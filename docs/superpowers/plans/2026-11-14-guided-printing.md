# Guided printing and overview inspection

Implement inline with TDD; SPEC 6-7/10/12 and backlog PA-303/304. User confirms
partner provides slicer-derived time/weight metadata with model profiles.

- Overview cards select a shared inspection panel with progress, temperatures,
  material, elapsed/remaining estimates and manual pending-start/pause/resume.
- Existing scene owns a demand-driven illustrative head-motion loop only while
  clock and job are running. Stop on pause, hidden document and disposal. It is
  not an actual slicer toolpath; retain the camera and backend progress authority.
- Quick print chooses approved profile and quantity; estimates are read-only.
  Typed atomic queue command creates order + automatic/manual assignments with
  replay safety. Automatic starts clock; manual guides to Schedule and Overview.
  Deadline defaults are explicit/editable; custom detailed intake stays available.
- Prepared JSON profile import supplies partner estimates and model reference;
  normal users do not enter time, weight or capability jargon. Preparation-only
  manual metadata is in an explicit disclosure. Default compatibility is FFF for
  the three virtual filament printers; backend validates imported requirements.
- Approved modeling items link to Orders. Persistent workflow guidance links
  Models -> Orders -> Schedule -> Overview. Do not implement inference, slicing,
  real hardware, or fake layer counts from the screenshot.
- Add reference gaps to backlog: slicer/profile asset ingestion, real layer/path
  data, cancel/scrap accounting and richer inspection diagrams.
- Verify units/API/replay/invalid profile, UI selection/guidance, scene cleanup,
  real browser printing workflow, root full coverage and update maps.

## Review and follow-up evidence

Read-only review found two usability issues: imported fractional filament weights
were blocked by the preparation form's step constraint, and manual quantities
larger than printer capacity were not guided into further pending batches. Both
were reproduced and corrected. Profile inputs now accept positive slicer precision;
manual completion prepares the next batch without automatic starts.

Browser testing additionally exposed stale clock-pause revisions and test-owned
simulation leakage. Clock pause now performs at most one refresh/retry following a
known 409 rejection, preserving session/supersession safety and uncertain receipt
ownership. Guided browser tests await pause/reset completion before ending.
A late quick-print reply cannot navigate away from a new reset session.

Current gaps and explicit follow-ons are in backlog PA-305/306: asset registration,
slicer provenance/layer data, incomplete profile repair and cancel/scrap accounting.

Guided printing verification (2026-11-14): root
`.venv\Scripts\python.exe scripts/check.py coverage` passed 71 backend tests,
116 frontend tests and 8 browser workflows with 100% statement/branch coverage,
schema drift and type/build checks. Browser workflow imports a fractional-weight
profile, approves it, inherits selected-model estimates, creates manual quantity,
starts/pauses/resumes from Overview and uses automatic printing. Tests use no live
models or hardware. Existing bundle-size advisory remains. Review findings have
regression coverage, including manual next batches and late reset/navigation.
