---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 60000
before: |
  rm -rf ../origin-upgraded.git ../upgraded-sessionB ../upgraded-bead.txt ../upgraded-ulid.txt ../upgraded-relink.mjs ../upgraded-locked.txt
  mkdir -p ../origin-upgraded.git
  git init --bare --initial-branch=main ../origin-upgraded.git

  # The same fixed-text patcher as cli-sync-relink-pending-comment: it writes the link
  # namespace an integration leaves behind, since there is no CLI for it.
  cat > ../upgraded-relink.mjs <<'PATCHER'
  import { readFileSync, writeFileSync } from 'node:fs';

  const [file, linkId, linkKey, updatedAt, body, localId, at] = process.argv.slice(2);
  const text = readFileSync(file, 'utf8');
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!fence) throw new Error(`no front matter in ${file}`);

  const kept = [];
  let inExtensions = false;
  for (const line of fence[1].split('\n')) {
    if (line === 'extensions:') {
      inExtensions = true;
      continue;
    }
    if (inExtensions && /^\s/.test(line)) continue;
    inExtensions = false;
    kept.push(
      line.startsWith('updated_at:') && updatedAt !== '-' ? `updated_at: ${updatedAt}` : line,
    );
  }

  const comments = body
    ? ['    comments:', `      - local_id: ${localId}`, `        at: ${at}`, `        body: ${body}`]
    : ['    comments: []'];
  const block = [
    'extensions:',
    '  linear:',
    `    id: ${linkId}`,
    `    key: ${linkKey}`,
    `    url: https://linear.app/example/issue/${linkKey}`,
    '    state: linked',
    '    synced_at: 2026-03-01T00:00:00.000Z',
    ...comments,
  ];

  writeFileSync(file, `---\n${[...kept, ...block].join('\n')}\n---\n${text.slice(fence[0].length)}`);
  PATCHER

  git init --initial-branch=main
  git config user.email "a@example.com"
  git config user.name "Session A"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-upgraded.git
  git push -u origin main

  tbd init --prefix=test
  git add .tbd
  git commit -m "Add tbd config"
  git push origin main

  tbd create "Quietly linked bead" --json | jq -r '.id' | tee ../upgraded-bead.txt
  tbd show "$(cat ../upgraded-bead.txt)" --json | jq -r '.id' > ../upgraded-ulid.txt
  node ../upgraded-relink.mjs \
    "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../upgraded-ulid.txt).md" \
    issue-P OS-9 2026-03-01T00:00:00.000Z
  tbd sync

  # Make this an upgraded repository: tbd 0.8.1 and earlier never wrote
  # `issues/.gitattributes`, so a sync branch they created does not have it. Remove it
  # and publish with plain git, because any tbd sync from this build would put it back.
  WT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"
  git -C "$WT" rm -q .tbd/data-sync/issues/.gitattributes
  git -C "$WT" commit -q -m "Sync branch as tbd 0.8.1 left it"
  git push -q origin tbd-sync
---
# tbd CLI: an upgraded repository gets the bead merge attribute before it merges

`issues/.gitattributes` (`*.md merge=binary`) is what sends every two-sided bead change
to the structured merge.
A sync branch created before that file existed does not have it, and nothing that runs
on an already-initialized repository used to add it, so an upgraded repository kept
line-merging beads. The fix writes it before every merge, once.

* * *

## The repository starts without the attribute

# Test: the published sync branch has no issues/.gitattributes

```console
$ git show origin/tbd-sync:.tbd/data-sync/issues/.gitattributes 2>/dev/null || echo absent
absent
? 0
```

* * *

## Two clones edit one bead without touching `updated_at`

# Test: Session B clones, leaving the sync branch as 0.8.1 would

A fresh worktree writes any missing scaffold file, the attribute included.
Session B undoes that and publishes, so the sync branch is back to lacking the file, as
0.8.1 left it.

```console
$ git clone -q ../origin-upgraded.git ../upgraded-sessionB && ( cd ../upgraded-sessionB && git config user.email "b@example.com" && git config user.name "Session B" && git config commit.gpgsign false && tbd sync >/dev/null 2>&1 && WT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree" && git -C "$WT" rm -q .tbd/data-sync/issues/.gitattributes && git -C "$WT" commit -q -m "Sync branch as tbd 0.8.1 left it" && git push -q origin tbd-sync ) && git fetch -q origin && (git show origin/tbd-sync:.tbd/data-sync/issues/.gitattributes 2>/dev/null || echo absent)
absent
? 0
```

# Test: Session B queues a comment, and its sync publishes the attribute

Session B is not behind, so its sync does not merge.
The file reaches the remote from the full sync’s own check, which is what carries it to
clones that never merge and to older clients.

```console
$ ( cd ../upgraded-sessionB && node ../upgraded-relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../upgraded-ulid.txt).md" issue-P OS-9 - "queued against issue-P" 01quietquietquietquietqui 2026-03-02T00:00:00.000Z && tbd sync >/dev/null 2>&1 ) && git fetch -q origin && git show origin/tbd-sync:.tbd/data-sync/issues/.gitattributes
*.md merge=binary
? 0
```

# Test: Session A relinks the bead without pulling

Session A’s worktree lost the attribute in setup, while the branch it is about to merge
now carries it. Git takes attributes from the merging worktree, not from the incoming
branch, so without its own check Session A would still line-merge: its edit and Session
B’s are several unchanged lines apart, which git combines into a namespace no writer
would emit.

```console
$ node ../upgraded-relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../upgraded-ulid.txt).md" issue-Q OS-8 -; git -C "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree" ls-files -- .tbd/data-sync/issues/.gitattributes | wc -l | tr -d ' '
0
? 0
```

* * *

## Session A’s sync adds the attribute, then merges the bead structurally

# Test: tbd sync resolves the bead and archives the abandoned link

```console
$ tbd sync 2>&1 | grep -c 'archived in the attic'
1
? 0
```

# Test: the comment queued against issue-P was NOT carried onto issue-Q

```console
$ tbd show "$(cat ../upgraded-bead.txt)" --json | jq -r '.extensions.linear | .id + " " + .url + " " + (.comments | length | tostring)'
issue-Q https://linear.app/example/issue/OS-8 0
? 0
```

# Test: the abandoned link is in the attic, with its undelivered comment

```console
$ tbd attic show "$(cat ../upgraded-bead.txt)" "$(tbd attic list "$(cat ../upgraded-bead.txt)" --json | jq -r '[.[] | select(.field == "extensions.linear")] | .[0].timestamp')" | sed -n '/^{/p' | jq -r '.id + " " + .comments[0].body'
issue-P queued against issue-P
? 0
```

# Test: Session A’s merge and push leave the published attribute as it was

```console
$ git show origin/tbd-sync:.tbd/data-sync/issues/.gitattributes
*.md merge=binary
? 0
```

# Test: a later sync from each clone adds no further commit for it

```console
$ WT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"; before=$(git log --oneline tbd-sync -- .tbd/data-sync/issues/.gitattributes | wc -l); tbd sync >/dev/null 2>&1 && ( cd ../upgraded-sessionB && tbd sync >/dev/null 2>&1 ) && tbd sync >/dev/null 2>&1; after=$(git log --oneline tbd-sync -- .tbd/data-sync/issues/.gitattributes | wc -l); test "$before" -eq "$after" && git -C "$WT" status --porcelain | wc -l | tr -d ' '
0
? 0
```

* * *

## A rejected `tbd sync --push` merges under the attribute too

`--push` does not run the full sync.
When the remote has moved, it merges from the push retry, so the attribute has to be
checked there as well.

# Test: both clones lose the attribute again, and Session B publishes a quiet comment

Session B commits and pushes with plain git, as a client that never adds the file would.

```console
$ WT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"; git -C "$WT" rm -q .tbd/data-sync/issues/.gitattributes && git -C "$WT" commit -q -m "Sync branch as tbd 0.8.1 left it" && git push -q origin tbd-sync && ( cd ../upgraded-sessionB && BWT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree" && git fetch -q origin && git -C "$BWT" merge -q --ff-only origin/tbd-sync && node ../upgraded-relink.mjs "$BWT/.tbd/data-sync/issues/$(cat ../upgraded-ulid.txt).md" issue-Q OS-8 - "queued against issue-Q" 01quietquietquietquietqu2 2026-03-04T00:00:00.000Z && git -C "$BWT" commit -q -am "Quiet comment" && git push -q origin tbd-sync && git -C "$BWT" ls-files -- .tbd/data-sync/issues/.gitattributes | wc -l | tr -d ' ' )
0
? 0
```

# Test: Session A relinks again and pushes without pulling

```console
$ node ../upgraded-relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../upgraded-ulid.txt).md" issue-R OS-7 - && tbd sync --push 2>&1 | grep -c 'preserved in attic'
1
? 0
```

# Test: the comment queued against issue-Q was NOT carried onto issue-R

```console
$ tbd show "$(cat ../upgraded-bead.txt)" --json | jq -r '.extensions.linear | .id + " " + .url + " " + (.comments | length | tostring)'
issue-R https://linear.app/example/issue/OS-7 0
? 0
```

# Test: both abandoned links are in the attic

```console
$ tbd attic list "$(cat ../upgraded-bead.txt)" --json | jq '[.[] | select(.field == "extensions.linear")] | length'
2
? 0
```

* * *

## A failure to add the attribute stops the sync

The full sync runs the check inside its fetch-and-merge error handling, which reads an
unexpected error as a first-sync fetch failure and carries on.
A failed write there must not skip the merge and still report the sync as done.

# Test: Session A loses the attribute again, and Session B publishes a new bead

Session A publishes its removal with plain git, so it has nothing of its own to push.

```console
$ WT="$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree"; git -C "$WT" rm -q .tbd/data-sync/issues/.gitattributes && git -C "$WT" commit -q -m "Sync branch as tbd 0.8.1 left it" && git push -q origin tbd-sync && ( cd ../upgraded-sessionB && tbd create "Made by Session B" >/dev/null && tbd sync >/dev/null 2>&1 ) && echo done
done
? 0
```

# Test: with Session A’s worktree index locked, tbd sync fails instead of skipping the merge

```console
$ LOCK="$(git -C "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree" rev-parse --path-format=absolute --git-dir)/index.lock"; touch "$LOCK"; tbd sync > ../upgraded-locked.txt 2>&1; code=$?; rm -f "$LOCK"; echo "exit $code"; grep -c 'Could not add the tbd-sync merge attributes' ../upgraded-locked.txt
exit 1
1
? 0
```

# Test: once the lock is gone, the next sync merges Session B’s bead

```console
$ tbd sync >/dev/null 2>&1 && tbd list --json | jq -r '.[] | select(.title == "Made by Session B") | .title'
Made by Session B
? 0
```
