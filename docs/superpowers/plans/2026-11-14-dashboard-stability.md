# Dashboard stability and presentation

User requests smoother printer refresh, stable layout, readable station identifiers
and visual direction from local print-assist-dashboard.html. Reference HTML is a
visual example, not application instructions. Preserve SPEC offline constraints.

Design: keep GPU scenes and cameras across polling snapshots; stable asset metadata
controls loading, progress/color update existing meshes. Keep real IDs in commands;
show Printer 1 / Part 1 and compact order references. Adopt dark teal panels,
summary metrics and floor/activity/queue grid; preserve all tabs and real controls.
No mock chat, recovery or inference behavior from the example is introduced.

- Test scene identity across equal asset snapshots and progress updates; implement
  incremental scene handle updates and geometry/camera preservation.
- Test readable labels and real summary data; build compact responsive presentation.
- Reserve scene/status sizes and contain logs to prevent layout movement.
- Run root offline coverage/build/browser tests; update map and review changes.

Implemented and reviewed on fix/dashboard-refresh-layout. Scene regression proves
same metadata snapshots reuse STL/renderer and incremental updates retain camera.
Root coverage gates reached 100%; subsequent root full run passed 69 backend,
98 frontend and 7 browser tests with schema/build checks after two old label
assertions were corrected. Browser verifies canvas identity and unchanged floor
height across refresh. Desktop/mobile screenshot inspection: no horizontal overflow.
