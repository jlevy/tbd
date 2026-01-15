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

# TBD CLI: CRUD Operations

Comprehensive tests for create, show, update, list, close, and reopen commands.

---

## Create Command

# Test: Create minimal task

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Minimal task"
✓ Created bd-[ULID]: Minimal task
? 0
```

# Test: Create with explicit type

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "A bug report" -t bug
✓ Created bd-[ULID]: A bug report
? 0
```

# Test: Create feature with priority

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "High priority feature" -t feature -p 0
✓ Created bd-[ULID]: High priority feature
? 0
```

# Test: Create with description

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Task with desc" -d "This is a detailed description"
✓ Created bd-[ULID]: Task with desc
? 0
```

# Test: Create with assignee

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Assigned task" --assignee alice
✓ Created bd-[ULID]: Assigned task
? 0
```

# Test: Create with multiple labels

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Labeled task" -l frontend -l urgent -l needs-review
✓ Created bd-[ULID]: Labeled task
? 0
```

# Test: Create epic

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Epic project" -t epic -p 1
✓ Created bd-[ULID]: Epic project
? 0
```

# Test: Create chore

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Cleanup task" -t chore
✓ Created bd-[ULID]: Cleanup task
? 0
```

# Test: Create with due date

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Due task" --due 2025-12-31T23:59:59Z
✓ Created bd-[ULID]: Due task
? 0
```

# Test: Create with defer date

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Deferred work" --defer 2025-06-01T00:00:00Z
✓ Created bd-[ULID]: Deferred work
? 0
```

# Test: Create with dry-run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Dry run only" -t bug --dry-run
[DRY-RUN] Would create issue
? 0
```

# Test: Create with JSON output

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "JSON test" -t task --json
{
  "id": "bd-[ULID]",
  "internalId": "is-[ULID]",
  "title": "JSON test"
}
? 0
```

---

## Show Command

First, create an issue to show:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Issue to show" -t bug -p 1 -d "Detailed description here" -l backend -l critical --json | head -1
{
? 0
```

# Test: Show issue by full ID

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.find(i=>i.title==='Issue to show').id)" > /tmp/issue_id.txt && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/issue_id.txt) | grep -c "title: Issue to show"
1
? 0
```

# Test: Show issue as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/issue_id.txt) --json
{
...
  "title": "Issue to show",
...
}
? 0
```

# Test: Show non-existent issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show is-00000000000000000000000000 2>&1
✗ Issue not found: is-00000000000000000000000000
? 0
```

---

## List Command

# Test: List all issues (default)

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list
...
? 0
```

# Test: List with --all to include closed

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --all
...
? 0
```

# Test: List as JSON

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --json
[
...
]
? 0
```

# Test: List filter by status

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --status open
...
? 0
```

# Test: List filter by type

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --type bug
...
? 0
```

# Test: List filter by priority

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --priority 1
...
? 0
```

# Test: List filter by assignee

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --assignee alice
...
? 0
```

# Test: List filter by label

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --label frontend
...
? 0
```

# Test: List filter by multiple labels

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --label urgent --label frontend
...
? 0
```

# Test: List with limit

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --limit 3
...
? 0
```

# Test: List sorted by created

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --sort created
...
? 0
```

# Test: List sorted by updated

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs list --sort updated
...
? 0
```

---

## Update Command

First, create an issue to update:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Update me" -t task -p 3 --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/update_id.txt && echo "Created"
Created
? 0
```

# Test: Update status

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --status in_progress
✓ Updated [..]
? 0
```

# Test: Update priority

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --priority 0
✓ Updated [..]
? 0
```

# Test: Update type

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --type bug
✓ Updated [..]
? 0
```

# Test: Update assignee

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --assignee bob
✓ Updated [..]
? 0
```

# Test: Update description

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --description "New description text"
✓ Updated [..]
? 0
```

# Test: Update notes

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --notes "Working on this task"
✓ Updated [..]
? 0
```

# Test: Update add label

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --add-label wip
✓ Updated [..]
? 0
```

# Test: Update remove label

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --remove-label wip
✓ Updated [..]
? 0
```

# Test: Update due date

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --due 2025-12-31T00:00:00Z
✓ Updated [..]
? 0
```

# Test: Update defer date

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --defer 2025-06-15T00:00:00Z
✓ Updated [..]
? 0
```

# Test: Verify updates applied

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/update_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('status:', d.status, 'type:', d.kind, 'assignee:', d.assignee)"
status: in_progress type: bug assignee: bob
? 0
```

# Test: Update with dry-run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --priority 4 --dry-run
[DRY-RUN] Would update [..]
? 0
```

# Test: Update non-existent issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update is-00000000000000000000000000 --status closed 2>&1
✗ Issue not found: is-00000000000000000000000000
? 0
```

---

## Close Command

Create an issue to close:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Close me" -t task --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/close_id.txt && echo "Created"
Created
? 0
```

# Test: Close issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/close_id.txt)
✓ Closed [..]
? 0
```

# Test: Verify closed status

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/close_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('status:', d.status)"
status: closed
? 0
```

# Test: Close with reason

Create another issue:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Close with reason" -t bug --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/close2_id.txt && echo "Created"
Created
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/close2_id.txt) --reason "Fixed in commit abc123"
✓ Closed [..]
? 0
```

# Test: Close with dry-run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Dry close" --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id)" > /tmp/dryclose_id.txt
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/dryclose_id.txt) --dry-run
[DRY-RUN] Would close [..]
? 0
```

# Test: Close already closed issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/close_id.txt) 2>&1
✗ Issue[..]already closed
? 0
```

---

## Reopen Command

# Test: Reopen closed issue

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs reopen $(cat /tmp/close_id.txt)
✓ Reopened [..]
? 0
```

# Test: Verify reopened status

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs show $(cat /tmp/close_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('status:', d.status)"
status: open
? 0
```

# Test: Reopen with reason

Close and reopen with reason:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/close_id.txt)
✓ Closed [..]
? 0
```

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs reopen $(cat /tmp/close_id.txt) --reason "Fix was incomplete"
✓ Reopened [..]
? 0
```

# Test: Reopen with dry-run

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs close $(cat /tmp/close_id.txt) && node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs reopen $(cat /tmp/close_id.txt) --dry-run
✓ Closed [..]
[DRY-RUN] Would reopen [..]
? 0
```

# Test: Reopen already open issue

First reopen it for real:

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs reopen $(cat /tmp/close_id.txt) 2>/dev/null; node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs reopen $(cat /tmp/close_id.txt) 2>&1
...
✗ Issue[..]not closed[..]
? 0
```

---

## Edge Cases

# Test: Create with empty title fails

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "" 2>&1
✗ Title is required[..]
? 0
```

# Test: Update with invalid priority

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs update $(cat /tmp/update_id.txt) --priority 10 2>&1
✗ Invalid priority[..]
? 0
```

# Test: Create with invalid type

```console
$ node $TRYSCRIPT_TEST_DIR/../dist/bin.mjs create "Bad type" -t invalid 2>&1
✗ Invalid type[..]
? 0
```
