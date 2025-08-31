# Configuration Guide

Environment variables:
- STATE_DIR: Directory for state files (default: ./state)
- OUTPUTS_DIR: Directory for generated content (default: ./outputs)
- QDRANT_URL, QDRANT_COLLECTION
- EMBEDDINGS_PROVIDER (hash|openai), EMBEDDINGS_SIZE
- OPENAI_API_KEY (optional), ANTHROPIC_API_KEY (optional)

Active chapters:
- Use `config:chapters:set --file=PATH` to load a JSON definition.
- Inspect with `config:chapters:show`, clear with `config:chapters:clear`.
- Validation criteria per chapter are respected by coverage checks.

State options:
- Autosave interval is controlled in config; checkpoints kept are pruned automatically.
