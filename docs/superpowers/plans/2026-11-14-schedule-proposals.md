# Idle start guidance and reviewable scheduling

User authorizes PA-307 and PA-301. Implement inline with TDD against SPEC 6-7/12.

Design: Overview always exposes a new-print action, completed/no-work explanation,
clock guidance and blocked/pending reasons; navigate existing prepared-profile intake.
Read-only deterministic proposal includes session/revision/content hash, future
printer slots and filament, blocked quantities and assumptions. Apply revalidates
hash atomically via existing command receipt guards. Future slots become planned
attempts, dispatched in order as their printer frees; manual slots wait for start.
Start/finish are estimates, never permission to interrupt busy/held equipment.
Reservations derive once from remaining material of active/planned attempts;
physical stock is deducted only by simulation consumption. Snapshot exposes ledger.
Old jobs derive reservations without migration. Existing automatic/manual paths
must honor reservations. Offline/paused work preserves its commitments.

Tests: priority/deadline/ties, future capacity, partial material, busy/held exclusion,
read-only preview, stale apply/reset/replay/concurrency and multi-batch lifecycle.
UI preview/apply/rejection and ledger; actual browser idle -> print -> pause/resume
and proposal -> apply -> progress. Root full coverage, map/backlog and review.

## Delivery evidence - 2026-11-14

Overview explains idle/completed/waiting/paused-clock states and exposes Start a
new print. Orders offers automatic, manual or Review schedule first. Review-first
orders stay held through ticks, without assignments/reservations, until apply.
Schedule preview gives future slots/material/blocked quantities. Pause the clock
during review; stale state requires a fresh preview. Approved planned attempts
run FIFO as equipment frees; manual ones wait for user start. Partial approvals
keep unassigned copies held. Material commitments derive once from unfinished
attempts, not physical stock deduction; only consumption reduces stock.

Review regressions cover manual jobs blocking later automatic forecasts, locked
preview mode, partial holds, and playback carried from intake to apply. Playback
is explicit with a 60x default for observable printing. No live inference/hardware.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed 80 backend,
134 frontend and 11 browser workflows at 100% statement/branch coverage, schema
drift and production build. Browser tests verify visible animated pixel changes,
pause/resume, read-only previews, review-first holds, future reservations and
completion/release. Existing bundle-size advisory remains. User verification of
the improved start experience remains pending; tests are not operator signoff.
