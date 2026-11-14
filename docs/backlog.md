# Remaining MVP backlog

Sources: [specification](../SPEC.md), [MVP implementation plan](superpowers/plans/2026-11-13-mvp-implementation.md),
[production overview plan](superpowers/plans/2026-11-14-production-overview.md),
and [interactive printer plan](superpowers/plans/2026-11-14-interactive-printers.md).

**Last audit: 2026-11-14, including `feat/compact-order-schedule-controls` based on main `1dec51f`.**
Statuses describe the audited implementation; operator verification remains separate from automated test results.
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
| PA-301 | Implemented | Future slot preview, validated atomic apply and remaining-material reservation ledger. |
| PA-302 | Implemented | Conservative capacity/material estimates, deadline risk and unavailable reasons. |
| PA-303 | Implemented; operator verification pending | Live floor/controls, guided intake and visual print timeline; verify the revised journey with the user. |
| PA-304 | Implemented on current branch | Local example shop inbox, model matching, acceptance/rejection, held orders and final schedule confirmation; no live connector. |
| PA-305 | Partial | Bounded STL upload/library and reusable estimates implemented; versioned slicer provenance and actual layer/toolpath data remain. |
| PA-306 | Partial | Confirmed unstarted queued-order deletion/release implemented; active cancel/discard and scrap accounting remain. |
| PA-307 | Implemented; operator verification pending | Idle/new-print guidance and visible start/pause/resume pass browser tests; verify with user. |
| PA-401, PA-402, PA-403 | Implemented offline; operator review pending | Persistent isolation, owned-part recovery, schedule impact and resettable browser demonstrations. |
| PA-501, PA-502, PA-503 | To Do | Fake agent gateway, controls, budgets and cancellation/zero-inference safeguards. |
| PA-601 | To Do | Simulated business metrics and matched scenario comparisons. |
| PA-602 | Partial | Production serving, portable packaging and broader platform verification. |
| PA-603 | Partial | Complete rehearsal/readiness evidence and actual-build presentation fallback. |
| PA-701 | Deferred | Optional bounded live-provider adapter after readiness gates. |

## Next development order and traceability

1. Operator-check the new saved-model/upload -> quantity/deadline -> timeline ->
   confirmation journey (PA-303/304/307), including example-feed matching. Maintain
   the delivered clock, forecasting, proposals and material commitments.
2. Operator-review delivered deterministic faults and recovery (PA-401/402/403),
   including waste, indirect schedule impacts and the failure-to-completion demo.
3. Complete the guarded fake orchestration framework (PA-501/502/503) against agreed
   recovery/tool contracts; live inference remains a separate gated follow-on.
4. Add simulated outcome metrics, repeatable packaging and rehearsal (PA-601/602/603).
   Remaining PA-305 provenance/toolpath work and PA-306 cancel/discard stay explicit.

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

**Status:** Implemented on `feat/schedule-proposals-start-guidance` (2026-11-14).

Immediate deterministic assignment orders by priority/deadline, explains blocked
work and uses revision/replay guards. New read-only proposals include future slots, filament, blocked quantities and
assumptions. Atomic hash/session/revision-aware application creates planned
attempts, with remaining-material commitments and manual-start preservation.

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

**Status:** Implemented; operator verification of the revised guided workflow remains pending (2026-11-14).

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

**Status:** Implemented on `feat/guided-model-order-workflow` for the user-selected local example feed and combined manual workflow.
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
- Validate the saved model mapping and required order data at acceptance. Check
  current printer/material/deadline feasibility at final schedule confirmation;
  accepted requests remain held beforehand. Preserve inputs on errors and never
  duplicate orders on repeated/uncertain retries.
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

The user's expanded fault-management outline is captured in the implemented
[fault/recovery design](superpowers/specs/2026-11-14-fault-recovery-design.md) and
[implementation plan](superpowers/plans/2026-11-14-fault-recovery.md). It adds durable
incidents, before/after part and order comparisons (including indirect delays),
failed-print waste, bounded opt-in automatic simulation recovery, operator escalation
and an Incidents & Schedule Impact panel. The offline implementation covers these requirements; live agent orchestration remains Phase 5.

### PA-401 — Inject and safely isolate faults

**Status:** Implemented offline; operator review pending (2026-11-14).

All five faults isolate equipment deterministically, persist evidence/waste and hold affected parts.

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

**Status:** Implemented offline; operator review pending (2026-11-14).

Typed proposals, guarded apply/reject, retry lineage, partial followups and independent bounded automatic recovery are implemented.

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

**Status:** Implemented offline; operator review pending (2026-11-14).

Browser workflows cover fault isolation, impact review, exact completion, rejection/staleness, automatic policy and reset/repeat.

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
- Implemented: saved-model browsing and local ASCII/binary STL upload, 10 MiB /
  100,000-triangle limits, millimeter bed checks, support/profile review and
  hash-addressed SQLite mesh persistence; no catalog hand-editing required.
- Version estimate provenance (slicer/printer settings, material, profile revision,
  source model identity); flag estimates stale when relevant settings change.
- Import optional actual layer/toolpath metadata and display layer counts only
  when supplied; raw STL alone cannot reliably determine print time/filament use.
- Explicit incomplete-profile/draft editing and guided repair; approval/printing
  must require prepared estimates, never arbitrary manufactured defaults.
- Keep an automatic slicer adapter separately scoped and offline-testable; it is
  a follow-on under SPEC, not a claim that slicing is implemented.

### PA-306 ? Explicit print cancellation and discarded material

**Status:** Partial. **P1.** Unstarted queue deletion/release is implemented in the compact planning refinement; active cancel/discard still depends on lifecycle/recovery accounting.
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

## Current phase review and idle-printer report (2026-11-14)

| Phase | Current position | Remaining acceptance/work |
| --- | --- | --- |
| 1: Foundation | Implemented | Maintain persisted intake, validation and offline checks. |
| 2: Virtual production | Core engine implemented; user start experience needs verification | Three printers, assignment, material/quantity accounting, clock and reset exist. Close PA-307 before claiming the user can reliably operate the floor. |
| 3: Scheduling/dashboard | Partial | Compact 3D dashboard, forecasting, profiles and guided printing exist. PA-301 proposals/reservations, PA-304 incoming review, PA-305 asset/provenance work, PA-306 cancel/scrap and PA-307 usability remain. |
| 4: Faults/recovery | Implemented offline | Five fault types, reviewed/bounded automatic recovery, persistent part/order impacts and resettable demo; operator review pending. |
| 5: Agent framework | To Do | Offline fake gateway, explicit controls, budgets, cancellation and tool/run activity. Live provider remains separately gated PA-701. |
| 6: Metrics/packaging/demo | Partial preparation | Business metrics/comparisons, portable serving/package and full demo/rehearsal evidence remain. |

Partner handoff remains printable geometry plus slicer-derived per-model time and
filament weight. The local application can import prepared profile metadata;
geometry registration/provenance still needs PA-305. Application work can continue
against the labeled example profile while waiting for the real assets.

### PA-307 - Make idle-to-active printing obvious and verify it with the operator

**Status:** Implemented on `feat/schedule-proposals-start-guidance`; operator verification pending. **P0.**

User reports that all printers remain idle; pause and offline controls work, but
active printing has not been successfully reached in their experience. Do not
close this report solely because automated happy-path tests pass.

Read-only preview observation on 2026-11-14: all three printers were idle, all five
attempts completed, orders fulfilled at 4/4 and 1/1, and the clock running at 300x.
There was no remaining/pending work. This explains the observed idle snapshot; it
does not prove that every attempted start by the operator succeeded or failed.
The existing inspector only shows Start when an assigned job is pending, leaving
an idle printer with Pause/Offline and no obvious model/quantity start action.
A running clock does not create new work. High speed can also make brief active
states easy to miss.

Acceptance:
- Reproduce the user's path from a completed/idle workshop and from a fresh queue.
- Distinguish no assigned work, all work complete, pending manual start, paused
  clock/printer, offline equipment and incompatible/blocked jobs in plain words.
- Offer a prominent start/new-print action from Overview/idle inspection that
  guides to model and quantity selection without guessing the next tab.
- Preserve the existing Orders automatic path (choose model/copies, Start automatic
  printing) and manual pending-start path; show the assignment/start result and
  explain why a printer remains idle when work cannot start.
- Make clock speed/paused status clear enough to see active printing; verify
  start, visible motion/progress, pause, resume and completion with the operator.
- Add regression tests for the reproduced gap, then run full offline coverage.

Recent completed code verification at 5d490dc: 71 backend, 125 frontend and 9
browser tests with 100% statement/branch coverage. Those results cover implemented
paths and do not resolve this reported usability/acceptance gap. This update is
documentation only; no jobs were created, reset or started for this audit.

## PA-301/307 implementation follow-up

Current local branch implements future proposals and derived reservations. Apply
reserves once per planned/active attempt; physical stock decreases only with
consumption. Paused/offline work keeps commitments, fulfilled jobs release them,
and later automatic forecasts do not skip a queued manual hold. Preview/apply
must use the same unchanged session/revision; pause the clock during review.
Slots assume model estimates and immediate manual starts, not guaranteed dates.

Overview now explains no work versus completed/waiting/paused-clock states and
links directly to new-print or scheduling actions. Idle inspection offers model
selection. Automatic quick printing explicitly selects playback speed (60x default)
so a prior fast clock does not make new activity disappear unexpectedly.
Browser tests verify actual animated image changes, pause/resume, preview purity,
reservations and full completion. PA-307 remains pending the operator confirming
that the new path is clear in the preview; automated success is not user signoff.

Review-first intake is available beside automatic/manual printing. It creates a
held order with no jobs/reservations until reviewed apply. Partial applications
keep blocked copies held for another proposal; they do not silently start when
capacity returns. Chosen playback speed is visible/carried into review apply.
Current verification: 80 backend, 134 frontend and 11 browser tests, all offline,
100% statement/branch coverage, schema/build passed. Operator signoff still pending.

## Published modeling/support work integration

Origin main 3b01bbd is integrated with the production UI: separate support
assessments, combined model/support review and artifact storage, safe unused-task
removal, bundled NIST preview and demo asset. Legacy unassessed Supports/Review
records are made actionable on restart; approved history remains unchanged.
The NIST demo uses compatible blue PLA and its registered mesh can render on beds.
Prepared-profile intake, guided quantities, scheduling proposals, material
reservations and the compact dashboard remain intact. This does not implement
AI geometry/support generation, slicing or the Phase 5 agent runtime.

## Guided model/order workflow priority (2026-11-14)

The user prioritized simple model -> quantity/deadline -> timeline -> confirmation
flows and selected a local example shop feed for this MVP. Models is a searchable
saved library with actual bounded STL upload and reusable preparation estimates.
Advanced modeling/support review stays available in a disclosure. Tabs follow
Models, Orders, Schedule, Overview, Printers; Overview remains the landing page.

Manual and accepted example requests remain held without attempts/reservations
until explicit confirmation. Pending/rejected requests never print. Product/model
mapping, reload/import deduplication, acceptance receipts and history persist.
The guided plan must be complete and meet production deadlines; uncommitted
quantity/date corrections require a new preview. Existing manual start options
remain advanced. Timeline thumbnails show registered geometry, including uploads.

This closes local PA-304 and the geometry-upload/library portion of PA-305. It
does not implement a real shop connector, infer slicer estimates, or close the
Phase 4 recovery, Phase 5 guarded runtime or Phase 6 metrics/packaging requirements.
Operator signoff and versioned estimate provenance remain separate follow-ups.

## Compact planning refinement (2026-11-14)

User requests compact searchable Orders, copy/date planning with early feasibility,
selectable schedule cards with conflict/ETA summaries, confirmed queued editing and
deletion, calendar ticks and individual incoming-request simulations. This is the
current feature branch `feat/compact-order-schedule-controls`, based on main 1dec51f.
The model library remains intact; website model-import integration belongs to the
partner and is not implemented by this branch.

Queued changes release unstarted attempts, return edits to review and archive
removed orders without stock restoration. Started work stays protected. Canceled
orders cannot be dispatched or counted as active. Selected card confirmations bind
the original session/revision; resetting with reused IDs cannot authorize stale
changes. Incoming manual requests stay pending; automatic matches create held orders
and preview, with final printing confirmation still required.
The inbox now explains both routes through confirmation and printer monitoring.
Timeline order colors, readable status keys and final-print markers distinguish
completion across printers; incomplete or conflicting allocations suppress promises
of a whole-order finish. Profile time/filament totals remain explicit.

Deadline advice uses supplied model estimates/current capacity, not accelerated
playback. A faster prepared profile can be chosen explicitly. Active print scrap,
recovery, guarded AI runtime, real model import connectors and broader packaging
remain outstanding under their respective owners/stories.
