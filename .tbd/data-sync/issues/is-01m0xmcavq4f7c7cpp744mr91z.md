---
type: is
id: is-01m0xmcavq4f7c7cpp744mr91z
title: Replace abstract guideline headings with topic-specific headings
kind: task
status: closed
priority: 2
version: 3
labels: []
dependencies:
  - type: blocks
    target: is-01m0xmcxvqt3p2qz7p4netcne2
created_at: 2026-08-25T23:34:09.526Z
updated_at: 2026-08-26T00:33:12.565Z
closed_at: 2026-08-26T00:33:12.563Z
close_reason: Replaced abstract headings across the new cross-cutting and Rust guidelines with topic-specific prescriptions while leaving the underlying carefully written sections intact.
resolution: null
duplicate_of: null
---
On all the new files you're writing, don't be abstract. Be concrete and follow the tbd.md guidelines to be as precise and concrete as possible.

Here's another example of a bad heading: "Test the State Machine, Not the Final Bytes". There's very little information in that heading that would help you know whether it applies to your situation. Make headings concrete and specific, or at least state the topic in a clearer way. They shouldn't be too long or too short in general.

Make sure the work emphasizes my strong expectation of very specific language and specific examples over general guidance that any agent would already know. This is not the same as saying everything is overly prescriptive. It needs to be very specific, with specific rationale, and leave it up to the agent to decide when to use the principles described in those guidelines.
