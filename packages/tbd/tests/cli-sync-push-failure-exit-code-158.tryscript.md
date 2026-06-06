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
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  tbd init --prefix=test >/dev/null
  tbd create "Local issue" --type=task >/dev/null
  tbd sync >/dev/null 2>&1 || true
---
# tbd CLI: A push failure that isn’t durably saved exits non-zero (#158)

A hard sync failure must be detectable by CI/scripts.
When a push fails and the changes were NOT durably saved to the outbox, `tbd sync` exits
non-zero (local commits remain on tbd-sync, but the remote was not updated).
It still prints the retry guidance.

See: plan-2026-06-03-unrelated-rescue-dirty-worktree.md (PR #158 review)

* * *

## A push to an unreachable remote fails hard

# Test: tbd sync exits non-zero when the push fails and nothing was saved

```console
$ git remote add origin ./nonexistent-remote.git; tbd sync > out.txt 2>&1 && echo "UNEXPECTED-OK" || echo "failed-nonzero"
failed-nonzero
? 0
```

# Test: It still reports the failure and offers recovery options

```console
$ grep -c "Push failed" out.txt | tr -d ' '
1
? 0
```

# Test: The local commit is not lost (still on tbd-sync, just unpushed)

```console
$ tbd list --json 2>/dev/null | jq -r '[.[] | select(.title == "Local issue")] | length'
1
? 0
```
