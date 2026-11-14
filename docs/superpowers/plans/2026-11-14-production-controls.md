# Production controls and scenario reset

> Execute inline using superpowers:executing-plans and test-driven development.

**Scope:** Next deliverable for PA-201/202/203: printer pause, resume, offline,
online, scenario reset and entity-linked production events. Configurable automatic
clock execution, future schedule proposals/estimates and temperature telemetry
remain subsequent backlog work; do not mark PA-202/303 fully complete here.

**Requirements:** SPEC sections 6-7, 10 and 12; MVP plan Task 2; current backlog
PA-201/202/203. Preserve authoritative SQLite transactions, offline behavior,
session/revision/idempotency guards and the existing STL/modeling integration.

## Decisions and interfaces

- `POST /api/printers/control`: typed envelope containing printer ID and
  `pause | resume | offline | online`. Pause/offline preserve the attempt and
  consumed filament. Online returns held work to paused; resume is explicit.
  Previously pending manual work remains pending when the printer resumes.
- Never clear faulted/unknown equipment through these controls. Recheck printer
  requirements and remaining filament before restarting an actual print.
- `POST /api/scenarios/reset`: typed envelope selecting `empty | seeded`.
  Reset replaces orders, jobs, inventory, activity, modeling tasks and custom
  artifacts with the selected deterministic baseline. Repository STL files are
  unaffected. UI requires explicit acknowledgment of the replacement.
- Reset changes session, revision restarts at zero, clock is paused and agent
  flags are off. Keep only a reset receipt in command storage so an exact lost-
  response retry can replay safely, but cannot replay into a later reset session.
- Existing order events stay readable. Extend event schema with optional printer,
  job and order references, source, status and explanation. Record assignments,
  blocked scheduling, controls and completions without recording every tick.
- Expose readable event history and blocked reasons. Reset invalidates in-flight
  UI responses; production retries retain the original envelope and expose an
  explicit retry control. Do not automatically confirm a destructive UI reset.

## Implementation

1. Backend tests first: pure controls freeze progress/material, valid resume,
   offline exclusion, pending-work preservation, unsafe/invalid transitions,
   scheduling reasons/events, repeatable scenarios and material safety. Implement
   focused controls/activity modules and extend simulation/scheduling.
2. API/storage tests first: typed payload rejection, conflicts, replay,
   concurrency, atomic reset, old-session commands and repeated-reset receipts.
   Reuse the service transaction boundary and regenerate frontend types.
3. Component/browser tests first: controls on selected printer, activity messages,
   reset selection/acknowledgment, uncertain retries and late responses across
   reset. Keep Overview free of order entry; preserve printer views and Modeling.
4. Run root full and coverage checks; review the feature; update maps, backlog,
   actual results and remaining work. Keep changes on this task branch for review.

## Review focus

- Busy printer taken offline cannot progress, lose its attempted quantity, or
  allow its material/job reservation to be reassigned.
- Reset replay must not replace newer manufacturing state or accept any stale
  pre-reset work, even when its response is lost.
- Late reads and mutation responses cannot restore a retired session in the UI.
- Unknown/faulted printer states cannot become available via generic controls.
- Material accounting and successful quantities stay deterministic across pauses.

## Delivery evidence - 2026-11-14

All four implementation steps are complete on `feat/production-controls`, pending
integration. Read-only review identified late order/model replies clearing newer
retry keys and late scheduling replies overwriting newer errors. Failing
regressions reproduced both; request ownership and sequence checks resolve them.
Concurrent scheduling and reset accept only one competing mutation; reset removes
custom data, restores inventory and turns running/agent flags off.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed 61 backend,
91 frontend and 6 browser tests, 100% backend/frontend statement and branch
coverage, schema drift and production build checks. This command includes all
full-suite stages. Browser checks used real Chromium/WebGL and intentional GPU
failure fallback; no live models or physical printers ran.

PA-201 and PA-203 acceptance behavior is implemented on this branch. PA-202 still
requires the single-owner accelerated run/pause clock; PA-303 still requires
automatic refresh and temperature telemetry. Follow those with schedule
proposals/reservations and completion/deadline estimates under PA-301/302.
