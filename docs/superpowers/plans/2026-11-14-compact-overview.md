# Compact overview layout

User approves structure/density from the handoff, preserving interactive 3D.
Use existing SPEC 6-7/12 and UI contracts. Execute inline with TDD.

- Compact 76px header with simulation clock/actions; navigation and optional
  workflow disclosure occupy one toolbar. Preserve all tab/control semantics.
- Desktop 1720px maximum layout: primary floor above queue/activity split;
  345px sidebar holds scenario reset and an honest future-orchestration note.
- One selected-printer telemetry strip under the floor. Remove repeated metrics
  from overview cards; retain inspector controls and detailed view capabilities.
- Compact production table keeps model/quantity/deadlines/forecast plus printer
  and job references. Bounded activity/queue scrolling; responsive stack <=760px.
- Tests first for table and structure, then existing full offline coverage,
  browser identity/layout/responsiveness, docs/map and review. No backend changes.

## Review corrections

Shared selection is hoisted to App so switching between Overview and Printers
retains the chosen station. Camera controls in a selected card no longer reset
its example-preview toggle; reset occurs only on changing the selected station.
Focused regressions cover both. Browser planning steps pause the simulated clock
between mutations so layout tests do not depend on tick/command timing.

Compact overview verification (2026-11-14):
`.venv\Scripts\python.exe scripts/check.py coverage` passed 71 backend,
125 frontend and 9 browser tests at 100% statement/branch coverage; schema drift
and production build passed. Browser checks verify 76px desktop header, floor and
sidebar placement, lower-panel alignment, single selected telemetry strip,
cross-tab station selection, camera disclosure persistence, tablet stacking and
390px mobile overflow. Desktop/mobile screenshots were inspected locally.
Interactive 3D and manual/automatic workflows remain covered. Existing Vite
bundle advisory remains; no agent or physical printer execution occurred.
