---
type: is
id: is-01kzysmb4s1ntzjgq5e7yhfpmr
title: Validate merged Linear integration and install tbd globally
kind: task
status: closed
priority: 1
version: 6
labels: []
dependencies: []
child_order_hints:
  - is-01kzyswrkqt9hp8s9tdke7860f
  - is-01kzywynn9xx4987b971j4kxah
created_at: 2026-08-14T00:09:27.441Z
updated_at: 2026-08-14T02:05:08.575Z
closed_at: 2026-08-14T02:05:08.575Z
close_reason: "Resolved in PR #215: Node.js 22.12.0 baseline, consistent bundled documentation, patched js-yaml production graph, clean release audits, global installation, no-Linear smoke, and hosted Linux/macOS/Windows CI all verified."
---
Create a stabilization branch from merged main, review that Linear remains fully opt-in and no-Linear users retain existing behavior, run release and packaged-install validation, replace the global tbd installation from the validated local package, and report release readiness without publishing a public release unless explicitly requested.
