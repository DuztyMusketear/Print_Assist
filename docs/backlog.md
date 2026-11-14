# Remaining MVP backlog

Sources: [specification](../SPEC.md), [MVP implementation plan](superpowers/plans/2026-11-13-mvp-implementation.md),
[production overview plan](superpowers/plans/2026-11-14-production-overview.md),
and [interactive printer plan](superpowers/plans/2026-11-14-interactive-printers.md).

**Last audit: 2026-11-14, including local `feat/compact-overview-layout` changes based
on `23f97e8`.** Clock/forecast/monitoring additions below await integration into `main`.
These are local story IDs,
not remote issues. Status reflects inspected code and tests; passing coverage
for current code does not mean unimplemented acceptance criteria are complete.
Phase 1 is implemented. Phases 2 and 3 have working foundations but remain partial.

**Status key:** Implemented = acceptance behavior delivered on the audited branch;
Partial = implemented behavior exists but acceptance gaps remain;
To Do = the story's primary workflow is not implemented; Deferred = gated follow-on.
The acceptance criteria below are the completion contract, including those already
implemented. The status notes identify what still needs work.

Priority: **P0** = required workflow/control; **P1** = supporting demo or packaging
work. Priority does not remove dependencies. No estimates or delivery dates are
committed. Branch names below are planned task areas; start new follow-up branches
from current `main`, rather than assuming the original feature branch is active.

## Ownership and independent work

- **Partner:** prepare printable part STL models, at intended millimeter scale,
  Z-up, following the [part asset handoff](../frontend/public/models/README.md).
  Supplied assets are not yet present; the example tower allows application work
  and offline tests to continue without them.
- **Application work:** printer controls, clock/reset, scheduling/estimates,
  monitoring, intake, recovery, guarded agent framework and packaging. Individual
  story owners can be assigned when coordinating the next implementation.
- The partner's geometry delivery does not implement AI orchestration or model
  generation. The current Modeling board is a persisted, operator-driven workflow.
  Live inference remains gated by PA-701 and the specification.

## Current delivery snapshot

Implemented additions include persisted Modeling/Supports/Review stages, approval
creating orderable artifacts, field-help icons and filament suggestions, plus
interactive 3D printer beds and optional catalog STL associations. These supplement
the original plan; they do not close the remaining operational requirements.
See the [code map](code-map.md) for inspected implementation and test relationships.

| Stories | Status | Remaining outcome |
| --- | --- | --- |
| PA-201 | Implemented | Maintain compatibility, assignment reasons/events and competing-command safety. |
| PA-202 | Implemented | Single-owner fixed-step clock, configurable speed, run/pause and restart/reset pause. |
| PA-203 | Implemented | Seeded/empty resets, new-session guards and safe lost-response replay. |
| PA-301 | Partial | Reviewable future schedule proposals, explicit material reservations and validated apply. |
| PA-302 | Implemented | Conservative capacity/material estimates, deadline risk and unavailable reasons. |
| PA-303 | Implemented | Serial one-second refresh, connection errors, simulated temperature telemetry and controls/history. |
| PA-304 | To Do | Incoming-order review/acceptance; guided manual/profile intake now exists. |
| PA-305 | Partial | Prepared-model asset ingestion, estimate provenance and optional real layer/toolpath data. |
| PA-306 | To Do | Explicit cancel/discard with scrap and consumed-material accounting. |
| PA-401, PA-402, PA-403 | To Do | Fault isolation, reviewed recovery and failure-to-completion demonstration. |
| PA-501, PA-502, PA-503 | To Do | Fake agent gateway, controls, budgets and cancellation/zero-inference safeguards. |
| PA-601 | To Do | Simulated business metrics and matched scenario comparisons. |
| PA-602 | Partial | Production serving, portable packaging and broader platform verification. |
| PA-603 | Partial | Complete rehearsal/readiness evidence and actual-build presentation fallback. |
| PA-701 | Deferred | Optional bounded live-provider adapter after readiness gates. |

## Next development order and traceability

1. Clock, forecasting and live monitoring are implemented locally. Next: PA-301 reviewable proposals and material reservations. Printer
   controls, assignment explanations/history and PA-203 resets are implemented
   by the [production controls plan](superpowers/plans/2026-11-14-production-controls.md).
   Reference SPEC sections 6-7 and MVP plan Task 2.
2. Complete PA-301 reviewable schedule proposals and reservation rules;
   maintain the delivered forecasts and live monitoring. Reference SPEC section 6 and plan Task 3.
3. Design PA-304 as the agreed combined intake workflow; it can proceed alongside
   operational work once its contracts are agreed. Direct manual order entry
   already exists; incoming acceptance/rejection is additional scope.
4. Continue with fault/recovery (Task 4), guarded fake agents (Task 5), and metrics,
   packaging and rehearsal (Task 6), preserving their dependencies and readiness gates.

For every implementation, read the relevant SPEC sections and approved design/plan
before coding. Maintain a requirements-to-test checklist, record justified plan
adjustments, run the required offline checks, and update this status and both maps
in the same change. SPEC sections 5, 7, 10 and 12 apply throughout: agent controls,
deterministic validation, acceptance evidence and test-first development.

## Shared definition of done

- Write a failing behavior test first, observe the intended failure, implement
  minimally, then refactor green. Add meaningful unit and relevant integration,
  component, and browser checks. Never use live inference as a test.
- Root `python scripts/check.py unit`, `full`, and `coverage` pass; preserve the
  100% application statement/branch target and reviewed coverage boundaries.
- Work on the phase's feature branch, keep commits focused, update the code and
  knowledge maps, and record actual verification commands/results.
- No live providers, autonomous workers, credentials, hardware calls, or hidden
  agent startup. Manual workflows remain usable with agents OFF.
- Deterministic validation owns every state change; enforce session/revision,
  idempotency and atomic persistence across all new commands.
- Story acceptance requires review; this backlog does not authorize merges,
  pushes, deployment, or live demo execution.

## Phase 2 — Virtual production

Branch: `feat/printer-simulation`. Epic outcome: an order can be produced on
three virtual printers with accurate quantities and filament accounting.

### PA-201 — Assign work to compatible printers

**Status:** Implemented on `feat/production-controls` (audit 2026-11-14).

Three printers, compatibility/material checks, distinct attempts and transactional
schedule/replay guards exist. Assignment and blocked-order events explain missing
capacity, capability, material/color or stock. Concurrent scheduling accepts one
mutation; replay preserves attempts and material. The dashboard displays history.

**Evidence / references:** [scheduling.py](../backend/print_assist/scheduling.py), [service.py](../backend/print_assist/service.py), [controls tests](../backend/tests/unit/test_controls.py), [concurrency/API tests](../backend/tests/integration/test_production_controls.py). SPEC 6-7; MVP plan Task 2.

**P0 · Depends on:** Phase 1.
As an operator, I want to assign queued work to available compatible printers
so that production can begin without double booking or consuming unavailable material.

Acceptance criteria:
- Seed exactly three virtual printers with explicit capabilities, material and state.
- Create independently identifiable item attempts from ordered quantity; track
  requested quantity separately from attempts and successful items.
- Reject busy/offline/incompatible printers and insufficient or wrong filament.
- Competing assignments from the same revision accept at most one mutation;
  retries do not create duplicate attempts or reserve material twice.
- Assignment and rejection are observable through typed API commands/events.

### PA-202 — Advance, pause and complete simulated work

**Status:** Implemented on `feat/clock-forecast-monitoring` (audit 2026-11-14).

Manual clock advancement, material consumption, successful quantity accounting,
automatic/manual starts and pause/resume/offline/online controls exist. Paused or
offline printers preserve attempts and stock; resume rechecks remaining material.
Zero advance is a no-op. Implemented follow-up: configurable 1/60/300/3600x fixed-step clock,
one cancellable backend owner and no wall-time catch-up after restart.

**Evidence / references:** [simulation.py](../backend/print_assist/simulation.py), [API](../backend/print_assist/api.py), [scheduling tests](../backend/tests/unit/test_scheduling.py). SPEC 6; MVP plan Task 2.

**P0 · Depends on:** PA-201.
As an operator, I want predictable progress and manual printer controls so that
I can run production without agents.

Acceptance criteria:
- A pure transition advances all eligible printers independently on one clock.
- Zero time advance is a no-op; negative increments fail without changing state.
- Pause/offline stop progress; valid resume restores eligible work.
- Consume filament consistently with elapsed progress; never allow negative stock.
- Count completion once, even across retries or repeated events. An order is
  print-complete only when all required items succeed; it is not marked shipped.
- Provide a configurable accelerated simulation clock with explicit run/pause; restart never catches up elapsed wall time.
- Only one backend simulation owner advances state; no tick invokes inference.

### PA-203 — Reset to repeatable scenarios

**Status:** Implemented on `feat/production-controls` (audit 2026-11-14).

Seeded/empty selection and acknowledged atomic reset replace orders, attempts,
inventory, modeling tasks, custom artifacts and history. Each reset changes
session, pauses simulation and disables agent/automatic flags. Exact reset
retries replay their receipt without reverting newer state; later resets retire
older receipts. Delayed reads/commands cannot restore pre-reset state or clear
new-session retry keys. Restart separately retains manufacturing state paused.

**Evidence / references:** [scenarios.py](../backend/print_assist/scenarios.py), [service.py](../backend/print_assist/service.py), [reset/API tests](../backend/tests/integration/test_production_controls.py), [late-response tests](../frontend/src/App.test.tsx), [browser workflow](../tests/e2e/production-controls.spec.ts). SPEC 6-7, 10; MVP plan Task 2.

**P0 · Depends on:** PA-202.
As a presenter, I want seeded and empty-order scenarios so that demos can be repeated.

Acceptance criteria:
- Both scenario types produce predictable baseline state and three printers.
- Reset replaces state atomically, changes session identity, pauses the clock,
  and sets agent/automatic-trigger controls OFF.
- Old commands, attempts and delayed actions cannot modify the new session.
- Restart retains manufacturing state but pauses simulation and disables agents;
  it never catches up elapsed wall time.

## Phase 3 — Scheduling and operator dashboard

Branch: `feat/production-dashboard`. Epic outcome: see what is running, what
should run next, and which orders may miss their production deadlines.

### PA-301 — Produce and apply a feasible schedule

**Status:** Partial (audit 2026-11-14).

Immediate deterministic assignment orders by priority/deadline, explains blocked
work and uses revision/replay guards. Remaining: a reviewable schedule proposal
and validated application, future-capacity planning and explicit planned-material
reservation semantics.

**Evidence / references:** [scheduling.py](../backend/print_assist/scheduling.py), [service.py](../backend/print_assist/service.py). SPEC 6-7; MVP plan Task 3.

**P0 · Depends on:** PA-203.
As a seller, I want a feasible production schedule so that urgent orders use
available capacity and material appropriately.

Acceptance criteria:
- Sort by priority, then earliest production due time, with stable ID tie-breaks.
- Consider availability, capabilities, filament type/color and remaining grams.
- Reserve planned material once; one printer handles one job at a time.
- Apply the proposal through validated session/revision-aware commands;
  stale proposals fail visibly and do not partially apply.
- Scheduling runs without agents and has reproducible results from the same input.

### PA-302 — Display estimates and deadline risk

**Status:** Implemented on `feat/clock-forecast-monitoring` (audit 2026-11-14).

Read-only forecasts now share printer capacity and remaining material across orders. Exact due-time completion is on time; held/manual work and unavailable resources explain missing estimates. Assumptions: immediate automatic scheduling, supplied duration/material estimates, no future outages, and packing/shipping separate.

**Evidence / references:** [OrderQueue](../frontend/src/components/OrderQueue.tsx). SPEC 6, 10; MVP plan Task 3.

**P0 · Depends on:** PA-301.
As a seller, I want to understand deadline risk so that I can make realistic commitments.

Acceptance criteria:
- Show estimated production completion, production due time, ship-by time,
  and reasons for risk or missing estimates.
- Completion exactly at the due time is on time; equivalent timezone inputs agree.
- Unavailable capacity or material produces an explicit infeasibility explanation,
  not a fabricated completion promise.
- Keep finishing/packing allowance and print completion distinct from shipping.

### PA-303 — Operate the floor through a live production dashboard

**Status:** Implemented on `feat/clock-forecast-monitoring` (audit 2026-11-14).

Tabs, real printer/job/progress/material state, 3D views, explicit refresh,
stale-response guards, activity history and printer controls exist. Browser tests
cover manual-start completion, paused/offline stock preservation and reset.
Serial one-second automatic refresh and deterministic simulated nozzle/bed telemetry now exist. Temperatures illustrate printer status and are not physical measurements.

**Evidence / references:** [App](../frontend/src/App.tsx), [PrinterFloor](../frontend/src/printers/PrinterFloor.tsx), [3D browser tests](../tests/e2e/printer-views.spec.ts). SPEC 6; MVP plan Task 3 and interactive printer plan.

**P0 · Depends on:** PA-302.
As an operator, I want printer cards, queue and history in one view so that I
can supervise and control production without checking separate tools.

Acceptance criteria:
- Distinguish idle, running, paused, offline and faulted printers; display current
  job, progress, filament, temperatures and supported manual controls.
- Poll without overlapping requests; clean up on unmount and show connection errors.
- Late responses, including those from before reset, cannot restore obsolete state.
- Activity identifies affected entities and distinguishes commands from simulator events.
- Browser test completes a manual order with agents OFF.

### PA-304 - Review incoming orders and enter production details manually

**Status:** To Do. User-requested addition, agreed as one combined workflow.
**P1 - Depends on:** Phase 1 intake and existing approved-artifact handoff. Does not depend on partner STL delivery.

As an operator, I want incoming requests and manual entry in one Orders workflow
so that I can review requirements before committing work to production.

Acceptance criteria:
- Offer a clear manual-entry path and an incoming-request review queue in Orders;
  keep Overview focused on production rather than placing the creation form there.
- Reuse approved artifacts, quantity, priority, material/print requirements and UTC
  deadlines; explain field purpose/units with the existing accessible help pattern.
- Distinguish pending, accepted and rejected requests. Pending/rejected requests
  cannot silently enter scheduling. Acceptance creates one production order.
- Validate required data and current artifact compatibility at acceptance; make
  errors visible and preserve inputs. Repeated/uncertain retries cannot duplicate orders.
- Preserve session/revision/idempotency checks and persist requests, decisions
  and order links atomically; test concurrent acceptance and restart/reload.
- Remain offline and usable with agents off. Marketplace ingestion, arbitrary
  file upload, slicing and live AI are not implied by this story.
- Agree the detailed design and contracts before implementation; add unit/API/UI
  and browser evidence under the shared definition of done.

**Traceability:** SPEC sections 4, 6-7 and 12 cover intake/validation. The pending
request and acceptance lifecycle is a user-requested extension beyond the original
MVP plan; record its approved design/plan and any required spec amendment before
implementation instead of silently treating it as an existing requirement.

## Phase 4 — Faults and recovery

Branch: `feat/fault-recovery`. Epic outcome: a disruption is contained and a
reviewed recovery can restore production without corrupting fulfillment.

### PA-401 — Inject and safely isolate faults

**Status:** To Do (audit 2026-11-14).

No fault injection or deterministic isolation workflow exists.

**Evidence / references:** SPEC 6-7, 10; MVP plan Task 4.

**P0 · Depends on:** PA-303.
As an operator, I want faults to stop affected work immediately so that a
recovery proposal is never responsible for enforcing equipment safety.

Acceptance criteria:
- Support filament runout, thermal fault, network disconnect, nozzle clog,
  and insufficient material with documented deterministic effects.
- Stop affected progress immediately without inference; display printer/job effects.
- Keep unsafe equipment unavailable until explicitly cleared through valid actions.
- Preserve consumed filament as failed-attempt waste; do not count failed output as fulfilled.

### PA-402 — Review and apply a validated recovery

**Status:** To Do (audit 2026-11-14).

No recovery proposals, approval/rejection or replacement-attempt workflow exists.

**Evidence / references:** SPEC 6-7, 10; MVP plan Task 4.

**P0 · Depends on:** PA-401.
As a seller, I want to review affected orders and a feasible recovery before
applying it so that I retain control over disruptions.

Acceptance criteria:
- Show affected attempts, suggested replacement/reallocation, and unresolved constraints.
- Operator can reject without changing production or apply through typed commands.
- Validate capabilities, material, equipment state and outstanding quantities again at apply time.
- Reject stale, duplicate and simultaneous conflicting approvals, including after reset.
- Recovery creates at most the needed replacement attempts; never starts unsafe equipment.

### PA-403 — Demonstrate failure-to-completion in the browser

**Status:** To Do (audit 2026-11-14).

Existing browser tests cover intake/modeling/3D production progress, not a fault-to-recovery workflow.

**Evidence / references:** SPEC 6, 10, 12; MVP plan Task 4.

**P1 · Depends on:** PA-402.
As a presenter, I want the entire recovery story visible so that judges can
understand both the operational problem and the resulting action.

Acceptance criteria:
- Browser workflow injects a fault, shows isolation, reviews a proposal,
  applies recovery and reaches correct final quantities.
- Log fault, safety action, review decision and outcome with entity references.
- Reset repeats the scenario; all five fault types have unit/integration coverage.
- All behavior works offline without claiming physical-printer reliability.

## Phase 5 — Guarded agent framework using fakes

Branch: `feat/guarded-agent-framework`. Epic outcome: agent-style coordination
can be tested through typed tools without paid inference or autonomous development activity.

### PA-501 — Add explicit agent controls and a fake proposal gateway

**Status:** To Do (audit 2026-11-14).

Stored controls default off, but there is no functional agent gateway, fake proposal flow or enable-control interface.

**Evidence / references:** SPEC 5-7; MVP plan Task 5.

**P0 · Depends on:** PA-403.
As an operator, I want agent assistance to be explicitly controllable so that
normal production and development never trigger unexpected inference.

Acceptance criteria:
- Startup/reset defaults both global and automatic-event controls OFF.
- OFF requests explain disabled state, make no provider call and queue no later work.
- Explicit fake-mode demonstrations are labeled scripted/simulated and require
  the applicable controls; do not silently fabricate an OFF-mode response.
- Dev/test reject live adapters even with credentials present; no SDK initialization.
- Typed proposals cover relevant order review, scheduling, operations and recovery
  responsibilities; only deterministic service tools may mutate state.
- Show user-facing explanations and outcomes, never hidden reasoning or secrets.

### PA-502 — Enforce bounded execution budgets

**Status:** To Do (audit 2026-11-14).

No shared execution budget ledger or budget UI exists.

**Evidence / references:** SPEC 5, 10, 12; MVP plan Task 5.

**P0 · Depends on:** PA-501.
As an operator, I want finite execution limits so that a demo cannot spend indefinitely.

Acceptance criteria:
- Require finite limits for calls, input/output token allowance, tool/delegation
  steps, retries, concurrent runs and duration before demo execution.
- Atomically reserve input/maximum output allowance before each provider boundary;
  all specialist calls and retries share account/session limits.
- Reconcile reported usage; unknown usage retains reservations.
- Concurrent requests cannot overspend. Limit exhaustion stops more inference
  while manual simulation remains usable.
- UI exposes usage/reservations, remaining limits and stop reasons. Test with fakes only.

### PA-503 — Cancel safely and prove zero inference

**Status:** To Do (audit 2026-11-14).

Command session guards and offline tests exist, but there is no queued/in-flight agent lifecycle to cancel or verify yet.

**Evidence / references:** SPEC 5, 10, 12; MVP plan Task 5.

**P0 · Depends on:** PA-502.
As an operator, I want OFF/reset to invalidate pending work so that old responses
cannot change a new production session.

Acceptance criteria:
- Cancel queued work and request in-flight cancellation where supported;
  late results after OFF/reset/restart cannot apply actions.
- Re-enabling never replays old requests; timeouts/retries remain bounded.
- Activity distinguishes pending, failed, canceled and completed runs; cancellation
  does not claim already-dispatched provider calls are free.
- Automated checks cover startup/imports, credential presence, chat, ticks,
  faults, completion, retries and reset without live SDKs/endpoints.
- Browser tests verify controls and manual operation remain independent.

## Phase 6 — Business metrics and portable demo

Branch: `feat/offline-demo`. Epic outcome: demonstrate the full story reliably,
with honest simulated outcomes and documented setup.

### PA-601 — Report simulated business outcomes

**Status:** To Do (audit 2026-11-14).

No metrics aggregation, metrics dashboard or matched comparison scenarios exist.

**Evidence / references:** SPEC 6, 10, 13; MVP plan Task 6.

**P0 · Depends on:** PA-503.
As a seller, I want outcomes tied to orders so that I can assess production rather
than just printer activity.

Acceptance criteria:
- Show on-time production rate, failed-attempt filament, interventions,
  recovery time, utilization and completion duration where measurable.
- No due orders gives an undefined/null rate rather than misleading perfect performance.
- Handle exact deadlines, failed/repeated attempts, cancellations and reset correctly.
- Label metrics simulated; never substitute simulation duration for actual human labor.
- Compare manual/assisted scenarios with identical workload, clock and faults,
  plus a no-fault baseline; report equal outcomes honestly.

### PA-602 — Package and verify the local web app

**Status:** Partial (audit 2026-11-14).

Native setup, dependency locks and Windows/Chromium offline checks exist. Remaining: unified production frontend/API serving, health-checked packaging/Compose volume lifecycle and explicit additional-platform verification.

**Evidence / references:** [Development setup](development.md). SPEC 7-8, 10, 12; MVP plan Task 6.

**P0 · Depends on:** PA-601.
As a teammate, I want repeatable setup so that I can run the demo on a supported system.

Acceptance criteria:
- Production build serves frontend/API at localhost:8000 with one backend worker,
  named SQLite volume, health check and optional Docker Compose setup.
- Use loopback host binding; no external fonts/CDNs or model credentials required.
- Verify persistence/restart with paused clock and agents OFF; document shutdown,
  reset and destructive volume-removal implications.
- Document native Windows/macOS/Linux setup and tested versions/architectures;
  explicitly mark systems/browsers not actually tested.
- Dependency/browser/image downloads are setup-only; installed demo/test operation is offline.

### PA-603 — Prepare the judged demo and readiness evidence

**Status:** Partial (audit 2026-11-14).

Business/market research and judging preparation documents exist. Remaining: complete operational demo including risk/recovery/reset, readiness evidence, timed rehearsal and an actual-build fallback recording/screenshots.

**Evidence / references:** [Judging checklist](judging-readiness.md), [business validation](business-validation.md). SPEC 9-10, 13; MVP plan Task 6.

**P1 · Depends on:** PA-602.
As a presenter, I want a rehearsed end-to-end story and fallback so that judges
can assess the product even if the presentation environment is unreliable.

Acceptance criteria:
- Run order intake, deadline risk, fault, reviewed recovery, completion and reset.
- Record full offline checks, schema/build verification and framework readiness
  against SPEC section 10; list gaps rather than silently waive them.
- Pitch customer, problem, value, competitor context, pricing/cost assumptions
  and realistic growth; use desk research, with no interview dependency.
- Confirm presentation duration, rehearse, and prepare an actual-build offline
  recording/screenshots clearly identified as fallback.
- Distinguish scripted demos, actual live reasoning and simulated manufacturing.

## Optional follow-on — not part of Phases 2-6

### PA-701 — Add a bounded live demo provider adapter

**Status:** Deferred (audit 2026-11-14).

No live adapter exists. Preserve the readiness and explicit operator/provider approval gates.

**Evidence / references:** SPEC 5, 9-10, 12; MVP plan optional follow-on.

**Deferred · Depends on:** all readiness gates and PA-603, plus an approved
provider/model choice and a separate adapter plan.

As a presenter, I want optional live reasoning after the framework is verified.
Implement against fake transports first; require backend demo mode, explicit
operator enablement and finite budgets. Preserve every guard. This story does
not authorize live calls or turn application agents on during development.

## Reference-driven usability follow-up (2026-11-14)

Local branch `feat/guided-printing-workflow` adds selectable Overview printer
cards and the same inspection/manual control panel as Printers; illustrative
head motion runs only while the clock/job run. Prepared-profile JSON imports
carry partner-supplied time/weight/compatibility metadata through approval.
Quick printing chooses an approved model and quantity, inherits estimates, and
atomically plans automatic or manual work. Manual batches prepare further pending
jobs as capacity frees; each still requires a user start. Workflow links guide
Modeling -> Orders -> Schedule -> Overview. PA-304's incoming-order review remains
outstanding; this is guided manual intake, not marketplace import or review.

| Reference expectation | Delivered / remaining |
| --- | --- |
| Select printer from the Overview floor | Delivered: clickable cards/headings, shared progress/material/temperature/time inspector and pending start/pause/resume/offline controls. |
| Watch printing happen | Delivered: illustrative head motion plus authoritative progress reveal. Real layer/toolpath animation remains PA-305; no layer numbers are invented. |
| Choose model and quantity without guessing time/weight | Delivered for prepared approved profiles. Partner supplies slicer estimates; unknown/unprepared models cannot be queued by inventing estimates. |
| Avoid printer capability jargon | Delivered: profile compatibility is internal; preparation-only fields use a separate disclosure. |
| Add actual part files without editing application code | Remaining PA-305: current JSON imports metadata; team still registers STL geometry in the allowlisted catalog. |
| Stop/discard a print | Pause/hold and offline are delivered. Explicit cancel/discard with consumed-material/scrap accounting remains PA-306. |

### PA-305 ? Prepared-model ingestion and slicer provenance

**Status:** Partial on `feat/guided-printing-workflow`. **P1.**
Partner owns geometry and slicer estimates. Application owns validated metadata,
local catalog/file registration, provenance and readiness guidance.

- Current: import profile JSON with name/reference, duration, filament weight,
  material/color and optional registered preview; approved models inherit values.
- Add safe local geometry registration/upload with existing STL limits, units,
  orientation and preview checks, without hand-editing the catalog.
- Version estimate provenance (slicer/printer settings, material, profile revision,
  source model identity); flag estimates stale when relevant settings change.
- Import optional actual layer/toolpath metadata and display layer counts only
  when supplied; raw STL alone cannot reliably determine print time/filament use.
- Explicit incomplete-profile/draft editing and guided repair; approval/printing
  must require prepared estimates, never arbitrary manufactured defaults.
- Keep an automatic slicer adapter separately scoped and offline-testable; it is
  a follow-on under SPEC, not a claim that slicing is implemented.

### PA-306 ? Explicit print cancellation and discarded material

**Status:** To Do. **P1.** Depends on lifecycle/recovery accounting.
- Distinguish reversible pause/hold from irreversible cancel/discard in the UI.
- Explain remaining requested quantity and consumed material before cancellation.
- Record scrapped attempts and material exactly once; replacement attempts cannot
  double-count success or reuse consumed filament. Test retries/reset/concurrency.

These follow-ups are local requirements, not remote issues or external tasks.

## Compact overview handoff alignment

Local `feat/compact-overview-layout` implements the approved layout/density:
compact header/clock, floor with one selected telemetry strip, compact production
table beside activity beneath the floor, and a scenario/workflow sidebar. Printer
selection persists into the detailed tab; Overview camera controls are collapsible.
3D/STL previews remain deliberate deviations from the reference SVG. Sidebar chat,
fault/recovery controls and agent-network indicators remain PA-401/402/501 work;
current sidebar text explicitly marks orchestration as planned.
