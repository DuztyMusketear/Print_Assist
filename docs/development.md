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
