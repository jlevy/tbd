---
type: is
id: is-01kxvmm1s3z2fhdxcg1b1ggg4j
title: "Session git broker: first push attempt often fails (sideband disconnect); tag pushes always rejected"
kind: chore
status: open
priority: 3
version: 1
labels: []
dependencies: []
created_at: 2026-07-18T22:12:48.035Z
updated_at: 2026-07-18T22:12:48.035Z
---
During the v0.4.1 release (2026-07-18), every first 'git push' attempt through the session broker failed with 'send-pack: unexpected disconnect while reading sideband packet' and an immediate retry succeeded; tag pushes (refs/tags/*) failed on all attempts and required the publishing.md branch-local release.yml recovery (as with v0.4.0). Consider documenting the retry-once behavior in publishing.md and/or asking the broker to allow tag refs for release sessions.
