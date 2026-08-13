---
type: is
id: is-01kzydychmx52zhy9by6xmh1ne
title: Make Linear live discovery QA tolerate unrelated scoped issues
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels: []
dependencies: []
parent_id: is-01kzy93y91gssqs5nbv6zga00g
created_at: 2026-08-13T20:45:13.651Z
updated_at: 2026-08-13T20:50:49.094Z
closed_at: 2026-08-13T20:50:49.093Z
close_reason: Fixed after the live release gate reproduced the issue with unrelated TBD-162. The automatic scope scenario now accepts structured report output for semantic exit 1, validates only its owned inside/outside sentinels, and still rejects process/usage failures and contract violations. The rerun passed all 11 live API scenarios and cleaned its fixtures.
---
The final live QA reached automatic-inbound-scope but exited because the configured real Linear project also contained unrelated TBD-162, a sub-issue whose parent is not linked in the disposable repo. The CLI correctly reported both the QA sentinel and the unrelated hierarchy failure; the harness incorrectly assumed a pristine project. Update the live scenario to parse report output even when unrelated candidates make the CLI exit nonzero, assert the in-project/out-of-project sentinels, and fail only if its own contract is violated.
