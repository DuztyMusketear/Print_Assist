# Print Assist — Product and MVP Specification

**Status:** Draft for planning  
**Product:** Print Assist  
**Target delivery:** Approximately 48-hour hackathon prototype  
**Primary constraint:** No agent or LLM execution until its framework is implemented; agent execution must remain explicitly controllable for token-conscious demos.

## 1. Product summary

**Positioning:** Print Assist helps small 3D-printing businesses fulfill orders
reliably with less hands-on supervision.

The first customer is an owner-operated business using filament (FFF/FDM)
printers to produce items from existing print-ready files. An Etsy shop selling
figures is the primary demo example, not a restriction on the product: the same
workflow supports accessories, decorations, personalized products, and parts.

Print Assist is a virtual manufacturing control center for a small 3D-printing
farm. A user gives production instructions to an orchestrator, which can delegate
planning to manufacturing specialists and invoke validated tools. A deterministic
simulation owns printer state, advances print jobs, and emits telemetry.

The prototype demonstrates how agentic reasoning can coordinate production and
recover from simulated disruptions. It does not claim real-world manufacturing
performance or control physical printers.

**Guiding principle:** Build a miniature autonomous factory, not an AI-powered
CAD application.

## 2. Goals and success measures

### Goals

- Help a seller protect order deadlines, reduce production supervision, and
  understand filament wasted on failed attempts.
- Demonstrate a coherent request-to-production workflow across three virtual
  printers.
- Make production state, agent reasoning, tool execution, and failures visible
  to a presenter.
- Allow users to change priorities and respond to failures while jobs are active.
- Keep simulation and routine operations independent of LLM inference.
- Make agent execution safe to disable and inexpensive to demonstrate.
- Support repeatable demos and early integration within the hackathon timebox.

### Prototype success measures

- A presenter can explain the state of all three printers, the queue, and current
  jobs from the UI.
- A user can submit a request, see it represented as a job, and observe it being
  scheduled and simulated.
- A simulated fault is visible, unsafe activity is deterministically stopped or
  isolated, and a recovery plan can be reviewed and applied.
- With agents disabled, the simulation and its manual controls continue working
  and produce zero agent/LLM calls.
- A demo can be reset to a known starting state without restarting the app.
- The UI reports prototype metrics as simulation results, not validated
  real-world performance.

### Business impact and measurement

The customer problem is the effort of coordinating orders, printer capacity,
filament availability, and failed jobs while trying to meet shipping deadlines.
The value hypothesis is more orders ready on time with less operator effort
and material waste. These benefits require customer validation; they are not
established by a successful simulation.

- **Production readiness on time:** Orders with all requested items successfully
  printed by their production due time, divided by orders due in the measured
  period. Production due time leaves an operator-defined allowance before the
  ship-by deadline for finishing, packing, and shipping.
- **Operator effort:** Track manual interventions in the prototype. Measure
  actual operator minutes per order in later customer trials; elapsed simulation
  time is not a substitute for human effort.
- **Material waste:** Simulated filament consumed by failed or abandoned
  attempts, reported separately from successful output.
- **Supporting measures:** Order completion time, recovery time, and printer
  utilization. Higher utilization alone is not proof of customer value.

Use the same seeded workload, fault schedule, and clock settings when comparing
manual scheduling with assisted scheduling. Include a no-fault baseline. Label
every comparison simulated and do not claim measured business savings until
real customer trials establish them.

## 3. Users and primary demo

### Primary user

A small-business owner/operator fulfilling customer orders using filament
printers and existing print-ready files. They need to know which orders may miss
their deadlines, what is running, what needs attention, and how to recover from
failures. A presenter demonstrates this operator's workflow in the simulator.

Hobbyists are a possible entry segment; industrial and metal-printing operations
are later expansion opportunities requiring separate discovery and validation.
They do not drive MVP requirements.

### Primary demo journey

1. Start a seeded demonstration floor with three printers, active jobs, and queued
   work for a fictional Etsy figure shop, including quantities, filament
   requirements, production due times, and ship-by deadlines.
2. Show that agent execution is OFF and that no agent calls are occurring.
3. Enter an order manually using an existing print-ready artifact. In a verified
   live demo, enable agents explicitly and ask to prioritize orders due soon.
   During development, exercise the same scenario through labeled local fakes.
4. Inspect the orchestrator's explanation, specialist activity, and proposed
   scheduling changes.
5. Inject a fault, such as filament runout, and show deterministic equipment
   isolation plus a reasoned recovery proposal.
6. Review and apply the proposal; observe the queue and printer assignments
   update, including any orders still at risk. Complete the requested quantities
   and mark the order print-complete, ready for human finishing and packing.
7. Reset the scenario and repeat with the same initial conditions.

The product must also support a normal production scenario that begins without
the seeded demo jobs.

## 4. Scope

### MVP: required

- Three independently simulated virtual printers.
- Shared, authoritative manufacturing state and a production queue.
- Manual order entry and reference to existing print-ready artifacts, with
  quantity, filament type/color, estimated duration/material use, production due
  time, and ship-by deadline. File references and estimates are supplied by the
  operator or seeded fixtures; arbitrary file parsing is not required.
- Deterministic job progression, telemetry, and completion.
- Interactive manufacturing-floor overview and per-printer details.
- Orchestrator chat for production instructions and explanations.
- Specialist responsibilities for order review, scheduling, printing operations,
  and monitoring/recovery. Model creation and supports/preparation are future
  extension points, not required active agents or MVP integrations.
- Validated tools for reading state and proposing or applying supported
  operations.
- Simulated fault injection, visible fault states, and recovery workflow.
- Agent activity and tool-call history.
- Demo seeding, reset, and repeatable scenarios.
- Explicit agent controls described in section 5.

### Not in the MVP

- Physical printer connectivity or commands to real equipment.
- Resin and metal-printing workflows.
- Etsy or other marketplace integrations, automatic order import, billing, and
  subscription enforcement. Manual order entry demonstrates the core workflow.
- Automated painting, finishing, packing, shipping, or marketplace fulfillment
  updates. Print completion does not mean the customer order has shipped.
- Design prompting or generating new designs from natural language; this is a
  nice-to-have follow-on capability.
- A production-grade CAD editor or arbitrary natural-language-to-CAD system.
- Physically accurate thermal, material, or mechanical simulation.
- Reliable production slicing or support optimization.
- Multi-facility, multi-tenant, or commercial user management.
- Claims of validated savings, throughput improvements, or autonomous
  real-world safety.

OpenSCAD templates, geometry validation, and PrusaSlicer integration are
follow-on capabilities unless the core workflow is complete early.

## 5. Agent execution and token controls

Agent activity is a product feature and a hard runtime boundary, not just a
presentation preference.

### Development and demo boundary

- Development, automated tests, builds, and CI must use deterministic local
  fakes for agents, model providers, printer connections, CAD, and slicing.
  They must require no model credentials, paid inference, or physical hardware.
- Live agents may run only after the framework readiness gate in section 9 is
  satisfied and an operator explicitly starts a demo session. Development and
  test modes must reject live invocation even if credentials are present or a
  UI control is enabled. Demo mode must also be explicitly selected at backend
  startup; a browser control alone cannot unlock live execution.
- Do not initialize live agent SDKs, discover models, warm up providers, or
  launch autonomous workers at import, startup, hot reload, build, or test time.
- A fake/demo-script response must be labeled as simulated; it is not evidence
  that live orchestration works. Maintain the same typed gateway/tool contracts
  for fake and live adapters.
- The end-to-end manufacturing vision spans request intake, part preparation,
  validation, scheduling, production, monitoring, recovery, and completion.
  The MVP implements this lifecycle with simulated artifacts and equipment;
  real CAD, slicing, and hardware remain follow-on integrations.

### Bounded demo execution

- Before live execution, require finite operator-configured limits for model
  calls per run/session, output tokens per call, total session token usage,
  tool/delegation steps, retries, concurrent runs, and run duration. No unlimited
  defaults or recursive specialist delegation are permitted.
- Reserve a conservative input/output token allowance before each provider
  request; reject requests that cannot fit the remaining session budget. Include
  all specialists and retries in the same accounting, and reconcile reported
  usage after responses. Unknown usage retains its reservation.
- Show calls, token usage/reservations, remaining limits, and stop reasons.
  Reaching a limit stops further inference and leaves manual simulation usable.
- Disabling agents, ending the demo session, or resetting cancels queued work,
  requests cancellation of in-flight work where supported, and invalidates its
  authority to apply actions. Late responses must not mutate the reset/new
  session. Re-enabling must not replay old requests. Already-dispatched calls
  may still incur provider charges; surface them explicitly.
- No automatic retry loops, polling agents, or background planning. Automatic
  event triggers, if demonstrated, remain separately opt-in and share all limits.

### Required controls

- **Agents Enabled** is a prominent global switch and defaults to **OFF** on
  startup and after a demo reset.
- When OFF, the application must not call an LLM, agent SDK, or remote model
  endpoint. This includes user chat, fault events, scheduled tasks, retries, and
  hidden/background work.
- The simulation, dashboard, fault controls, and supported manual operations
  remain usable while agents are OFF.
- If an agent-only request is submitted while OFF, explain that agents are
  disabled; do not silently simulate an agent response or queue a call for later.
- Enabling agents permits user-initiated orchestration, but **automatic
  agent-triggered runs for faults or other background events have a separate
  control and default to OFF**. No simulation tick may invoke an agent.
- Changing either control takes effect immediately and is visible in the UI.
  Disabling agents prevents new calls. Any in-flight call must be surfaced as
  in progress and its result must not apply state changes without deterministic
  validation.
- Show agent activity and tool calls with status, timestamp, outcome, and
  associated job/printer where available. Do not expose secrets or hidden
  reasoning traces.
- Cache reusable generated artifacts where practical and make cache hits
  distinguishable from new inference.

### Invocation policy

Agents may be requested for explicit user instructions and, only when the
separate automatic-trigger control is enabled, selected operational events.
Routine print progression, normal completion, and telemetry updates are always
deterministic. Specialist agents are invoked only when relevant to the request.

### State-changing actions

Agents recommend actions through typed tools; deterministic application code
validates authorization, current state, equipment compatibility, and safety
constraints before changing shared state. Invalid or stale actions are rejected
with a visible reason. A recovery plan is reviewable before application; the
demo may make acceptance explicit even where routine scheduling changes can be
applied automatically.

## 6. Core user stories and requirements

### Production coordination

- As an operator, I can submit a manufacturing request and see it represented
  in the production queue.
- As an operator, I can ask to prioritize work, minimize completion time, take
  a printer offline, or reallocate work.
- The system shows the resulting plan, affected jobs/printers, and any
  assumptions or incompatibilities.
- Scheduling considers printer availability and capabilities, job requirements,
  filament type/color and availability, production due times, and priority.
- Show estimated production completion and deadline risk with assumptions;
  report infeasible deadlines rather than promising every order can be met.
- Track successful quantities across jobs and retries. Failed attempts do not
  count toward fulfillment; an order becomes print-complete only when all
  requested quantities succeed. Repeated completion events must not double-count.
- Manual order intake and scheduling remain available with agents OFF.

### Printer floor and simulation

- Each printer has an identifier, operational state, current job, progress,
  material inventory, temperature readings, capabilities, and fault state.
- The floor view makes running, idle, paused, offline, and faulted states
  distinguishable.
- Jobs progress on a configurable accelerated simulation clock, independently
  and concurrently.
- Normal progression and completion do not invoke agents.
- A simplified animated printhead or progressive object representation is
  sufficient; visual fidelity is secondary to legibility.

### Faults and recovery

- Users can inject at least filament runout, thermal fault, network
  disconnection, nozzle clog, and insufficient material.
- A fault and its effect on the affected printer/job are visible.
- Deterministic safety rules put unsafe equipment into a safe state before any
  agent recommendation is considered.
- Monitoring/recovery reasoning uses current shared state and proposes
  supported actions, such as rescheduling or restarting a job.
- The user can see and apply/reject the recovery plan. The simulator records the
  outcome.

### Demonstration and observability

- The user can select or reset a seeded scenario with predictable printers,
  jobs, and queue contents.
- Reset returns simulation state to the scenario baseline and turns agent
  controls OFF.
- The activity log separates user messages, agent runs, tool calls, simulator
  events, and deterministic safety actions.
- Metrics include printer utilization, throughput, recovery time, human
  interventions, material waste, and order completion time where the simulator
  has enough data. Metrics must be labeled simulated.

## 7. System design

### Ownership boundaries

- **Frontend:** Floor visualization, queue, telemetry, chat, controls, history,
  and metrics.
- **Backend/API:** Authoritative state, validation, simulation clock, scenario
  management, event delivery, and agent gateway.
- **Simulation engine:** Deterministic printer/job transitions and telemetry;
  has no dependency on an agent framework.
- **Agent layer:** Orchestrator plus focused specialists. It reads shared state
  and requests actions through narrow typed tools.
- **Persistence:** Lightweight storage for current state, scenarios, and
  activity history; restart behavior should be explicit.

### Architectural rules

1. The backend is the source of truth for manufacturing state.
2. Agent framework dependencies are isolated behind an agent gateway so the
   simulation can run without them.
3. All state changes pass through deterministic validation.
4. The agent enable controls are checked at the invocation boundary, not only
   hidden in the UI.
5. Simulation time and LLM time are independent.
6. Events are explicit and inspectable; do not rely on agents observing an
   unbounded stream of telemetry.
7. Agent/tool errors are visible and do not become success-shaped fallback
   results.

### Suggested state entities

- **Printer:** identity, capabilities, operational state, material inventory,
  telemetry, fault, and assigned job.
- **Job:** identity, requested part/quantity, priority, requirements, status,
  assigned printer, progress, and estimated/actual duration.
- **Order:** user request, requested items, priority, and completion state.
- **Order detail:** each item references a print-ready artifact and requested
  quantity; track successful quantities, production due time, ship-by deadline,
  estimated completion, and deadline risk. Keep marketplace references optional.
- **Print-ready artifact:** identity/reference, revision, compatible printer
  requirements, filament type/color, and operator-supplied duration/material
  estimates. The MVP does not generate, slice, or certify the artifact.
- **Scenario:** initial printers, jobs, orders, clock settings, and available
  fault injections.
- **Activity event:** timestamp, actor/source, event type, relevant entity,
  status, and outcome.

## 8. Proposed technology direction

Keep the initial implementation lightweight and replaceable. These are
recommendations, not prerequisites:

- Frontend: React, TypeScript, and Vite.
- 3D floor: Three.js or React Three Fiber; a clear 2D/schematic fallback is
  acceptable if it accelerates integration.
- Backend: Python and FastAPI.
- State and validation: Pydantic with SQLite for prototype persistence.
- Live updates: WebSockets; polling is an acceptable time-boxed fallback.
- Agent SDK: choose after confirming team familiarity and API access. Keep the
  SDK behind the agent gateway and ensure the disabled mode does not initialize
  or call it.
- CAD/slicing: defer OpenSCAD, Trimesh, and PrusaSlicer integration until the
  core simulated workflow works.

Avoid adding infrastructure or dependencies unless they directly unblock an
MVP requirement.

## 9. Delivery sequence for a 48-hour hackathon

Prioritize vertical integration and a reliable demo over breadth.
Apply the test-first workflow in section 12 to every implementation step.

1. **Agree on contracts:** Define printer/job states, seed scenario, API/event
   shapes, and agent-control semantics.
2. **Build the deterministic core:** Three printers, queue, clock, job
   progression, resettable scenario, and fault transitions.
3. **Integrate the floor UI:** Show printers, jobs, status, progress, and manual
   controls against the same backend state.
4. **Wire interaction:** Add chat/request intake and activity feed. In agent-off
   mode, communicate the disabled state and retain manual operability.
5. **Add guarded agent path:** Implement the gateway, orchestrator/tools, and
   specialist responsibilities. Verify global OFF and automatic-trigger OFF
   behavior using local fakes. Keep live providers unavailable during development.
6. **Complete recovery demo:** Inject a fault, enforce deterministic safety,
   produce a reviewable recovery plan using a fake adapter, and apply it through
   validated tools.
7. **Harden presentation:** Reset repeatedly, verify the token controls, label
   simulated metrics, and rehearse the primary demo journey.

**Framework readiness gate:** Before any live demo, the deterministic lifecycle,
typed gateway/tools, frontend/backend integration, fault/recovery flow, disabled
mode, session invalidation, and budget enforcement must be implemented and pass
the offline unit, integration, and end-to-end suites. Record the verification
commands/results. Only then may an operator explicitly enable a bounded live
demo. Live model evaluation is optional, manual, and separate from development
and CI; it is never a prerequisite for the offline test suite to pass.

If schedule slips, preserve the deterministic core, three-printer view,
repeatable fault/recovery story, and explicit agent OFF control. Defer advanced
3D rendering, CAD, and slicing.

## 10. Acceptance checklist

- [ ] Fresh startup has Agents Enabled OFF and automatic triggers OFF.
- [ ] With agents OFF, user messages, simulation ticks, faults, retries, and
  reset cause zero model/agent invocations.
- [ ] Manual simulation and fault controls work with agents OFF.
- [ ] Enabling agents is explicit, visible, and reversible.
- [ ] Automatic fault-triggered agent runs require their own explicit enablement.
- [ ] Three printers can run independent jobs and expose their state.
- [ ] Production requests update a visible queue and can be scheduled.
- [ ] A seller can enter an order for an existing artifact with quantity,
  filament requirements, production due time, and ship-by deadline while agents
  are OFF; the queue shows estimated completion and deadline risk.
- [ ] Failed attempts and duplicate completion events cannot inflate fulfilled
  quantities. Print completion is distinct from packing and shipping.
- [ ] The figure-shop scenario demonstrates order intake, prioritization, fault
  recovery, and print completion without Etsy integration or design generation.
- [ ] Fault injection produces observable state and deterministic safety action.
- [ ] Recovery proposals are validated before they change manufacturing state.
- [ ] Agent/tool outcomes and errors appear in the activity history.
- [ ] Demo reset restores the selected seed and turns agent controls OFF.
- [ ] No UI or documentation implies that simulated metrics validate real-world
  operational gains.
- [ ] Development/test startup cannot initialize live agents or send provider
  traffic, even with credentials present and controls enabled.
- [ ] All application behavior has unit tests; new features and bug fixes follow
  a recorded failing-test, passing-test, refactor cycle.
- [ ] Offline unit, integration, and end-to-end suites pass from the repository
  root without model credentials, external services, or physical printers.
- [ ] Live demo execution is blocked until framework readiness is verified and
  backend demo mode plus explicit operator enablement are present.
- [ ] Shared call/token/step/retry/time/concurrency limits stop inference,
  including specialist calls and retries, without interrupting manual simulation.
- [ ] Disable/reset invalidates queued work and late responses; re-enabling
  does not replay old work or allow stale actions to mutate the new session.

## 11. Open decisions

- Which agent SDK and model provider fit team familiarity, access, and budget?
- Which team members own frontend, simulation/backend, and agent integration?
- Should recovery plans always require operator approval, or can selected
  low-risk actions be auto-applied when agents and automatic triggers are on?
- Should demo scenarios be editable in the UI or defined as code fixtures for
  the MVP?
- What should persist across application restart: nothing, the latest state, or
  saved scenarios and history?
- What simulation speed and metric definitions make the live demo understandable?

Resolve these decisions before depending on them in implementation; none should
weaken the agent execution controls in section 5.

## 12. Testing and development policy

### Mandatory test-driven development

For every feature, behavior change, and bug fix:

1. Write a focused unit test specifying the required observable behavior.
2. Run it and confirm it fails for the intended missing behavior, rather than
   an import, environment, or setup error. For bugs, reproduce the defect first.
3. Write the smallest implementation that makes the test pass.
4. Refactor with the tests passing; run affected tests after each change.
5. Run the full offline suite from the repository root before completing or
   integrating the change. Record actual commands and results in the handoff.

Do not write implementation first and add tests afterward. Documentation-only
changes require document review rather than artificial unit tests.

### Unit tests for all application behavior

- Cover domain rules, simulation transitions, scheduling, material accounting,
  order/job completion, faults, recovery, validation, persistence adapters,
  API handlers, gateway orchestration, controls, budgets, and frontend behavior.
- Include valid, invalid, boundary, failure, timeout, cancellation, retry, stale
  state, and concurrency cases where applicable. Assert observable outcomes,
  rather than internal method calls that merely mirror implementation.
- Use seeded fixtures, fake clocks, deterministic identifiers, in-memory or
  temporary storage, and local fakes/spies at external boundaries. Do not use
  real-time sleeps or model responses to decide whether a test passes.
- Test UI interactions, disabled states, error feedback, and displayed updates.
  Test visualization logic where it owns behavior; do not require brittle
  pixel snapshots for decorative rendering.
- Target 100% statement and branch coverage of application-owned behavioral
  code. Any exclusion must identify the file/lines and rationale and receive
  explicit review; exclude third-party/generated code, not difficult behavior.
  Coverage is a gap detector and does not replace meaningful assertions.

### Integration, workflow, and zero-inference checks

- Supplement unit tests with offline API/storage/event integration tests and a
  full request-to-completion workflow through the UI/backend using fake agents.
  Exercise fault, reviewed recovery, reset, and manual agent-off workflows.
- Enforce a network-deny policy for automated tests, permitting loopback only
  when needed for the local test server. Unexpected outbound traffic must fail
  the test, not be silently retried. Test provider adapters with fake transports.
- Use a provider spy that fails on any attempted live invocation. Verify zero
  calls during imports, startup, hot reload initialization, chat while OFF,
  ticks, faults, completion, retries, reset, and development/test mode with
  credentials present. Inspect SDK construction separately from request counts.
- Test budget boundaries, delegated calls, retries, simultaneous requests,
  in-flight disable/reset, late responses, and stale tool actions. Reservations
  and authorization checks must hold under concurrent execution.
- Define fast unit-test, full offline-test, and coverage commands at the repo
  root when scaffolding begins. Use pytest/coverage for Python and
  Vitest/Testing Library for React if the proposed stack is adopted; use an
  appropriate browser runner for the offline end-to-end workflow.
- CI must run the full offline suite and coverage checks without provider keys
  or live agents. A failing test or uncovered unapproved behavior blocks
  integration. Manual live demos are never part of the default test command.

### Definition of done

A behavior is complete only when its test-first evidence, meaningful unit
coverage, relevant integration/workflow checks, and passing full offline suite
are recorded. The hackathon timebox may reduce feature scope, but does not waive
TDD, disabled-agent guarantees, or deterministic validation.

## 13. Commercial direction and validation

### Proposed monetization hypothesis

Use a monthly subscription based primarily on connected printer capacity,
including a bounded AI allowance. Offer optional usage packs with explicit
spending caps; no surprise or automatic overage charges. This is a hypothesis
to validate, not committed pricing or an MVP billing requirement.

- **Hobby:** Limited printer capacity, basic status and notifications; potential
  entry offering after the initial business workflow is validated.
- **Business:** More printer capacity, order scheduling, recovery assistance,
  and team workflows. This is the initial customer segment; team access remains
  a future commercial feature rather than expanding the prototype scope.
- **Enterprise:** Future negotiated fleet capacity, integrations, traceability,
  and deployment options after separate industrial discovery.

Per-print pricing is not the initial proposal: job sizes and durations vary,
and charging for every attempt could penalize retries. Printer capacity is the
proposed understandable base; included AI limits bound inference costs. Test
this assumption with customers before setting tier limits or prices. Default
offline operation must remain independent of commercial AI allowances.

### Validation before commercial commitments

For the hackathon, use public seller discussions, competitor documentation and
pricing, and internal workflow comparisons to inform the customer/problem and
financial hypotheses. No interviews or outreach are planned or required.
Include conflicting evidence and distinguish public anecdotes from measured
demand. Willingness to pay and printer-count pricing remain unvalidated.

Customer pilots should measure actual effort, waste, and production readiness
against the seller's existing process. Evaluate willingness to pay alongside
provider usage, support, and infrastructure costs before claiming viable
margins. No market-size, price, savings, or revenue claims are established here.

### Scope and extension rules

Keep domain entities generic: orders, items, artifacts, jobs, materials, printers,
and deadlines. Etsy and figures belong in fixtures and demo copy, not core
validation or scheduling rules. Marketplace adapters, design prompting, resin,
metal printing, and physical equipment integration require subsequent designs.
