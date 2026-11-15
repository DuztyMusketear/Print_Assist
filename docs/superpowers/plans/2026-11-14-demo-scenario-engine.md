# Demo scenario engine implementation plan

**Spec:** [Reusable events design](../specs/2026-11-14-demo-scenario-engine-design.md).
Continue `feat/automatic-workload-transfer`; preserve the current local implementation.

- [x] Reproduce the one-job-only rebalance, implement full approved future pool
  balancing with safety/material preservation, and verify pause/resume and offline/online.
- [x] Reproduce urgent orders blocked behind existing reservations; extend read-only
  proposals and atomic application to replan approved parts without replacing IDs or
  releasing unrelated approvals. Reject plans that drop existing commitments.
- [x] Add strict scenario event contracts, shared reusable shop ingestion, deterministic
  event engine and service/API transaction wiring with persistent dedup/history/impacts.
- [x] Add collapsed configurable DemoScenarios with actual tool history, guarded retry,
  inspection/refill controls, explicit simulation/agent limits, and App command wiring.
- [x] Verify real sequential browser events, balanced backlog, completion, reset and
  mobile layout. Resolve independent review findings with regressions.
- [x] Update maps/spec/backlog/development/runbook. Run full root offline coverage,
  schema, build and browser suite. Refresh the existing preview without a reset.

No commit, merge, remote publication, live inference or hardware execution is included.


Final root command `scripts/check.py coverage` passed: 253 backend + 335 frontend
+ 26 browser tests (614 total), 100% application coverage, generated schema drift,
TypeScript and production build. Final browser run includes all five sequential
scenarios, restored backlog, exact completion, reset and compact expanded controls.
Desktop/mobile screenshots inspected with no horizontal overflow. Independent
review's two P2 findings have regression fixes: explicit-only policy overrides and
protection of remaining original stock during backlog placement. Existing Vite
bundle-size advisory remains. Preview saved state retained; no live inference ran.
