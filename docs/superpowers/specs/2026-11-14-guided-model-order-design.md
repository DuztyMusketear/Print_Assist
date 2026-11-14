# Guided model-to-order workflow

User priority replaces additional visual polish: browse saved models, upload a
model with reusable estimates/material, choose quantity/deadline, confirm a visual
schedule and automatically print. The user selected a local example shop feed
for this MVP; no real shop authentication, remote API or credentials are needed.

Keep Overview as the landing page; navigation follows Models, Orders, Schedule,
Overview, Printers. Models owns a searchable approved library and bounded STL
upload. A single explicit save/approval records a support assessment and print
profile; existing detailed modeling/support review stays available as preparation
tools. Estimates are supplied once by the preparer, including grams for material
validation, rather than inferred from geometry or invented at order time.

Orders owns quantity, visible production/ship deadlines and a local example-feed
inbox. Known example product mappings preselect models; unmatched products require
selection. Acceptance creates a held order. Re-import/accept retries cannot duplicate
orders, and rejected/pending requests cannot print. No hidden live integration.

Schedule owns printer lanes with model previews, planned times, existing work and
deadline warnings. The main review path requires a feasible, complete, on-time
proposal before confirmation. Server validation enforces the same constraints.
Confirmation starts automatic dispatch and returns to Overview. Manual starts
remain available under advanced options. Existing clock/session/revision/receipt
guards remain authoritative; pause the simulation for stable schedule review.

Approach: extend existing approved artifacts, SQLite commands and future proposal
engine. A separate application or replacement workflow would discard tested
contracts and is unnecessary. Store validated mesh bytes in SQLite alongside the
existing database, with hash-addressed local preview routes; never use an uploaded
filename as a filesystem path. Enforce existing 10 MiB/100,000-triangle bounds,
finite nondegenerate geometry and virtual bed size before approval. Preview-only
geometry does not constitute slicing, toolpaths or physical printer certification.

Out of scope: live shops, slicer integration, CAD generation, physical printing,
new inference and the separate fault/agent-framework work. Keep the dark, compact
dashboard; show secondary preparation/settings only when requested.
