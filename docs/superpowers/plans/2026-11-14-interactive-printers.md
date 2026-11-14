# Interactive printers implementation plan

> Execute inline using superpowers:executing-plans and test-driven development.

**Goal:** Three real interactive printer/bed views driven by production state, with local STL assets associated with approved artifacts.
**Architecture:** React owns view selection; Three.js renders procedural equipment and local part geometry. Backend validates and persists optional visual asset IDs through modeling approval. No production mutation originates in the renderer.
**Stack:** Existing React/TypeScript/FastAPI stack plus bundled Three.js.
**Spec:** [Approved design](../specs/2026-11-14-interactive-printer-design.md).

## Constraints and review focus

- 220 x 220 x 250 mm simulated volume; STL in millimeters/Z-up, no automatic scaling.
- Local catalog only; no arbitrary URLs or external resources. 10 MiB / 100,000-triangle limits.
- No AI, hardware or paid calls. Preserve readable status when WebGL fails.
- Review stale asset responses, hidden-tab disposal, bounds/orientation, zero/completed progress and old database compatibility.
- Ruling: work in the current checkout on a separate feature branch, following the existing session workflow. No concurrent implementer is sharing files.

## Task 1: Catalog and persisted association

Files: backend `visual_assets.py`, `contracts.py`, `modeling.py`, `api.py`; frontend generated types and modeling form; `test_modeling.py`.
Interface: `visual_asset_id: str | None` on tasks/artifacts; `FactorySnapshot.visual_assets` returns IDs, same-origin paths, units and orientation. Catalog example STL is a checked-in asset.
- [x] Test approval preserves known visual IDs, rejects unknown IDs, and accepts existing records without IDs; observe failures then implement.
- [x] Add an optional catalog selector to Modeling; preserve existing field behavior and regenerate API types.

## Task 2: Geometry and view-state rules

Files: frontend `printers/model.ts`, `assets.ts` and unit tests; example STL.
Interfaces: `printerView(snapshot,printerId)` selects active/latest completed job and its artifact; `loadPart(asset,signal)` reads bounded local bytes and returns normalized Three geometry and fit information.
- [x] Test idle/active/completed/missing visuals; progress clamps and orientation/centering without scaling.
- [x] Test STL parsing and file/triangle limits, nonfinite/empty geometry, failure and abort; implement after intended failures.

## Task 3: Renderer and controls

Files: frontend `printers/scene.ts`, `PrinterScene.tsx`, `PrinterFloor.tsx`, tests and styles; dependency manifests/lock.
Interfaces: `mountScene(element,part,progress): SceneHandle` exposes camera control/reset/dispose. Components load asynchronously and dispose old resources on selection/unmount; view state drives clipping only.
- [x] Test lifecycle, fallback, stale loads, printer selection and camera controls before implementation.
- [x] Build local procedural frame, plate/grid, gantry/nozzle, part clipping plane, orbit controls, reset and keyboard-friendly controls. Add readable fallback and fit warnings.
- [x] Mount compact scenes only on Overview; a single selected detailed scene on Printers. Hidden views must not own render loops.

## Task 4: Verification and delivery

Files: browser tests, code/knowledge maps, setup/partner asset instructions.
- [x] Run real WebGL browser flow for camera controls, example preview, selection, progress and context failure fallback; deny external traffic.
- [x] Run root `scripts/check.py full` and `coverage`, resolve failures and review the whole change.
- [x] Update maps, dependency/license notes, exact commands/results and handoff instructions. Leave feature available for user preview before integration.

## Execution record

- Design approved 2026-11-14. No accessible Prusa MK3 library asset found locally or in connected tools; procedural equipment is the initial visualization.

- Ruling: publish catalog metadata inside the existing state snapshot instead of a separate endpoint; this avoids an extra startup request and keeps associations and available choices together.
- Geometry, state-selection, loader, renderer and UI tests were observed failing before their corresponding implementations.

- Final review: fixed removed-catalog-entry snapshot validation with a failing-then-passing persisted-data regression. Corrected separators in UI text. GPU cleanup also explicitly releases the context, with a regression test.
- Final verification: root coverage command passed 48 backend, 77 frontend and 5 browser tests, 100% statement/branch coverage, generated-type drift and build checks.
