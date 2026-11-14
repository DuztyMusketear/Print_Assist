# Application code map

All paths below exist. Verification commands run from the repo root using the
virtual environment. `python scripts/check.py full` verifies the entire slice;
`coverage` additionally checks application statement/branch coverage.

```mermaid
graph LR
  UI["App / OrderForm / OrderQueue"] -->|HTTP via api.ts| API["api.py"]
  UI -->|contains modeling tab| BOARD["ModelingBoard"]
  BOARD -->|validates transitions| WORKFLOW["workflow.ts"]
  API -->|validated command| SERVICE["service.py"]
  API -->|schema| CONTRACTS["contracts.py"]
  CONTRACTS -->|generates via schema.py| TYPES["types.ts"]
  TYPES -->|compile-time contracts| UI
  SERVICE -->|transactions| STORE["store.py / SQLite"]
  SERVICE -->|new database seed| SEED["scenarios.py"]
  UNIT["Unit and component tests"] -->|verify behavior| SERVICE
  INTEGRATION["API integration tests"] -->|verify contracts and persistence| API
  BROWSER["Playwright order intake"] -->|verifies real UI and backend| UI
```

## Source and test responsibilities

| File | Owned behavior / relationships | Verification |
| --- | --- | --- |
| [backend/print_assist/__init__.py](../backend/print_assist/__init__.py) | Package marker; no initialization side effects. | Backend suite/imports |
| [contracts.py](../backend/print_assist/contracts.py) | Strict quantity/priority, UTC deadlines, typed printer/material, visual metadata, printer/reset commands and entity-linked activity schema. Used by API/service and generated frontend types. | `python -m pytest backend/tests/integration` |
| [scenarios.py](../backend/print_assist/scenarios.py) | Deterministic seeded/empty-order baselines with three idle virtual printers, print-ready artifact and disabled controls. | Service/production-controls tests |
| [store.py](../backend/print_assist/store.py) | SQLite transactions, snapshot storage, command-result table and connection lifetime. | Store/service tests |
| [service.py](../backend/print_assist/service.py) | One-owner transactional intake/production, session/revision/replay checks, atomic reset and current-reset receipt lifetime. | Service and production-controls tests |
| [scheduling.py](../backend/print_assist/scheduling.py) | Deterministic automatic/manual assignment, blocked explanations, assignment events and material-revalidated start/resume. | Scheduling and controls unit tests |
| [simulation.py](../backend/print_assist/simulation.py) | Deterministic eligible-printer progression, completion events and bounded material consumption; paused/offline work is frozen. | Scheduling and controls unit tests |
| [api.py](../backend/print_assist/api.py) | Offline app factory, typed intake/modeling/production/control/reset routes and conflict responses. | `python -m pytest backend/tests/integration` |
| [backend/tests/conftest.py](../backend/tests/conftest.py) | Shared order fixture and outbound socket guard (numeric loopback allowed). | Backend suite |
| [test_orders.py](../backend/tests/unit/test_orders.py) | Invalid inputs and normalized/equal-boundary deadlines. | Backend unit suite |
| [test_scheduling.py](../backend/tests/unit/test_scheduling.py) | Initial scheduling priority and distinct-printer behavior. | `python -m pytest backend/tests/unit/test_scheduling.py` |
| [test_service.py](../backend/tests/unit/test_service.py) | Persistence, replay, unknown artifacts, concurrent conflicts, detached snapshots and restart invalidation. | Backend unit suite |
| [test_store.py](../backend/tests/unit/test_store.py) | Transaction exit closes a real SQLite connection. | Backend unit suite |
| [test_checks.py](../backend/tests/unit/test_checks.py) | Root runner executes subprocesses and propagates failure without continuing. | Backend unit suite |
| [test_orders_api.py](../backend/tests/integration/test_orders_api.py) | Real app/SQLite HTTP behavior, response schema, offline operation with fake credentials. | Backend integration suite |
| [frontend/src/main.tsx](../frontend/src/main.tsx) | DOM mounting and stylesheet import only. | Browser test/build |
| [App.tsx](../frontend/src/App.tsx) | Dashboard tabs, state loading, control/reset composition, retry ownership and late-response suppression across session replacement. Delegates 3D views to PrinterFloor. | Frontend App tests |
| [api.ts](../frontend/src/api.ts) | HTTP transport and actionable save/load errors. | Frontend transport tests |
| [types.ts](../frontend/src/types.ts) | Generated OpenAPI types; do not hand-edit. | `python scripts/schema.py --check` |
| [styles.css](../frontend/src/styles.css) | Responsive visual layout for intake, modeling, queue, tooltips and 3D printer/control panels. No business logic. | Build/browser review |
| [OrderForm.tsx](../frontend/src/components/OrderForm.tsx) | Inputs with icon-triggered tooltips and examples, UTC command payload, busy/error states, preservation on failure. | Frontend OrderForm tests |
| [OrderQueue.tsx](../frontend/src/components/OrderQueue.tsx) | Empty state, saved quantity/deadlines/status and completion display. | Frontend OrderQueue tests |
| [test-setup.ts](../frontend/src/test-setup.ts) | DOM cleanup, mock restoration and default fetch denial. | Frontend suite |
| [test-fixtures.ts](../frontend/src/test-fixtures.ts) | Complete typed empty/ordered snapshot fixtures. | Frontend suite/typecheck |
| [App.test.tsx](../frontend/src/App.test.tsx) | Load/save/refresh, control/reset retries, cross-session overlapping reads/mutations, retry-key preservation and stale success/failure handling. | `npm test` |
| [api.test.ts](../frontend/src/api.test.ts) | Transport command body and load/conflict/validation errors. | `npm test` |
| [OrderForm.test.tsx](../frontend/src/components/OrderForm.test.tsx) | Field explanations, submit payload, rejected-input preservation and invalid deadline feedback. | `npm test` |
| [OrderQueue.test.tsx](../frontend/src/components/OrderQueue.test.tsx) | Empty and saved order presentation. | `npm test` |
| [scripts/check.py](../scripts/check.py) | Portable unit/full/coverage orchestration; short-circuits on failure; per-run outputs. | Runner unit tests and all three check modes |
| [scripts/schema.py](../scripts/schema.py) | Offline OpenAPI generation, TS generation and drift check in temporary storage. | Full/coverage modes |
| [order-intake.spec.ts](../tests/e2e/order-intake.spec.ts) | Browser-to-real-backend creation and reload persistence; fails external requests. | `npm run e2e` |

## Production controls and reset

| File | Owned behavior / relationships | Verification |
| --- | --- | --- |
| [activity.py](../backend/print_assist/activity.py) | Entity-linked production events and repeated blocked-reason suppression, shared by controls/scheduling/simulation/reset. | Controls unit tests |
| [controls.py](../backend/print_assist/controls.py) | Pure pause/resume/offline/online transitions; preserves held attempts and requires explicit resume after coming online. | `python -m pytest backend/tests/unit/test_controls.py` |
| [test_controls.py](../backend/tests/unit/test_controls.py) | Frozen progress/stock, pending manual work, valid and rejected transitions, resume validation, material accounting and assignment explanations. | Backend unit suite |
| [test_production_controls.py](../backend/tests/integration/test_production_controls.py) | Typed API/replay/atomicity, concurrent reset and assignment, receipt retirement, fresh inventory/custom data and disabled flags. | Backend integration suite |
| [ProductionControls.tsx](../frontend/src/components/ProductionControls.tsx) | State-specific printer actions, acknowledged scenario replacement, newest-first activity and legacy event compatibility. | ProductionControls component tests |
| [ProductionControls.test.tsx](../frontend/src/components/ProductionControls.test.tsx) | Allowed actions, busy/failure states, reset acknowledgment and readable old/new events. | `npm test --workspace frontend -- src/components/ProductionControls.test.tsx` |
| [production-controls.spec.ts](../tests/e2e/production-controls.spec.ts) | Real seeded/manual workflow, paused/offline stock preservation, explicit resume, full requested quantity completion and empty reset without external requests. | Root full/coverage checks |

```mermaid
graph LR
  App -->|selected printer actions| ProductionControls
  ProductionControls -->|typed requests via App and api.ts| API
  Service -->|pure lifecycle transitions| Controls[controls.py]
  Service -->|replacement baseline| Scenarios[scenarios.py]
  Controls -->|available-work assignment| Scheduling[scheduling.py]
  Scheduling -->|assignment and blocked events| Activity[activity.py]
  Simulation[simulation.py] -->|completion events| Activity
  Controls -->|control events| Activity
  ProductionControls -->|renders snapshot history| ActivityFeed
  ControlsBrowser[production-controls.spec.ts] -->|verifies manual production and reset| App
```

## Configuration and documentation

| File | Responsibility | Verification |
| --- | --- | --- |
| [.gitignore](../.gitignore) | Exclude credentials, runtime data, tools, caches and generated outputs. | Git status/check-ignore |
| [.node-version](../.node-version) | Reference Node version. | `node --version` |
| [.python-version](../.python-version) | Reference Python version. | `python --version` |
| [pyproject.toml](../pyproject.toml) | Runtime/test dependencies, pytest paths, application coverage gate. | Locked sync/backend checks |
| [uv.lock](../uv.lock) | Resolved Python versions/hashes. | `uv sync --locked --extra test` |
| [package.json](../package.json) | npm workspace commands and browser/schema dependencies. | `npm ci`, full checks |
| [package-lock.json](../package-lock.json) | Resolved JS versions/integrities. | `npm ci` |
| [frontend/package.json](../frontend/package.json) | React/Vite/TypeScript and component testing dependencies/scripts. | npm tests/build |
| [frontend/tsconfig.json](../frontend/tsconfig.json) | Strict TS/browser compilation. | `npm run build` |
| [frontend/vite.config.ts](../frontend/vite.config.ts) | Loopback dev server/API proxy, DOM tests and coverage inclusion/exclusion. | Full/coverage checks |
| [frontend/index.html](../frontend/index.html) | Browser title, responsive viewport and mount entry. | Browser test/build |
| [playwright.config.ts](../playwright.config.ts) | Test-owned backend/frontend servers, separate DB/output per run. | Browser test and clean exit |
| [development.md](development.md) | Setup, startup/restart, check commands, coverage scope and platform verification matrix. | Links and agreement with executed commands |


## Modeling workflow

| File | Responsibility | Verification |
| --- | --- | --- |
| [ModelingBoard.tsx](../frontend/src/dashboard/ModelingBoard.tsx) | Operator-facing persisted workflow board, task intake with icon-triggered field help/examples and editable material/color suggestions, print estimates, retry controls, stage actions, and review outcomes. Does not generate models or supports. | ModelingBoard tests, workflow module |
| [workflow.ts](../frontend/src/dashboard/workflow.ts) | Validates deterministic task creation and modeling/supports/review/approval transitions. No inference; backend owns persistence in the integrated app. | `workflow.test.ts` |
| [ModelingBoard.test.tsx](../frontend/src/dashboard/ModelingBoard.test.tsx) | Verifies input descriptions, material/color suggestions, custom material entry, stage progression, approval, and revision return. | `npm test` |
| [workflow.test.ts](../frontend/src/dashboard/workflow.test.ts) | Verifies required inputs, allowed transitions, and invalid action rejection. | `npm test` |

Return to the [repository map](knowledge-map.md) for requirements and research.

## Modeling production handoff

| File | Responsibility | Verification |
| --- | --- | --- |
| [modeling.py](../backend/print_assist/modeling.py) | Validated stage transitions and atomic approved-artifact creation through service transactions. | `python -m pytest backend/tests/integration/test_modeling.py` |
| [test_modeling.py](../backend/tests/integration/test_modeling.py) | Persistence, replay, invalid transition/input rejection and approved artifact order intake. | `python -m pytest backend/tests/integration/test_modeling.py` |

```mermaid
graph LR
  Board[ModelingBoard] -->|typed commands via api.ts| API[api.py]
  API -->|revision and replay guards| Service[service.py]
  Service -->|validated transition| Modeling[modeling.py]
  Modeling -->|approval creates| Artifact[Orderable artifact]
  Service -->|atomic snapshot| SQLite[store.py]
```

## Field help

| File | Responsibility | Verification |
| --- | --- | --- |
| [EntryField.tsx](../frontend/src/components/EntryField.tsx) | Shared input label and info icon; help hidden until hover, focus or tap; Escape dismisses; accessible field description. | `npm test --workspace frontend -- src/components/EntryField.test.tsx` |
| [EntryField.test.tsx](../frontend/src/components/EntryField.test.tsx) | Visibility, keyboard/touch activation, Escape dismissal, and non-submitting info button behavior. | `npm test --workspace frontend -- src/components/EntryField.test.tsx` |

```mermaid
graph LR
  OrderForm -->|field labels and icon help| EntryField
  ModelingBoard -->|field labels and icon help| EntryField
  EntryFieldTest[EntryField.test.tsx] -->|verifies interaction| EntryField
  ModelingBrowser[modeling-dashboard.spec.ts] -->|checks real hover and keyboard visibility| EntryField
```

## Interactive printer views

| File | Owned behavior / relationships | Verification |
| --- | --- | --- |
| [visual_assets.py](../backend/print_assist/visual_assets.py) | Local STL catalog and visual-ID allowlist used by task validation and snapshot metadata. | `python -m pytest backend/tests/integration/test_modeling.py` |
| [model.ts](../frontend/src/printers/model.ts) | Resolves each printer's active/latest completed job, artifact and bounded progress. | `npm test --workspace frontend -- src/printers/model.test.ts` |
| [model.test.ts](../frontend/src/printers/model.test.ts) | Empty, unknown, active, completed and invalid progress view states. | Frontend suite |
| [assets.ts](../frontend/src/printers/assets.ts) | Bounded same-origin STL loading, geometry validation, explicit rotation, centering and volume warnings without rescaling. | `npm test --workspace frontend -- src/printers/assets.test.ts` |
| [assets.test.ts](../frontend/src/printers/assets.test.ts) | ASCII/binary parsing, units/orientation, bounds, byte/triangle limits and invalid assets. | Frontend suite |
| [scene.ts](../frontend/src/printers/scene.ts) | Procedural frame/bed/nozzle, demand rendering, clipping, orbit/camera commands, resize, context failure and GPU disposal. Three.js is third-party, bundled locally. | `npm test --workspace frontend -- src/printers/scene.test.ts` and real browser tests |
| [scene.test.ts](../frontend/src/printers/scene.test.ts) | Real Three geometry and cameras with fake GPU boundary: clipping, commands, resizing, empty/placeholder scenes, failure and disposal. | Frontend suite |
| [PrinterScene.tsx](../frontend/src/printers/PrinterScene.tsx) | Asynchronous asset lifecycle, stale-load disposal, fallback, fit warnings and accessible camera controls. | `npm test --workspace frontend -- src/printers/PrinterScene.test.tsx` |
| [PrinterScene.test.tsx](../frontend/src/printers/PrinterScene.test.tsx) | Empty/loaded/stale/failed/context-lost view behavior and unmount cleanup. | Frontend suite |
| [PrinterFloor.tsx](../frontend/src/printers/PrinterFloor.tsx) | Compact overview and selected detailed printer, optional production controls, model association and local example-progress controls. | PrinterFloor and App tests |
| [PrinterFloor.test.tsx](../frontend/src/printers/PrinterFloor.test.tsx) | Printer selection, example isolation, empty state and artifact progress. | Frontend suite |
| [example-tower.stl](../frontend/public/models/example-tower.stl) | Original deterministic stepped example mesh in millimeters/Z-up; no real production certification. | STL loader and browser checks |
| [Model handoff](../frontend/public/models/README.md) | Partner-facing instructions and asset provenance. | Link/catalog consistency review |
| [printer-views.spec.ts](../tests/e2e/printer-views.spec.ts) | Real WebGL, camera-change evidence, local STL, WebGL fallback and production/model association workflows. | `python scripts/check.py full` |

```mermaid
graph LR
  App -->|overview or detailed tab| Floor[PrinterFloor]
  Floor -->|resolves job and artifact| View[model.ts]
  Floor -->|mounts visible scenes| Component[PrinterScene]
  Component -->|bounded local STL| Assets[assets.ts]
  Component -->|owns GPU lifetime| Scene[scene.ts]
  Scene -->|uses bundled controls and geometry| Three[Three.js]
  Catalog[visual_assets.py] -->|metadata and approved ID| Contract[contracts.py]
  Contract -->|generated types and state| Floor
  Contract -->|selector choices| ModelingBoard
  Assets -->|loads same-origin fixture| STL[example-tower.stl]
```
