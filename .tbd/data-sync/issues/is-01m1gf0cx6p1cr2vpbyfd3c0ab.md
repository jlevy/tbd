---
type: is
id: is-01m1gf0cx6p1cr2vpbyfd3c0ab
title: "PR #266 review R3: main still hardcoded in step 4 after step 1 resolves TRUNK"
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
parent_id: is-01m1gf0bjgf9gdmq3megpsn7fs
created_at: 2026-09-02T07:05:49.733Z
updated_at: 2026-09-02T07:14:16.112Z
closed_at: 2026-09-02T07:14:16.111Z
close_reason: "Fixed in 0176d239 on PR #266; disposition map posted as issuecomment-5505903595."
resolution: null
duplicate_of: null
---
create-or-update-pr-simple.md:45-46 and the validation-plan twin. Also needs a fallback if the TRUNK query returns empty.
