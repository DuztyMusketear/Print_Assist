# Print Assist development instructions

## Scope and boundaries

- Work inside this repository. Preserve unrelated local changes.
- Read `SPEC.md` for product requirements and testing/runtime constraints.
- Never expose credentials or run live application agents during development.
- Do not push, publish, deploy, or contact collaborators unless explicitly asked.

## Branch workflow

- Never implement features or fixes directly on `main`.
- Before editing, inspect Git status and the current branch. Use a separate
  branch for each cohesive feature, fix, or maintenance task:
  `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, or `chore/<topic>`.
- Continue on an existing task branch when it already matches the work. Do not
  move unrelated uncommitted changes onto another task without resolving their
  ownership. Use an isolated worktree when concurrent work requires it.
- Keep commits focused. Record relevant checks and update documentation before
  requesting review. Integrate into `main` only after review and passing checks;
  do not merge or push without user authorization.
- Agree with the partner on integration order when branches touch shared
  contracts. Branch protection on GitHub is a separate setup task, not something
  these instructions enforce automatically.

## Repository knowledge graph

- Start navigation with `docs/knowledge-map.md`, then read the relevant files.
- The map is a checked-in index of file responsibilities and relationships, not
  a substitute for inspecting code before changing it.
- Every application source, configuration, and test file must have a map entry
  stating its purpose, owned behavior, related files, and verification command
  where applicable. Do not index dependencies, generated files, secrets, caches,
  or runtime data.
- Update entries and graph edges in the same change that adds, moves, removes,
  or changes a file's responsibility. Use repository-relative clickable links.
- Show important dependency, contract, documentation, and test relationships
  with labeled Mermaid edges. Record only inspected relationships; label future
  architecture as planned rather than implying it exists.
- Prefer the map and narrow searches over repeatedly scanning the whole repo.
  If the map is missing or stale, inspect the actual files and repair it.
- Keep maintenance local and deterministic. Do not launch agents, call models,
  or add a graph service to refresh this index.

## Testing and completion

- Follow red-green-refactor TDD for every behavior change and bug fix.
- Cover all application behavior with meaningful unit tests; add integration
  and workflow checks as required by `SPEC.md` section 12.
- Use deterministic fakes and offline tests. Never use paid model calls as tests.
- Run affected tests and the full offline suite from the repository root before
  completing code changes. Report exact commands/results and any limitations.
- Documentation-only changes require link, consistency, and formatting review;
  do not fabricate a passing test result when no executable suite exists.
