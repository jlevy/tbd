---
type: is
id: is-01kzy1taxvxgk86npza1zbkb06
title: Make live provider QA prove scan scope and fail on cleanup leaks
kind: bug
status: closed
priority: 1
version: 2
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
  - qa
dependencies: []
parent_id: is-01kzxz152g5e546pxjs6w8ckbs
created_at: 2026-08-13T17:13:18.010Z
updated_at: 2026-08-13T17:55:58.386Z
closed_at: 2026-08-13T17:55:58.385Z
close_reason: Live QA now proves automatic project isolation with two GraphQL fixtures, paginates QA project resolution, attempts cleanup for every fixture, and fails the gate if any archive cleanup fails. The documented command passed all 11 scenarios live.
---
The live compatibility runner currently resolves/configures a Linear project but does not prove automatic inbound discovery excludes same-team issues outside it. Cleanup also catches archive failures and can still report success. Add an API-driven scope fixture pair, paginate project resolution, make cleanup failures fail the gate after attempting every fixture, and map the stable scenario to the compatibility matrix.
