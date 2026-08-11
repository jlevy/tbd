---
sandbox: true
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
  node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init --prefix=test --quiet
---
# `tbd web` CLI contract

The long-running lifecycle is covered by `cli-web.test.ts`; this transcript fixes the
human-facing help, dry-run, and validation contracts.

* * *

## Help

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs web --help | sed -n '1,16p'
Usage: tbd web [options]

Serve a live, read-only bead view on loopback

Options:
  --port <n>            Bind exactly this loopback port (default: search from
                        7777)
  --open                Open the page in the default browser after HTTP
                        readiness
  --interval <seconds>  Remote tip poll interval (minimum 10) (default: "30")
  -h, --help            display help for command

Global Options:
  --version             Show version number
  --dry-run             Show what would be done without making changes
  --verbose             Enable verbose output
? 0
```

## Machine-readable dry run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --dry-run --json web --port 17899 --interval 10 | jq -c '{url,port,syncBranch}'
{"url":"http://127.0.0.1:17899","port":17899,"syncBranch":"tbd-sync"}
? 0
```

## Validation

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs web --interval 9 2>&1
Error: --interval must be at least 10 seconds
? 2
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs web --port nope 2>&1
Error: --port must be an integer between 1 and 65535
? 2
```
