---
type: is
id: is-01m0xmafvdgyftr42fd8y9cbp2
title: Make Don't Just Test the Test a primary testing rule
kind: task
status: closed
priority: 2
version: 3
labels: []
dependencies:
  - type: blocks
    target: is-01m0xmbzp5xmkkmcyr4txjkp6g
parent_id: is-01m0xm7a8pywqqpqn451h4tdsv
created_at: 2026-08-25T23:33:09.100Z
updated_at: 2026-08-26T00:33:10.311Z
closed_at: 2026-08-26T00:33:10.310Z
close_reason: Made Don’t Just Test the Test a primary section with four concrete vacuous-test examples and the exact cases in which construction or setup tests earn their place.
resolution: null
duplicate_of: null
---
Probably the most important principle here is "Don't Just Test the Test": Don't write a test that does nothing but check the assumptions of the test itself, like checking that the initialization happened or that a created object contains the fields it was just instantiated with. There are many vacuous tests like this written by agents.

Use this exact concrete smell and include specific examples of vacuous tests and the independent behavior they should establish instead. Do not dilute it into generic advice to "assert outcomes."
