---
type: is
id: is-01kzx2h3wnfbscatsa26ftvb72
title: Tag exact v0.5.0 release commit
kind: task
status: closed
priority: 1
version: 4
labels:
  - release
dependencies:
  - type: blocks
    target: is-01kzx2h4ab6pmz70zq2zhb7xyw
parent_id: is-01kzx2gsbxgxck3kfswkb3gn3m
created_at: 2026-08-13T08:06:30.036Z
updated_at: 2026-08-13T08:53:30.712Z
closed_at: 2026-08-13T08:53:30.711Z
close_reason: v0.5.0 tags the exact green main merge commit a305a37d; the tag-triggered release workflow completed successfully.
---
Confirm main has not advanced unexpectedly, gate the exact release-PR merge SHA on successful main CI, create v0.5.0 at that commit, and push the tag.
