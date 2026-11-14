# Fault management and dynamic rescheduling implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the user's preferred
> continuous inline development. Use test-first steps and a final independent review.

**Goal:** Isolate simulated faults and recover approved outstanding work with durable
part/order impact reporting and a repeatable dashboard demonstration.

**Architecture:** Extend pure state transitions behind FactoryService's current
transaction/session/revision/idempotency boundary. Keep the existing scheduler and
material ledger authoritative; add focused incident, recovery and impact projections.

**Tech stack:** Existing Python/FastAPI/Pydantic/SQLite and React/TypeScript/CSS;
pytest, Vitest and Playwright. No new service, LLM call or runtime dependency.

**Spec:** [Fault/recovery design](../specs/2026-11-14-fault-recovery-design.md),
[product requirements](../../../SPEC.md#faults-and-recovery), PA-401/402/403 in the
[backlog](../../backlog.md#phase-4--faults-and-recovery).

## Starting point and constraints

- Dashboard checkpoint: local commit `7177a76`, based on `1dec51f`.
- Start implementation on `feat/fault-recovery` from the committed planning branch;
  inspect status first and preserve unrelated work. No merge/push is authorized.
- Baseline root coverage verification: 119 backend + 229 frontend + 18 browser tests
  (366 total), 100% application coverage, schema/build passing.
- All behavior remains offline, deterministic, and explicitly simulated. No live
  agents, model endpoints, collaborators, remote repositories or credentials.
- Safety precedes planning. Review is default; automatic simulation policy is an
  explicit separate opt-in and never clears faulty equipment.
- Each task updates its inspected source/test responsibilities and graph edges in
  docs/code-map.md and actual verification evidence in docs/development.md.
- Planned files below are proposed responsibilities, not existing implementation.

## Review focus

1. Repeated fault/recovery delivery, two simultaneous approvals and reset/restart
   cannot duplicate output, stock use, incidents or replacements (Tasks 1, 3, 5).
2. Exhaustion partway through a clock interval stops only affected equipment and
   preserves healthy progress/completed output; waste is not a stock refund (Tasks 1-2).
3. Manual starts and previously unapproved held quantities cannot be silently
   converted into approved automatic production (Tasks 3-4).
4. A partial/blocked plan cannot claim order completion, and healthy queued orders'
   indirect delays cannot disappear from comparisons (Tasks 2-3, 5).
5. Short mobile timeline bars, stale confirmations and persisted incident history
   remain understandable and keyboard accessible with agents off (Tasks 4-5).

## Task 1: Persist and safely isolate incidents

**Create:** `backend/print_assist/incidents.py`,
`backend/tests/unit/test_incidents.py`,
`backend/tests/integration/test_incident_commands.py`.

**Modify:** `contracts.py`, `service.py`, `api.py`, `scenarios.py`, `controls.py`,
`scheduling.py`, `proposals.py`
under `backend/print_assist/`, and `docs/code-map.md`.

**Interfaces:** `inject_fault(state: dict, payload: dict) -> dict` and
`clear_fault(state: dict, payload: dict) -> dict`, both pure. Add typed fault/clear
commands and additive incident/recovery-policy snapshot defaults. Route commands
through `_transition`; persist using Store's existing snapshot transaction.

- [x] Write failing tests for each of five faults on varied active printer IDs;
  assert immediate isolation, unchanged healthy jobs, unchanged successful quantity,
  interrupted failure/waste and unstarted queue holds. Assert no consumed-stock refund.
- [x] Add repeated source-event/idempotency tests, duplicate open fault rejection,
  invalid printer/type/clearance, session/revision conflicts, restart history and
  legacy snapshot upgrade tests. Stock correction and printed waste remain distinct.
- [x] Add hold-bypass regressions: clock ticks, ordinary automatic/manual scheduling,
  normal proposal application, manual start and printer resume/online must not
  recreate or start incident-owned held parts. Healthy unheld existing work continues.
- [x] Run the targeted unit/integration tests and verify intended failures.
- [x] Implement safe transitions, persistent evidence/diagnosis and incident actions.
  Capture pre-isolation state once; keep faulted equipment unavailable to normal
  pause/resume/online/start commands until valid explicit simulated clearance.
  Record per-part owning incident IDs; generic schedule review cannot clear these
  holds, and approved recovery authorization is scoped to its enumerated parts.
- [x] Run affected tests and root schema generation/check as contracts change;
  record results and commit a focused local change.

## Task 2: Forecast impacts and detect boundary faults

**Create:** `backend/print_assist/schedule_impact.py`,
`backend/tests/unit/test_schedule_impact.py`.

**Modify:** `simulation.py`, `monitoring.py`, `reservations.py`, `incidents.py` and
their tests; add integration assertions in `test_incident_commands.py`.

**Interfaces:** `capture_schedule(state: dict) -> dict` produces timestamped part/job
slots and complete/unknown per-order estimates; `compare_schedules(before: dict,
after: dict) -> dict` produces per-part and per-order deltas and assignment changes.
`refresh_incidents(state: dict) -> dict` records recovery outcomes without rewriting
immutable before/applied comparisons.

- [x] Write failing tests for interrupted and queued part timelines, completed parts,
  split customer orders, indirect queue delays, unchanged healthy active attempts,
  positive/negative/unknown changes, late/unavailable completion and explicit UTC.
- [x] Write a failing boundary test: one printer exhausts its remaining stock halfway
  through an advance, another completes normally, stock never becomes negative,
  exactly one incident is created and no failed item counts as successful output.
- [x] Implement projections using existing saved estimates/current reservations;
  never derive whole-order completion from only the currently visible partial jobs.
- [x] Split advancement at completion/material exhaustion boundaries; send generated
  faults through deterministic isolation, then continue healthy work. Preserve
  original thermal/connection evidence alongside isolated current telemetry.
- [x] Verify targeted tests, remaining material ledger consistency and root coverage
  before the focused local commit.

## Task 3: Validate and atomically apply recovery

**Create:** `backend/print_assist/recovery.py`,
`backend/tests/unit/test_recovery.py`,
`backend/tests/integration/test_recovery_workflow.py`.

**Modify:** `proposals.py`, `scheduling.py`, `incidents.py`, `contracts.py`,
`service.py`, `api.py`, `scenarios.py` and relevant existing tests.

**Interfaces:** `propose_recovery(state: dict, incident_id: str) -> dict` is read-only;
`apply_recovery(state: dict, payload: dict) -> dict` validates the exact fingerprint;
`reject_recovery(state: dict, payload: dict) -> dict` retains isolation/history;
`set_recovery_policy(state: dict, payload: dict) -> dict` controls simulation-only
automation. Add corresponding typed proposal, command and response models.

- [x] Write failing tests for moved unstarted queues, full-duration replacements,
  retry lineage across another fault, split orders and successful-count invariants.
  Healthy running/paused work is immutable; movable healthy queues may change.
- [x] Fault two printers on the same order before applying either proposal. Each
  proposal recovers only its incident-owned parts; apply/reject/clear of one cannot
  release the other hold or omit waste/history. Shared-order completion stays unknown
  until all required parts are resolved, and a new fault invalidates old previews.
- [x] Test priority/deadline ordering, renamed printers, capability/type/color mismatch,
  reserved stock, unavailable printers, no-feasible escalation, partial and late
  review, and inclusion of indirectly affected orders in comparisons.
- [x] Test stale fingerprint/session/revision, reset with reused IDs, idempotent
  retries, simultaneous conflicting apply and rollback of all reservations/jobs/report
  changes if validation fails. Preview must not mutate state.
- [x] Test review-default and automatic-opt-in behavior separately from agent controls;
  only complete compatible on-time approved automatic work can apply without review.
  Manual work/held quantities remain gated; unsafe printer clearance is never automatic.
- [x] Implement a deterministic planner adapter that excludes unsafe equipment,
  preserves approved quantity bounds/active jobs, retains unstarted part identity,
  creates linked replacement attempts and produces complete schedule comparisons.
- [x] Apply all assignments, reservations, order holds, incident actions and schedule
  changes atomically. Preserve per-order manual/automatic mode and planned queue
  sequence. Dispatch automatic work when healthy compatible printers become free.
- [x] Verify tests, schema/coverage and transactional restart behavior, then commit.

## Task 4: Dashboard incidents, impact and recovery controls

**Create:** `frontend/src/components/IncidentPanel.tsx`,
`frontend/src/components/IncidentPanel.test.tsx`.

**Modify:** `frontend/src/App.tsx`, `api.ts`, generated `types.ts`, `styles.css`,
`printers/PrinterFloor.tsx`, `printers/viewModel.ts`, `components/PrintTimeline.tsx`
and their inspected tests. Keep shared typed production command handling.

**Interfaces:** `IncidentPanel` consumes Snapshot and a shared guarded production
command callback; it presents selected incident/report and recovery proposal/actions.
Injection uses the selected printer ID and source event ID; clearance/recovery use
incident IDs. No controls use hardcoded printer IDs or scenario outcomes.

- [x] Write failing component tests for injection on selected active equipment,
  visible safety isolation, incident history, deterministic summary source, direct
  and indirect impacts, original/revised assignments/ETAs, deltas, waste and risks.
- [x] Test unknown/partial completion, blocked mitigations, rejection, automatic-policy
  restrictions, repair/refill validation and recovered-work progress independently
  from equipment clearance. Verify key order-color/status labels remain visible.
- [x] Test stale confirmation after ticking/reset, loading/errors, focus traversal,
  keyboard access and source revision forwarding. Review while the clock is paused
  should be straightforward; global pause must be explicit, not fault containment.
- [x] Implement compact Overview summaries with a selected incident detail view;
  show before/after tables, outstanding actions and persistent history. Add clear
  simulated injection/repair controls to printer details and updated fault visuals.
- [x] Show a concise deterministic operational/business summary in panel and activity;
  label its source without pretending an LLM or orchestrator was invoked.
- [x] Run relevant Vitest tests/coverage and build, inspect desktop/mobile density,
  update maps/docs and commit locally.

## Task 5: Repeatable fault-to-completion demonstration

**Create:** `tests/e2e/fault-recovery.spec.ts`.

**Modify:** `docs/backlog.md`, `docs/development.md`, `SPEC.md`,
`docs/code-map.md`, `docs/knowledge-map.md` and evidence for PA-401/402/403.

- [x] Add a browser workflow that starts real simulated jobs, advances enough to
  consume stock, injects a fault, verifies immediate local isolation and healthy
  progress, reviews direct/indirect impacts, applies recovery and completes exactly
  the requested quantities. Verify failure history/waste and no duplicate output.
- [x] Add automatic-policy, blocked/escalation, rejected/stale review and duplicate
  retry/reset cases. Repair/repeat the scenario with different printer IDs; ensure
  agent controls stay off and any non-loopback traffic fails the test.
- [x] Check narrow/mobile status warnings and impact tables without page overflow;
  reset must remove holds/history/policy and allow the workflow to repeat.
- [x] Run `.venv\Scripts\python.exe scripts/check.py coverage` from root. Require
  passing unit/integration/browser/schema/build checks and 100% application coverage.
- [x] Request independent read-only review, address concrete findings with red/green
  tests, record exact results/limitations and preview the completed demonstration.
- [x] Commit completed work locally; merge/push require a new explicit instruction.

## Execution status

Offline fault containment, recovery policy, schedule impact reporting and incident UI
are implemented. The final root verification results are recorded in development.md.
Live AI orchestration and physical equipment adapters remain outside this phase.

Independent read-only builder review found two gaps, now addressed: all ordinary
dispatch paths must enforce incident holds, and simultaneous faults on the same
order need per-part incident ownership. Regression steps and affected source files
are explicit above. Preview versions persist with decisions, not read-only fetches.


Implementation rulings: use one cohesive local feature commit after integrated
verification rather than committing temporarily incompatible schema/UI steps. Impact
regressions live with test_recovery.py instead of an additional test_schedule_impact.py;
both application modules retain full branch coverage. Independent review fixed idle
incident resolution, explicit unassigned-part rows and persistent decision/evidence
access. Actual preview inspection removed long internal part IDs, collapsed optional
lineage detail and distinguished unassigned work from blocked incident parts.
