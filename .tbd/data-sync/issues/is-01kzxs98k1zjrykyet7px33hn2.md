---
type: is
id: is-01kzxs98k1zjrykyet7px33hn2
title: Recover a live create before its bridge record exists
kind: bug
status: closed
priority: 1
version: 3
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - pr-review
  - linear
dependencies: []
parent_id: is-01kzx848mdfzapsc2ddm6hm0zt
created_at: 2026-08-13T14:44:09.952Z
updated_at: 2026-08-13T15:07:57.366Z
closed_at: 2026-08-13T15:07:57.365Z
close_reason: Fixed in 8e00e188. Red regression reproduced the provider-create/attachment-failure/no-bridge window; the journaled creation snapshot now supplies the first three-way base, pull-only takes intervening remote fields without provider I/O, and the next full sync completes and consumes the journal without reverting them. All local and hosted gates green; originating thread replied to and resolved.
---
Cursor Bugbot thread PRRT_kwDOQ109P86Y-I6F identifies that a retained create journal can refer to a provider item that was created successfully while follow-up attachment/splice work failed, before writeLinkRecord established a three-way base. The current liveness fix fetches the item but the missing-record fallback seeds base from the current remote, which makes a tracker edit appear local/outbound; inbound-only then will not pull it.

Validate with a red end-to-end sync-engine test that starts from a provisional link and retained create journal with no bridge record, materializes the remote using the client UUID, changes the remote, forces targeted liveness, and runs --pull. Design and implement crash-safe recovery so a live create without a bridge seeds an appropriate creation snapshot/base and pulls remote divergence without provider writes or journal loss. Update spec/design/docs and reply on the originating thread with disposition and proof.

## Notes

Validated Bugbot thread PRRT_kwDOQ109P86Y-I6F as correct with a red end-to-end engine regression: provider create succeeds, attachment fails before first bridge record, remote title changes, pull-only previously reports no pull. Implemented creation-snapshot base recovery from the durable create intent. Focused 30/30 integration engine tests pass; complete Vitest 1,931/1,931; Tryscript 1,084/1,084; format/Markdown/lint/typecheck/build/publint pass; package-age 31 pins/0 violations. Awaiting commit, push, and hosted CI before closure.
