#!/usr/bin/env python3
"""Append moderation CSV posts into the Nexus graph JSON and Nexus_Posts.csv."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_GRAPH = SCRIPT_DIR / "graph2_parent_topic_topic.json"
DEFAULT_POSTS = SCRIPT_DIR / "Nexus_Posts.csv"

POSTS_COLUMNS = [
    "post_id",
    "mongo_id",
    "url",
    "profile_url",
    "content_snippet",
    "post_narrative",
    "input_keyword",
    "is_relevant_to_poi",
    "is_relevant_to_secondary_poi",
    "subjects",
    "parent_topic",
    "topic",
    "subtopic",
    "violations_str",
    "speech_type",
    "protected_expression",
    "stance",
    "tone",
    "polarity",
    "negative_score",
]


def parent_topic_id(name: str) -> str:
    return f"parent_topic_{name}"


def topic_id(name: str) -> str:
    return f"topic_{name}"


def post_id_node(post_id: str) -> str:
    return f"post_{post_id}"


def load_graph(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_existing_post_ids(posts_path: Path) -> set[str]:
    if not posts_path.exists():
        return set()
    with posts_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return set()
        return {row["post_id"] for row in reader if row.get("post_id")}


def validate_columns(fieldnames: list[str] | None) -> None:
    if fieldnames is None:
        raise SystemExit("Input CSV has no header row.")
    missing = [c for c in POSTS_COLUMNS if c not in fieldnames]
    if missing:
        raise SystemExit(f"Input CSV missing required columns: {missing}")


def ensure_parent_topic(graph: dict, node_ids: set[str], name: str) -> bool:
    nid = parent_topic_id(name)
    if nid in node_ids:
        return False
    graph["nodes"].append(
        {
            "id": nid,
            "type": "parent_topic_node",
            "label": f"Parent Topic: {name}",
        }
    )
    node_ids.add(nid)
    return True


def ensure_topic(graph: dict, node_ids: set[str], name: str) -> bool:
    nid = topic_id(name)
    if nid in node_ids:
        return False
    graph["nodes"].append(
        {
            "id": nid,
            "type": "topic_node",
            "label": f"Topic: {name}",
        }
    )
    node_ids.add(nid)
    return True


def ensure_link(
    graph: dict,
    link_set: set[tuple[str, str]],
    source: str,
    target: str,
) -> bool:
    key = (source, target)
    if key in link_set:
        return False
    graph["links"].append({"source": source, "target": target})
    link_set.add(key)
    return True


def topic_parent_map(graph: dict) -> dict[str, str]:
    """Map topic name -> parent topic name from existing parent→topic links."""
    mapping: dict[str, str] = {}
    for link in graph["links"]:
        src, tgt = link["source"], link["target"]
        if src.startswith("parent_topic_") and tgt.startswith("topic_"):
            mapping[tgt[len("topic_") :]] = src[len("parent_topic_") :]
    return mapping


def append_data(
    csv_path: Path,
    graph_path: Path,
    posts_path: Path,
    dry_run: bool = False,
) -> None:
    graph = load_graph(graph_path)
    node_ids = {n["id"] for n in graph["nodes"]}
    link_set = {(l["source"], l["target"]) for l in graph["links"]}
    existing_posts = load_existing_post_ids(posts_path)
    # Also treat posts already in the graph as present
    for nid in node_ids:
        if nid.startswith("post_"):
            existing_posts.add(nid[len("post_") :])

    parent_of_topic = topic_parent_map(graph)

    with csv_path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        validate_columns(reader.fieldnames)
        rows = list(reader)

    posts_added = 0
    posts_skipped = 0
    new_parent_topics = 0
    new_topics = 0
    warnings: list[str] = []
    rows_to_append: list[dict[str, str]] = []
    seen_in_batch: set[str] = set()

    for i, row in enumerate(rows, start=2):
        post_id = (row.get("post_id") or "").strip()
        parent_topic = (row.get("parent_topic") or "").strip()
        topic = (row.get("topic") or "").strip()

        if not post_id or not parent_topic or not topic:
            warnings.append(
                f"line {i}: skipping row with empty post_id/parent_topic/topic"
            )
            posts_skipped += 1
            continue

        if post_id in existing_posts or post_id in seen_in_batch:
            posts_skipped += 1
            continue

        if ensure_parent_topic(graph, node_ids, parent_topic):
            new_parent_topics += 1
        if ensure_topic(graph, node_ids, topic):
            new_topics += 1

        existing_parent = parent_of_topic.get(topic)
        if existing_parent is not None and existing_parent != parent_topic:
            warnings.append(
                f"line {i}: topic '{topic}' already under parent "
                f"'{existing_parent}', keeping existing link "
                f"(CSV parent was '{parent_topic}')"
            )
        else:
            ensure_link(
                graph,
                link_set,
                parent_topic_id(parent_topic),
                topic_id(topic),
            )
            parent_of_topic[topic] = parent_topic

        pid = post_id_node(post_id)
        graph["nodes"].append(
            {
                "id": pid,
                "type": "regular_node",
                "label": f"Post: {post_id}",
            }
        )
        node_ids.add(pid)
        ensure_link(graph, link_set, topic_id(topic), pid)

        out_row = {col: row.get(col, "") for col in POSTS_COLUMNS}
        rows_to_append.append(out_row)
        seen_in_batch.add(post_id)
        existing_posts.add(post_id)
        posts_added += 1

    print(f"Input rows:           {len(rows)}")
    print(f"Posts added:          {posts_added}")
    print(f"Posts skipped:        {posts_skipped}")
    print(f"New parent topics:    {new_parent_topics}")
    print(f"New topics:           {new_topics}")
    print(f"Graph nodes (after):  {len(graph['nodes'])}")
    print(f"Graph links (after):  {len(graph['links'])}")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  - {w}")
        if len(warnings) > 20:
            print(f"  ... and {len(warnings) - 20} more")

    if dry_run:
        print("Dry run — no files written.")
        return

    with graph_path.open("w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)
        f.write("\n")

    write_header = not posts_path.exists() or posts_path.stat().st_size == 0
    with posts_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=POSTS_COLUMNS, lineterminator="\n")
        if write_header:
            writer.writeheader()
        for row in rows_to_append:
            writer.writerow(row)

    print(f"Updated graph: {graph_path}")
    print(f"Appended posts: {posts_path} (+{posts_added} rows)")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Append a moderation CSV into graph2_parent_topic_topic.json "
            "and Nexus_Posts.csv."
        )
    )
    parser.add_argument(
        "--csv",
        required=True,
        type=Path,
        help="Path to new moderation output CSV",
    )
    parser.add_argument(
        "--graph",
        type=Path,
        default=DEFAULT_GRAPH,
        help=f"Graph JSON path (default: {DEFAULT_GRAPH})",
    )
    parser.add_argument(
        "--posts",
        type=Path,
        default=DEFAULT_POSTS,
        help=f"Nexus_Posts.csv path (default: {DEFAULT_POSTS})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary without writing files",
    )
    args = parser.parse_args(argv)

    if not args.csv.exists():
        raise SystemExit(f"CSV not found: {args.csv}")
    if not args.graph.exists():
        raise SystemExit(f"Graph JSON not found: {args.graph}")

    append_data(args.csv, args.graph, args.posts, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
