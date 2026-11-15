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

The Overview opens first; choose the Modeling tab for model preparation. Add a
model name and operator-supplied file reference. The Supports lane creates a
separate linked support task where the operator records whether supports are
needed and, when they are, an optional slicer-project/file reference, material
estimate, and removal notes. Either answer goes to Review; the reviewer sees the
model and support task together and can approve or request changes. Approval
stores the model and support task together on one orderable artifact. These
stage changes are validated by the backend and do not call a model or slicer.
Enter positive print-duration and filament estimates plus material and printer
requirements. Approval creates one artifact selectable in Orders; it does not
create an order or certify, generate, or slice the referenced file. Create an
order explicitly to send approved work to scheduling.

For a repeatable demo, use the bundled NIST Additive Manufacturing Test Artifact
card in Modeling. It links to the unchanged public-domain STL and pre-fills a
demo task. After adding it, the task card shows a shaded mesh preview. Click the
mesh to open the enlarged view; mouse dragging rotates the model there, and
pinching zooms independently without changing rotation. The rotate and reset
buttons remain available in both views. The task card also shows a guide to the
model's features.
The guide covers the center hole, cylinders, pin/hole pairs, stepped walls, ramp,
and lateral features. Press Escape or click the shaded area to close the preview.
The Modeling page also links to [Snack Sticks by ryan5sampson on Pinshape](https://pinshape.com/items/106174-3d-printed-snack-sticks)
as a support-requiring demo. Its page states supports are required and lists the file
under CC BY; the dashboard uses the page URL as a model reference and does not
bundle the STL. Preserve attribution if redistributing the file.
Removing a task in Modeling, Supports, or Review asks for confirmation
before deleting it. For Approved tasks, the dashboard checks existing orders
first; an in-use model stays in the list with an explanation. Confirming removal
of an unused approved model also removes its orderable artifact. Its
120-minute/35-gram PLA values are presentation assumptions, not
NIST settings or slicer results. The NIST file is an experimental design, not an
ASTM standard, and is not claimed as physically printed or certified by this
app. See the [asset record](../frontend/public/demo-models/README.md) for
provenance, checksum, and the local mesh check.

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
When a preview already occupies the default ports, set `PRINT_ASSIST_API_PORT`
to `8001` and `PRINT_ASSIST_WEB_PORT` to `5174` before running the check; the
browser server and Vite API proxy use those values together.

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

NIST demo verification (2026-11-14): `PRINT_ASSIST_API_PORT=8001`,
`PRINT_ASSIST_WEB_PORT=5174`, then `python scripts/check.py coverage` passed
47 backend tests, 61 frontend tests, and 3 browser tests with 100% statement and
branch coverage. The browser test fetched the 369,684-byte STL, completed the
modeling/support/review approval flow, and selected the artifact for an order.
The original preview remained available on ports 8000/5173.

NIST mesh preview verification (2026-11-14): the same isolated-port coverage
command passed 47 backend tests, 67 frontend tests, and 3 browser tests. The
browser test loaded the bundled triangle mesh, checked the feature guide and
rotation control, and completed approval/order selection; frontend statement,
branch, function, and line coverage all reached 100%. The browser test also
dragged the mesh with the mouse, confirmed its view changed, and checked that
dragging did not trigger click-to-enlarge.

Model removal and enlarged preview verification (2026-11-14): isolated-port
`python scripts/check.py coverage` passed 50 backend tests, 76 frontend tests,
and 3 browser tests at 100% application coverage. The browser test enlarged the
mesh, confirmed the high-resolution canvas and existing controls, completed the
workflow, then confirmed task removal. UI tests cover cancel/confirm at modeling,
supports, and review stages plus the approved-task order-use check. Backend
integration tests verified approved artifact cleanup and rejected removal when
an order already uses it.

Enlarged preview gesture verification (2026-11-14): isolated-port
`python scripts/check.py coverage` passed 50 backend tests, 76 frontend tests,
and 3 browser tests. Frontend and backend statement and branch coverage were
100%; schema drift and production build passed. Component tests verified that
the task card does not rotate while dragging, the enlarged view rotates by mouse,
pinching changes zoom independently, and the existing rotate/reset controls work.
The browser workflow verified enlarged-only mouse rotation without zoom change.

Linked support task verification (2026-11-14): isolated-port
`python scripts/check.py coverage` passed 56 backend tests, 81 frontend tests,
and 3 browser tests. Backend and frontend statement and branch coverage were
100%; schema generation and production build passed. Tests verify that support
assessment is required, no-support findings go directly to Review, required
supports appear with the model in Review, approval stores the linked support task
on the same artifact, and review revisions clear stale support data. The browser
workflow also used the linked Snack Sticks source page as its model reference.

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

## Modeling/support integration verification - 2026-11-14

Integrated published main `3b01bbd` with the local production dashboard. Linked
support assessments, paired review/approval, protected task removal and the NIST
preview coexist with prepared profiles, quantity handoff, clock controls, future
schedule proposals and material commitments. Restart upgrades older unassessed
Supports/Review tasks; approved history remains intact. The NIST demo uses blue
PLA from default inventory and its registered mesh appears on printer beds.
Its time/weight remain labeled presentation assumptions, not slicer results.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed 91 backend,
157 frontend and 12 browser tests at 100% backend/frontend statement and branch
coverage. Schema drift, TypeScript and production build passed. Six changed
documentation files passed local-link validation; `git diff --check` passed.
Read-only review identified the incompatible demo color, corrected with a
default-inventory approval-to-print regression. Browser assertions distinguish
modeling previews from printer canvases and require explicit support assessment.
The guided control test pauses the simulation clock before pause/resume commands
to avoid expected stale-revision conflicts; live tick/progress checks remain in
the separate clock and schedule workflows. Existing Vite bundle-size advisory
remains. No live inference, external model fetching or hardware control ran.

## Guided model/order workflow verification - 2026-11-14

The main navigation is Models, Orders, Schedule, Overview, Printers; startup opens
Overview. Models offers a searchable approved library, actual bounded STL upload,
optional estimate-profile import and explicit profile/support review. Prepared
time, weight, material and color are reused when choosing copies and dates. The
original modeling/support board remains in preparation tools. Uploaded models
are millimeters/Z-up, capped at 10 MiB and 100,000 triangles, checked for complete
ASCII facets, finite Float32 geometry, nondegenerate triangles and virtual bed fit.
Validated bytes live in SQLite meshes; snapshots/receipts contain metadata/digests.
Reset hides uploaded preview routes; startup preserves saved models.

Orders provides guided review-first entry and an explicit local example shop feed.
Requests are pending/accepted/rejected, product matches persist and update other
pending requests for the same product, and acceptance creates only a held order.
It is not a live shop connection. Manual starts remain in advanced controls.
Schedule shows current/proposed printer lanes with model thumbnails and deadline
warnings. Delayed work is reforecast from remaining duration; held/manual timings
are provisional. Correct uncommitted copies/dates, refresh the preview, then
confirm a complete on-time plan to start automatic printing and return to Overview.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed 113 backend,
191 frontend and 14 browser tests with 100% application statement/branch coverage,
schema drift, TypeScript and production build checks. Independent review findings
have regressions for malformed/Float32-overflow/collapsed geometry, paused timeline
delays, persisted uploaded-preview reuse and actionable upload errors. Competing
acceptances, replay/reset/restart and late navigation replies are covered. Actual
desktop Models/Orders/Schedule screenshots were inspected; Chromium reported no
page errors or 390px horizontal overflow. Existing bundle-size advisory remains.
No live providers, shop APIs or physical printers ran. User acceptance remains
separate from automated and visual checks.

## Compact planning and queue management verification - 2026-11-14

Orders preserves library selection and adds model search, compact copy/date fields,
a stepper and debounced read-only capacity/material estimates. Infeasible drafts
offer feasible quantities, later dates with packing allowance retained, or a faster
saved profile when supplied. Playback speed only accelerates the demo. Earliest-fit
dates round up to minute input precision. Planning summaries and timeline labels
use explicit UTC consistently.
Preview-only placements display Proposed rather than suggesting they are committed.

Schedule uses selectable order cards with quantity, whole-order estimate and
late/overlap/unavailable cues; partial unavailable work has no misleading ETA.
Details expose confirmed queued edits/deletion. Edits cancel old placements and
return to review; deletion archives the order and releases commitments without
restoring physical stock. Started/completed attempts remain protected. Confirmation
captures its original session/revision; reset invalidates dialogs even with reused
IDs. Day/week/month controls label bounded bottom calendar ticks; detail allocations
and stock ledgers are collapsed by default. Full keyboard traversal reaches all
simulation-form fields and traps focus inside the modal.

Simulate incoming order creates individual persisted local requests. Manual mode
leaves an inbox item; automatic matching creates a held order and opens its preview.
Final confirmation starts printing. The older example batch works alongside this
flow. Website model imports remain separate partner work.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed 119 backend,
229 frontend and 18 browser tests with 100% application statement/branch coverage,
schema drift, TypeScript and production build checks. Browser workflows verify
early deadline warnings, selection handoff, calendar controls, explicit cancel/confirm,
stock release and both incoming paths. Independent review findings have regression
coverage and scoped verification. Actual desktop Orders/Schedule previews and 390px
containment were inspected; no page errors or horizontal overflow were found. The
primary order action fits within the 1000px desktop viewport. Existing Vite bundle
advisory remains. No live shop calls, inference or hardware ran; active print
cancel/discard and scrap accounting are still separate work.

Follow-up estimate display: saved model cards explicitly label per-item print time
and filament. Orders and schedule cards/details show total estimated printer work
and filament for the requested quantity, with material/color; edit confirmation
uses the revised quantity. Proposed queue totals cover proposed assignments only.
Summed printer work is distinguished from the scheduled finish date. New regressions
first failed for missing labels/totals, then passed. The root coverage command above
was rerun successfully after these changes (360 tests total); schema/build passed,
and the compact browser workflow verifies totals and retained desktop action density.

Order-color follow-up: a shared color key identifies each order across printer
lanes and gives guarded estimated completion; final allocated prints carry markers.
Archived orders retain their color slots. Partial, blocked, overlapping and unavailable
work does not promise a whole-order finish. Status/deadline/overlap labels remain in
the readable key and details even when bars are narrow; accessible names preserve
the model label. Independent review identified those accessibility improvements,
which have red/green regressions. The inbox's expandable demo walkthrough explains
manual review and automatic matching through confirmation and printer monitoring.

Fresh root `.venv\Scripts\python.exe scripts/check.py coverage` passed 119 backend,
229 frontend and 18 browser tests (366 total), 100% application coverage, schema
drift, TypeScript and production build checks. Browser tests include distinct order
colors/readable key geometry in a 390px monthly view and both incoming routes reaching
running printers only after confirmation/manual start. Existing Vite bundle advisory
remains; no physical printing, live shop calls or application agents ran.
Restored the existing preview database with clock and agents off. Actual two-order
schedule colors/key/final markers were visually inspected; the mobile preview has no
page overflow. Previewing did not apply/start orders or reset saved simulation data.


## Fault recovery verification - 2026-11-14

Implemented all five simulated faults with immediate local isolation, persistent
source-event deduplication/evidence, consumed-material waste and incident-owned part
holds. Recovery preserves healthy active work and compares original/revised part
and order schedules, including indirect delays. Apply/reject uses transactional
session/revision/idempotency guards. Partial followups and repeated faults retain
lineage; completed output is never duplicated. Automatic simulation recovery is a
separate opt-in for complete compatible on-time automatic work. Startup/reset
returns to review; simulated equipment clearance remains explicit.

Material exhaustion splits advancement at the boundary and continues healthy work.
Stock is never refunded as scrap; injection stock corrections and printed waste are
separate. Incidents retain immutable before/applied comparisons, decisions, telemetry,
action outcomes and progress distinct from equipment repair. Unknown/unallocated
part timing is explicit. Overview/Printers expose Incidents & Schedule Impact,
deterministic summaries, mitigation advice, order/part comparisons and history.
Optional lineage starts collapsed with friendly part/attempt labels. Live agent
orchestration remains future work; no inference, external shop or hardware ran.

Final root `.venv\Scripts\python.exe scripts/check.py coverage` exited 0:
**149 backend + 248 frontend + 20 browser tests (417 total)**; 100% application
statement/branch coverage, schema drift, TypeScript and production build pass.
Existing Vite bundle-size advisory remains. Browser tests cover isolation, exact
fulfillment, reset/repeat on another printer, stale/rejected review, automatic policy
and mobile containment. Independent review findings were fixed with regressions:
idle-incident resolution, explicit unassigned parts, durable decision/evidence
visibility and readable identifiers.

Actual desktop and 375px expanded-evidence previews had no page errors or page
overflow. A separate ignored fault-demo database runs on ports 8000/5173 with agents
and clock off; the previous preview database is preserved. The demo has one thermal
incident awaiting review and two healthy active jobs with the clock paused.


## Compact incident panel refinement - 2026-11-14

Policy/injection controls share a compact responsive row. Recommended actions and
proposed assignments start collapsed; policy and recovery explanations are expandable.
Existing confirmation, risk tables, repair acknowledgement and history remain available.
A new regression first failed while recommendations were always visible, then passed
with native keyboard-accessible disclosures. Desktop and 375px expanded-evidence
preview inspection found no page errors or horizontal overflow.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed: 149 backend,
249 frontend and 20 browser tests (418 total), 100% application coverage, schema,
TypeScript and build checks. Existing Vite bundle-size advisory remains.

GPT diagnosis is discussed, not connected. Recommendation: an explicit in-dashboard
API diagnosis request using the saved incident report, independent of deterministic
safety/recovery validation. MCP is an optional tool exposure for compatible clients;
no provider credentials, enabled agent controls or live model calls were added.


## Incident flags, applied previews and resolution - 2026-11-14

Reproduced the user's generic preview error against the existing demo: the API
returned 409 because recovery was already applied. The UI now shows saved impacts
and progress instead of an invalid repeat preview; held partial work still permits
follow-up review. Unknown conflict details use the existing safe fallback.

Default presentation is a compact printer/type/status row with Inspect incident.
Settings, recommendations and reports stay closed until requested. Physical issues
use acknowledged Mark resolved, with positive refill where needed. Current network
faults can clear from an explicit simulated signal confirming both connected and
safe_to_resume; stale/unsafe/physical-fault signals are rejected. Neither clearance
path releases manufacturing holds or restarts failed output. Reports record operator
versus printer_telemetry resolution and preserve evidence/action history.

Root `.venv\Scripts\python.exe scripts/check.py coverage` passed: **167 backend +
262 frontend + 21 browser tests (450 total)**; 100% application statement/branch
coverage, schema drift, TypeScript and build pass. Existing Vite bundle advisory
remains. Independent review found no concrete P1/P2 defect. A first full run caught
an inherited-modeling-session stale revision (8 submitted against server 9); modeling
browser tests now reset into a fresh empty session before each workflow. The full
rerun passes, including the exact applied-preview and compact/manual/network cases.

Actual existing-demo inspection measured the one-incident collapsed section at 120px
on desktop, with applied status visible after inspection and no invalid Preview
recovery action. Desktop and 375px inspection had no page errors or horizontal
overflow. Original incident and resolution data were retained; only printers that
were running before verification were resumed after the required server restart.
No physical hardware, remote models or agent controls were enabled.


## Main integration verification - 2026-11-14

Integrated origin/main f4fcd01 (persistent modeling colors and preset intake) with
7177a76 dashboard planning, b7dc100 fault recovery and 4cbac3e compact incident flags.
Resolved disjoint stylesheet additions together and combined code-map responsibilities.
Incoming modeling browser workflows each resetEmpty, preserving test isolation while
adding the persistent five-color selector case. Regenerated TypeScript from the
combined backend contract rather than selecting one generated schema side.

Independent review found a delayed modeling 409 refresh could overwrite a newer reset
session and its retry envelope. A red/green App regression now proves the old refresh
cannot send another request or replace the newer session. Request ownership/session
checks and same-session monotonic state updates protect the retry. Removed unreachable
preset-handler guards and App callbacks for hidden intake; disabled-send/UI boundaries
remain tested. Added missing color-action validation and malformed-response/profile
boundary coverage without changing valid modeling behavior.

Fresh root `.venv\Scripts\python.exe scripts/check.py coverage` passed: **170 backend,
288 frontend and 22 browser tests (480 total)**, 100% application statement/branch coverage,
schema drift, TypeScript and build checks. Prior feature-only verification passed 450
tests. Existing Vite bundle advisory remains. The exact combined tree is used for
main integration; no live inference, remote shop, datasets or hardware were used.


## Healthy transfer and automatic local orders - 2026-11-14

On `feat/automatic-workload-transfer`, final root verification:

```powershell
$env:PRINT_ASSIST_API_PORT='8002'
$env:PRINT_ASSIST_WEB_PORT='5175'
.venv\Scripts\python.exe scripts/check.py coverage
```

Passed **206 backend + 312 frontend + 24 browser tests (542 total)**. Backend
statement/branch coverage and all frontend coverage metrics are 100%; schema drift,
TypeScript and production build pass. Existing Vite bundle advisory remains; the
WebGL failure test intentionally logs renderer failures while verifying fallback.
The ordinary 8000/5173 preview remained available during isolated-port tests.

Independent review identified and regression tests fixed: incident-owned deferred
transfers bypassing approval, running parts losing ETA before future manual holds,
and feasible automatic intake rejected instead of planning around manual queues.
Legacy browser expectations were updated for transfer rather than abandoned-part
resume; transferred manual retries still require explicit manual start.

Preview runs at http://127.0.0.1:5173 with a separate healthy database: three idle
printers, paused clock, no incidents or orders. The old fault-demo database remains
intact; reload still preserves incident history. Desktop 1440px and mobile 390px
screenshots were inspected; mobile has no horizontal overflow. Orders > Simulate
incoming order > Fully automated order-to-print demo exercises matching, targeted
approval, clock start, dispatch and completion without manual printer starts.
Infeasible/unmatched orders stop for attention. No live agents, shop or hardware
were used. Changes remain local on the feature branch.


### Returning printers and deadline-first queues

The same root coverage command on ports 8002/5175 passed **227 backend + 316 frontend
+ 25 browser tests (568 total)**, 100% application coverage, schema, TypeScript and
production build after the return-to-work fix. Existing Vite size advisory remains.
Browser checks pause/offline an active printer, confirm late queued completion,
resume/online it and verify the same queued attempt starts immediately, healthy
active attempts remain unchanged, and completion risk returns to on-time.

Queue rebalancing operates before dispatch on healthy idle capacity, choosing
already-approved unstarted automatic attempts by production deadline, then priority.
The initial dispatch, proposal, transfer, recovery, forecast, impact and dashboard
ordering follow the same rule. Manual starts and incident-held parts remain guarded.
An API replay regression also covers impact snapshots containing virtual unassigned
parts: only real jobs receive updated saved queue estimates.

The local API preview was restarted with its existing healthy database, retaining
all saved data and startup safety. No printers were running before that restart.
No remote integration, commits, merge or push was performed by this follow-up.


## Demo scenario engine and restored backlogs - 2026-11-14

Final root verification uses the ordinary offline runner with isolated server ports:

```powershell
$env:PRINT_ASSIST_API_PORT='8002'
$env:PRINT_ASSIST_WEB_PORT='5175'
.venv\Scripts\python.exe scripts/check.py coverage
```

Implementation covers shared configurable event ingestion, urgent future-queue
replanning, safe complete backlog balancing, incident/restore policy guards, actual
before/after impacts and deterministic tool-call history. The five events are tested
sequentially through the real UI, including exact completed quantities and reset.
The new [demo runbook](demo-runbook.md) documents manual and automatic presentations.

Independent review found a stale panel recovery setting and generic queue placement
stranding restricted-printer filament. Regression-first fixes send no policy override
unless explicitly selected and preserve remaining original queued stock during
placement. New orders cannot displace previously approved commitments. The API
uses the existing single transaction, session/revision guard and replay cache.

The local preview was restarted using the same saved database with a backup; no
active printers were running before restart and no reset/event was injected into
user data. Actual desktop 1440px and mobile 390px inspection shows no horizontal
overflow. The new panel is collapsed by default; expanded labels/forms override
inherited page-level margins so controls remain compact. The browser regression
limits initial expanded fieldset height to 700px (original inherited spacing: 894.5px).
No model calls, live agents, real marketplace connection or physical printers ran.


Final verification after the compact spacing adjustment: **253 backend + 335 frontend
+ 26 browser tests (614 total)** pass with 100% application coverage, generated schema
consistency, TypeScript and build. `git diff --check` and documentation link checks
pass. Existing Vite bundle-size advisory remains. Source/test responsibility map
covers every newly added application and test file. Work remains local on the
feature branch, without a commit, merge or push.


## Unified sidebar and OpenAI account-backed read-only assistant - 2026-11-14

Root verification on the final tree:

```powershell
$env:PRINT_ASSIST_API_PORT='8002'
$env:PRINT_ASSIST_WEB_PORT='5175'
.venv\Scripts\python.exe scripts/check.py coverage
```

Passed **289 backend + 357 frontend + 28 browser tests (674 total)** with 100%
application statement/branch coverage, generated schema consistency, TypeScript and
production build. Existing Vite bundle-size advisory remains. OAuth/provider tests use
fake transports and generated test signing keys; browser connected chat uses explicit
fixture routes, while the real default API confirms registration is unconfigured.
No actual OpenAI sign-in, account credential access or model calls were performed.

The sidebar follows the reference's Orchestrator / Scenario controls / Agent network.
Workshop reset is visibly inside the same Scenario controls section as event injection.
Manual workflow links remain below the floor. Registered-client account setup and
remaining ephemeral-session/registration constraints are in [assistant setup](openai-assistant-setup.md).
Manual requests are read-only recommendations; specialist agents remain disconnected.

Security review regressions enforce actual inference grants, resource binding, verified
identity, exact replay without paid duplication, and reset invalidation. Live clock
revision changes do not discard captured read-only advice. Callback query credentials
are removed before access logging. UI tests prove explicit discard does not submit a
new request and new messages use a fresh identity. Sidebar key collisions were reproduced
and fixed, retaining component state across ordinary refreshes.

The API preview was restarted with its existing database and a pre-restart backup;
no active printers were running and no reset or scenario was injected. Desktop 1440px
and mobile 390px were inspected: no page errors or horizontal overflow. The actual
connection remains configured=false/connected=false until the owner supplies registered
OpenAI client/callback settings and approved inference access. Work remains local;
no commit, merge, push or deployment was performed.


## Partner preset integration - 2026-11-14

Integration branch `fix/integrate-modeling-preset-cards` combines partner
`origin/feat/modeling-preset-cards` at 39c009f (68ea602 + local source-image assets)
with current main at 52b6dd7. Nine textual conflicts were resolved by combining
contracts/behavior rather than selecting an entire side. Duplicate DeleteOrder
classes and duplicate API route introduced by automatic merging were consolidated;
TypeScript was regenerated from the combined OpenAPI contract.

Main's compact schedule cards, revision/session confirmation, histories, incident
recovery, deadline-first backlog scheduling, scenario engine and assistant sidebar
are retained. Partner saved/preset search, source image previews and bulk selection
are integrated. Bulk removal uses guarded atomic cancellation with retained history,
rather than physically dropping orders from manufacturing state. The build also
caught partner WorkItem visual_asset_id metadata missing from its TypeScript type.

Regression-first checks cover bulk confirmation/eligibility/session/revision and
history, approved/preset suggestion paths and local modeling previews. The combined
browser scenario passes without external requests and verifies mobile overflow,
real image loading and persistent cancelled-order/request history.


Fresh upstream check during integration confirmed origin/main unchanged at 52b6dd7.
The combined regression suite includes the existing assistant, scenarios, recovery,
manual/automatic production and modeling workflows. No live model/provider/hardware
calls were used, and no remote branch was rewritten or pushed by this merge task.


Final combined-tree command `.venv\Scripts\python.exe scripts/check.py coverage`
(on isolated API/web ports 8002/5175) passed **298 backend + 368 frontend + 29 browser
tests (695 total)**, 100% application coverage, schema drift, TypeScript and build.
A legacy browser selector was updated from Search saved models to the partner's
new Search models combobox. Code-map links, conflict-marker and whitespace checks
pass. Independent review found no remaining P1/P2 issue in the combined bulk guards.
Existing Vite bundle advisory remains; WebGL-failure logs are intentional fallback
coverage. The merge is authorized locally; no push is included in this integration.


## Orders feasibility and search fix - 2026-11-14

On local branch `fix/orders-estimate-search`, the draft estimator previously cleared
its visible result on every manufacturing revision. A running simulation increments
that revision every second, so the Orders page alternated checking/fit messages.
The hook now debounces changed drafts and sessions, then checks the latest semantic
capacity snapshot at a stable five-second interval. Revision/activity-only polling
makes no estimate request; live ticks cannot restart the timer or starve a request.
A background check preserves its last result and checked simulation time; a failed
refresh labels previous advice clearly. Changed/invalid drafts and replaced sessions
clear stale advice, and planning still revalidates authoritative backend state.

Order search no longer pins the selected model among nonmatching results. It trims
and filters names/material/colors, shows no matches explicitly, and requires an
explicit model selection after excluding the previous choice. Enter does not submit.
The existing faster-profile action clears an excluding search when choosing that
profile, keeping the visible selector and submitted artifact consistent.

Browser regression uses the real saved-model/manufacturing API with deterministic
browser timers: idle polling makes one estimate; actual production advancement plus
a held refresh response preserves visible checked advice; uploaded model name and
material search works, empty results disable submission, Enter creates no order,
and the page fits a 390px viewport. Desktop/mobile preview screenshots were inspected
without any reset or production mutation; Vite hot reload exposes the fix immediately.


Final root `.venv\Scripts\python.exe scripts/check.py coverage` on isolated ports
8002/5175 exited 0: **298 backend + 375 frontend + 30 browser tests (703 total)**,
100% application coverage, schema consistency, TypeScript and production build pass.
Existing Vite bundle-size advisory remains; WebGL fallback tests intentionally log
renderer errors. Link checks and `git diff --check` pass. Work remains uncommitted
on `fix/orders-estimate-search`; no merge or push was performed.
