# Integrate published modeling/support work

User authorizes integrating GitHub origin/main 3b01bbd into local main 3327576.
Work on feat/integrate-modeling-supports; preserve printer/clock/proposal/profile
work. No publishing or live agents. References SPEC 4/6/7/12 and existing maps.

- Merge linked support-assessment records, paired review/artifact metadata,
  removal safeguards, NIST preview and configurable local test ports.
- Keep profile import, hidden preparation-only controls, next-quantity handoff,
  selected printer, reset/session guards and material reservation contracts.
- Regenerate types from combined contracts instead of resolving generated text.
- Upgrade legacy unassessed Supports/Review tasks to pending Supports without
  losing model metadata. Preserve approved history; label unknown assessments.
- Ensure bundled NIST demo matches available blue PLA and is cataloged for the
  existing bounded STL printer-bed loader. Keep demo estimates clearly labeled.
- Update browser selectors to distinguish modeling canvas from printer canvases,
  and require explicit support assessment on the guided approval path.
- Run full offline coverage/build/schema/browser checks and read-only review,
  then commit merge and fast-forward local main. No remote push.

Verification: root `.venv\Scripts\python.exe scripts/check.py coverage` passed
91 backend, 157 frontend and 12 browser tests with 100% application coverage,
schema/type/build checks. Read-only review's demo-inventory issue is resolved.
The guided browser control sequence pauses the clock to avoid revision races;
live progress retains separate browser coverage. Documentation links and Git
whitespace checks pass. Existing bundle-size advisory remains.
