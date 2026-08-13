---
type: is
id: is-01kzx848mdfzapsc2ddm6hm0zt
title: Merge v0.5.0 main and assess Linear release candidate
kind: task
status: in_progress
priority: 1
version: 40
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - integration
  - release-candidate
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
child_order_hints:
  - is-01kzqs9ax4x2jc12zca4j441px
  - is-01kzx8jvr185a27s7c85zcwrvj
  - is-01kzx8jw39zc4dpgx6w82rg3dm
  - is-01kzqrsfqkzfs6nqb65yhwjves
  - is-01kzxa94czv16etffdg3peprm3
  - is-01kzxarn7mnat08m2xw96m53ca
  - is-01kzxawcw1hgqx2bzajsrnbtx9
  - is-01kzxb6s4agh9evbrx81a9qdzs
  - is-01kzxb9021cb71bgm46c9nhhbg
  - is-01kzxb9frjrd5jk17n3kb3chzj
  - is-01kzxbg4eqzh30m2ncb42vnjeg
  - is-01kzxbsjycz4yvzmpgdp82ysyy
  - is-01kzxbsk97bbqqvf3gk38za3qt
  - is-01kzxbv4ngwe88h2zwj5gpqsg7
  - is-01kzxbv516zknbsgzw6dt93v05
  - is-01kzxc397xk7zg6mxcvewbcsrb
  - is-01kzxcdbr49cz66vgp76n64fpv
  - is-01kzxcw3j4tkyq67m37qfac82b
  - is-01kzxd3e8wj8a9fsasmhdxaast
  - is-01kzxd6rb995nhsfesdpvpbgf6
  - is-01kzxd9et7v4g1n4mtgds8b85w
  - is-01kzxdhhh785bh95p3d1hy149v
  - is-01kzxdxa13azzfh0fk89cw80bh
  - is-01kzxdxac80d28zhp2khjsh2bf
  - is-01kzxdxapyjqr703ty8mknwwqk
  - is-01kzxdxb1mhthgn46vfxtawv01
  - is-01kzxg35z6xqe2s5j3wr6n315h
  - is-01kzxhw9w2xj03bfz4de3kxvpb
  - is-01kzxk660qk999gpapm6j74rgg
  - is-01kzxkvemtgka7w0kezxky6tac
  - is-01kzxmc1fwdgshnbsne64fha22
  - is-01kzxmc219typjnb46kwsm83k3
  - is-01kzxp8m8fn9vyrd0qfghkgtx2
  - is-01kzxp8mkfq99eamm3d3kw7a9e
created_at: 2026-08-13T09:44:20.358Z
updated_at: 2026-08-13T14:07:00.584Z
---
Merge origin/main into claude/linear-integration using the merge-upstream shortcut. Audit every overlapping sync/storage/schema/web surface for semantic conflicts, reconcile stale Phase 2 bead state, revise the plan with file/function-level Linear RC, GitHub, and web work, validate the built CLI and live Linear pilot end to end, run the full quality gates, push PR #206, and watch CI to a final result.

## Notes

origin/main v0.5.0 is merged semantically; live Linear phases 1-6 passed. Eleven PR review findings are fixed with TDD, including provider-neutral replay cancellation, cancellation-first unlink, pending-create/orphan distinction (tbd-8npr), and provider-namespace preservation during provisional-link enrichment (tbd-a1hv). Authoritative spec/design/user docs/changelog/generated skills are current. Final local gates at a91c1254: format/Markdown/lint/typecheck/build; 1,929 Vitest; 1,084 Tryscript; publint; package-age 31 pins/0 violations; 5k/10k performance coverage; packed web proof; native watch RC. Known gray-matter/js-yaml advisory remains narrowly unreachable and tracked as tbd-6gy0. Remaining: push, resolve two originating threads, replacement hosted CI, final thread sweep and disposition, then RC closure.
