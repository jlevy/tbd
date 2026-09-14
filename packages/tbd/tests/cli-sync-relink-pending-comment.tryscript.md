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
  rm -rf ../origin-relink.git ../sessionB ../bead.txt ../ulid.txt ../relink.mjs
  mkdir -p ../origin-relink.git
  git init --bare --initial-branch=main ../origin-relink.git

  # An integration writes `extensions.<provider>`; there is no CLI for it, and this test
  # has to stand up the state a relink leaves behind. Front matter is line-oriented and
  # the block is fixed text, so plain string surgery is enough and needs no dependency.
  cat > ../relink.mjs <<'PATCHER'
  import { readFileSync, writeFileSync } from 'node:fs';

  const [file, linkId, linkKey, updatedAt, body, localId, at] = process.argv.slice(2);
  const text = readFileSync(file, 'utf8');
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!fence) throw new Error(`no front matter in ${file}`);

  // Drop any existing extensions block: its heading, then every indented line under it.
  const kept = [];
  let inExtensions = false;
  for (const line of fence[1].split('\n')) {
    if (line === 'extensions:') {
      inExtensions = true;
      continue;
    }
    if (inExtensions && /^\s/.test(line)) continue;
    inExtensions = false;
    // `-` leaves the timestamp alone: two clones editing one bead without touching
    // updated_at is the case where git's line merge would otherwise take over.
    kept.push(
      line.startsWith('updated_at:') && updatedAt !== '-' ? `updated_at: ${updatedAt}` : line,
    );
  }

  const comments = body
    ? ['    comments:', `      - local_id: ${localId}`, `        at: ${at}`, `        body: ${body}`]
    : ['    comments: []'];
  // The shape a real link carries. The fields between `key` and `comments` matter: they
  // are what lets git merge a relink and a queued comment as two independent hunks.
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

  # Session A: a normal tbd repo wired to origin.
  git init --initial-branch=main
  git config user.email "a@example.com"
  git config user.name "Session A"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  git remote add origin ../origin-relink.git
  git push -u origin main

  tbd init --prefix=test
  git add .tbd
  git commit -m "Add tbd config"
  git push origin main

  tbd create "Linked bead" --json | jq -r '.id' | tee ../bead.txt
  tbd show "$(cat ../bead.txt)" --json | jq -r '.id' > ../ulid.txt

  # A second bead for the case where neither clone touches `updated_at`.
  tbd create "Quietly linked bead" --json | jq -r '.id' | tee ../bead2.txt
  tbd show "$(cat ../bead2.txt)" --json | jq -r '.id' > ../ulid2.txt
  node ../relink.mjs \
    "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../ulid2.txt).md" \
    issue-P OS-9 2026-03-01T00:00:00.000Z

  # Session A links the bead to the tracker's issue-X and publishes it.
  node ../relink.mjs \
    "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../ulid.txt).md" \
    issue-X OS-1 2026-03-01T00:00:00.000Z
  tbd sync
---
# tbd CLI: a relink never delivers another clone’s queued comment

A comment authored offline belongs to the tracker issue it was written against.
If one clone relinks the bead to a different issue while another clone still has an
undelivered comment queued on the old one, merging the two comment logs would post that
comment under an issue nobody wrote it for.

So the two links are different lineages and never merge: the relink wins, the abandoned
link loses whole, and the losing link — comment included — goes to the attic, where the
docs say it is. That is the two-clone end-to-end for the `extensions` comment rules
(`tbd-8rnq`, #279) and for the sync path’s conflict destination (`tbd-ajq2`, `tbd-apnu`
gap 3).

* * *

## Session B queues a comment on the old link while Session A relinks

# Test: Session B (a second clone) authors a comment against issue-X and pushes

Session B also comments on the second bead **without touching its `updated_at`**, which
is what an integration writing straight to the file, or a hand edit, leaves behind.

```console
$ git clone -q ../origin-relink.git ../sessionB && ( cd ../sessionB && git config user.email "b@example.com" && git config user.name "Session B" && git config commit.gpgsign false && tbd sync >/dev/null 2>&1 && node ../relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../ulid.txt).md" issue-X OS-1 2026-03-02T00:00:00.000Z "queued against issue-X" 01pendingpendingpendingpen 2026-03-02T00:00:00.000Z && node ../relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../ulid2.txt).md" issue-P OS-9 - "queued against issue-P" 01quietquietquietquietqui 2026-03-02T00:00:00.000Z && tbd sync >/dev/null 2>&1 ) && echo done
done
? 0
```

# Test: Session A relinks the bead to issue-Y without pulling

Session A relinks the second bead too, again leaving `updated_at` alone.
That bead now has two edits on it, several unchanged lines apart — the arrangement git’s
line merge combines happily, producing a namespace no writer would ever emit.

```console
$ node ../relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../ulid.txt).md" issue-Y OS-2 2026-03-03T00:00:00.000Z && node ../relink.mjs "$(git rev-parse --path-format=absolute --git-common-dir)/tbd/data-sync-worktree/.tbd/data-sync/issues/$(cat ../ulid2.txt).md" issue-Q OS-8 -; echo done
done
? 0
```

* * *

## The merge keeps the relink and archives the abandoned one

# Test: tbd sync succeeds and says where the losing value went

```console
$ tbd sync 2>&1 | grep -c 'archived in the attic'
1
? 0
```

# Test: the bead is on the new link

```console
$ tbd show "$(cat ../bead.txt)" --json | jq -r '.extensions.linear.id'
issue-Y
? 0
```

# Test: the comment queued against issue-X was NOT carried onto issue-Y

```console
$ tbd show "$(cat ../bead.txt)" --json | jq '.extensions.linear.comments | length'
0
? 0
```

# Test: the abandoned link is in the attic, with the undelivered comment intact

```console
$ tbd attic show "$(cat ../bead.txt)" "$(tbd attic list "$(cat ../bead.txt)" --json | jq -r '[.[] | select(.field == "extensions.linear")] | .[0].timestamp')" | sed -n '/^{/p' | jq -r '.id + " " + .comments[0].body'
issue-X queued against issue-X
? 0
```

* * *

## The same rule holds when neither side touches `updated_at`

Whether the field-level merge ran at all used to depend on git finding a textual
conflict, which in turn depended on how far apart the two edits happened to land in the
file.
Bead files are marked unmergeable (`issues/.gitattributes`) so that every two-sided
change goes to the structured merge instead, and the answer stops being an accident of
line numbers.

# Test: the comment queued against issue-P was NOT carried onto issue-Q

```console
$ tbd show "$(cat ../bead2.txt)" --json | jq '.extensions.linear.comments | length'
0
? 0
```

# Test: the bead is on the new link, with that link’s own url

```console
$ tbd show "$(cat ../bead2.txt)" --json | jq -r '.extensions.linear | .id + " " + .url'
issue-Q https://linear.app/example/issue/OS-8
? 0
```

# Test: the abandoned link is in the attic, with its undelivered comment

```console
$ tbd attic show "$(cat ../bead2.txt)" "$(tbd attic list "$(cat ../bead2.txt)" --json | jq -r '[.[] | select(.field == "extensions.linear")] | .[0].timestamp')" | sed -n '/^{/p' | jq -r '.id + " " + .comments[0].body'
issue-P queued against issue-P
? 0
```
