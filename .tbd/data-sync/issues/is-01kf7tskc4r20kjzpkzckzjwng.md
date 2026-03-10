---
type: is
id: is-01kf7tskc4r20kjzpkzckzjwng
title: Bootstrap loads unbundled cli.mjs instead of bundled bin.mjs
kind: bug
status: closed
priority: 1
version: 8
labels: []
dependencies: []
created_at: 2026-01-18T05:56:07.171Z
updated_at: 2026-03-09T16:12:31.742Z
closed_at: 2026-01-18T06:12:34.775Z
close_reason: "Fixed: bootstrap now imports bundled bin.mjs instead of unbundled cli.mjs. Saves ~30ms on startup."
---
## Problem

The bin-bootstrap.cjs imports cli.mjs (227KB, unbundled) instead of bin.mjs (2.7MB, fully bundled with all dependencies). This defeats the bundling optimization and adds ~28ms of module resolution overhead.

## Evidence

- `node dist/bin.mjs --version` = 86ms
- `tbd --version` (via bootstrap) = 114ms
- Difference: ~28ms wasted on node_modules resolution

## Root Cause

In src/cli/bin-bootstrap.cjs line 30-31:
```javascript
const cliPath = path.join(__dirname, 'cli.mjs');
import(pathToFileURL(cliPath).href)
```

Should import bin.mjs instead.

## Fix

Change bootstrap to dynamically import bin.mjs. Since bin.mjs runs runCli() as a side effect, just importing it will execute the CLI.
