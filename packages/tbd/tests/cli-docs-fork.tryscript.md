---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
patterns:
  VERSION: 'v[0-9]+\.[0-9]+\.[0-9]+(-[a-z0-9.-]+)?'
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd setup --auto --prefix=fk --quiet
---
# tbd docs: Fork Lifecycle Golden Test

End-to-end fork lifecycle for the `tbd docs` command group: status, fork, status again,
unfork. Serving precedence, customized-refusal, and out-of-band deletion are covered by
the `doc-fork` unit tests; these blocks pin the CLI surface.

* * *

## Status with nothing forked

# Test: status reports no forks

```console
$ tbd docs status
No docs forked into the repo.
Make some visible: tbd docs fork --category=general (and your languages)
? 0
```

* * *

## Fork a guideline

# Test: fork python-rules writes the file and records the manifest

```console
$ tbd docs fork python-rules
✓ Forked python-rules → docs/tbd/guidelines/python-rules.md

Edit in place — tbd now serves your copy wherever it served upstream.
? 0
```

# Test: the forked file is present in the repo

```console
$ test -f docs/tbd/guidelines/python-rules.md && echo present
present
? 0
```

# Test: the base snapshot is recorded under .tbd/doc-forks/

```console
$ test -f .tbd/doc-forks/base/guideline/python-rules.md && echo present
present
? 0
```

* * *

## Status shows the fork

# Test: status lists the forked doc

```console
$ tbd docs status
NAME          KIND       STATE   SOURCE
python-rules  guideline  forked  internal:guidelines/python-rules.md

1 forked: 0 customized
? 0
```

* * *

## Forking everything available

# Test: --dry-run previews without writing

```console
$ tbd docs fork --all --dry-run
[DRY-RUN] Would fork [..] doc(s) into docs/tbd/
...
No files written. Re-run without --dry-run to apply.
? 0
```

* * *

## Unfork restores upstream

# Test: unfork an unmodified fork

```console
$ tbd docs unfork python-rules
✓ Unforked python-rules — served from upstream again.
? 0
```

# Test: status reports no forks again

```console
$ tbd docs status
No docs forked into the repo.
...
? 0
```

* * *

## Out-of-band deletion falls back to upstream

# Test: deleting a forked file still serves the guideline from upstream

```console
$ tbd docs fork python-rules
✓ Forked python-rules → docs/tbd/guidelines/python-rules.md
...
? 0
```

# Test: remove the forked file directly

```console
$ rm docs/tbd/guidelines/python-rules.md
? 0
```

# Test: the guideline still resolves (served from the cache)

```console
$ tbd guidelines python-rules
...
? 0
```

# Test: status reports the dangling fork as missing

```console
$ tbd docs status
NAME          KIND       STATE    SOURCE
python-rules  guideline  missing  internal:guidelines/python-rules.md

1 forked: 0 customized
? 0
```
