# Orchestrator sidebar implementation plan

**Spec:** [Unified controls and signed-in assistant design](../specs/2026-11-14-orchestrator-sidebar-design.md).
Preserve existing local feature work; no commit/merge/push or live model execution.

- [x] Backend TDD: isolated OAuth/connection/read-only chat adapter, maintained JWT
  verification, bounded official Responses stream transport and offline auth tests.
- [x] Frontend TDD: one Scenario controls surface with event/reset, Orchestrator chat
  and truthful Agent network; stable retries, connection and error states.
- [x] Integrate API mount, schema/types and App composition; preserve existing
  workflow/reset and exact production command behavior.
- [x] Independent security/reliability review; resolve findings with regressions.
- [x] Full root offline coverage/schema/build/browser checks; desktop/mobile preview.
- [x] Update code map, setup/runbook/spec/backlog and record client registration limits.


Final tree: root scripts/check.py coverage passed 289 backend + 357 frontend +
28 browser tests (674 total), 100% application coverage, schema, TypeScript/build.
Independent review findings for scope/resource/replay/reset and live-clock boundaries
were fixed with offline regressions. Callback access logging is redacted; distinct
sidebar component identities and explicit failed-message discard are covered.
The final preview uses the same saved database and has no implicit reset; no printers
were active before API restart. Desktop/mobile inspection has no horizontal overflow
or page errors. Registered-client setup remains required; no live account login or
provider inference was executed by development. Existing Vite bundle warning remains.
