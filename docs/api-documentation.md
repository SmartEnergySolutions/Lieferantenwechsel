# API Documentation (Overview)

This document summarizes the main modules and CLI commands.

Modules:
- State: `src/state/state-manager.js`, `src/state/state-validator.js`, `src/state/outputs-validator.js`, `src/state/coverage-validator.js`
- Generation: `src/generation/template-engine.js`, `src/generation/gemini-client.js`, `src/generation/claude-client.js`
- Core: `src/core/validation-engine.js`, `src/core/ebook-generator.js`, `src/core/chapter-processor.js`, `src/core/smart-regeneration.js`
- Interactive: `src/interactive/chat-interface.js`, `src/interactive/interactive-workflow.js`, `src/interactive/session-manager.js`, `src/interactive/session-persistence.js`
- Retrieval: `src/retrieval/qdrant-client.js`, `src/retrieval/embeddings.js`, `src/retrieval/search-strategies.js`, `src/retrieval/content-analyzer.js`
- Export: `src/export/bundle.js`, `src/export/html.js`, `src/export/json.js`, `src/export/crossrefs.js`

Key CLI commands (see `src/cli.js`):
- State: `init`, `status`, `checkpoint`, `resume`, `recover:smart`, `state:checkpoints`, `state:cleanup`, `state:validate`, `validate:*`
- Outputs: `outputs:list`, `outputs:report`, `outputs:quality`, `outputs:crossrefs`, `outputs:coverage`
- Generation: `generate:section`, `generate:chapter`, `generate:all`, `process:chapter`, `regenerate:smart`
- Interactive: `interactive`, `interactive:chat`, `interactive:workflow`, `session:*`, `sessions:*`
- Retrieval: `qdrant:*`
- Export: `export:bundle`, `export:html`, `export:json`
- Config: `config:*`

See source files for detailed method signatures.