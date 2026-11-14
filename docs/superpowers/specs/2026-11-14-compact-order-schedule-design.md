# Compact order planning and queue controls

User refinement: keep the model library, add search within Orders while preserving
the library selection, reduce form height, flag impossible deadlines with usable
alternatives, use compact clickable order cards, confirm edits/deletions, label the
timeline's bottom calendar axis, and simulate individual incoming requests for both
manual and automatic matching demos. Website model imports belong to the partner.

Extend the existing workflow rather than replacing its validated scheduler. A
read-only draft estimate uses the same queue/capacity/material planner as final
confirmation. Show feasible copies and earliest completion when available; never
claim playback speed changes manufacturing duration. Changing the chosen quantity
or dates is explicit. Retain manual start and packing/shipping details as secondary
controls. Keep keyboard-accessible model selection and compact quantity/date fields.

Schedule shows cards with model, copies, status and estimated finish; selecting one
opens details. Late, blocked and overlapping allocations have textual/color cues.
Explicitly label per-item estimated print time and filament on saved models. Order
planning/cards/details show quantity-based totals and filament type/color; edited
quantity confirmations show revised totals. Total printer time means summed work,
separate from the scheduled finish date; proposed queue totals exclude blocked work.
Confirmed edits to unstarted queued work release its placements and require fresh
review. Confirmed deletion archives the order and cancels unstarted placements,
releasing commitments without restoring consumed stock. Started/completed attempts
are protected; cancellation/scrap of active prints remains separate work. All
mutations retain revision/session/idempotency guards, including confirmation delays.

Day/week/month timeline views put aligned UTC date/time ticks beneath printer
lanes; cap tick count and retain mobile scrolling. The existing simulation clock
is distinct from estimates and selected planning dates.

Follow-up: distinguish orders with consistent colors across printers and a labeled
color key. A complete allocation has an estimated completion in the key and an end
marker on its last print; partial, blocked, unavailable or overlapping allocations
must not imply whole-order completion. Preserve textual status/deadline warnings.
Use persisted order insertion order for color assignment (including archived orders)
so advancing the clock or adding another order does not recolor existing orders.
Use a distinct generated hue per order rather than a short repeating palette.
Keep the existing simulated intake commands; add an expandable walkthrough beside
the simulator explaining manual/automatic matching, confirmation and printer viewing.

An explicit Simulate incoming order form produces a persisted, uniquely identified
local request with model, quantity and dates. Manual mode leaves it pending;
automatic matching creates a held production order and previews the schedule.
Final confirmation still starts printing. No live shop calls, hidden inference,
website importer or hardware connection is introduced.
