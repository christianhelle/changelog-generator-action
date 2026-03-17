---
name: "project-conventions"
description: "Core conventions and patterns for this codebase"
domain: "project-conventions"
confidence: "medium"
source: "template"
---

## Context

> This repository exists to expose `chlogr` as a reusable public GitHub Action. The action should stay focused on orchestrating the CLI well — not re-implementing changelog generation logic in another language.

## Patterns

### Action Wrapper First

- Treat this repo as a thin integration layer around `chlogr`.
- Prefer passing well-documented inputs to the CLI over duplicating `chlogr` logic in wrapper code.
- Keep the action contract stable and public-facing: clear inputs, outputs, defaults, and failure messages.

### Error Handling

- Never log tokens or full command lines that include secrets.
- Fail with actionable messages that tell the user which input, permission, or external dependency is missing.
- Surface platform-specific execution failures clearly, especially when dealing with downloaded binaries.

### Testing

- Test the action behavior across Linux, Windows, and macOS runners.
- Prefer fixture-driven or mocked integration tests around CLI invocation and generated markdown output.
- Cover token precedence, missing-token failures, invalid repo input, and binary download/cache behavior.

### Code Style

- Keep wrapper code small, explicit, and boring.
- Separate action input parsing, command construction, binary resolution, and output handling.
- Prefer descriptive names that match GitHub Action concepts (`inputs`, `outputs`, `runner`, `cache`, `artifact`).

### File Structure

- `action.yml` at the repo root defines the public contract.
- `src/` (if using a JavaScript/TypeScript action) holds wrapper logic only.
- `test/` or `tests/` holds fixture-based and platform-oriented tests.
- `docs/` or README sections should contain copy-paste workflow examples and troubleshooting notes.
- `dist/` should be generated output only, never the source of truth.

## Examples

```
# Good: build a command line from action inputs, then run chlogr
# Avoid: re-implementing changelog grouping logic in the wrapper
```

## Anti-Patterns

- **Re-implementing `chlogr` features in the action** — The action should orchestrate the CLI, not fork its logic.
- **Assuming one runner OS** — Public actions must expect Windows, macOS, and Linux users.
- **Undocumented auth behavior** — Token precedence and required permissions must be explicit in docs and examples.
- **Floating binary behavior** — Be deliberate about how `chlogr` versions are selected, cached, and upgraded.
