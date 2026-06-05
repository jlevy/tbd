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
  # Isolated bare repo as "origin".
  rm -rf ../origin-faillou.git ../inject ../epic-fl.txt
  mkdir -p ../origin-faillou.git
  git init --bare --initial-branch=main ../origin-faillou.git

  # A normal tbd repo wired to origin, with tbd-sync established.
  git init --initial-branch=main
  git config user.email "a@example.com"
  git config user.name "Session A"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-faillou.git
  git push -u origin main

  tbd init --prefix=test
  tbd create "An issue" --type=task >/dev/null
  tbd sync
---
# tbd CLI: Sync fails loudly on a corrupt bead, never reports success (#155)

If a sync pulls in a bead whose YAML is invalid (e.g. one left holding git conflict
markers by an older client), `tbd sync` must **exit non-zero** and name the file — it
must not print `Synced: received ...` over a store it cannot read.

See: plan-2026-06-03-tbd-sync-structured-bead-merge.md (PR #157 review)

* * *

## A corrupt bead arrives from the remote

# Test: Inject a bead with conflict markers onto origin/tbd-sync

```console
$ git clone -q ../origin-faillou.git ../inject && ( cd ../inject && git config user.email "i@example.com" && git config user.name "Inject" && git config commit.gpgsign false && git checkout -q tbd-sync && mkdir -p .tbd/data-sync/issues && printf '%s\n' '---' 'type: is' 'id: is-01failtestbead000000000001' '<<<<<<< HEAD' 'version: 1' '=======' 'version: 2' '>>>>>>> origin/tbd-sync' '---' 'body' > .tbd/data-sync/issues/is-01failtestbead000000000001.md && git add -A && git commit -q -m "inject corrupt bead" && git push -q origin tbd-sync ) && echo injected
injected
? 0
```

* * *

## Sync must fail loudly, not report success

# Test: tbd sync exits non-zero when the merge brings in an unreadable bead

```console
$ tbd sync > out.txt 2>&1 && echo "UNEXPECTED-OK" || echo "failed-as-expected"
failed-as-expected
? 0
```

# Test: The error names the unreadable bead file

```console
$ grep -c "unreadable bead file" out.txt | tr -d ' '
1
? 0
```

# Test: It does NOT print a success summary over the corrupted store

```console
$ grep -c "Synced: received" out.txt || true
0
? 0
```
