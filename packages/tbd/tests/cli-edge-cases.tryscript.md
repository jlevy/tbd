---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
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
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd
  tbd init --prefix=test
---
# tbd CLI: Edge Cases and Error Handling

Tests for unusual inputs, error conditions, and edge cases.

* * *

## Unicode and Special Characters

# Test: Create issue with Unicode title

```console
$ tbd create "Fix bug with émojis 🐛 and ñ"
✓ Created test-[SHORTID]: Fix bug with émojis 🐛 and ñ
? 0
```

# Test: Create issue with CJK characters

```console
$ tbd create "修复中文 bug" --type=bug
✓ Created test-[SHORTID]: 修复中文 bug
? 0
```

# Test: Create issue with Japanese characters

```console
$ tbd create "日本語テスト" --type=task
✓ Created test-[SHORTID]: 日本語テスト
? 0
```

# Test: Create issue with Arabic characters

```console
$ tbd create "اختبار عربي" --type=task
✓ Created test-[SHORTID]: اختبار عربي
? 0
```

# Test: Unicode titles appear in list

```console
$ tbd list | grep -c "émojis"
1
? 0
```

# Test: Unicode search works

```console
$ tbd search "中文" --json
[
...
]
? 0
```

# Test: Create label with Unicode

```console
$ tbd list --json | jq -r '.[0].id' | tee unicode_id.txt
test-[SHORTID]
? 0
```

```console
$ ID=$(cat unicode_id.txt) && tbd label add $ID "优先级高"
✓ Added labels[..]
? 0
```

# Test: Special characters in description

```console
$ tbd create "Special chars" --description="Description with <html>, \"quotes\", 'apostrophes', & ampersands"
✓ Created test-[SHORTID]: Special chars
? 0
```

# Test: Newlines in description from file

```console
$ echo -e "Line 1\nLine 2\nLine 3" > /tmp/multi.txt && tbd create "Multi-line" --file=/tmp/multi.txt
✓ Created test-[SHORTID]: Multi-line
? 0
```

* * *

## Error Handling

# Test: Invalid issue ID format

```console
$ tbd show "invalid!!!" 2>&1
Error: Issue not found: invalid!!!
? 1
```

# Test: Non-existent short ID

```console
$ tbd show "zzzz" 2>&1
Error: Issue not found: zzzz
? 1
```

# Test: Invalid priority value

```console
$ tbd create "Test" --priority=10 2>&1
Error: Invalid priority: 10. Use P0-P4 or 0-4.
? 2
```

# Test: Invalid type value

```console
$ tbd create "Test" --type=invalid 2>&1
Error: Invalid type: invalid. Must be: bug, feature, task, epic, chore
? 2
```

# Test: Empty title error

```console
$ tbd create "" 2>&1
Error: Title is required. Use: tbd create "Issue title"
? 2
```

# Test: Update non-existent issue

```console
$ tbd update bd-0000 --priority=1 2>&1
Error: Issue not found: bd-0000
? 1
```

# Test: Close non-existent issue

```console
$ tbd close bd-0000 2>&1
Error: Issue not found: bd-0000
? 1
```

# Test: Self-dependency error

```console
$ tbd list --json | jq -r '.[0].id' | tee self_id.txt
test-[SHORTID]
? 0
```

```console
$ ID=$(cat self_id.txt) && tbd dep add $ID $ID 2>&1
Error: Issue cannot depend on itself
? 2
```

* * *

## Boundary Conditions

# Test: Very long title (200 chars)

```console
$ tbd create "$(awk 'BEGIN { for (i = 0; i < 200; i++) printf "A" }')"
✓ Created test-[SHORTID]: [..]
? 0
```

# Test: Too long title is rejected before writing

```console
$ tbd create "$(awk 'BEGIN { for (i = 0; i < 501; i++) printf "A" }')" 2>&1
Error: Title is too long (501 chars, max 500). Move detail into the description body.
? 2
```

# Test: Many labels

```console
$ tbd create "Many labels" --label=one --label=two --label=three --label=four --label=five --label=six --label=seven --label=eight
✓ Created test-[SHORTID]: Many labels
? 0
```

# Test: Zero priority

```console
$ tbd create "Critical" --priority=0
✓ Created test-[SHORTID]: Critical
? 0
```

# Test: Lowest priority

```console
$ tbd create "Backlog" --priority=4
✓ Created test-[SHORTID]: Backlog
? 0
```

* * *

## List Filtering Edge Cases

# Test: List with multiple filters

```console
$ tbd list --status=open --type=task --priority=2 | grep -c "^test-" || echo "0"
[..]
? 0
```

# Test: List count only

```console
$ tbd list --count
[..]
? 0
```

# Test: List with very large limit

```console
$ tbd list --limit=10000 | head -1
[..]
? 0
```

* * *

## Dry Run Mode

# Test: Create with dry-run doesn’t create

```console
$ tbd create "DryRun Test" --dry-run
[DRY-RUN] Would create issue
? 0
```

# Test: Verify dry-run didn’t create

```console
$ tbd search "DryRun Test" --json
[]
? 0
```

# Test: Close with dry-run doesn’t close

```console
$ ID=$(cat self_id.txt) && tbd close $ID --dry-run
[DRY-RUN] Would close issue
? 0
```

# Test: Verify issue still open after dry-run close

```console
$ ID=$(cat self_id.txt) && tbd show $ID | grep "status: open"
status: open
? 0
```

* * *

## JSON Output Consistency

# Test: List JSON is valid array

```console
$ tbd list --json
[
...
]
? 0
```

# Test: Show JSON is valid object

```console
$ ID=$(cat self_id.txt) && tbd show $ID --json
{
...
}
? 0
```

# Test: Search JSON is valid array

```console
$ tbd search "test" --json
[..]
? 0
```

# Test: Stats JSON is valid object

```console
$ tbd stats --json
{
...
}
? 0
```

* * *

## Working Notes

# Test: Add working notes

```console
$ ID=$(cat self_id.txt) && tbd update $ID --notes="Investigation notes: found the root cause"
✓ Updated test-[SHORTID]
? 0
```

# Test: Verify notes in show output

```console
$ ID=$(cat self_id.txt) && tbd show $ID | grep -c "Investigation notes"
1
? 0
```

# Test: Notes from file

```console
$ echo "Notes from file content" > /tmp/notes.txt && ID=$(cat self_id.txt) && tbd update $ID --notes-file=/tmp/notes.txt
✓ Updated test-[SHORTID]
? 0
```

* * *

## Stale Issues

# Test: Stale with default days

```console
$ tbd stale --json
[..]
? 0
```

# Test: Stale with custom days

```console
$ tbd stale --days=0 | head -1
[..]
? 0
```

* * *

## Deferred Issues

# Test: Create deferred issue with full datetime

```console
$ tbd create "Deferred task" --defer=2099-12-31T00:00:00Z
✓ Created test-[SHORTID]: Deferred task
? 0
```

# Test: List with deferred filter runs without error

```console
$ tbd list --deferred --json
[..]
? 0
```
