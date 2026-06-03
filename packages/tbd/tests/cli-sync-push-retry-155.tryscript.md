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
  rm -rf ../origin-pushretry.git ../sessionB-pr ../epic-pr.txt
  mkdir -p ../origin-pushretry.git
  git init --bare --initial-branch=main ../origin-pushretry.git

  # Session A: a normal tbd repo wired to origin.
  git init --initial-branch=main
  git config user.email "a@example.com"
  git config user.name "Session A"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-pushretry.git
  git push -u origin main

  tbd init --prefix=test
  git add .tbd
  git commit -m "Add tbd config"
  git push origin main

  tbd create "Shared Epic" --type=epic --json | jq -r '.id' | tee ../epic-pr.txt
  tbd sync
---
# tbd CLI: Push-retry integrates the remote before retrying (#155)

`tbd sync --push` does not pull first, so when the remote has advanced it forces the
**push-retry** path: the first push is rejected (non-fast-forward), the retry callback
must do a real merge that *commits* the remote into local `tbd-sync`, and the retried
push must then fast-forward.
Before the fix the callback wrote merged files but never advanced the branch, so this
path failed after the retry limit even on a clean structured merge.

See: plan-2026-06-03-tbd-sync-structured-bead-merge.md (PR #157 review)

* * *

## Set up a divergence, then force the push-retry path

# Test: Session B appends Child B and pushes (remote advances)

```console
$ git clone -q ../origin-pushretry.git ../sessionB-pr && ( cd ../sessionB-pr && git config user.email "b@example.com" && git config user.name "Session B" && git config commit.gpgsign false && tbd sync >/dev/null 2>&1 && tbd create "Child B" --parent "$(cat ../epic-pr.txt)" >/dev/null 2>&1 && tbd sync >/dev/null 2>&1 ) && echo done
done
? 0
```

# Test: Session A appends Child A locally (committed on next push, not pulled)

```console
$ tbd create "Child A" --parent "$(cat ../epic-pr.txt)" --no-sync >/dev/null 2>&1; echo done
done
? 0
```

* * *

## The push-only sync must integrate the remote and succeed

# Test: tbd sync --push succeeds via the retry path (real merge + fast-forward)

```console
$ tbd sync --push >/dev/null 2>&1; echo "exit=$?"
exit=0
? 0
```

# Test: The epic carries BOTH children after the push-retry merge

```console
$ tbd show "$(cat ../epic-pr.txt)" --json | jq '.child_order_hints | length'
2
? 0
```

# Test: The remote tbd-sync received the integrated result (push really happened)

```console
$ git fetch -q origin tbd-sync && git ls-tree -r --name-only origin/tbd-sync | grep -c 'issues/is-' | tr -d ' '
3
? 0
```

# Test: No bead file holds git conflict markers

```console
$ ! grep -rq '<<<<<<<' "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues" && echo clean
clean
? 0
```
