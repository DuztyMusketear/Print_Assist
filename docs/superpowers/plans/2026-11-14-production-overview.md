# Production Overview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and test-first development for each task.

**Goal:** Deliver a working three-printer simulation, scheduling and tabbed dashboard.

**Architecture:** FastAPI owns validated, transactional factory state in SQLite; deterministic simulation and scheduling update it. React displays typed snapshots and sends commands through the existing offline API.

**Tech Stack:** Python, FastAPI, Pydantic, SQLite, React, TypeScript, Vitest, pytest and Playwright.

**Spec:** [Production overview design](../specs/2026-11-14-production-overview-design.md).

## Implementation audit - 2026-11-14

This plan delivered a working foundation on `main`, but is not a declaration that
all original Phase 2/3 acceptance criteria are complete. Use the current
[backlog](../../backlog.md) together with [SPEC sections 6-7, 10 and 12](../../../SPEC.md)
when implementing follow-ups; do not infer completion from passing code coverage.

| Task | Current state | Remaining work |
| --- | --- | --- |
| 1 | Implemented | Maintain old-data compatibility when adding fields. Printer migration and typed API/generation exist. |
| 2 | Partial | Controls, assignment explanations/events and concurrent/material checks added by the local production-controls follow-up. Accelerated run/pause clock and future reservation semantics remain. |
| 3 | Implemented foundation | Existing tabs, real state, controls and history are connected. PA-302/303 still require estimates/risk, automatic refresh and telemetry. 3D views were added by the separate interactive printer plan. |
| 4 | Partial | Offline, visual-model progression, manual completion, pause/offline and scenario reset workflows exist; later recovery workflows remain incomplete. |

The unchecked multi-condition steps below remain open wherever any requirement
is missing. Extend the plan or add a focused follow-up plan before implementation;
use SPEC as the requirement authority and keep per-story evidence in the backlog.

## Constraints and review focus

- Three simulated printers; no physical equipment or live agent calls.
- Automatic starts by default, with explicit manual start mode per scheduled work.
- Preserve existing order data, session/revision checks, idempotency and atomicity.
- Cover concurrent scheduling, stale sessions, restart, material limits and duplicate completion.
- Follow red-green-refactor; update maps and run root full and coverage checks.

## Task 1: Typed printer state and migration

Files: `contracts.py`, `scenarios.py`, `service.py`, `store.py`, backend unit/integration tests and generated frontend types.

- [x] Test a fresh database returns three distinct idle printers with explicit capabilities and material.
- [x] Test loading a Phase 1 database preserves its orders and initializes printers exactly once; restart pauses the clock and preserves printer state.
- [x] Run tests and confirm intended failures; implement typed printer snapshots and transactional migration, then rerun tests and regenerate types.

## Task 2: Scheduling and print lifecycle

Files: new focused scheduling/simulation modules, `contracts.py`, `service.py`, `api.py`, backend tests.

- [ ] Define typed schedule, manual-start, clock and printer-control commands using session, revision and idempotency keys.
- [ ] Test automatic assignment and start, manual waiting and start, stable priority/deadline ordering and clear unavailable-resource outcomes.
- [ ] Test concurrent requests, retries, stale commands, incompatible printer/material, insufficient material and atomic failure.
- [ ] Test independent progression, pause, material use, completion exactly once, requested quantities and restart behavior. Run each test to its intended failure before implementation.
- [ ] Implement pure scheduling and simulation transitions and serialized API commands; rerun affected tests and regenerate types.

## Task 3: Overview and tabs

Files: `frontend/src/App.tsx`, API client, focused dashboard components, styles and frontend tests.

- [x] Test overview default, accessible tab navigation, three printer statuses, queue summary, simulated labels and error states.
- [x] Test schedule mode selection and manual start interactions against fake transport, including stale response handling.
- [x] Implement Overview, Orders, Printers and Schedule tabs against the real API; retain order intake and show server validation failures.

## Task 4: End-to-end verification and documentation

Files: `tests/e2e/`, `docs/code-map.md`, `docs/knowledge-map.md`, `docs/development.md`.

- [ ] Add offline browser coverage for order submission, automatic start, manual start and visible printer progress.
- [x] Update file responsibilities, graph edges, setup and actual verification results.
- [x] Run `.venv\Scripts\python.exe scripts/check.py full` and `coverage` from the repository root; resolve failures and record results.
- [x] Review the full diff and shared integration boundary before requesting merge authorization.
