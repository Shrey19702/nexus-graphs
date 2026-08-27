# Nexus Graph Visualizations

Interactive Canvas + D3 force graphs.

| View | Path |
|------|------|
| Hub | `/` — pick CJP / AP / STK / DNP |
| Profiles | `/platform-profiles/` (CJP accounts) |
| Themes | `/narratives-graph/?corpus=stk` |
| Report | `/reports-nexus/?corpus=stk` |

Corpora are registered in `shared/js/corpora.js`. Report images live in `images/<corpus>/` (not a shared folder).

## Local

```bash
python3 -m http.server
# or: ./run.sh
```

Then open http://localhost:8000/

## Report images

```bash
npm i
npx playwright install chromium
npm run generate-report-images              # all hubs
npm run generate-report-images -- stk       # one hub
```
