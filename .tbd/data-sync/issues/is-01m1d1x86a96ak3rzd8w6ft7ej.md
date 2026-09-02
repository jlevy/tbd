---
type: is
id: is-01m1d1x86a96ak3rzd8w6ft7ej
title: "QA playbook: validate the whole gh setup on a fresh Linux instance"
kind: task
status: open
priority: 1
version: 1
labels: []
dependencies: []
parent_id: is-01m1d1tam7230zrcj70ecmkt8b
created_at: 2026-08-31T23:19:11.817Z
updated_at: 2026-08-31T23:19:11.817Z
---
Deliverable that makes this PR verifiable by a different agent on a clean machine, which is the
acceptance test for the whole epic.

Add a QA playbook under tests/qa/ that a fresh-environment agent runs end to end:
1. Start from a clean Linux instance with no gh, or with a deliberately OLD gh installed (the
   more interesting case, since it exercises the version-floor bead and is the scenario the
   current script silently fails).
2. Run tbd setup, then the ensure script.
3. Walk the setup-github-cli.md fresh-machine procedure exactly as written.
4. Run the verification checklist and record actual vs expected for each line.
5. Build a real two-layer stack in a scratch repo, submit it, and confirm GitHub shows a linked
   stack with layer 2 based on layer 1 rather than on the trunk.
6. Run create-or-update-pr-simple.md against a stacked branch and confirm it does NOT retarget
   the PR at the default branch (the regression fixed by the --base bead).

The playbook must state expected output per step so the result is pass/fail, and must note that
an agent validating this should report what actually happened rather than confirming the doc.
