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
  rm -rf ../origin-attic.git ../sessionB ../bead.txt
  mkdir -p ../origin-attic.git
  git init --bare --initial-branch=main ../origin-attic.git

  # Session A: a normal tbd repo wired to origin.
  git init --initial-branch=main
  git config user.email "a@example.com"
  git config user.name "Session A"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-attic.git
  git push -u origin main

  tbd init --prefix=test
  # Publish the tbd config on main so a fresh clone is already initialized.
  git add .tbd
  git commit -m "Add tbd config"
  git push origin main

  # The shared bead, published on tbd-sync as the common ancestor.
  tbd create "Original title" --json | jq -r '.id' | tee ../bead.txt
  tbd sync
---
# tbd CLI: a sync that discards a field records it in the attic

`tbd sync` resolves a concurrent edit to the same field by last-writer-wins, which means
one side’s value is dropped.
The attic is where a dropped value goes: append-only, never read back into live bead
state, there so a bad merge can be undone.

Two sessions retitle the same bead.
The merge keeps one title and discards the other, and the discarded one has to be
recoverable afterwards — by `tbd attic list`, `tbd attic show`, and `tbd attic restore`
— rather than only from git history.

See: `tbd-ajq2`, and plan-2026-09-06-bead-coordination-and-native-comments.md

* * *

## Two sessions retitle the same bead

# Test: Session B (a second clone) retitles the bead and pushes

```console
$ git clone -q ../origin-attic.git ../sessionB && ( cd ../sessionB && git config user.email "b@example.com" && git config user.name "Session B" && git config commit.gpgsign false && tbd sync >/dev/null 2>&1 && tbd update "$(cat ../bead.txt)" --title "Title from B" >/dev/null 2>&1 && tbd sync >/dev/null 2>&1 ) && echo done
done
? 0
```

# Test: Session A retitles it differently without pulling B’s change

```console
$ tbd update "$(cat ../bead.txt)" --title "Title from A" >/dev/null 2>&1; echo done
done
? 0
```

* * *

## The merge keeps one title and archives the other

# Test: tbd sync succeeds and reports the conflict

```console
$ tbd sync 2>&1 | grep -c 'conflict'
1
? 0
```

# Test: Session A’s title won (it is the later write)

```console
$ tbd show "$(cat ../bead.txt)" --json | jq -r '.title'
Title from A
? 0
```

# Test: the discarded title is in the attic, not only in git history

```console
$ tbd attic list --json | jq -r '[.[] | select(.field == "title")] | length'
1
? 0
```

# Test: the attic entry names the bead and carries the lost value

```console
$ tbd attic show "$(tbd attic list --json | jq -r '.[0].id')" "$(tbd attic list --json | jq -r '.[0].timestamp')" | grep -c 'Title from B'
1
? 0
```

# Test: restoring the entry puts the discarded title back on the bead

```console
$ tbd attic restore "$(tbd attic list --json | jq -r '[.[] | select(.field == "title")] | .[0].id')" "$(tbd attic list --json | jq -r '[.[] | select(.field == "title")] | .[0].timestamp')" >/dev/null 2>&1; tbd show "$(cat ../bead.txt)" --json | jq -r '.title'
Title from B
? 0
```

# Test: no bead file holds git conflict markers

```console
$ ! grep -rq '<<<<<<<' "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues" && echo clean
clean
? 0
```

* * *

## An attic write failure is visible to scripts

The merge and push are already safe when the recovery copy is written.
If that final write fails, the sync still publishes the resolved issue, but it must
return nonzero so automation does not mistake incomplete recovery data for complete
success.

# Test: establish the restored title as the common base

```console
$ tbd sync >/dev/null 2>&1 && ( cd ../sessionB && tbd sync >/dev/null 2>&1 ) && echo ready
ready
? 0
```

# Test: Session B changes the description and publishes it

```console
$ ( cd ../sessionB && tbd update "$(cat ../bead.txt)" --description "Description from B" >/dev/null 2>&1 && tbd sync >/dev/null 2>&1 ) && echo done
done
? 0
```

# Test: Session A changes the same field without pulling B’s change

```console
$ tbd update "$(cat ../bead.txt)" --description "Description from A" >/dev/null 2>&1 && echo done
done
? 0
```

# Test: a blocked attic path makes sync return nonzero after completing the merge

```console
$ attic="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/attic"; mv "$attic" "$attic.saved"; echo blocked > "$attic"; tbd sync > ../archive-failure.txt 2>&1; echo "exit=$?"
exit=1
? 0
```

# Test: the default-visible output reports both the failed write and incomplete archive

```console
$ grep -c 'Could not archive the description value' ../archive-failure.txt; grep -c '1 conflict resolved, 1 NOT archived' ../archive-failure.txt
1
1
? 0
```

# Test: restore the fixture path and prove the resolved issue was pushed despite the error

```console
$ attic="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/attic"; rm "$attic"; mv "$attic.saved" "$attic"; ( cd ../sessionB && tbd sync >/dev/null 2>&1 && tbd show "$(cat ../bead.txt)" --json | jq -r '.description' )
Description from A
? 0
```
