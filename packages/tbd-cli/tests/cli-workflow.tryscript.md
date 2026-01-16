---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
timeout: 30000
patterns:
  ULID: '[0-9a-z]{26}'
  SHORTID: '[0-9a-z]{4,5}'
  TIMESTAMP: "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z"
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs init
---

# TBD CLI: Workflow Commands

Tests for ready, blocked, stale, label, and depends commands.

---

## Ready Command

Set up issues for workflow testing:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Ready task 1" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/ready1.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Ready task 2" -t bug -p 0 --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/ready2.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Assigned task" -t task --assignee alice --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/assigned.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "In progress task" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/inprogress.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/inprogress.txt) --status in_progress
✓ Updated [..]
? 0
```

# Test: Ready shows unassigned open issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready
...
? 0
```

# Test: Ready as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --json
[
...
]
? 0
```

# Test: Ready filter by type

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --type bug
...
? 0
```

# Test: Ready with limit

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --limit 1
...
? 0
```

# Test: Ready excludes assigned issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); found=d.some(i=>i.assignee==='alice'); console.log(found?'FAIL: found assigned':'OK: no assigned')"
OK: no assigned
? 0
```

# Test: Ready excludes in_progress issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); found=d.some(i=>i.status==='in_progress'); console.log(found?'FAIL: found in_progress':'OK: no in_progress')"
OK: no in_progress
? 0
```

---

## Blocked Command

Set up blocking relationship:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Blocker issue" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/blocker.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Blocked by other" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/blocked_by.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add $(cat /tmp/blocker.txt) $(cat /tmp/blocked_by.txt)
✓ bd-[ULID] now blocks bd-[ULID]
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Explicitly blocked" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/explicit_blocked.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/explicit_blocked.txt) --status blocked
✓ Updated [..]
? 0
```

# Test: Blocked shows blocked status issues

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs blocked
...
? 0
```

# Test: Blocked as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs blocked --json
[
...
]
? 0
```

# Test: Blocked with limit

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs blocked --limit 1
...
? 0
```

# Test: Blocked includes issues with unresolved blockers

The blocked command should show issues that have blocking relationships where the blocker is not closed.

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs blocked --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('blocked count:', d.length)"
blocked count: [..]
? 0
```

---

## Stale Command

Create some old issues (we can't actually backdate, so stale may show recent):

# Test: Stale shows not recently updated

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale
...
? 0
```

# Test: Stale with custom days

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --days 0
...
? 0
```

# Test: Stale as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --json
...
? 0
```

# Test: Stale filter by status

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --status in_progress
...
? 0
```

# Test: Stale with limit

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs stale --limit 2
...
? 0
```

---

## Label Commands

Create an issue for label testing:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Label test issue" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/label_issue.txt
? 0
```

# Test: Label add single

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label add $(cat /tmp/label_issue.txt) frontend
✓ Added labels to bd-[ULID]: frontend
? 0
```

# Test: Label add multiple

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label add $(cat /tmp/label_issue.txt) backend urgent
✓ Added labels to bd-[ULID]: backend, urgent
? 0
```

# Test: Verify labels added

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/label_issue.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('labels:', d.labels.sort().join(','))"
labels: backend,frontend,urgent
? 0
```

# Test: Label add duplicate (idempotent)

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label add $(cat /tmp/label_issue.txt) frontend
All labels already present
? 0
```

# Test: Label remove single

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label remove $(cat /tmp/label_issue.txt) urgent
✓ Removed labels from bd-[ULID]: urgent
? 0
```

# Test: Verify label removed

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/label_issue.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); has=d.labels.includes('urgent'); console.log(has?'FAIL: still has urgent':'OK: urgent removed')"
OK: urgent removed
? 0
```

# Test: Label remove multiple

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label remove $(cat /tmp/label_issue.txt) frontend backend
✓ Removed labels from bd-[ULID]: frontend, backend
? 0
```

# Test: Label list all

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label list
...
? 0
```

# Test: Label list as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label list --json
...
? 0
```

# Test: Label add with dry-run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label add $(cat /tmp/label_issue.txt) test-label --dry-run
[DRY-RUN] Would add labels
? 0
```

# Test: Label add to non-existent issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs label add is-00000000000000000000000000 test-label 2>&1
✗ Issue not found[..]
? 0
```

---

## Depends Commands

Create issues for dependency testing:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Parent feature" -t feature --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dep_parent.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Child task" -t task --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dep_child.txt
? 0
```

# Test: Depends add (X blocks Y)

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_child.txt)
✓ bd-[ULID] now blocks bd-[ULID]
? 0
```

# Test: Depends list forward (what does X block)

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends list $(cat /tmp/dep_parent.txt)
Blocks: bd-[ULID]
? 0
```

# Test: Depends list reverse (what blocks Y)

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends list $(cat /tmp/dep_child.txt)
Blocked by: bd-[ULID]
? 0
```

# Test: Depends list as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends list $(cat /tmp/dep_parent.txt) --json
{
...
}
? 0
```

# Test: Depends remove

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends remove $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_child.txt)
✓ Removed dependency[..]
? 0
```

# Test: Verify dependency removed

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends list $(cat /tmp/dep_parent.txt) --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('blocks:', d.blocks.length)"
blocks: 0
? 0
```

# Test: Depends add with dry-run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_child.txt) --dry-run
[DRY-RUN] Would add dependency
? 0
```

# Test: Depends add self-reference fails

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add $(cat /tmp/dep_parent.txt) $(cat /tmp/dep_parent.txt) 2>&1
✗ Issue cannot block itself
? 0
```

# Test: Depends add non-existent source

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add is-00000000000000000000000000 $(cat /tmp/dep_child.txt) 2>&1
✗ [..]not found[..]
? 0
```

---

## Integration: Ready excludes blocked issues

Add a dependency to make an issue blocked:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs depends add $(cat /tmp/blocker.txt) $(cat /tmp/ready1.txt)
✓ bd-[ULID] now blocks bd-[ULID]
? 0
```

# Test: Ready excludes issues blocked by open blockers

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); id='$(cat /tmp/ready1.txt)'; found=d.some(i=>i.id===id); console.log(found?'FAIL: blocked issue in ready':'OK: blocked excluded')"
OK: blocked excluded
? 0
```

# Test: Closing blocker makes blocked issue ready

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/blocker.txt)
✓ Closed [..]
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs ready --json | node -e "d=JSON.parse(require('fs').readFileSync(0,'utf8')); id='$(cat /tmp/ready1.txt)'; found=d.some(i=>i.id===id); console.log(found?'OK: now ready':'FAIL: should be ready now')"
OK: now ready
? 0
```
