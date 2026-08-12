---
sandbox: true
fixtures:
  - run-built-cli.mjs
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
timeout: 30000
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Web test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---
# `tbd web` CLI contract

The long-running lifecycle is covered by `cli-web.test.ts`; this transcript fixes the
human-facing help, dry-run, and validation contracts.

* * *

## Sandboxed repository setup

```console
$ node run-built-cli.mjs init --prefix=test --quiet
? 0
```

## Help

```console
$ node run-built-cli.mjs web --help | sed -n "1,13p"
Usage: tbd web [options]

Serve a live, read-only bead view on loopback

Options:
  --port <n>      Bind exactly this loopback port (default: search from 7777)
  --open          Open the page in the default browser after HTTP readiness
  -h, --help      display help for command

Global Options:
  --version       Show version number
  --dry-run       Show what would be done without making changes
  --verbose       Enable verbose output
? 0
```

## Machine-readable dry run

```console
$ node run-built-cli.mjs --dry-run --json web --port 17899 | jq -c "{url,port,syncBranch}"
{"url":"http://127.0.0.1:17899","port":17899,"syncBranch":"tbd-sync"}
? 0
```

## Human-readable Ownership Boundary

```console
$ node run-built-cli.mjs --dry-run web --port 17898 | grep -E "TBD WEB|Access:"
TBD WEB (DRY RUN)
[..] Access:      loopback, live read-only viewer
? 0
```

## Validation

```console
$ node run-built-cli.mjs web --interval 10 2>&1
error: unknown option '--interval'
? 1
```

```console
$ node run-built-cli.mjs web --port nope 2>&1
Error: --port must be an integer between 1 and 65535
? 2
```
