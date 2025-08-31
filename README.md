# Lieferantenwechsel

State-first CLI for a resilient E‑Book generation workflow with checkpoints, recovery, and interactive sessions.

## Quickstart

1) Copy `.env.example` to `.env` and adjust if needed (defaults work offline).
2) Install deps and initialize state.

Commands

```bash
npm ci
npm run init               # initialize state
npm run status             # show current phase/status
npm run checkpoint         # manual checkpoint
npm run progress           # progress + ETA (if available)
npm run plan:progress      # percentage of completed items in PLAN.md
```

## Retrieval (Qdrant) and Decisions

- Vector search with hash embeddings (offline) or OpenAI embeddings (optional):
	- Search (merged vector + filter):
		- npm run qdrant:search-embed -- --term="ANMELD Nachricht"
		- Options: --alpha=0.7 --limit=10 --collection=<name>
	- Create a review decision for a chapter:
		- npm run qdrant:search-embed-decision -- --term="ANMELD Nachricht" --chapter=01-overview

Import sample data into Qdrant (NDJSON or JSON array):

```bash
npm run qdrant:import-sample -- --file=./uploads/sample.ndjson --collection=willi
```

## Embeddings

- Default: EMBEDDINGS_PROVIDER=hash (deterministic, offline)
- OpenAI: EMBEDDINGS_PROVIDER=openai and set OPENAI_API_KEY
	- Optional: OPENAI_EMBED_MODEL, OPENAI_BASE_URL

## Caches

- Query cache: state/search-cache/queries (TTL via QUERY_CACHE_TTL_SEC, default 3600s)
- Embedding cache: state/search-cache/embeddings (TTL via EMBEDDINGS_CACHE_TTL_SEC, default 86400s)
- Admin:
	- node src/cli.js cache:search:stats
	- node src/cli.js cache:search:clear

## Interactive and Generation

- Interactive session quick start:
	- npm run interactive
- Chat assistant (guided search + review + optional generation):
	- npm run interactive:chat
- Generate:
	- npm run generate:quick           # one section per chapter
	- npm run generate:all             # all sections
	- npm run generate:seeded          # seed retrieval decisions before generation

## Validation, Reports, Export

- All validations in one run:
	- npm run validate:all             # uses state + outputs validators and coverage
- Outputs report and coverage:
	- npm run outputs:report
	- npm run validate:coverage
- HTML export:
	- npm run export:html

### Cross-reference validation

Validate that all `[[ref:...]]` tokens in outputs resolve to existing anchors:

```bash
node src/cli.js outputs:crossrefs
```

## PLAN Fortschritt

Get completion from `PLAN.md` checkboxes:

```bash
npm run plan:progress
# -> { "total": 123, "done": 87, "percent": 71 }
```

## Tests and Qdrant note

Run all tests:

```bash
npm test
```

If Qdrant isn’t reachable in your environment, tests will skip the live smoke check unless you set:

```bash
QDRANT_STRICT=true npm test
```

## Environment

Key variables (see `.env.example`): QDRANT_URL, QDRANT_COLLECTION, EMBEDDINGS_PROVIDER/OPENAI_API_KEY, cache TTLs, AUTO_SAVE_INTERVAL, etc.

The defaults enable fully offline operation; Qdrant usage is optional but recommended.

## Docker

Optional: Container bauen und ausführen.

```bash
docker build -t lieferantenwechsel .
docker run --rm -v "$PWD/outputs":/app/outputs -v "$PWD/state":/app/state lieferantenwechsel
```

## CI

GitHub Actions Workflow `.github/workflows/ci.yml` führt die Tests auf Node 18/20/22 aus.

## Dokumentation

- API: `docs/api-documentation.md`
- Konfiguration: `docs/configuration-guide.md`
- Troubleshooting: `docs/troubleshooting.md`
