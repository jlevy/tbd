---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Isolated bare repo as "origin", shared by both sessions.
  rm -rf ../origin-155.git ../sessionB ../epic.txt
  mkdir -p ../origin-155.git
  git init --bare --initial-branch=main ../origin-155.git

  # Session A: a normal tbd repo wired to origin.
  git init --initial-branch=main
  git config user.email "a@example.com"
  git config user.name "Session A"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-155.git
  git push -u origin main

  tbd init --prefix=test
  # Publish the tbd config on main so a fresh clone is already initialized.
  git add .tbd
  git commit -m "Add tbd config"
  git push origin main

  # Create the shared epic and publish it on tbd-sync (the common ancestor).
  tbd create "Shared Epic" --type=epic --json | jq -r '.id' | tee ../epic.txt
  tbd sync
---
# tbd CLI: Concurrent edits to one epic merge cleanly (#155)

Two sessions each append a different child to the **same** epic before syncing.
The losing side must not be dropped and the bead must never end up holding git conflict
markers: `child_order_hints` is an append-only set, so the result is the **union** of
both children and `tbd sync` succeeds.

See: plan-2026-06-03-tbd-sync-structured-bead-merge.md

* * *

## Session B publishes a child, then Session A diverges with another

# Test: Session B (a second clone) appends Child B and pushes

```console
$ git clone -q ../origin-155.git ../sessionB && ( cd ../sessionB && git config user.email "b@example.com" && git config user.name "Session B" && git config commit.gpgsign false && tbd sync >/dev/null 2>&1 && tbd create "Child B" --parent "$(cat ../epic.txt)" >/dev/null 2>&1 && tbd sync >/dev/null 2>&1 ) && echo done
done
? 0
```

# Test: Session A appends Child A locally without pulling B’s change

```console
$ tbd create "Child A" --parent "$(cat ../epic.txt)" --no-sync >/dev/null 2>&1; echo done
done
? 0
```

* * *

## The conflicting sync resolves into a clean union

# Test: tbd sync succeeds (structured merge, no manual repair)

```console
$ tbd sync >/dev/null 2>&1; echo "exit=$?"
exit=0
? 0
```

# Test: The epic now carries BOTH children (union, nothing dropped)

```console
$ tbd show "$(cat ../epic.txt)" --json | jq '.child_order_hints | length'
2
? 0
```

# Test: No bead file holds git conflict markers

```console
$ ! grep -rq '<<<<<<<' "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues" && echo clean
clean
? 0
```
