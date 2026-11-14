# Interactive printer and bed visualization

Status: approved 2026-11-14; implemented on the interactive printer feature branch.

## Intent and agreed direction

Provide interactive 3D views of the three existing virtual printers so operators
can see what is on each bed and inspect production visually. The user selected
interactive 3D over schematic views. Their partner will supply models of the
parts being printed; this work supplies the printer frames, beds and viewer.

## Approach and technology

The alternatives were interactive 3D (selected: supports actual model inspection)
and lightweight schematics (simpler rendering, less useful for supplied models).
Retain React/TypeScript and the existing authoritative FastAPI state. Proposed
implementation choice: Three.js with its OrbitControls and STLLoader, installed
and bundled locally. No model provider or CDN is involved.

Official references: [STLLoader](https://threejs.org/docs/pages/STLLoader.html),
[OrbitControls](https://threejs.org/docs/pages/OrbitControls.html).

## Views and interaction

- Overview remains the landing tab. Three compact printer views show the bed,
  current part and existing status, job and progress text. Order entry stays in
  Orders. All production indicators use actual backend snapshot state.
- Printers provides a larger selected-printer view with rotate, zoom, pan and
  reset-camera controls. Selecting a printer preserves its identity and shows
  its corresponding active job and artifact.
- Use simple procedural printer frames, a gridded build plate, gantry and nozzle.
  Proposed dimensions: a clearly labeled simulated 220 x 220 x 250 mm build
  volume for all three printers until real dimensions are configured.
- Show a bundled example part when demonstrating examples, labeled as example
  geometry. Empty idle printers have empty beds. A job without a visual asset
  gets a labeled placeholder, never another job's model.
- Reveal a model progressively from the bed upwards according to simulated job
  progress. This is a visual approximation, not slicing, a toolpath, or a claim
  about real print quality. Pause freezes simulated progress; moving the camera
  never changes production state. Completed work can show the finished part
  until the next job uses the bed.
- Retain readable HTML status/progress and a useful fallback when WebGL is
  unavailable. Support keyboard camera controls and reset. Avoid perpetual
  rendering when hidden; release GPU resources and event listeners on disposal.

## Part assets and partner handoff

Proposed first delivery contract: STL part files, with coordinates interpreted
as millimeters and Z-up. The partner supplies parts at their intended scale;
record any explicit orientation adjustment in the local asset catalog. Do not
silently shrink oversized geometry to make it appear to fit. Center the part
on the plate and place its lowest point on the bed; show an out-of-volume warning
when bounds exceed the simulated build volume. The warning is visual information
and does not certify or change production compatibility rules.

First version uses repository-local assets and a small typed asset catalog,
including a deterministic example mesh. Partner files can be added to that
catalog once supplied. The catalog maps stable visual asset IDs to same-origin
STL paths, units and orientation metadata. Add an optional visual asset ID to
model tasks and approved artifacts; approval preserves the selected association.
The existing file-reference string remains a production reference and is not
automatically fetched as a URL or arbitrary filesystem path. Browser file upload
and additional formats are separate extensions, not needed for this delivery.

Use a proposed 10 MiB file limit and 100,000-triangle limit for this prototype.
Invalid, missing or oversized assets produce visible errors without blocking
orders or scheduling. No external resources, credentials or paid model calls
are required. Asset requests remain same-origin; stale loads cannot replace
the newly selected printer or part.

## Integration and boundaries

Extend snapshots and generated types compatibly; existing databases and artifacts
without visual IDs continue to work. Share the selected artifact/model association
through backend persistence rather than unrelated per-view sample state. Existing
job elapsed time and duration drive the visual reveal. No printer hardware,
G-code execution, slicing, AI generation, packing simulation or automatic
reorientation is added. No real supplied files are required to build and verify
the example workflow.

## Verification and completion

Use test-first development for asset association, bounds/orientation calculations,
progress, selection, errors and lifecycle behavior. Test approval preserving
visual IDs, old database compatibility, unknown visual IDs and stale loads.
Exercise real local WebGL rendering, camera controls and fallback in offline
browser checks using small deterministic fixtures. Keep behavioral unit tests,
the existing coverage gates and schema/build checks; do not use decorative pixel
snapshots as the sole correctness evidence. Run full and coverage commands from
the repository root, document actual results and update the code/knowledge maps.

The implementation plan will choose module boundaries and dependency versions.
The dimensions, asset catalog approach and limits above are proposed defaults,
not requirements supplied by the user. Review before merging or publishing.
