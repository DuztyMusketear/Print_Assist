# Print Assist MVP Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for inline,
> task-by-task implementation. No subagents or application agents are needed
> to implement this plan. Review this plan before starting implementation.

**Goal:** Deliver a locally runnable browser app that helps a small filament-print
business track orders, simulate production, and recover from faults.

**Architecture:** React calls a FastAPI backend that exclusively owns state.
A deterministic Python engine advances virtual printers; SQLite stores state
and history. A typed agent gateway is isolated from the engine and uses local
fakes throughout development.

**Tech stack:** React, TypeScript, Vite, Python, FastAPI, Pydantic, SQLite;
pytest/pytest-cov, Vitest/Testing Library, and Playwright. Docker Compose is an
alternative local setup, not a prerequisite for native development.

**Spec:** [SPEC.md](../../../SPEC.md).

## Current implementation audit - 2026-11-14

Phase 1 is implemented; Tasks 2 and 3 have partial production/dashboard foundations.
The original Task 2/3 completion checkboxes remain open because the accelerated
clock, schedule proposals/estimates and live monitoring remain incomplete.
The local [production controls follow-up](2026-11-14-production-controls.md)
adds pause/resume/offline/online, scenario resets, activity and manual workflow
verification; those additions await integration into main.
Tasks 4-6 remain outstanding; native setup/research preparation are
supporting pieces, not full milestone acceptance. Additional persisted modeling
and interactive STL views are implemented under their focused plans.

Consult the [current backlog](../../backlog.md) for per-story status, inspected
code/test evidence, remaining criteria and the next development order. Consult
[the overview audit](2026-11-14-production-overview.md) and
[interactive printer plan](2026-11-14-interactive-printers.md) for delivered scope.
The user's combined incoming-review/manual-entry workflow is tracked as PA-304;
its acceptance stage is an extension requiring an approved design and plan.
Partner STL preparation follows [the asset handoff](../../../frontend/public/models/README.md)
and does not block development against deterministic example geometry.

## Agreed direction and implementation choices

The user selected the React/Python web app and schematic printer floor. A 3D
floor was considered but deferred to preserve time for production behavior.
A browser-only mockup would be quicker but would not exercise authoritative
backend state, persistence, or the future agent boundary.

The following are proposed implementation defaults, not prior user decisions:

- Use REST and one-second snapshot polling initially, with no model activity
  in polling. Event streaming can follow if it solves an observed problem.
- Run one backend process and one simulation owner. Serialize commands/ticks
  through one application service and persist each accepted transition atomically.
  Multi-worker execution is outside this prototype.
- Persist manufacturing state and activity, but start with the simulation paused
  and agent controls OFF after every restart. Never catch up elapsed wall time.
  No queued agent runs resume after restart.
- Seed an Etsy figure-shop fixture and provide a separate empty-orders scenario.
  Keep product names out of domain logic. One job attempt prints one item;
  quantity creates multiple attempts, making successful quantity explicit.
- Use UTC timestamps in contracts and render local times with timezone labels.
  Production due time must not be later than ship-by time.
- Use operator-supplied artifact references, durations, and filament estimates;
  no file upload, G-code execution, slicing, or physical printer connection.
- Choose supported Python/Node versions during task 1, after checking the local
  environment and current package requirements; pin them and dependency locks.
- Keep the live SDK/provider choice deferred. Offline readiness must not depend
  on provider accounts. It gets a separate plan after the framework is ready.

## Global constraints

- "Three independently simulated virtual printers."
- "No simulation tick may invoke an agent."
- "Manual order intake and scheduling remain available with agents OFF."
- "Do not write implementation first and add tests afterward."
- "Target 100% statement and branch coverage of application-owned behavioral code."
- "Manual live demos are never part of the default test command."
- Follow [AGENTS.md](../../../AGENTS.md): task branches, focused commits,
  maintained knowledge map, no unauthorized push/merge/deployment.
- No credentials, runtime data, or generated dependencies in Git.
- Original interfaces below are planning targets. Some commands now exist under focused plans; inspect the code map and current backlog rather than assuming every original target is implemented.

## Review focus

1. Repeated submissions or completions must not duplicate orders or quantities
   (tasks 1 and 2).
2. Concurrent assignment, ticks, and recovery must not double-book a printer or
   spend the same material twice (tasks 2 and 4).
3. Stale polling responses and commands after reset must not restore old state
   (tasks 1, 3, and 5).
4. Mixed timezones, exact deadline boundaries, and impossible deadlines must
   produce correct, explainable risk indicators (tasks 1 and 3).
5. Startup, configuration, retries, and late responses must never bypass agent
   controls or session budgets (tasks 5 and 6).

## Planned file responsibilities

These paths are planned, not existing implementation. Add each actual file and
its relationships to the knowledge map when it is created.

| Paths | Responsibility |
| --- | --- |
| `pyproject.toml`, `uv.lock` | Python dependencies, pytest/coverage configuration |
| `package.json`, `package-lock.json` | Root commands and frontend workspace lock |
| `scripts/check.py` | Portable unit/full/coverage check runner; fail on any failed child command |
| `backend/print_assist/contracts.py` | Pydantic request/response and domain types |
| `backend/print_assist/store.py` | SQLite transactions, snapshots, schema version, idempotency |
| `backend/print_assist/service.py` | Serialized commands, revision checks, persistence |
| `backend/print_assist/api.py` | App factory, REST routes, errors, lifespan |
| `backend/print_assist/simulation.py` | Pure clock, progress, material and completion transitions |
| `backend/print_assist/scheduling.py` | Compatible assignments and completion estimates |
| `backend/print_assist/recovery.py` | Fault effects and validated recovery proposals |
| `backend/print_assist/scenarios.py` | Deterministic seed/reset factories |
| `backend/print_assist/metrics.py` | Simulated outcomes and baseline comparison |
| `backend/print_assist/agents/contracts.py`, `fake.py`, `gateway.py`, `budgets.py` | Typed proposals, scripted adapter, invocation guards, atomic reservations |
| `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html` | Frontend toolchain and entry shell |
| `frontend/src/main.tsx`, `App.tsx`, `styles.css` | Mounting, page composition, schematic layout |
| `frontend/src/api.ts`, `types.ts` | API access and generated API types |
| `frontend/src/components/OrderForm.tsx`, `OrderQueue.tsx`, `PrinterFloor.tsx`, `ActivityFeed.tsx`, `AgentPanel.tsx`, `MetricsPanel.tsx` | Focused operator interactions and displays |
| `backend/tests/unit/`, `backend/tests/integration/`, `frontend/src/**/*.test.tsx`, `tests/e2e/` | Behavior, contract, persistence, and browser checks |
| `compose.yaml`, `Dockerfile`, `.dockerignore`, `.gitignore` | Local packaging and generated/private-file exclusions |
| `docs/development.md`, `docs/demo.md` | Native/container setup, verification matrix, demo procedure |

## Shared contracts

- `FactorySnapshot`: `session_id: UUID`, `revision: int`, `simulation_time: UTC
  datetime`, `running: bool`, printers, orders, jobs, artifacts, events, and
  controls. Money/pricing is not part of production state.
- `OrderCreate`: artifact ID, positive integer quantity, priority, UTC production
  due time and ship-by time. Artifact holds positive duration, filament grams,
  type/color, and compatible capabilities. Reject invalid/unknown values.
- `CommandEnvelope`: session ID, expected revision, idempotency key, typed
  payload. Mutation retries with the same key/payload return the original result;
  changed payload conflicts. Stale session/revision returns HTTP 409.
- `FactoryService.execute(command: CommandEnvelope) -> FactorySnapshot` validates
  and atomically commits commands. `snapshot() -> FactorySnapshot` is read-only.
- `advance(snapshot: FactorySnapshot, seconds: int) -> FactorySnapshot` is a pure
  deterministic transition. Negative steps fail; zero is a no-op.
- `AgentAdapter.propose(request: AgentRequest) -> AgentProposal` returns typed,
  bounded tool actions and a brief user-facing explanation, never hidden thought.
  Proposals carry originating session/revision; they do not mutate state directly.

## Task 1: Offline order-entry vertical slice

**Status:** Implemented on `feat/order-intake`; see
[setup and verification](../../development.md). Subsequent tasks are not started.

**Branch:** `feat/order-intake`.
**Files:** Create toolchain/check runner, contracts/store/service/API, seed factory,
frontend shell/API/types/OrderForm/OrderQueue, `.gitignore`, and development guide.
**Tests:** `backend/tests/unit/test_orders.py`, `test_service.py`, `test_checks.py`,
`backend/tests/integration/test_orders_api.py`,
`frontend/src/components/OrderForm.test.tsx`, `tests/e2e/order-intake.spec.ts`.

**Interfaces:** Produce `FactoryService`, `FactorySnapshot`, `OrderCreate`, and
`CommandEnvelope` above. Routes: `GET /api/health`, `GET /api/state`,
`POST /api/orders`; service returns 201 for new orders, 422 invalid input,
409 conflicts. Generate TypeScript contract types from the API schema and
verify regeneration produces no drift.

- [x] Set up dependencies and test harness, then write failing behavior tests:
  valid order appears once; zero/fractional quantity, invalid dates, and unknown
  artifact are rejected; same idempotency key replays safely; stale revision
  conflicts; restart retains the order but returns controls OFF/clock paused.
- [x] Run `python -m pytest backend/tests/unit/test_orders.py -q`; verify an
  intended assertion fails after minimal importable interfaces exist.
- [x] Implement validated intake and SQLite transactions, then the order form
  and queue. Test error feedback and preservation of entered values on failure.
  No model provider dependency or initialization is allowed.
- [x] Implement root commands `python scripts/check.py unit`, `full`, `coverage`.
  `full` includes backend/integration, frontend, type/build, and browser checks;
  `coverage` additionally enforces statement/branch targets. Runner failure must
  propagate a nonzero exit code. Offline checks block outbound traffic; browser
  and local-server access allow loopback only. Downloads belong to setup, not tests.
- [x] Run the focused tests, all three root commands, and the browser order-entry
  check. Expected: zero failures and one persisted order displayed in the UI.
- [x] Update knowledge map/setup docs and commit this slice. Record commands,
  expected environment, actual results, and known gaps.

## Task 2: Deterministic three-printer production

**Branch:** `feat/printer-simulation`, after task 1 integration.
**Files:** Create `simulation.py`; extend scenarios, contracts, service and API.
**Tests:** `backend/tests/unit/test_simulation.py`, `test_scenarios.py`,
`backend/tests/integration/test_simulation_api.py`.
**Interfaces:** Produce `advance(snapshot, seconds)`; commands `AssignJob`,
`PausePrinter`, `ResumePrinter`, `SetPrinterOffline`, `AdvanceClock`, `SetRunning`,
and `ResetScenario`. Add `POST /api/commands` and `POST /api/scenarios/reset`.

- [ ] Write tests proving exactly three printers, simultaneous independent
  progress, pause/offline behavior, exact material accounting, and completion
  counted once. Include insufficient filament, incompatible assignment, invalid
  clock increments, and two competing assignments using the same revision.
- [ ] Run `python -m pytest backend/tests/unit/test_simulation.py -q`; observe
  intended failures, then implement the pure transitions and single-owner clock.
  Ticks use the same serialization/transaction boundary as manual commands.
- [ ] Test reset to seeded and empty-orders scenarios: new session, restored
  baseline, stopped clock, disabled agents. No wall-clock sleeps in unit tests.
- [ ] Run full/coverage commands; update map and commit. Expected: exact repeatable
  quantities/material totals, no double booking, zero provider calls.

## Task 3: Scheduling and operator dashboard

**Branch:** `feat/production-dashboard`, after task 2.
**Files:** Create `scheduling.py`, PrinterFloor/ActivityFeed; extend queue,
API polling, contracts, service and styles.
**Tests:** `backend/tests/unit/test_scheduling.py`,
`frontend/src/components/PrinterFloor.test.tsx`, `OrderQueue.test.tsx`,
`frontend/src/api.test.ts`, `tests/e2e/production.spec.ts`.
**Interfaces:** `plan_schedule(snapshot: FactorySnapshot) -> ScheduleProposal`
returns assignments, estimated completion and risk reasons; `ApplySchedule`
uses session/revision validation. Scheduling is deterministic and agent-free.

- [ ] Write tests for priority then earliest production due time with stable ID
  tie-breaking, compatibility, filament type/color/remaining grams, unavailable
  printers, and infeasible deadlines. One printer processes one job at a time;
  planned material reservations cannot exceed inventory.
- [ ] Run focused scheduling tests and confirm failures; implement proposal and
  application. Test exact due-time equality as on-time and UTC-equivalent dates
  as equal. Estimates must explain missing capacity rather than invent completion.
- [ ] Test and implement polling with cleanup/no overlapping polls, visible
  connection failures, and protection against out-of-order responses across reset.
  Show printers, manual controls, queue risk, and entity-linked activity without
  exposing implementation details as operator decisions.
- [ ] Run full/coverage commands and browser order-to-print-completion workflow;
  update map and commit. Expected: manual operation works with agents OFF.

## Task 4: Fault isolation and reviewed recovery

**Branch:** `feat/fault-recovery`, after task 3.
**Files:** Create `recovery.py`; extend contracts/service/API, PrinterFloor and
ActivityFeed.
**Tests:** `backend/tests/unit/test_recovery.py`,
`backend/tests/integration/test_recovery_api.py`,
`tests/e2e/recovery.spec.ts`, extend PrinterFloor component tests.
**Interfaces:** `inject_fault(snapshot, printer_id, fault) -> FactorySnapshot`;
`validate_recovery(snapshot, proposal: RecoveryProposal) -> None`; commands
`InjectFault`, `ClearFault`, `ApplyRecovery`, `RejectRecovery`. Validation raises
typed domain errors mapped to visible API errors.

- [ ] Write a fault-effect table and tests for runout, thermal fault, network
  disconnect, clog, and insufficient material. Faulted printers stop progressing
  immediately without inference. Unsafe equipment stays unavailable until cleared.
- [ ] Run focused tests and confirm intended failures; implement transitions.
  Conservatively fail the interrupted attempt, retain consumed filament as waste,
  and create a new attempt only through validated recovery, never count it twice.
- [ ] Test review/reject/apply, printer capability and material checks, stale
  proposals, concurrent apply, and already-completed quantities. Recovery cannot
  mutate state after reset or duplicate an existing replacement attempt.
- [ ] Implement review UI; run full/coverage and browser fault-to-recovery checks.
  Update map and commit. Expected: all five fault types are observable and safe.

## Task 5: Fake agent framework and execution boundaries

**Branch:** `feat/guarded-agent-framework`, after task 4.
**Files:** Create agents contracts/fake/gateway/budgets modules and AgentPanel;
extend configuration, API, service and activity history.
**Tests:** `backend/tests/unit/test_agent_gateway.py`, `test_agent_budgets.py`,
`backend/tests/integration/test_zero_inference.py`,
`frontend/src/components/AgentPanel.test.tsx`, `tests/e2e/agent-controls.spec.ts`.
**Interfaces:** `AgentGateway.propose(request: AgentRequest) -> AgentProposal`;
`BudgetLedger.reserve(run_id, input_tokens, output_tokens) -> Reservation` and
`reconcile(reservation_id, actual_usage)`; commands enable/disable agents,
enable/disable automatic triggers, request/cancel proposal. All share session
identity. Only service-validated typed tools can alter manufacturing state.

- [ ] Write failing tests for OFF chat rejection without queuing, OFF startup/reset,
  automatic triggers separately OFF, and dev/test always refusing live adapters
  even with credentials. Fake runs are explicitly labeled and controlled; disabled
  chat never silently returns a fake answer. Never initialize a live SDK.
- [ ] Run gateway tests, confirm intended failures, then implement fake routing
  for order review, scheduling, operations and recovery. Call only relevant roles;
  no unbounded delegation or telemetry-triggered planning.
- [ ] Write tests and implement atomic shared call/token/step/retry/concurrency/time
  limits. Require finite positive configuration before a demo. Token reservations
  include input and maximum output for all calls; unknown usage retains the
  reservation. Fake adapters provide deterministic usage for these tests.
- [ ] Test simultaneous budget reservations, timeout and bounded retry, cancellation,
  late response after OFF/reset/restart, and re-enable without replay. Canceling
  cannot falsely imply already-sent requests cost nothing.
- [ ] Implement chat/proposal review/activity/budget controls; do not display hidden
  reasoning or secrets. Run full/coverage including zero-inference checks for all
  earlier workflows; update map and commit. No live provider work in this task.

## Task 6: Business metrics and portable demo packaging

**Branch:** `feat/offline-demo`, after task 5.
**Files:** Create `metrics.py`, MetricsPanel, Dockerfile/compose/.dockerignore,
`docs/demo.md`; extend fixtures/check runner/setup docs.
**Tests:** `backend/tests/unit/test_metrics.py`,
`frontend/src/components/MetricsPanel.test.tsx`, `tests/e2e/demo.spec.ts`.
**Interfaces:** `calculate_metrics(snapshot: FactorySnapshot) -> MetricsSummary`
reports due-order count, on-time print completion rate (null when no orders due),
failed-attempt grams, interventions, recovery time, utilization and completion
duration when measurable. All values are labeled simulated.

- [ ] Write metric tests for no data, exact deadline boundaries, failed/repeated
  attempts, canceled orders, reset, and counts distinct from actual operator
  minutes. Run to intended failure, then implement aggregation and UI.
- [ ] Define seeded assisted/manual and no-fault comparisons with identical
  workload/clock/fault schedule. Do not invent savings or substitute simulated
  clock duration for measured human effort.
- [ ] Package a local production build: frontend assets served by FastAPI at
  `http://localhost:8000`, SQLite in a named volume, one backend worker, loopback
  host binding, health check, no secrets, no external fonts/CDNs. Document native
  dev servers, production build, reset, volume removal implications, and shutdown.
- [ ] Run full/coverage and complete offline browser demo. Build and smoke-test
  Compose: health, UI, order persistence across restart, controls OFF/clock paused,
  reset, and shutdown. Initial dependency/image/browser downloads need internet;
  installed app operation and automated tests do not.
- [ ] Document Windows/macOS/Linux native setup matrix and available container
  architectures. Record tested versions/results; mark unavailable systems untested.
  Verify Chromium in automation; record Firefox/WebKit smoke checks when available.
  Do not claim universal compatibility from a Windows-only run.
- [ ] Update map and commit. Record the framework-readiness checklist against
  SPEC section 10; open gaps block live demos rather than being silently waived.

## Optional follow-on: bounded live demo adapter

After all six tasks and offline readiness verification, choose provider/model
with the operator, write a separate adapter plan, and implement it against fake
transports first. Live invocation additionally requires explicit backend demo
mode, operator enablement, and finite session budgets. Restart/reset/disable
must preserve every tested guard. No live runs are authorized by this plan.

## Execution and review

Use the [judging readiness checklist](../../judging-readiness.md) throughout
delivery. Technical execution is 30% of the supplied rubric; customer/problem,
financial logic, and impact/growth together account for 60%. Reserve effort for
evidence and presentation alongside implementation, without adding product scope.
The checklist is a preparation aid, not a claim of achieved scores.

- During tasks 1-3, prepare the customer/problem narrative and record available
  seller evidence, explicitly marking assumptions that remain unvalidated.
- During tasks 4-5, capture the recovery story and explain why agent assistance
  adds value beyond a deterministic scheduler. A fake adapter does not prove
  model reasoning; say which mode is being demonstrated.
- During task 6, finish the pricing/cost sensitivity worksheet, matched scenario
  comparison, roadmap, timed pitch, and offline demo fallback. Track missing
  evidence separately from technical completeness.

Implement inline to minimize development token overhead. Each task follows
red-green-refactor, passes root full/coverage checks, updates the graph, and ends
in focused local commits. Review a task before starting dependent work. Branches
start from the accepted predecessor; merge/push requires separate authorization.
If a partner takes UI work, freeze API contracts together first.

No application code, dependency installation, CI service configuration, or live
agents are part of writing this document. Hosting, billing, marketplace import,
physical equipment, resin/metal, design generation and 3D rendering remain out
of this plan. CI execution of root offline checks is a follow-on repository
configuration task once commands exist; publishing/configuring remote CI needs
explicit authorization.
