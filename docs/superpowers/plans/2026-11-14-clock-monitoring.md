# Clock, forecasting and monitoring plan

Execute inline with test-driven development. References: SPEC 6-7, 10, 12;
backlog PA-202/302/303 and MVP Tasks 2-3. User authorizes continued implementation.

Design: extend existing transactional service, no external services or agents.
One FastAPI lifespan task advances a fixed one-second tick at 1/60/300/3600x.
No elapsed-wall-time catch-up. Startup/reset pause; shutdown cancels the owner.
Clock commands use existing revision/session/idempotency guards. Forecasts are
read-only conservative list scheduling: include held jobs, material and capacities,
manual/paused work has no promised finish. Exact deadline equality is on time.
Telemetry is deterministic illustrative current/target temperature, labeled simulated.
Client uses a recursive one-second refresh with cleanup and existing stale guards.

- [x] Test clock pause/run, speed validation, replay, tick ownership and reset.
- [x] Test forecast quantity, shared capacity/material, holds and deadline boundaries.
- [x] Implement typed contracts, projections, backend lifespan and regenerate types.
- [x] Test UI run/pause/speed, forecasts, polling errors/nonoverlap and cleanup.
- [x] Root offline coverage/browser checks, map/backlog updates and review.

Review corrections: queued work schedules before advancing a tick; completed
forecasts retain completion-event timestamps; high-speed ticks use bounded batches
and known advancement errors pause with a visible event instead of losing the owner.
Forecast assumption: supplied estimates, immediate automatic assignment and no
future outages; unavailable held/manual work has no promised finish.

Verification on Windows/Chromium (2026-11-14):
`.venv\Scripts\python.exe scripts/check.py coverage` passed 69 backend,
96 frontend and 7 browser tests; 100% statement/branch coverage, schema drift and
production build passed. Browser workflow confirms automatic progress and live
forecast display. Read-only review findings have regression coverage. No models
or physical printers ran. Vite retains its existing large-bundle advisory.
