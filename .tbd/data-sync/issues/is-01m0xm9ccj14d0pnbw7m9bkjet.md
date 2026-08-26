---
type: is
id: is-01m0xm9ccj14d0pnbw7m9bkjet
title: Add a concise correct Rust atomic-write example
kind: task
status: closed
priority: 2
version: 2
labels: []
dependencies: []
parent_id: is-01m0xm6ckrwa936ffezb6qsxmk
created_at: 2026-08-25T23:32:32.785Z
updated_at: 2026-08-26T00:33:08.881Z
closed_at: 2026-08-26T00:33:08.880Z
close_reason: Replaced the incomplete Rust staging sample with a complete same-directory NamedTempFile write, flush, and persist example that states its visibility, durability, and metadata contract.
resolution: null
duplicate_of: null
---
Give a concise example of atomic writes done properly in Rust.

The example must be specific enough to copy and evaluate: name the API, show the temporary-file and replacement boundary, preserve and report failures correctly, and state when the example applies. Avoid generic advice or an unconditional rule that conflicts with append, create-new, scratch-file, or durability contracts.
