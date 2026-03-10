---
type: is
id: is-01kfv2hqhf918k9q7rhztrfd5n
title: Create hasGitignorePattern() detection function
kind: task
status: closed
priority: 2
version: 10
labels: []
dependencies:
  - type: blocks
    target: is-01kfv2hwyh8g0namvvastjprj9
  - type: blocks
    target: is-01kfv2kq1tptewzzk901njccnj
parent_id: is-01kfv2he1c3hct3c07gv0edh90
created_at: 2026-01-25T17:17:12.110Z
updated_at: 2026-03-09T16:12:32.828Z
closed_at: 2026-01-25T17:26:42.919Z
close_reason: null
---
Implement the detection function that checks if a pattern exists in gitignore content.

Pattern matching rules:
- Normalize trailing slashes: foo/ matches foo/
- Exact line match (not substring)
- Skip comment lines (#) and blank lines when checking
- Case-sensitive (gitignore is case-sensitive on Linux)

File: packages/tbd/src/utils/gitignore-utils.ts
