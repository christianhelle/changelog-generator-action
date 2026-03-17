# Squad Team

> changelog-generator-action

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Morpheus | Lead / Action Architect | `.squad/agents/morpheus/charter.md` | ✅ Active |
| Trinity | Action Runtime Engineer | `.squad/agents/trinity/charter.md` | ✅ Active |
| Tank | Release & Distribution Engineer | `.squad/agents/tank/charter.md` | ✅ Active |
| Switch | QA & Compatibility Engineer | `.squad/agents/switch/charter.md` | ✅ Active |
| Link | Docs & Marketplace Engineer | `.squad/agents/link/charter.md` | ✅ Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Test coverage for well-defined action behavior
- README and example workflow updates
- Dependency updates, version bumps, and workflow maintenance
- Small scaffolding tasks following established patterns

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- Medium wrapper features with clear acceptance criteria
- Refactoring action internals with existing tests
- Marketplace polish that touches multiple files

**🔴 Not suitable — route to squad member instead:**
- Action contract and UX design
- Binary distribution strategy for `chlogr`
- Security-sensitive token and permissions changes
- Cross-platform execution architecture
- Ambiguous product decisions or public API changes

## Project Context

- **Owner:** Christian Helle
- **Stack:** GitHub Actions metadata/workflows; wrapper layer TBD (likely JavaScript/TypeScript or composite action); native `chlogr` Zig CLI; cross-platform release automation
- **Description:** A reusable public GitHub Action that generates changelogs by wrapping the `chlogr` CLI.
- **Project:** changelog-generator-action
- **Created:** 2026-03-17
