# Guided models and order intake implementation plan

**Goal:** A clear saved-model -> order -> confirmed timeline -> printing journey,
including bounded STL upload and a local example shop feed.

**Architecture:** Extend approved artifacts, transactional FactoryService commands,
SQLite mesh storage and existing scheduling proposals. Add focused library, inbox,
thumbnail and timeline components; preserve detailed preparation/manual controls.

**Stack:** Existing Python/FastAPI/Pydantic/SQLite and React/TypeScript/Three/Vitest.
**Spec:** [Workflow design](../specs/2026-11-14-guided-model-order-design.md),
[SPEC](../../../SPEC.md) sections 4-7/12. New local-feed/upload scope supersedes
the older exclusions only for these explicitly requested offline features.

## Constraints and review focus

No live agents, remote shop calls or credentials. Work on the dedicated branch,
preserve unrelated changes, meaningful red/green tests and full offline coverage.
Keep server validation for stale/reset/replayed requests; bytes must not leak into
state responses or command receipts. Reject invalid/oversized/nonfinite/oversize-bed
STL before saving. Duplicate feed acceptance, unknown model mappings, late or partial
proposals and late replies after reset must never start unexpected jobs.

## Tasks

- [x] Backend upload: add typed LibraryUploadCommand and support assessment;
  `library.py` validates STL and creates reviewed task/artifact metadata. Store mesh
  bytes transactionally, serve only currently registered hash paths. Tests cover
  real binary/ASCII files, estimates, restart, replay, reset and rejected files.
- [x] Offline feed: add typed example-load/decision commands and request snapshots;
  `shop.py` produces deterministic sample orders and explicit accept/reject. Acceptance
  remembers SKU/model mappings and creates held orders exactly once. Test no printing
  before confirmation, unmatched products, replay/restart/reset and stale rejection.
- [x] Deadline gate: add optional require_on_time to reviewed application; tests
  reject late/incomplete plans atomically, preserve existing advanced behavior.
- [x] Library and intake UI: searchable cards, bounded actual previews, upload with
  estimates/material/support review, order handoff and local-feed inbox. Component
  tests exercise drafts, validation/errors, mapping, pending/accepted/rejected states.
- [x] Timeline/navigation: add three printer lanes with model thumbnails/times;
  show visible date/quantity review and a single guided confirmation. Keep advanced
  manual/preparation flows. Test stale plans, deadlines, navigation/reset and errors.
- [x] End-to-end: upload, reload/browse, choose quantity/date, review timeline,
  confirm, inspect progress; example feed and unmatched mapping without network.
  Update SPEC/backlog/maps/setup evidence and run full offline coverage/schema/build.
- [x] Read-only branch review, resolve findings, restore preview. No automatic merge
  or push is authorized by this feature request.

## Execution ledger

Native execution, continuing the user's standing preference for uninterrupted work.
Use the existing clean checkout on a dedicated branch; no concurrent implementation
or changes outside the repository. Keep a final independent read-only review.


Execution evidence: root `.venv\Scripts\python.exe scripts/check.py coverage`
passed 113 backend, 191 frontend and 14 browser tests, 100% application coverage,
schema drift, TypeScript and production build. Existing bundle advisory remains.
Changed documentation links and new source/test map entries validate locally.
Desktop Models/Orders/Schedule screenshots were inspected; actual preview has no
page errors or horizontal overflow at 390px. Preview restored with existing data,
clock paused and agents OFF. Initial delivery remained on the feature branch for
user review.

Review rulings: reject malformed facets and Float32 overflow/collapsed geometry;
reforecast delayed active and queued work from remaining duration; validate reused
upload IDs against persisted state; display safe corrective upload errors. Each has
an observed failing/passing regression. Confirmed product matches update other
pending requests without auto-accepting them; competing acceptance creates one order.
No live shop connection, inference, automatic merge or publishing occurred.

Integration follow-up: the user explicitly authorized commit, merge to main and
GitHub push. Fetch confirmed origin/main matched the feature base `3d2a2f1`; run
the full root coverage gate before committing and use a normal fast-forward merge
and push, preserving remote work if the remote advances.
