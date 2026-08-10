---
type: is
id: is-01kzn50zw89y02g85dccqy48d8
title: "Attachment payloads: bead metadata, spec, repo links"
kind: task
status: open
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies:
  - type: blocks
    target: is-01kzn510a0s6yafgt5j1x9nyss
  - type: blocks
    target: is-01kzn5152hkvnx553tj4gwgc28
parent_id: is-01kzn2w9w9gx9j6h3b250jnyzf
created_at: 2026-08-10T06:16:11.911Z
updated_at: 2026-08-10T06:16:17.232Z
---
attachmentCreate is a TRUE UPSERT keyed on url (verified: same id returned, title/subtitle/metadata replaced) and metadata accepts nested objects and arrays despite docs saying string and number only. This is the one naturally idempotent, retry-safe write in the API. Emit: tbd://bead/<id> (title '<id> - <kind>', subtitle status/priority/child+ready counts, metadata = full canonical field set), tbd://bead/<id>/spec (permalink), tbd://bead/<id>/repo (bead file on sync branch). Spec Component 5.
