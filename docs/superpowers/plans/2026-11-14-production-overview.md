# Production Overview Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and test-first development for each task.

**Goal:** Deliver a working three-printer simulation, scheduling and tabbed dashboard.

**Architecture:** FastAPI owns validated, transactional factory state in SQLite; deterministic simulation and scheduling update it. React displays typed snapshots and sends commands through the existing offline API.

**Tech Stack:** Python, FastAPI, Pydantic, SQLite, React, TypeScript, Vitest, pytest and Playwright.

**Spec:** [Production overview design](../specs/2026-11-14-production-overview-design.md).

## Constraints and review focus

- Three simulated printers; no physical equipment or live agent calls.
- Automatic starts by default, with explicit manual start mode per scheduled work.
- Preserve existing order data, session/revision checks, idempotency and atomicity.
- Cover concurrent scheduling, stale sessions, restart, material limits and duplicate completion.
- Follow red-green-refactor; update maps and run root full and coverage checks.

## Task 1: Typed printer state and migration

Files: `contracts.py`, `scenarios.py`, `service.py`, `store.py`, backend unit/integration tests and generated frontend types.

- [ ] Test a fresh database returns three distinct idle printers with explicit capabilities and material.
- [ ] Test loading a Phase 1 database preserves its orders and initializes printers exactly once; restart pauses the clock and preserves printer state.
- [ ] Run tests and confirm intended failures; implement typed printer snapshots and transactional migration, then rerun tests and regenerate types.

## Task 2: Scheduling and print lifecycle

Files: new focused scheduling/simulation modules, `contracts.py`, `service.py`, `api.py`, backend tests.

- [ ] Define typed schedule, manual-start, clock and printer-control commands using session, revision and idempotency keys.
- [ ] Test automatic assignment and start, manual waiting and start, stable priority/deadline ordering and clear unavailable-resource outcomes.
- [ ] Test concurrent requests, retries, stale commands, incompatible printer/material, insufficient material and atomic failure.
- [ ] Test independent progression, pause, material use, completion exactly once, requested quantities and restart behavior. Run each test to its intended failure before implementation.
- [ ] Implement pure scheduling and simulation transitions and serialized API commands; rerun affected tests and regenerate types.

## Task 3: Overview and tabs

Files: `frontend/src/App.tsx`, API client, focused dashboard components, styles and frontend tests.

- [ ] Test overview default, accessible tab navigation, three printer statuses, queue summary, simulated labels and error states.
- [ ] Test schedule mode selection and manual start interactions against fake transport, including stale response handling.
- [ ] Implement Overview, Orders, Printers and Schedule tabs against the real API; retain order intake and show server validation failures.

## Task 4: End-to-end verification and documentation

Files: `tests/e2e/`, `docs/code-map.md`, `docs/knowledge-map.md`, `docs/development.md`.

- [ ] Add offline browser coverage for order submission, automatic start, manual start and visible printer progress.
- [ ] Update file responsibilities, graph edges, setup and actual verification results.
- [ ] Run `.venv\Scripts\python.exe scripts/check.py full` and `coverage` from the repository root; resolve failures and record results.
- [ ] Review the full diff and shared integration boundary before requesting merge authorization.
