# Reusable demo events and restored printer backlogs

The user requested five configurable simulated external events: marketplace order,
thermal fault, urgent order, insufficient filament and printer restoration. Scenarios
must use shared manufacturing state and real application intake/scheduling/recovery,
never scripted agent responses or predetermined recovery outcomes. Events compose
without resets; explicit reset restores the ordinary fault-free baseline.

The scenario command uses existing session/revision/idempotency transactions and a
persistent event identity guard. Shop ingestion reuses cached product-to-artifact
mappings and validates requested material. Incoming manual requests stay in the
inbox; explicitly authorized end-to-end requests use the normal automatic workflow.
New urgent requests can replan already-approved future automatic parts by earliest
production deadline while preserving their identities and active/completed work.
All original commitments must fit before applying a new order's plan.

Thermal and low-material events route through inject_fault. Recovery remains subject
to existing review/automatic settings, compatibility, stock and deadline constraints.
Fault restoration requires explicit simulated inspection and known positive refill
where required. Returning equipment triggers real scheduling; no fixed printer IDs
or scenario-specific assignments are used.

A healthy returned printer receives a balanced future queue, with running work fixed.
Replan the approved automatic queue pool over compatible healthy available capacity,
reserve material once, prefer an original assignment on equal availability, and
roll back if every approved commitment cannot be preserved. Manual starts and
incident-owned pending recovery attempts stay guarded. Remaining queue times are
recomputed and before/after reports use real forecasts, including indirect orders.

The Overview sidebar adds a collapsed Demo scenarios panel. It configures event,
printer/product/model/quantity/material/deadline/priority, processing mode and policy.
Notifications, persisted event history, real deterministic tool calls, before/after
completion and red risks complement the existing floor, timeline and incidents.
The adjacent acknowledged reset remains available. Ambiguous network retries reuse
the exact event payload/identity until confirmed; reset replaces that UI session.

Live agent orchestration remains planned in this repository. The engine makes zero
LLM calls, reports deterministic tool execution truthfully and labels marketplace and
equipment events simulated. It does not claim a live Etsy integration or physical
printer control, and does not introduce a parallel demo factory or hardcoded outcomes.
