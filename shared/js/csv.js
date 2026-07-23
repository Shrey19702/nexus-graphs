/** Shared CSV parser (RFC-style quoted fields). */

export function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    if (i >= len) return "";
    if (text[i] === '"') {
      i += 1;
      let out = "";
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            out += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        out += text[i];
        i += 1;
      }
      return out;
    }
    let out = "";
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") {
      out += text[i];
      i += 1;
    }
    return out;
  }

  function readRow() {
    const fields = [];
    if (i >= len) return null;
    while (i < len) {
      fields.push(readField());
      if (i >= len) break;
      if (text[i] === ",") {
        i += 1;
        continue;
      }
      if (text[i] === "\r") i += 1;
      if (text[i] === "\n") i += 1;
      break;
    }
    return fields;
  }

  const header = readRow();
  if (!header) return [];
  while (i < len) {
    if (text[i] === "\n" || text[i] === "\r") {
      i += 1;
      continue;
    }
    const fields = readRow();
    if (!fields || (fields.length === 1 && fields[0] === "" && i >= len)) break;
    const obj = {};
    for (let c = 0; c < header.length; c += 1) {
      obj[header[c]] = fields[c] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}
