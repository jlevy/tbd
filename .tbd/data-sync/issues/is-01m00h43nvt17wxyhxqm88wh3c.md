---
type: is
id: is-01m00h43nvt17wxyhxqm88wh3c
title: "[epic] External sync and traceability: prime, claim, checkpoint, Linear visibility"
kind: epic
status: open
priority: 1
version: 62
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels: []
dependencies: []
child_order_hints:
  - is-01m00h4kq7ywbxdn9nz2tedv7b
  - is-01m00h4n4v9ej5abttafz79t72
  - is-01m00h4phk5sx8cf4meq0gpk9b
  - is-01m00h4r097kwbjg224wn8xxbk
  - is-01m00h57nkvtvkbqn992w5fm2e
  - is-01m00h5aejamyg9y5vw4qf9649
  - is-01m00h5bwwh3cnhd087t7yc7dx
  - is-01m00h5y6q413edk3j82zry3d9
  - is-01m00h5zhsp0wh3nkcydjf0rtk
  - is-01m00h60xmsj85fqn07wkrtjqd
  - is-01m00h62dhwa0tgqbrxz4sb0sc
  - is-01m00h6mdt1t263xgyn6ht00d5
  - is-01m00h6nssev3wydw37zz68nhn
  - is-01m00h6q764kkt4jekkeqjz5kb
  - is-01m00h6rm09zkf3e6n88pzd4ge
  - is-01m00h74jxrdkgs06btjdx4v22
  - is-01m00h762qx9k4enj3pdk3q75a
  - is-01m00hf31fn9wskcxd775x8xaa
  - is-01m00j9jkhwgbczp3hkcy38z7q
  - is-01m00j9m3fp2j6hny5s14fs2a0
  - is-01m00ja5yw7ebsx68tw8k844e3
  - is-01m00ja7cxw4z9heqpmdcmsfsa
  - is-01m00ja8zjg8mbnw6b474q9q17
  - is-01m00jaacfz0nepg8ghey7qd87
  - is-01m00k639pqyx9p30eszfh06k0
  - is-01m00k64qt61hy5vnwb66nr3zx
  - is-01m00k6rrtay18j0gb1snphxge
  - is-01m00k6t67cbxc3hrcwek1563e
  - is-01m00k6vj8rnw98ttyx016mmak
  - is-01m00k6wyrse7se3kj2693296a
  - is-01m00mw87c585dzj8yxfxm9er5
  - is-01m00mw9ppcnxpzvqakekq5tpc
  - is-01m00v3wqaatz90kaztwafsz1c
  - is-01m00v3z032qt4610478q3vsw6
  - is-01m00y5g4nha1jb0kxnempajex
  - is-01m010epmrrmp2s67x1pe8xqa3
  - is-01m012qa5v7vjnn713ec383mze
  - is-01m017pgj0jg1kr909p5khayt1
  - is-01m017q47ynz01gchchm33d958
  - is-01m017q64g3783gr7eyde3mjfx
  - is-01m017q7z7fq1p6b1zdqya2xd0
  - is-01m044nedt6k3nsfsnnyxep4k3
  - is-01m044ntts3mchercdbj5ysc1w
  - is-01m044nvks5kv7t4cs9gn8b6sw
  - is-01m044p9c6bhvyb8bbryag33hz
  - is-01m044ppfx0jkk2ddfe2faf5pn
  - is-01m044pq2zntk84fyb610dprmn
  - is-01m044qg77sr6cpwasm0qkhcbq
  - is-01m044qhmd5be33jt0rj5e710g
  - is-01m05x3f2n5bcn6174150jr7mx
  - is-01m05x3fzw9mvsg09kdseyqh78
  - is-01m05x3x47jz7nk999rmb7bbex
  - is-01m05x3xpvvtc5ejwvg9b11hgz
  - is-01m05xpyh3fz4dd9masskp0ats
  - is-01m05xqby3me0gh4er7b5kb1dv
created_at: 2026-08-14T16:19:15.771Z
updated_at: 2026-08-16T18:35:41.890Z
extensions:
  linear:
    id: 1ef43a0c-0cf8-4944-a374-327de127108c
    linked_at: 2026-08-16T00:13:27.259Z
---
Make Linear show what every agent is doing right now, from a small set of mirrored issues — and make tbd sync cheap enough that agents can run it constantly.

Full background: docs/project/research/current/research-2026-08-14-agent-sync-protocol-and-hooks.md

Findings, all measured 2026-08-14 against this repo's 1,681 beads and a probe of the sync engine against the bundled mock Linear server.

EFFICIENCY — prerequisites for everything else (label: sync-efficiency)
- F5  tbd sync pushes the sync branch without --no-verify, so every sync fires the parent repo's pre-push hook; here that is the full test suite, and again on each retry. (tbd-7okw)
- F9  A no-op sync rewrites EVERY bridge record (synced_at only), so it commits, pushes, and triggers F5 — while reporting nothingToDo: true. (tbd-774m, P0)
- F10 Comment polling is one request per linked bead per sync, so cost is 2+N. A 70-bead mirror allows ~34 syncs/hour across everyone sharing a key. (tbd-iqgm)
- ensureMeta caches per-process only, so every CLI run re-fetches team states and labels. (tbd-9ulk)

SURFACE CONSISTENCY
- sync_on_tbd_sync defaults to TRUE and the fold is systematic — that part is correct. But:
- F6 tbd sync --push silently performs the outbound-only mirror setup-linear warns joiners never to run. (tbd-71am)
- F7 tbd --dry-run sync and --status never cover the tracker. (tbd-42u4)
- tbd sync --issues silently drops the tracker. (tbd-8ot8)
- F8 sync.ts:1155 says the fold is 'off by default'. It is on. (tbd-1uep)

VISIBILITY
- F1 The default policy selects 114 of 254 active beads (45%), not the ~10% claimed in setup-linear and policy.ts. (tbd-czhw)
- F2 44 of those 114 are at depth 3 and skipped under max_nesting: 2, so 114 selected produces 70 Linear issues. (tbd-czhw)
- F3 8 of the 14 in_progress beads are not selected, so in-flight work is invisible. (tbd-9j5a, tbd-o6o6)
- F4 0 of 1,681 beads have ever carried an assignee; there is no claim or presence signal at all. (tbd-mnci, tbd-f39i, tbd-c4zl)

ORIENTATION
- The SessionStart hook exits 1 in this environment (PATH prepend shadows Node 22 with Node 20) and fails silently. (tbd-fnwc, tbd-qd1n)

Suggested order: fix the efficiency items first (a quiet sync must be ~2 requests, 0 writes, 0 commits, no push), then repair the existing surfaces, then the claim protocol, then enforcement hooks.
