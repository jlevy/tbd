---
type: is
id: is-01kzw6y8ppmp6bt6nd8tgmmspn
title: Polish web table time and column layout
kind: epic
status: closed
priority: 1
version: 44
labels:
  - web
  - release-readiness
dependencies: []
child_order_hints:
  - is-01kzw6ynhk7g7547xaw43pm26g
  - is-01kzw6ynzeydde58fa6q97xnwr
  - is-01kzw6ypc6h8pkjs1hdaqtpyxw
  - is-01kzw8ee5x53dqyske7ycvzkyc
  - is-01kzw93e83wnk699cjem1wz76c
  - is-01kzw93emdr4zjsfatr6t9vp73
  - is-01kzw95g87hwwn7bbx77x0atf1
  - is-01kzw99hbw2k6nj9dgqsd09xq8
  - is-01kzwem8emw6k4797akbkdq4xb
  - is-01kzwfnmyscjkk1g4p1hh99r8j
  - is-01kzwfnmysbzgmvne4sk4tm2py
  - is-01kzwfnmytmhxaeacngc8dj94h
  - is-01kzwh1kn32yy2c68xex09h9kz
  - is-01kzwhjmqn2ze00p37sajpg061
  - is-01kzwhnrwjwft3jxnmtcfe4r1c
  - is-01kzwhqdqw1pctnke33z07ffbh
  - is-01kzwhqw5tdp3hkrxt2yy3tw9q
  - is-01kzwhtrz43jsna99fmma7vcyg
  - is-01kzwhzjtedsjb2p5bs1qgx3qj
  - is-01kzwj3a66jtae68g448dn8cph
  - is-01kzwj40j5ws6dgganzmg24etj
  - is-01kzwj62hcm12f1gw1mg1pk8tb
  - is-01kzwj7jw5w3qs8yvartsrapbt
  - is-01kzwjy79znqd0j5b2tv3k2dmz
  - is-01kzwk0xk5t3h24fjtav4d6gxc
  - is-01kzwk40tw6g8yamztkd90h0tf
  - is-01kzwkc7r2x86tqs16dxe7gchp
  - is-01kzwkc85hwnegxgv0bsk0fa8j
  - is-01kzwkf94ttfwv36p51yvb0ypx
  - is-01kzwkh4wffsgaazgq9q8857j5
  - is-01kzwncnacxdgc25p0e4ycrhf8
created_at: 2026-08-13T00:04:20.821Z
updated_at: 2026-08-13T05:15:39.249Z
closed_at: 2026-08-13T05:15:39.248Z
close_reason: All 31 tracked web-polish children are complete. Final live validation confirms the simplified single-elbow hierarchy, exact Pretty/filter/sort behavior, and the complete documented design system.
---
Polish the live read-only bead table before the next minor release. Scope: add a standard relative updated-time column with exact timestamp hover and semantic blue age ramp; freeze table column geometry across collapsed and expanded rows; and rebalance title versus label widths so titles wrap cleanly while tags receive useful space. Update the authoritative design-system comments in packages/tbd/src/web/styles.css and verify behavior in the live browser.

## Notes

Reopened after final live review: simplify the browser Pretty prefix to one elbow at the correct indentation for every child, with no ancestor vertical bars and no tee variants.
