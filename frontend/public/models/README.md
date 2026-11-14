# Part assets for the printer views

The printer frame is procedural geometry, not an official Prusa MK3 model. No
Prusa library model was accessible through the repository or connected tools.
The frame can be replaced independently of the part assets later.

## Partner handoff

1. Export a part as STL at intended scale: coordinates in millimeters, Z-up.
2. Keep it below 10 MiB and 100,000 triangles. Simplify externally if necessary.
3. Add the file here with a simple name, such as `dragon-v1.stl`.
4. Add an entry in `backend/print_assist/visual_assets.py`: stable ID, display
   name, `/models/dragon-v1.stl` path, `units: mm`, and three rotation degrees.
   Rotations are XYZ Euler angles applied before Z-up is mapped into the scene.
5. Restart the backend. In Modeling choose the asset under **3D preview model**.
   Review/approve it, create an order for the approved artifact and schedule it.
   The matching printer now displays that asset using simulated job progress.

Files are served locally by Vite during development. No arbitrary URLs or
filesystem paths are loaded from the production reference field. The optional
visual asset ID persists on model tasks and approved artifacts. Existing records
without it show labeled placeholder geometry when printing.

The view centers the geometry on the plate and rests its lowest point on the bed.
It never scales a part to fit. Warnings describe the simulated 220 x 220 x 250 mm
volume; they do not certify compatibility or printability. The progress reveal
is a visual clipping approximation, not slicing/G-code or toolpath execution.

## Example and third-party provenance

`example-tower.stl` is original Print Assist example geometry: three stacked
rectangular tiers, generated deterministically in this change, in mm/Z-up. It
can be selected for a modeling task or shown via **Preview example part** in the
Printers tab. Example mode and its progress slider never mutate production.

Three.js 0.187.0 and its OrbitControls/STLLoader addons are bundled dependencies
under the MIT license (see the installed package LICENSE). Type declarations
are pinned to @types/three 0.187.0. No CDN, external decoder or model service is
used. Future externally sourced printer/part assets need their own provenance
and applicable license recorded alongside them.

## Prepared model profiles

The partner supplies geometry **and slicer-derived print time/filament weight**.
Normal printing selects an approved profile and quantity; users should not guess
these values or enter compatibility jargon. In Modeling, import profile JSON,
review it through the existing stages, then choose **Next: choose quantity**.

[Example profile](example-tower.profile.json) contains illustrative demo estimates,
not measured/slicer-certified performance. Replace values with the prepared part's
estimates; do not assume the example's 120 minutes / 25 g applies to other models.

Required JSON fields: `title`, `modelReference`, positive integer
`duration_seconds`, positive `filament_grams`, `filament_type` and `color`.
Optional `required_capabilities` defaults to `["FFF"]` for these virtual filament
printers; preparers can supply compatible requirements. Optional `visual_asset_id`
must refer to a registered preview (for example `example-tower`). Profile metadata
import does **not** upload/register the referenced STL or run a slicer. Continue
using the asset registration instructions above until PA-305 implements that flow.
Layer counts and toolpaths are not inferred from geometry; provenance/versioned
slicer settings and safe local file ingestion are tracked in PA-305.
