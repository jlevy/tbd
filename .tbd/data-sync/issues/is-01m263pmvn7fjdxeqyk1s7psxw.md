---
type: is
id: is-01m263pmvn7fjdxeqyk1s7psxw
title: Make tbd design topic extraction ignore fenced-code headings
kind: bug
status: open
priority: 2
version: 1
labels: []
dependencies: []
created_at: 2026-09-10T16:51:33.365Z
updated_at: 2026-09-10T16:51:33.365Z
---
The packaged tbd design document renders fully, but tbd design 2-file-layer stops at the first level-two heading inside a fenced Markdown example because extractSection() scans raw lines without tracking code fences. Make section discovery and extraction use Markdown-aware heading boundaries and add a regression proving the full File Layer, including section 2.10, is returned.
