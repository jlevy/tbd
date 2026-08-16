---
type: is
id: is-01m0623wddbwjvv9kwzekgg0e1
title: "Flatten the origin labels: bare 'tbd' marker plus repo:<name>"
kind: feature
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-16T19:52:26.274Z
updated_at: 2026-08-16T19:52:48.679Z
closed_at: 2026-08-16T19:52:48.678Z
close_reason: "Implemented, documented, and migrated live. Code: ORIGIN_LABEL, REPO_LABEL_PREFIX, labelColorFor, isForeignRepoLabel and isTbdOwnedLabel updated. Docs: linear-integration-design and setup-linear rewritten for the flat scheme. Tests: origin-labels, the sync-engine label block, and the CLI e2e provisioning assertions. Live: 263 issues migrated by in-place rename, all three repos verify Already provisioned, sync settles."
---
Shipped. The marker on every mirrored item is now a bare 'tbd', and repository labels are flat 'repo:<name>' instead of children of a 'repo' label group.

Why this way round: Linear enforces label-name uniqueness across a whole team and a group does NOT scope it, so a 'repo' group with bare children put 'repo/tbd' and a root 'tbd' in direct conflict — mirroring the tbd repository itself was impossible. The earlier fix prefixed the marker ('tbd:sync'); this prefixes the repository labels instead, which reads better because the marker is the single most-seen label in the workspace and the one the documented 'label is not tbd' filter names. Segments are sanitized to [a-z0-9._-] and cannot contain a colon, so a prefixed name can never equal a bare one — collision-proof by construction either way.

Cost: Linear's one-label-per-group guarantee. Small — tbd asserts exactly one repository label per item, so the invariant holds from this side, and 'everything from any tbd repo' is what the marker is for.

tbd: stays for occasional purposeful carriers (tbd:blocked, tbd:deferred), deliberately uncommon unlike the marker.

Also adds label colors at creation only, never on update: dark olive green for the marker, slate for repository labels, red/amber for blocked/deferred. Colour is presentation and belongs to the workspace once a label exists.

Live migration done by renaming in place: 263 issues kept their labels with zero per-issue writes, and all three repos report 'Already provisioned'.
