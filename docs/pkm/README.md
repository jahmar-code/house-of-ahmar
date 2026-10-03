---
title: Documentation conventions
summary: How to read and maintain the House knowledge vault.
source:
  - AGENTS.md
  - agents/README.md
verified: 2026-10-03
tags: [docs, workflow]
---

# Documentation conventions

This vault is the project's persistent engineering memory. Open it in Obsidian or follow ordinary Markdown links from [Home](Home.md). No editor plugin is required.

## Structure

- `00-overview`: purpose, vocabulary, and repository orientation.
- `10-architecture`: cross-cutting boundaries, privacy, and design.
- `20-domains`: the actual product areas and their invariants.
- `30-flows`: end-to-end requests spanning domains.
- `40-reference`: lookup tables for routes, actions, data, and configuration.
- `50-operations`: setup, verification, release, recovery, and agent work.

## Provenance and updates

Every note carries `title`, `summary`, `source` (repository-relative paths), `verified` (ISO calendar date), and `tags`. A `verified` stamp means substantive source claims were checked against those paths. It does **not** mean the app or remote project was executed. Execution evidence lives under `docs/audits/` with its environment and result.

1. Find notes affected by source changes: `rg -l 'src/path/to/file' docs/pkm`.
2. Read the source and amend behavior, caveats, and tests together.
3. Re-stamp only notes actually re-verified. Leave a dated partial-review note if the entire source set was not re-read.
4. Link each new note from Home and at least one relevant neighbor. Use ordinary relative Markdown links so the repository browser works; optional wikilinks must resolve uniquely.
5. Refer to files and symbols, not frozen line numbers. Prefer commands that derive inventories over unsupported counts.
6. Run the repository documentation check when available and inspect links. Mechanical checks catch missing paths and metadata, not incorrect prose.

Use present tense for implementation and explicitly mark proposals, unmet preconditions, and historical behavior. Record decisions with their consequences. Avoid copying the same schema or permission matrix into multiple documents; link to the canonical table.
