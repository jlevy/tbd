---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd setup --auto --prefix=up --quiet
  tbd docs fork python-rules
---
# tbd docs update: Upgrade/Merge Golden Test

Simulates a tbd upgrade by editing the gitignored cache copy (the upstream), then
exercises `tbd docs update` across the refresh, clean-merge, and conflict paths.
The decision table itself is covered exhaustively by the `fork-update` unit tests.

* * *

## Unmodified fork + upstream change → refresh

# Test: simulate an upstream change to the cache copy

```console
$ printf '\n<!-- UPSTREAM CHANGE -->\n' >> .tbd/docs/guidelines/python-rules.md
? 0
```

# Test: update refreshes the unmodified fork

```console
$ tbd docs update
Updated 1 forked doc(s):
  ✓ python-rules: refreshed to upstream (was unmodified)
? 0
```

* * *

## Customized fork + overlapping upstream change → conflict

# Test: customize the fork’s first line

```console
$ perl -pi -e '$_ = "<!-- FORK FIRST LINE -->\n" if $. == 1' docs/tbd/guidelines/python-rules.md
? 0
```

# Test: change the same line upstream

```console
$ perl -pi -e '$_ = "<!-- UPSTREAM FIRST LINE -->\n" if $. == 1' .tbd/docs/guidelines/python-rules.md
? 0
```

# Test: update skips conflicts by default and names both strategies

```console
$ tbd docs update
...
1 doc(s) need a decision:
  ⚠ python-rules: your changes conflict with upstream
  re-run with one of:
    tbd docs update <name> --merge      # combine, then resolve conflict markers
    tbd docs update <name> --keep-ours  # keep your version, advance the fork point
? 0
```

# Test: --merge writes conflict markers and flags the doc conflicted

```console
$ tbd docs update --merge
Updated 1 forked doc(s):
  ✓ python-rules: wrote merged content with conflict markers; resolve them, then it returns to 'customized'
? 0
```

# Test: status reports the doc as conflicted

```console
$ tbd docs status
NAME          KIND       STATE       SOURCE
python-rules  guideline  conflicted  internal:guidelines/python-rules.md

1 forked: 1 customized, 1 conflict pending
? 0
```

* * *

## --merge and --keep-ours are mutually exclusive

# Test: passing both is an error

```console
$ tbd docs update --merge --keep-ours 2>&1
[..]mutually exclusive[..]
? 1
```
