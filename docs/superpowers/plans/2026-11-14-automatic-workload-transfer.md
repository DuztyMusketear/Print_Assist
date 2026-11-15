# Healthy transfer and automated orders implementation plan

**Spec:** [Design](../specs/2026-11-14-automatic-workload-transfer-design.md).
Work on feat/automatic-workload-transfer; root coordinates independent transfer,
automatic intake and risk UI domains, and owns shared service/contracts/wiring.

- [x] Red/green transfer tests and controls/redistribution/scheduling implementation:
  healthy future slots, quantities, compatibility/material, waste, lineage, blocked
  work/retry, manual/incident hold guards and original/revised impacts.
- [x] Red/green order_demo tests and targeted proposal filtering: full automation,
  only new-order confirmation, infeasible/unmatched outcomes and completion refresh.
  Add typed end_to_end mode and shared transactional wiring without live calls.
- [x] Red/green order form/App handoff, OperationalStatus and red part/order risks;
  align queue/timeline projections and keep default healthy status compact.
- [x] Update SPEC/backlog/maps and restore a healthy preview in a new database while
  preserving the old fault demo. Ordinary reload must not erase incident history.
- [x] Full root offline coverage/schema/build/browser checks, independent review and
  actual desktop/mobile inspection. Record evidence and limitations.

No push or merge is included in this implementation request.


Review corrections: pending transfer markers only admit ACTIVE approved attempts;
an incident-owned recovery_pending attempt cannot regain approval through retry.
Already-running jobs retain ETA before future manual holds. Automatic incoming
plans exclude unknown manual queues and use feasible alternative healthy capacity.
Legacy startup-paused parts retain explicit same-printer resume support.

The preview uses a separate empty healthy database. The previous fault database
and its incident history are preserved. Desktop 1440px and mobile 390px inspection
confirmed readable layouts and no mobile horizontal overflow; the automatic intake
form remains accessible. All new source and test files are indexed in the code map.


Final verification: root `scripts/check.py coverage` passed 206 backend, 312 frontend,
and 24 browser tests (542 total), with 100% application statement/branch coverage,
schema consistency, TypeScript and production build. Independent review's three
concrete findings have regression fixes. Existing Vite bundle-size advisory remains.


## Follow-up: healthy printers rejoin queued production

Continue the same local feature branch; preserve its uncommitted implementation.
Root cause: controls only schedule unassigned quantities, so transferred planned
attempts remain on busy printers. Existing priority-before-deadline keys also
conflict with the requested earliest-deadline behavior.

- [x] Reproduce pause/resume and offline/online idle stranding, then implement
  `queue_rebalancing.py` invoked before schedule dispatch. Preserve approved job
  identities, running work, manual/incident holds and material commitments.
- [x] Use deadline before priority in scheduling, proposals, transfers, recovery
  and monitoring; align capture_schedule, timelineSlots and operational warnings.
- [x] Cover healthy/incompatible/manual/incident capacity, exact fulfillment,
  deadline estimates, API replay and real-browser return-to-work regressions.
- [x] Update maps/spec/backlog and run full root offline coverage/schema/build/browser.
- [x] Refresh local preview, preserving saved simulation data and startup safety.


Follow-up verification: 227 backend + 316 frontend + 25 browser tests passed
(568 total), application coverage 100%, schema/build passed. The API regression
caught virtual unassigned impact rows being mistaken for actual jobs; estimate
updates now iterate actual job identities only. Preview restarted against the same
saved healthy database; it had no active printers at restart, and no reset was used.
