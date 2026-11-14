# Compact order/schedule implementation plan

**Goal:** Compact, searchable intake and conflict-aware schedule cards with safe
queue management, calendar ticks and repeatable incoming-order demos.
**Spec:** [Design](../specs/2026-11-14-compact-order-schedule-design.md), SPEC 4-7/12.
**Architecture:** Reuse existing transactional commands, pure proposal engine and
approved artifacts. Add focused estimation/projection helpers and reusable dialogs.
**Stack:** Existing Python/FastAPI/SQLite, React/TypeScript and offline tests.

## Constraints / review focus

No live providers, shop calls or partner importer changes. Preserve started work,
consumed material and history. Prevent canceled orders from automatic rescheduling.
Confirmed edits invalidate previous placements; stale confirmations must fail.
Read-only estimates cannot reserve stock/create orders and must discard late UI
responses. Playback speed must not falsely resolve deadline failures. Bound draft
quantity and calendar ticks. Maintain source maps and full offline coverage.

## Tasks

- [x] Write failing API/unit tests for confirmation-required queued revision and
  deletion, reservation release, started-work protection, cancellation exclusion,
  replay/reset and read-only draft feasibility/alternatives.
- [x] Extend order_review.py/contracts/service/API, preserving atomic guards.
  Add an estimate helper reusing propose; cancellation archives unstarted work.
- [x] Test and add per-request simulation in shop.py: unique requests, manual
  pending vs automatic held matching, retry deduplication and required confirmation.
- [x] Test and implement compact model search, stepper/date fields and debounced
  feasibility feedback. Keep supplied estimates and initial library selection.
- [x] Test calendar/timeline projections and conflicts; implement aligned bottom
  ticks and day/week/month controls with bounded labels and mobile scroll.
- [x] Test and implement compact order cards/details and confirmation dialogs;
  wire exact source revisions into commands, keep active prints protected.
- [x] Add browser workflows for conflicting plans, edit/delete confirmation,
  compact layouts and individual manual/automatic incoming requests.
- [x] Update SPEC/backlog/maps; run full offline coverage/schema/build/browser
  checks, independent read-only review and actual preview inspection.

## Execution ledger

Continue native execution on the dedicated branch using the user's standing
preference for uninterrupted implementation. Initial direction uses cards and
details instead of another multi-page wizard to reduce navigation/height.
No merge or push is included without a later explicit user request.

## Follow-up: order colors and demonstration clarity

Continue on this cohesive feature branch; preserve all existing changes. Use the
existing React/CSS timeline and local simulator. No new dependency or remote call.

- [x] Add failing scheduleView and PrintTimeline tests for distinct order colors,
  shared colors across printers, stable colors as orders complete/arrive, last-print
  markers and guarded whole-order completion (partial/blocked/overlap/unavailable).
- [x] Implement order presentation groups in scheduleView.ts and render the color
  key/end markers in PrintTimeline.tsx. Keep conflict status visible independently
  of order hue. Cover orphan slots and completed copies without false completion.
- [x] Add a failing ShopInbox test, then expandable manual/automatic walkthrough;
  extend the existing browser demo to accept a manual request and prove each path
  reaches running printers only after confirmation. Check colors in the browser.
- [x] Update SPEC/maps and run focused then full root offline coverage checks;
  inspect desktop/mobile preview and review the complete follow-up diff.

- [x] Follow-up: explicitly label saved-profile time/filament, live quantity totals,
  order cards/details, revised confirmations and proposed-assignment totals. Keep
  summed printer work separate from scheduled completion and use profile material/color.


Review findings addressed with red/green regressions: cross-session confirmations,
full keyboard access to simulation controls, ceil-to-minute earliest-fit dates and
unavailable/partial allocation status. Independent scoped verification found no
remaining issues. Manual request matching and the older example batch work together.
Visual inspection aligned all planning summaries/timeline dates to explicit UTC and
reduced lane height; the primary order action is visible within a 1000px desktop.
Final root coverage/schema/build/browser verification and preview evidence are
recorded in docs/development.md. No commit, merge or push is included in this task.

Follow-up review ruling: short month/week bars can hide status labels. Keep status,
late and overlap warnings in the non-clipped order key and expanded details; summary
accessible names include the visible model name. Regression tests first failed for
the missing warning and accessible name, then passed after implementation. Browser
checks cover mobile month colors/key geometry and both intake paths through actual
simulated printer starts. Fix the browser locator with the established combobox role
rather than a wrapping-label exact-text query. No product command behavior changed.
Final follow-up verification: 119 backend + 229 frontend + 18 browser tests pass,
100% application coverage, schema/TypeScript/build checks pass. Restored the original
preview database with agents/clock off; inspected actual two-order colors/end markers
and 390px containment. No merge, commit, push or production data reset performed.
