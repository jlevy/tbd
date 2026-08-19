---
type: is
id: is-01kzvrve6thxf2fxbs7tyd3jsp
title: Make nonexistent-ID CLI transcript deterministic
kind: bug
status: closed
priority: 1
version: 3
labels: []
dependencies: []
parent_id: is-01kzvr00wp6yqv6cbhgagx0ve8
created_at: 2026-08-12T19:58:08.089Z
updated_at: 2026-08-12T23:38:10.922Z
closed_at: 2026-08-12T23:38:10.922Z
close_reason: "Implemented and verified in PR #209: all front matter is YAML-only before parser dispatch, the executable engine cannot run, and the missing-ID transcript is deterministic. Full local CI and pre-push suites passed all 1,602 tests."
---
Current main CI run 31633760447 failed because cli-edge-cases.tryscript.md uses zzzz as an unknown ID. Generated four-character short IDs can randomly fall within the did-you-mean edit-distance threshold, adding a valid but nondeterministic suggestion. Use a deliberately distant, valid display-ID-shaped fixture and verify the coverage/tryscript gate.
