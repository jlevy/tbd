---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
---

# TBD CLI Golden Tests

These tests validate the tbd CLI using tryscript for subprocess coverage collection.

The CLI is invoked using the `TRYSCRIPT_TEST_DIR` environment variable which points
to the test file directory. Commands use `node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs`.

---

## Help and Version

# Test: --help shows usage summary

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --help
Usage: tbd [options] [command]

Git-native issue tracking for AI agents and humans
...
? 0
```

# Test: --version shows version number

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs --version
[..]
? 0
```

---

## Initialization

# Test: Initialize tbd in a repository

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init
✓ Initialized tbd repository

To complete setup, commit the config files:
  git add .tbd/ .tbd-sync/
  git commit -m "Initialize tbd"
? 0
```

# Test: Verify info shows initialized state

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info
tbd version [..]

Working directory: [..]
Config file: .tbd/config.yml
Sync branch: tbd-sync
Remote: origin
ID prefix: bd-
Total issues: 0
? 0
```

# Test: Info as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs info --json
{
  "version": [..],
  "initialized": true,
...
}
? 0
```

---

## Issue Creation

# Test: Create a basic task

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Test task" -t task -p 2
[..]Created bd-[ULID]: Test task
? 0
```

# Test: Create issue with labels

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Bug with labels" -t bug -l urgent -l frontend
[..]Created bd-[ULID]: Bug with labels
? 0
```

# Test: Create with JSON output

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "JSON output test" -t task --json
{
  "id": "bd-[ULID]",
...
}
? 0
```

---

## Issue Listing

# Test: List all issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list
...
? 0
```

# Test: List issues as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json
[
...
]
? 0
```

# Test: List with status filter

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --status open
...
? 0
```

---

## Issue Operations

# Test: Show issue details (text)

First create an issue to show:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Issue to show" -t task
[..]Created bd-[ULID]: Issue to show
? 0
```

# Test: List to find the issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json
[
...
]
? 0
```

---

## Close and Reopen

# Test: Create and close an issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Issue to close" -t bug
[..]Created bd-[ULID]: Issue to close
? 0
```

---

## Dry Run Mode

# Test: Create with dry-run shows preview

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Dry run test" -t task --dry-run
[DRY-RUN] Would create issue
? 0
```

---

## Stats Command

# Test: Show statistics

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stats
Total issues: 5

By status:
  open           5

By kind:
  bug            2
  task           3

By priority:
  2 (Medium  ) 5
? 0
```

# Test: Stats as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stats --json
{
...
}
? 0
```

---

## Label Commands

# Test: List labels

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label list
...
? 0
```

---

## Ready Command

# Test: Show ready issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready
...
? 0
```

---

## Doctor Command

# Test: Run doctor check

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs doctor
...
? 0
```

---

## Error Handling

# Test: Show non-existent issue returns error

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show is-nonexistent 2>&1
✗ Issue not found: is-nonexistent
? 0
```
