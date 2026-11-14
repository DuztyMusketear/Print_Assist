# Development

Implemented: offline order entry, persisted SQLite queue, validated UTC deadlines,
safe retries, disabled agent state, and a local modeling/supports/review workflow
dashboard. Dashboard tasks persist in the shared SQLite snapshot across reloads and restart. The dashboard
tracks operator-supplied file references; it does not generate geometry or
supports or slice files. Three virtual printers, scheduling and manual clock advancement are implemented;
fault recovery remains planned. The seeded artifact is a reference and estimates, not a file that
can be sent to a physical printer.

## Setup

Reference versions: Python 3.14.7 and Node 26.13.1 with npm. Python declares a
3.12 minimum, but other versions/platforms are not yet verified. Install uv,
then run these from the repository root:

```text
uv sync --locked --extra test
npm ci
npx playwright install chromium
```

Setup downloads require internet; application operation and tests need no model
credentials. The lockfiles pin dependencies. Keep `.env`, SQLite data, local
tools, environments, dependencies and test outputs out of Git.

On this machine Python is `.venv\Scripts\python.exe`; a checksum-verified Node
archive lives in ignored `.tools/node-v26.13.1-win-x64`. For an ordinary terminal
either put Node on PATH or prepend that directory to PATH for the current
session. The check runner detects the local archive automatically.

## Run locally

Windows, terminal 1:

```powershell
.\.venv\Scripts\python.exe -m uvicorn print_assist.api:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000
```

macOS/Linux, terminal 1 (documented, not yet tested):

```sh
.venv/bin/python -m uvicorn print_assist.api:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000
```

Terminal 2: `npm run dev`. Open `http://127.0.0.1:5173`. Vite proxies `/api` to
the local backend. Stop both servers with Ctrl+C. Use one backend worker and one
application instance per database. Never expose this unauthenticated prototype
on a public network. Production hosting/authentication are not implemented.

Data defaults to `factory.sqlite3` in the working directory. Set
`PRINT_ASSIST_DB` to another writable file path if needed. Restart retains orders,
starts a new session, pauses the clock, clears command replay history, and sets
both agent controls OFF. No agents exist or initialize in this phase.

The Overview opens first; choose the Modeling tab for model preparation. Add a model name and operator-supplied file reference,
then move the task through support preparation and human review. A review can
approve the task or return it to modeling with a visible revision note. These
stage changes are validated by the backend and do not call a model. Enter positive
print-duration and filament estimates plus material and printer requirements.
Approval creates one artifact selectable in Orders; it does not create an order
or certify, generate or slice the referenced file. Create an order explicitly
to send approved work to scheduling.

The Orders tab uses explicit UTC input labels. Choose the seeded blue PLA figure,
quantity and deadlines; add an order and reload to verify it remains. Errors
preserve form inputs. If state conflicts, refresh and retry. Successful repeats
are separate orders; an uncertain network retry reuses its command key while
the page remains open. A page reload does not retain that retry key: inspect the
queue before resubmitting after a reload.

## Verification

Use the virtual environment's Python below; substitute the appropriate platform
path or activate the environment before using `python`:

```text
python scripts/check.py unit
python scripts/check.py full
python scripts/check.py coverage
```

`unit` runs backend unit and frontend component/transport tests. `full` also
runs backend integration, generated-type drift, type/build, and browser checks.
`coverage` adds 100% statement/branch gates for application modules and tested UI.
The runner stops on a failing child command. Browser checks need ports 8000 and
5173 free and permissions to create/terminate child processes. Servers are
owned and stopped by Playwright. Sandboxed Windows sessions may need elevated
tool execution permissions for process cleanup; this is not an app requirement.

Backend tests block outbound socket connections, allowing numeric loopback for
the Windows event loop. Frontend unit tests fail actual fetch calls unless a
test supplies a transport response; the browser test records/fails external
requests. There is no provider SDK, paid endpoint or background inference path.
These are test boundaries, not an operating-system network firewall.

`python scripts/schema.py` regenerates `frontend/src/types.ts` from FastAPI's
OpenAPI schema. `python scripts/schema.py --check` verifies drift. No server or
network is required. Node must be on PATH when running this command directly.

Coverage exclusions: generated `types.ts`, test fixtures/setup/tests, and
`main.tsx` (DOM mounting only, exercised by the browser check). Source behavior
is covered; root tooling is verified by behavior tests/schema/build checks but
not included in application coverage percentages. New exclusions need review.

## Verification matrix

| Environment | Status |
| --- | --- |
| Windows, Python 3.14.7, Node 26.13.1, Chromium | Coverage command passed on 2026-11-14: 26 backend tests, 19 frontend tests, 1 browser test; 100% statement/branch coverage, type drift and build passed. |
| macOS / Linux native | Setup documented; not executed here. |
| Other browsers / CPU architectures | Not verified. |
| Docker Compose | Planned for milestone 6; not implemented. |

Do not claim universal system compatibility from this matrix. No live model or
physical printer execution was performed.

Pre-merge regression: refreshing while a save was pending previously discarded
the successful save response. The new UI test failed with the saved order absent,
then passed after reconciling save and refresh responses against the current
session/revision. Both response completion orderings are covered.
Verified from the repository root with `.\.venv\Scripts\python.exe scripts/check.py coverage`;
Windows process-cleanup permissions were needed for Playwright server shutdown.

Modeling integration verification (2026-11-14): `python scripts/check.py coverage`
passed with 47 backend tests, 57 frontend tests and 2 browser tests, 100%
statement/branch coverage, schema drift and build checks. No live models ran.

Input-help verification (2026-11-14): `python scripts/check.py coverage` passed
47 backend tests, 59 frontend tests and 2 browser tests at 100% statement/branch
coverage. Modeling and order fields include info icons that show context and examples on hover, focus or tap; Escape dismisses the tooltip;
filament and color use native editable suggestion lists, preserving custom input.

Icon-tooltip verification (2026-11-14): backend/frontend coverage gates reached
100% with 47 backend and 60 frontend tests. The initial browser run exposed
ambiguous input/help-button selectors; exact-label selectors resolved this.
`python scripts/check.py full` then passed all tests, schema drift/build and
both browser workflows, including hover, keyboard focus and Escape dismissal.

## Interactive printer views

Three simulated 220 x 220 x 250 mm printer beds now render on Overview; choose
Printers for a single larger view with orbit, zoom, pan and reset controls.
Camera buttons work with keyboard focus/Enter. Select **Preview example part**
to inspect the bundled tower; its slider only changes demonstration geometry.
Production parts reveal according to actual job elapsed time. No slicing or
hardware commands run. No extra server is needed; dependencies bundle Three.js
and its MIT-licensed addons locally.

Use [the partner asset handoff](../frontend/public/models/README.md) to register
STL files and choose their visual asset in Modeling. Missing/removed catalog
entries retain historical records and show a placeholder instead of breaking
production. Unavailable WebGL retains status text; moving to another tab releases
its scene resources. No new coverage exclusions were added.

Verification on Windows/Chromium (2026-11-14):
`.venv\Scripts\python.exe scripts/check.py coverage` passed 48 backend tests,
77 frontend tests and 5 browser workflows with 100% statement/branch coverage;
schema drift and type/build checks passed. Browser checks used real WebGL and
also deliberately forced WebGL failure to verify fallback. Setup on other OSes
and browsers remains unverified. Vite reports an approximately 813 kB main JS
bundle after the new 3D dependency; code splitting is a future performance task,
not a functional failure. The renderer is demand-driven with no continuous idle
animation loop. No official Prusa CAD asset is included.

## Production controls and repeatable scenarios

In Printers, select a printer to pause/resume or take it offline/online. Held work
preserves progress and material; bringing a printer online requires an explicit
resume before held work continues. Pending manual work stays pending. Schedule
continues to offer manual/automatic assignment and explicit one-hour advances;
an automatic accelerated clock is still backlog work.

Printers also offers Empty/Seeded scenario reset with a required acknowledgment.
Reset replaces orders, attempts, inventory, modeling tasks, custom artifacts and
history, changes the session, pauses simulation and disables agent flags. It does
not remove repository model files. Seeded orders use the bundled example tower.
Overview/Schedule show activity and blocked assignment explanations. Uncertain
production commands expose an explicit retry that preserves the original key.

Verification (2026-11-14, local `feat/production-controls`):
`.venv\Scripts\python.exe scripts/check.py coverage` passed 61 backend tests,
91 frontend tests and 6 browser workflows with 100% statement/branch coverage;
schema drift and type/build checks passed. The command includes the full offline
suite. Review regressions cover late pre-reset order/model/schedule responses,
retry receipt ownership, competing commands and material preservation. Existing
Vite bundle-size guidance remains; other platforms remain unverified.

## Clock and monitoring follow-up

Run/Pause controls select 1x, 60x, 300x or 3600x. One backend lifespan owner
uses fixed steps, never wall-time catch-up. Reset/restart pause. Bounded batches
protect short-job workloads; known simulation errors pause with an activity event.
Live refresh waits for the preceding automatic read and cleans up on unmount.
Forecasts share compatible capacity and filament, assume immediate automatic
scheduling and supplied estimates, and explain manual/held work. Recorded completed
work retains its finish time. Packing/shipping remain separate. Temperatures
are deterministic status illustrations, labeled simulated.

Verification on Windows/Chromium (2026-11-14):
`.venv\Scripts\python.exe scripts/check.py coverage` passed 69 backend,
96 frontend and 7 browser tests; 100% statement/branch coverage, schema drift and
production build passed. Browser workflow confirms automatic progress and live
forecast display. Read-only review findings have regression coverage. No models
or physical printers ran. Vite retains its existing large-bundle advisory.

## Stable dashboard refresh and compact presentation

Printer scenes retain their canvas/camera across polling and update clipping,
nozzle height and color in place. Equal asset metadata no longer reloads STL files.
Printer headings/control labels use Printer 1, Printer 2, etc.; part references
show Part 1 and activity uses compact hexadecimal order references. Persisted IDs
and command payloads are unchanged. The dark responsive overview uses real summary
counts and contained activity panels, following the user's local HTML visual example.
No chat or recovery behavior is implied by that visual reference.

Verification (2026-11-14): root coverage run reached 100% backend/frontend
statement/branch coverage (69 backend, 98 frontend tests); its browser checks
exposed two assertions still using old labels. After correcting those assertions,
`.venv\Scripts\python.exe scripts/check.py full` passed 69 backend, 98 frontend
and 7 browser tests plus schema/build checks. Browser regression verifies canvas
identity and floor height across refresh. Desktop 1440px and mobile 390px visual
inspection found no horizontal overflow. Read-only feature review found no
critical/important issues. Existing Vite bundle advisory remains.

Guided printing verification (2026-11-14): root
`.venv\Scripts\python.exe scripts/check.py coverage` passed 71 backend tests,
116 frontend tests and 8 browser workflows with 100% statement/branch coverage,
schema drift and type/build checks. Browser workflow imports a fractional-weight
profile, approves it, inherits selected-model estimates, creates manual quantity,
starts/pauses/resumes from Overview and uses automatic printing. Tests use no live
models or hardware. Existing bundle-size advisory remains. Review findings have
regression coverage, including manual next batches and late reset/navigation.

Compact overview verification (2026-11-14):
`.venv\Scripts\python.exe scripts/check.py coverage` passed 71 backend,
125 frontend and 9 browser tests at 100% statement/branch coverage; schema drift
and production build passed. Browser checks verify 76px desktop header, floor and
sidebar placement, lower-panel alignment, single selected telemetry strip,
cross-tab station selection, camera disclosure persistence, tablet stacking and
390px mobile overflow. Desktop/mobile screenshots were inspected locally.
Interactive 3D and manual/automatic workflows remain covered. Existing Vite
bundle advisory remains; no agent or physical printer execution occurred.

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
