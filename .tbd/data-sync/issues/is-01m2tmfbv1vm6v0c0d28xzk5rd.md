---
type: is
id: is-01m2tmfbv1vm6v0c0d28xzk5rd
title: doctor should compare the policy block prose against renderPolicyBlock
kind: feature
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-18T16:09:29.184Z
updated_at: 2026-09-18T16:09:29.184Z
---
From review E's E1 follow-up suggestion (https://github.com/jlevy/tbd/pull/309#issuecomment-5732703205). E1 was a stale-prose drift in this repository's own committed policy block that nothing detected: inspectManagedArtifact compares the tbd integration block, and setup carries the policy block over verbatim, so doctor reported AGENTS.md current while the block contradicted the guideline. A narrow check (does the block contain the current POLICY_BLOCK_PROSE?) would catch the class on any user's repository without fighting hand-edited grant lines or user notes inside the block. Needs a remedy command that re-renders without changing a value.
