# Remaining MVP backlog

Source: [implementation plan](superpowers/plans/2026-11-13-mvp-implementation.md)
and [specification](../SPEC.md). Phase 1 is implemented and merged into local `main`.
These are Jira-style local story IDs, not issues created in Jira. Phase 2-6 stories
are **To Do**; PA-701 is **Deferred**. All stories are unassigned and have no
committed estimates or due dates.

Priority: **P0** = required workflow/control; **P1** = required supporting demo
or packaging work. Priority does not remove dependencies. Phase 2 depends on
the reviewed Phase 1 implementation; Phases 3-6 follow the existing plan order.
Owners should be assigned jointly once partner availability is known.

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
- Only one backend simulation owner advances state; no tick invokes inference.

### PA-203 — Reset to repeatable scenarios

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

**P0 · Depends on:** PA-301.
As a seller, I want to understand deadline risk so that I can make realistic commitments.

Acceptance criteria:
- Show estimated production completion, production due time, ship-by time,
  and reasons for risk or missing estimates.
- Completion exactly at the due time is on time; equivalent timezone inputs agree.
- Unavailable capacity or material produces an explicit infeasibility explanation,
  not a fabricated completion promise.
- Keep finishing/packing allowance and print completion distinct from shipping.

### PA-303 — Operate the floor through a live schematic dashboard

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

## Phase 4 — Faults and recovery

Branch: `feat/fault-recovery`. Epic outcome: a disruption is contained and a
reviewed recovery can restore production without corrupting fulfillment.

### PA-401 — Inject and safely isolate faults

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

**Deferred · Depends on:** all readiness gates and PA-603, plus an approved
provider/model choice and a separate adapter plan.

As a presenter, I want optional live reasoning after the framework is verified.
Implement against fake transports first; require backend demo mode, explicit
operator enablement and finite budgets. Preserve every guard. This story does
not authorize live calls or turn application agents on during development.
