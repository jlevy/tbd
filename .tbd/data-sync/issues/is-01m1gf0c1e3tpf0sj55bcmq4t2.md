---
type: is
id: is-01m1gf0c1e3tpf0sj55bcmq4t2
title: "PR #266 review R1: gh skill install with no selector installs nothing and exits 0"
kind: bug
status: closed
priority: 0
version: 2
labels: []
dependencies: []
parent_id: is-01m1gf0bjgf9gdmq3megpsn7fs
created_at: 2026-09-02T07:05:48.845Z
updated_at: 2026-09-02T07:14:15.452Z
closed_at: 2026-09-02T07:14:15.451Z
close_reason: "Fixed in 0176d239 on PR #266; disposition map posted as issuecomment-5505903595."
resolution: null
duplicate_of: null
---
ensure-gh-cli.sh:323. Verified independently: gh skill install github/gh-stack --pin v0.1.0 --dir DIR --force installs 0 files and exits 0. Needs an explicit skill name (gh skill install REPO gh-stack) and result verification instead of trusting the exit code.
