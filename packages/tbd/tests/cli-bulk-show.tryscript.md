---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  SHORTID: '[0-9a-z]{4,5}'
  ULID: '[0-9a-z]{26}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
---
# tbd CLI: Bulk Show

Tests for variadic `tbd show` (agent CLI ergonomics round 2, tbd-r2zr). Single-ID
behavior is covered by cli-crud and stays byte-identical; this file covers the
multi-target (bulk) read path: delimiters, ordering, dedupe, the fail-closed /
`--ignore-missing` contract, JSON shapes, and per-issue `--max-lines`.

* * *

## Seeding

# Test: Seed an epic and two children plus one standalone issue

```console
$ tbd create "Show epic" --type=epic --json | jq -r '.id' | tee epic.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Show A" --parent $(cat epic.txt) --json | jq -r '.id' | tee a.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Show B" --parent $(cat epic.txt) --json | jq -r '.id' | tee b.txt
test-[SHORTID]
? 0
```

```console
$ tbd create "Show C standalone" --json | jq -r '.id' | tee c.txt
test-[SHORTID]
? 0
```

* * *

## Bulk text rendering

# Test: Single-ID show still auto-displays the parent (unchanged legacy behavior)

```console
$ tbd show $(cat a.txt) | grep -c "The parent of this bead is:"
1
? 0
```

# Test: Single-ID output is pinned byte-for-byte (stable fields via patterns)

```console
$ tbd show $(cat c.txt)
---
type: is
id: is-[ULID]
title: Show C standalone
kind: task
status: open
priority: P2
version: 1
labels: []
dependencies: []
created_at: [TIMESTAMP]
updated_at: [TIMESTAMP]
---
? 0
```

# Test: Single-ID show has no bulk delimiter

```console
$ tbd show $(cat a.txt) | grep -c "^──" || true
0
? 0
```

# Test: Bulk show renders one delimiter header per issue

```console
$ tbd show $(cat a.txt) $(cat b.txt) | grep -c "^── test-"
2
? 0
```

# Test: Bulk show suppresses parent context (siblings would repeat the same epic)

```console
$ tbd show $(cat a.txt) $(cat b.txt) | grep -c "The parent of this bead is:" || true
0
? 0
```

# Test: Issues render in argument order

```console
$ tbd show $(cat b.txt) $(cat a.txt) | grep "^title:"
title: Show B
title: Show A
? 0
```

# Test: Duplicate IDs are deduplicated (first occurrence wins)

```console
$ tbd show $(cat a.txt) $(cat a.txt) $(cat b.txt) | grep -c "^── test-"
2
? 0
```

* * *

## Fail-closed and --ignore-missing

# Test: One unknown ID aborts the whole read (nothing rendered)

```console
$ tbd show $(cat a.txt) test-zzzzzzz 2>&1
Error: Issue not found: test-zzzzzzz
? 1
```

# Test: Every unknown ID is listed in the abort

```console
$ tbd show test-yyyyyyy test-zzzzzzz 2>&1
Error: Issue not found: test-yyyyyyy, test-zzzzzzz
? 1
```

# Test: --ignore-missing renders the found subset and exits 0

```console
$ tbd show $(cat a.txt) test-zzzzzzz --ignore-missing 2>/dev/null | grep -c "^── test-"
1
? 0
```

# Test: --ignore-missing reports the skipped IDs on stderr

```console
$ tbd show $(cat a.txt) test-zzzzzzz --ignore-missing 2>&1 >/dev/null
⚠ Not found: test-zzzzzzz
? 0
```

# Test: A lone unknown ID with --ignore-missing renders nothing but still reports

```console
$ tbd show test-zzzzzzz --ignore-missing 2>&1
⚠ Not found: test-zzzzzzz
? 0
```

# Test: A lone skipped ID emits JSON null (stdout stays parseable)

```console
$ tbd show test-zzzzzzz --ignore-missing --json 2>/dev/null
null
? 0
```

# Test: The JSON-mode skip is still reported on stderr

```console
$ tbd show test-zzzzzzz --ignore-missing --json 2>&1 >/dev/null
{"warning":"Not found: test-zzzzzzz"}
? 0
```

# Test: Bulk --json with every ID skipped still emits an array

```console
$ tbd show test-yyyyyyy test-zzzzzzz --ignore-missing --json 2>/dev/null
[]
? 0
```

* * *

## JSON shapes

# Test: Single-ID --json keeps the legacy object shape (with parent context)

```console
$ tbd show $(cat a.txt) --json | jq -r '[type, (has("parent") | tostring)] | join("|")'
object|true
? 0
```

# Test: Bulk --json emits an array of issues in argument order

```console
$ tbd show $(cat b.txt) $(cat a.txt) --json | jq -r '[type, (length | tostring), .[0].title, .[1].title] | join("|")'
array|2|Show B|Show A
? 0
```

# Test: Bulk --json entries carry displayId and omit parent

```console
$ tbd show $(cat a.txt) $(cat b.txt) --json | jq -r '[(.[0].displayId != null | tostring), (.[0] | has("parent") | tostring)] | join("|")'
true|false
? 0
```

* * *

## Per-issue --max-lines

# Test: --max-lines truncates each issue separately (one omission notice per issue)

```console
$ tbd show $(cat a.txt) $(cat b.txt) --max-lines 3 | grep -c "lines omitted"
2
? 0
```

# Test: --max-lines keeps every delimiter visible

```console
$ tbd show $(cat a.txt) $(cat b.txt) --max-lines 3 | grep -c "^── test-"
2
? 0
```

* * *

## Stale mapping

# Test: A mapped ID whose file is gone points at doctor, not a self-suggestion

```console
$ rm "$(grep -rl "title: Show C standalone" .git/tbd/data-sync-worktree/.tbd/data-sync/issues/)"
? 0
```

```console
$ tbd show $(cat c.txt) $(cat a.txt) 2>&1
Error: Issue not found: test-[SHORTID]
The ID resolves but its issue file is missing; run `tbd doctor` to check repository health.
? 1
```
