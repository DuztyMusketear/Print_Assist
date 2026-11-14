# Production overview and virtual printers

## Goal and ownership

Build a working vertical slice for order scheduling, three virtual printers and
monitoring. The operator lands on an overview of printer status and scheduled
work. The partner owns AI models for model preparation, review and supports;
this slice consumes operator-provided print-ready artifact references and does
not implement or invoke those models.

## Approach

The selected approach connects the dashboard to a real deterministic simulation
from the start. A dashboard shell with sample data was considered; it would
produce visuals sooner but defer operational behavior and integration. The
existing React, FastAPI and SQLite stack remains in place.

## Operator experience

- **Overview** is the landing tab: show three printer cards, current jobs,
  progress, statuses and a concise scheduling/queue summary.
- **Orders** retains order intake and the existing queue.
- **Printers** shows the virtual floor, each printer's material and capabilities,
  and available controls.
- **Schedule** shows pending work, assignment outcomes and any incompatibility
  or insufficient-material explanation. Clearly identify all equipment and
  production data as simulated.
- Scheduled work automatically starts when an eligible printer is available.
  The operator can instead choose manual start for work they wish to control;
  that work remains pending until the operator starts it. Both paths use the
  same validation and report conflicts or unavailable resources visibly.

## State and safety

The backend owns printer, job, queue and simulation state. Seed three independent
printers with explicit capabilities and material. A print attempt represents one
requested item; successful quantities are counted once. Scheduling considers
availability, capabilities, material type/color and quantity, priority, and
production due time with deterministic tie-breaking. Do not double-book a
printer or reserve the same material twice. Invalid or stale commands have no
partial effects. The clock and print progression remain deterministic, with no
agent invocation. Restart retains manufacturing state but pauses the simulation
and turns agent controls off.

Reuse the existing session, revision, idempotency and transactional persistence
boundaries. Extend typed API snapshots and generate frontend types from the
schema. Existing order data must remain readable when printer state is added.
Use a single simulation owner. The exact command and migration shapes are
implementation decisions to document in the plan and test before coding.

## AI boundary

AI assistance is outside this slice. Future recommendations must go through the
same typed, deterministic validation as manual operations; no provider SDK,
credential, live call or autonomous agent is needed for the dashboard or
simulation. Agree on any shared integration contract with the partner before
either side depends on it.

## Verification and delivery

Use test-first development for scheduling, concurrent assignments, material
accounting, progression, manual/automatic starts, persistence and restart.
Cover dashboard tabs, printer statuses, errors and the request-to-print workflow
with offline component, API and browser tests. Verify stale responses and
session changes, and retain the repository's coverage gates and network-deny
checks. Run the full offline suite and coverage from the repository root; update
the knowledge and code maps alongside implementation. Build on a feature branch
and review before integration into main.

Fault recovery, physical printer control, live inference and model generation
remain subsequent work. The exact styling and scheduling interaction can be
refined during implementation without changing these behaviors.
