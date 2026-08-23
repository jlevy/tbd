---
type: is
id: is-01m0exfjrvc0nz7698bmrktanb
title: Upgrade gate has no same-format baseline now that f08 has shipped
kind: bug
status: closed
priority: 1
version: 2
labels: []
dependencies: []
created_at: 2026-08-20T06:24:36.634Z
updated_at: 2026-08-20T06:34:08.108Z
closed_at: 2026-08-20T06:34:08.107Z
close_reason: "Fixed in a252f192: same-format baseline moved to 0.7.1 (f08) with expectOldClientToWork true and expectManagedScriptChange false, plus a precondition that refuses a degenerate run when the candidate version equals the baseline. All four proofs pass against a 0.7.2 candidate."
resolution: null
duplicate_of: null
---
packages/tbd/scripts/validate-upgrade-package.mjs sets sameFormatBaseline='0.6.3' (f07). Its own docstring explains why: when f08 was introduced no published version was f08 yet, so 'there is deliberately no same-format baseline until the candidate ships'. f08 shipped in 0.7.0 and 0.7.1 is published, so that baseline now exists and the script is a release behind. The consequence is that the 0.7.x -> candidate path — same format, additive bead fields, new optional slot on the bridge base, which is exactly the shape of the current release — is not exercised by the gate at all.
