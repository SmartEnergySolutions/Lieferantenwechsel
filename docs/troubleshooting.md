# Troubleshooting Guide

Common issues:
- QDrant unreachable: tests that depend on QDrant are skipped; ensure QDRANT_URL is set and reachable.
- Missing outputs/state dirs: run `config:validate` to let the CLI ensure directories exist.
- Cross-references unresolved: run `outputs:crossrefs` to validate, fix anchors or references.
- Validation errors: use `validate:engine` for a combined report.

Logs:
- CLI prints JSON results for many commands; use `jq` to filter.
- State checkpoints are in `state/checkpoints`.
