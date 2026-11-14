# Repository knowledge map

Start here to find responsibilities and related files. This map describes files
that exist today; there is no application implementation or executable test suite
yet. Runtime architecture proposals are in the specification.

## Current graph

Arrows describe the labeled relationship, not runtime imports.

```mermaid
graph LR
    README["README.md"] -->|introduces product| SPEC["SPEC.md"]
    README -->|navigation entry| MAP["docs/knowledge-map.md"]
    README -->|development guidance| RULES["AGENTS.md"]
    RULES -->|requires compliance with| SPEC
    RULES -->|requires maintenance of| MAP
    MAP -->|indexes| README
    MAP -->|indexes| SPEC
    MAP -->|indexes| RULES
    PLAN["MVP implementation plan"] -->|implements requirements in| SPEC
    MAP -->|indexes| PLAN
    JUDGING["docs/judging-readiness.md"] -->|guides evidence for| PLAN
    MAP -->|indexes| JUDGING
    BUSINESS["docs/business-validation.md"] -->|supplies preparation for| JUDGING
    MAP -->|indexes| BUSINESS
    README -->|links implementation roadmap| PLAN
    README -->|links evidence checklist| JUDGING
    README -->|links business hypotheses| BUSINESS
```

## File index

| File | Purpose and owned behavior | Related files | Verification |
| --- | --- | --- | --- |
| [README.md](../README.md) | Customer/value overview, planned web stack, honest implementation status, and contributor entry points. No runtime behavior. | Specification, instructions, map, plan, judging checklist, business brief | Check relative links and consistency with spec. |
| [SPEC.md](../SPEC.md) | Customer, business outcomes, MVP scope, proposed architecture, agent controls, TDD policy, acceptance criteria, and pricing hypotheses. Requirements rather than implemented behavior. | README, instructions | Review requirements for consistency; preserve offline development and explicit live-demo gates. |
| [AGENTS.md](../AGENTS.md) | Contributor/agent rules for branches, navigation, graph maintenance, tests, and authorization boundaries. No automated branch enforcement. | Specification, map | Compare rules with spec and current workflow. |
| [docs/knowledge-map.md](knowledge-map.md) | This index and relationship graph. No runtime behavior. | All indexed files | Confirm links resolve, entries match files, and edges match inspected relationships. |
| [MVP implementation plan](superpowers/plans/2026-11-13-mvp-implementation.md) | Proposed web-app architecture, six test-first milestones, contracts, portability checks, and offline readiness gate. All implementation paths are planned. | Specification, instructions | Review milestone coverage against spec and verify links. No execution results yet. |
| [Judging readiness](judging-readiness.md) | User-supplied rubric weights, evidence gaps, financial worksheet guidance, growth limits, and pitch checklist. Preparation rather than achieved scores. | Implementation plan, specification | Check weights total 100%, distinguish assumptions from evidence, verify links. |
| [Business validation](business-validation.md) | Sourced competitor observations, customer interview guide, hypothetical pricing/cost model, market evidence gaps, and demo script. No customer validation claimed. | Judging checklist, implementation plan | Verify arithmetic, dated source attribution, assumption labels, and local links. |

## How to extend the map

When implementation begins, add each source/configuration/test file to the table.
Describe what it owns and connect its actual imports, shared contracts, and tests
with labeled graph edges. Include runnable test commands once they exist. Keep
entries concise; split into linked subsystem maps as the index grows, retaining
this page as the top-level entry point.

Read the relevant implementation and tests before editing. Correct stale entries
in the same branch. The map helps locate evidence; it does not prove correctness
or automatically discover dependencies.
