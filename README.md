# Print Assist

Print Assist helps small filament-printing businesses fulfill orders reliably
with less hands-on supervision. The first example is an Etsy seller producing
figures from existing print-ready files; the workflow also supports other small
print businesses.

The MVP is a browser-based production control center with three simulated
printers, manual order intake, deadline-aware scheduling, fault recovery, and
reviewable agent assistance. We aim to compete on a simpler overall experience,
reliable coordination, and predictable costs. These benefits and willingness to
pay still need customer validation.

**Current status:** Offline order entry uses a persisted queue. The dashboard
also tracks operator-supplied model references through modeling, supports, and
human review in persisted shared state; approved tasks become orderable artifacts. It does not generate models, create supports,
or slice files. Three virtual printers, interactive 3D beds with local STL previews, and scheduling are implemented; fault recovery remains planned.
Physical printer control, marketplace integrations, and billing are outside the
MVP.

The planned stack is React/TypeScript with Vite, Python/FastAPI, and SQLite,
with native Windows/macOS/Linux setup and an optional Docker Compose path.
Platform support will be claimed only after verification. All development uses
offline fakes; live application agents remain disabled until the framework is
verified and an operator explicitly enables a bounded demo.

See [development setup](./docs/development.md) to run the app and offline checks.

See the [product specification](./SPEC.md) for the MVP scope, requirements,
architecture, agent execution controls, and delivery plan.

For development, follow [AGENTS.md](./AGENTS.md) and start navigation with the
[repository knowledge map](./docs/knowledge-map.md). Use a separate feature,
fix, documentation, or maintenance branch; update the map alongside file changes.

The [MVP implementation plan](./docs/superpowers/plans/2026-11-13-mvp-implementation.md)
describes the proposed web app, test-first milestones, and cross-platform setup.

See the [judging checklist](./docs/judging-readiness.md) for the evidence we need
to present, and the [business validation brief](./docs/business-validation.md)
for interview questions, competitor references, pricing hypotheses, illustrative
costs, and the proposed demo story. Proposed subscriptions scale by printer
capacity with capped AI usage; prices are unvalidated.
