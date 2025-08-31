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

## Bezug zur App „Willi Mako“ (stromhaltig.de)

Dieses Open‑Source‑Projekt wurde im Rahmen der Anwendung „Willi Mako“ umgesetzt und nutzt dieselbe Wissensbasis, die in der hochoptimierten QDrant‑Collection der App verwendet wird.

- Website: https://stromhaltig.de/
- App: https://stromhaltig.de/app/

Hinweis: Obwohl der Code frei verfügbar ist, dient das Projekt auch als Showcase und Werbung für die kommerzielle App „Willi Mako“. Wenn du Zugriff auf die optimierte QDrant‑Collection der App hast, kannst du die Umgebungsvariable `QDRANT_URL` entsprechend setzen, um diese Wissensbasis direkt zu nutzen.

## Anleitung: E‑Book „Lieferantenwechsel aus Sicht der Marktkommunikation“ erstellen

Ziel: Ein vollständiges E‑Book vom Auftrag des Kunden bis zur Anfangsablesung samt relevanter Zwischenstati, basierend auf Inhalten aus der konfigurierten QDrant‑Collection. Das Buch ist für Beginner bis Experten geeignet (Template‑Levels unterstützt).

Voraussetzungen
- .env (oder Umgebungsvariablen) mit QDRANT_URL und QDRANT_COLLECTION (Inhalte sind bereits in der Collection vorhanden).
- Verzeichnisse `outputs/` und `state/` (werden bei Bedarf automatisch angelegt).

1) State initialisieren

```bash
npm ci
npm run init
npm run config:validate
```

2) Kapitelkonfiguration für den Prozessablauf setzen (vom Auftrag bis Anfangsablesung)

Erstelle eine Datei `chapters-lieferantenwechsel.json` mit den relevanten Prozessschritten. Levels steuern die Zielgruppe (beginner|intermediate|advanced|expert) und beeinflussen die verwendeten Templates.

Beispiel (auszugsweise):

```json
{
	"chapters": [
		{ "id": "01-overview", "title": "Überblick & Rollen", "level": "beginner", "sections": [
			"Akteure und Marktrollen", "Datenflüsse und Nachrichtenarten", "Prozessüberblick vom Auftrag bis Anfangsablesung"
		], "validationCriteria": { "requiredSections": 1 } },
		{ "id": "02-contract-conclusion", "title": "Vertragsschluss & Beauftragung", "level": "intermediate", "sections": [
			"Auftrag des Kunden", "Lieferbeginn und Fristen", "Stammdaten & Vertragsdaten"
		] },
		{ "id": "03-notification", "title": "ANMELD & Marktkommunikation", "level": "advanced", "sections": [
			"ANMELD Nachricht – Struktur", "Plausibilitäten & Ablehnungen", "Bestätigung & Zuordnung"
		] },
		{ "id": "04-switch-execution", "title": "Wechselvollzug", "level": "advanced", "sections": [
			"Zeitliche Abwicklung", "Zuordnung an MSB/NNB", "Start der Belieferung"
		] },
		{ "id": "05-metering", "title": "Messwesen", "level": "expert", "sections": [
			"Anfangsablesung", "Zählerstände & Ableseprozesse", "Sonderfälle (iMSys/SLP/RLM)"
		] },
		{ "id": "06-billing", "title": "Abrechnung & Stammdatenpflege", "level": "intermediate", "sections": [
			"Stammdatenabgleich", "Netz- und Lieferabrechnung – Grundlagen"
		] },
		{ "id": "07-quality", "title": "Qualität & Prüfungen", "level": "advanced", "sections": [
			"Plausibilitäten", "Fehlerbilder & Korrekturen"
		] },
		{ "id": "08-appendix", "title": "Anhang", "level": "beginner", "sections": [
			"Glossar", "Referenzen"
		] }
	]
}
```

Aktivieren:

```bash
node src/cli.js config:chapters:set --file=./chapters-lieferantenwechsel.json
node src/cli.js config:chapters:show
```

3) Recherche aus QDrant vorbereiten (optional, empfohlen)

Variante A: Automatisch Seed‑Queries pro Kapitel anlegen (falls `config/search-queries` gepflegt ist):

```bash
npm run seed:all
```

Variante B: Manuell pro Kapitel Suchentscheidungen erstellen (z. B. für ANMELD):

```bash
node src/cli.js qdrant:search-embed-decision --term="ANMELD Nachricht" --chapter=03-notification
node src/cli.js qdrant:search-embed-decision --term="Anfangsablesung" --chapter=05-metering
```

4) Interaktive Kuratierung (optional) oder Batch‑Generierung

- Interaktiv, stateful Workflow (Review + Kapitel‑Generierung):

```bash
node src/cli.js interactive:workflow --chapter=03-notification
```

- Chat‑Assistent (geführte Suche + Auswahl + Generierung):

```bash
npm run interactive:chat
```

- Batch‑Generierung (alle Kapitel, limitierbar):

```bash
npm run generate:all -- --sections-limit=1
```

5) Validierung & Qualitätssicherung

```bash
# Gesamtvalidierung (State, Outputs, Coverage, Crossrefs aggregiert)
npm run validate:engine

# Cross‑References prüfen
npm run outputs:crossrefs

# Coverage vs. Kapitel‑Konfiguration
npm run validate:coverage -- --min=1

# Qualitätsanalyse (Heuristiken)
npm run outputs:report
```

Optional: Smart Regeneration zur Anhebung zu kurzer/quellearmer Abschnitte

```bash
node src/cli.js regenerate:smart --min=0.8 --chapter=05-metering --max=2
```

6) Export

```bash
# Markdown‑Bundle mit ToC und Cross‑Refs
npm run export:bundle -- --title "Lieferantenwechsel" --to ./outputs/bundle/book.md

# HTML‑Export
npm run export:html -- --title "Lieferantenwechsel" --to ./outputs/bundle/book.html
```

Hinweise zur Zielgruppen‑Aufbereitung (Beginner → Experte)
- Das Template‑System nutzt pro Kapitel `level` (beginner/intermediate/advanced/expert), um Stil/Tiefe zu variieren.
- Für unterschiedliche Zielgruppen kannst du mehrere Konfigurationen anlegen (z. B. `chapters-beginner.json`, `chapters-expert.json`) und jeweils separat generieren/exportieren.
- Inhalte aus QDrant werden interaktiv kuratiert; priorisiere je Level unterschiedliche Chunk‑Typen/Schlüsselbegriffe bei der Suche.

