---
type: is
id: is-01kzsrmw0y6dtbbg849384y6a4
title: Final concurrency and stream-ordering review for tbd web
kind: epic
status: closed
priority: 1
version: 68
spec_path: docs/project/specs/active/plan-2026-08-10-tbd-web-live-bead-view.md
labels:
  - web
  - concurrency
  - code-review
dependencies: []
child_order_hints:
  - is-01kzss87b8tbssp42jjbpq1hkk
  - is-01kzss87p50627wm4a2n5k1q0s
  - is-01kzss880ek33k9f44yh9bp466
  - is-01kzss88b84chbyx6yerpb4fwc
  - is-01kzss88nnpk8q95qeyphfhk0k
  - is-01kzssx1dw18m3avxs1j9dvr74
  - is-01kzst5bq03e812ynrgsbp8mjd
  - is-01kzstb2mfx00p2yn2qpmv35mk
  - is-01kzsttp6pggjrw5ntdqnkpths
  - is-01kzsttpn4rnzxb23qtg62hrpg
  - is-01kzsttq5t2vh36gbp2c123eb6
  - is-01kzsv0s63msgwh561h8ec13ma
  - is-01kzswptxnq3w9p424j2mjha6c
  - is-01kzsxfdxmqcx8me1qm0zkm7px
  - is-01kzsy6fds7be2nsqrrsbr4gge
  - is-01kzsya6ngrpgc8544br6sgz48
  - is-01kzsyksdk1dxrxyn0yegqr7r1
  - is-01kzsynkh82v55b35pw3gw3dc7
  - is-01kzt12xjzw3v4zh19v6rza4y8
  - is-01kzt26j5jfvsg9fs2t5j64gae
  - is-01kzt557vdgx7sm5c0z7pkmnyf
  - is-01kzt558cyrfc0jdz1m85nzjtj
  - is-01kzt77cb9bjsemwev2d6v9s8h
  - is-01kzt7x3p2xzab83j6wdyz490j
  - is-01kzt816bxs150d1bnaw4qceej
  - is-01kzt83s73w8jes74dwg675qke
  - is-01kzt86tq1ykb1n42vffhga4et
  - is-01kztafk7n89b2jsbcwrdz677v
  - is-01kztakhjkajzh9hj9gjv6wyf6
  - is-01kzthhg94pckc5ag8txeq1bem
  - is-01kztm8q8ykq7hsr0wyq5bfdt7
  - is-01kzvbjadd348ch672sr9zfwrr
  - is-01kzvc3mq2399g5yn0ah1qkfnh
  - is-01kzvcmhx1ekhfm2xjhxs6qdxp
  - is-01kzvcny0tgwnqjqsgs2hfbd87
  - is-01kzvcpyjh6rk9dwwny64c0syt
  - is-01kzvd0vsb24vaxb54cds65y7t
  - is-01kzvd0vt3z5k3prdwkxayxath
  - is-01kzvd1d9tgj7gt932e8wgaf2c
  - is-01kzvd918pwt3fs3a65kxbbyaq
  - is-01kzvd91kjpt6jydw21wr0cxa9
  - is-01kzvdd4maa35vapp0dwed7hzd
  - is-01kzvddwyxkfhns5k90b6szd9e
  - is-01kzvdg5qtx8e95hmd4f2e1p3s
  - is-01kzvdq9msrp5vzmkwq7921bb4
  - is-01kzvdryepvn3z17ctztw59bbz
  - is-01kzvdvegnze8rh8mzt9m4msry
  - is-01kzve129mjd23tw6x4nnf67v6
  - is-01kzve12mwmp0jjbva56gen07x
  - is-01kzve1v1k16v0yqykh5v6hfsz
  - is-01kzve4ked3qj7sph0zhadrdfr
  - is-01kzvengx0dmgsmmrb9my3gnwy
created_at: 2026-08-12T01:16:03.997Z
updated_at: 2026-08-12T17:21:53.398Z
closed_at: 2026-08-12T17:21:53.397Z
close_reason: Final concurrency, stream-ordering, UX/design-system, documentation, PR-comment, performance, package, and merge-readiness review complete. Existing mkdir writer lock plus persistent epoch, lock-free staged snapshots, bounded observer/SSE/client queues, monotonic adoption, abort fencing, and shutdown invariants match the normative design and adversarial tests; no open P0-P3 finding remains.
---
Audit the tbd web pipeline end to end for filesystem-event races, debounce/reconciliation ordering, serialized reload correctness, SSE fan-out/backpressure and reconnect replay, shutdown interleavings, client state monotonicity, duplicate delivery, deadlock/livelock, and contention. Track every confirmed finding as a child bead, implement all fixes, and retain adversarial regression evidence.

## Notes

Reopened: Two valid post-push Bugbot lock-liveness findings arrived; reopening for tracked follow-up.

Reopened: Final-head Bugbot portability finding: hard-link owner installation can fail on otherwise supported filesystems; reopening for a portable atomic owner-generation protocol.

Reopened: Final installation-surface audit found missing natural-language web-view routing and viewer ownership guidance in the shipped agent skill and onboarding docs.
