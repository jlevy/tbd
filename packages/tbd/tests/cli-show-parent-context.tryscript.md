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
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd init --prefix=test
---
# Show Parent Context Tests

Tests for `tbd show` auto-displaying parent bead context for child issues, `--no-parent`
suppression, and `--max-lines` truncation.

## Setup: Create parent and child beads

# Test: Create parent epic

```console
$ tbd create "Build Auth System" --type=epic --priority=1 --description="Users need OAuth and SAML auth" --json | jq -r '.id' | tee parent_id.txt
test-[SHORTID]
? 0
```

# Test: Create child task under parent

```console
$ tbd create "Implement OAuth" --type=task --parent=$(cat parent_id.txt) --json | jq -r '.id' | tee child_id.txt
test-[SHORTID]
? 0
```

## Parent Context Auto-Display

# Test: Show child bead first, then parent context below

```console
$ tbd show $(cat child_id.txt)
---
type: is
id: is-[ULID]
title: Implement OAuth
kind: task
status: open
priority: P2
version: 1
labels: []
dependencies: []
parent_id: is-[ULID]
created_at: [TIMESTAMP]
updated_at: [TIMESTAMP]
---


The parent of this bead is:
---
type: is
id: is-[ULID]
title: Build Auth System
kind: epic
status: open
priority: P1
version: 2
labels: []
dependencies: []
child_order_hints:
  - is-[ULID]
created_at: [TIMESTAMP]
updated_at: [TIMESTAMP]
---
Users need OAuth and SAML auth
? 0
```

## --no-parent Suppression

# Test: Show child with --no-parent omits parent context entirely

```console
$ tbd show $(cat child_id.txt) --no-parent
---
type: is
id: is-[ULID]
title: Implement OAuth
kind: task
status: open
priority: P2
version: 1
labels: []
dependencies: []
parent_id: is-[ULID]
created_at: [TIMESTAMP]
updated_at: [TIMESTAMP]
---
? 0
```

## --max-lines Truncation

# Test: Show with --max-lines truncates and shows omission notice

```console
$ tbd show $(cat child_id.txt) --no-parent --max-lines 3
---
type: is
id: is-[ULID]
… [12 lines omitted]
? 0
```

## Root Bead (No Parent)

# Test: Show root bead displays normally without parent context

```console
$ tbd show $(cat parent_id.txt)
---
type: is
id: is-[ULID]
title: Build Auth System
kind: epic
status: open
priority: P1
version: 2
labels: []
dependencies: []
child_order_hints:
  - is-[ULID]
created_at: [TIMESTAMP]
updated_at: [TIMESTAMP]
---
Users need OAuth and SAML auth
? 0
```

## JSON Output

# Test: JSON output for child includes full parent object

```console
$ tbd show $(cat child_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 1,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Implement OAuth",
  "kind": "task",
  "status": "open",
  "priority": 2,
  "labels": [],
  "dependencies": [],
  "parent_id": "is-[ULID]",
  "displayId": "test-[SHORTID]",
  "parent": {
    "type": "is",
    "id": "is-[ULID]",
    "version": 2,
    "created_at": "[TIMESTAMP]",
    "updated_at": "[TIMESTAMP]",
    "title": "Build Auth System",
    "kind": "epic",
    "status": "open",
    "priority": 1,
    "description": "Users need OAuth and SAML auth",
    "labels": [],
    "dependencies": [],
    "child_order_hints": [
      "is-[ULID]"
    ],
    "displayId": "test-[SHORTID]"
  }
}
? 0
```

# Test: JSON output for root bead has no parent key

```console
$ tbd show $(cat parent_id.txt) --json
{
  "type": "is",
  "id": "is-[ULID]",
  "version": 2,
  "created_at": "[TIMESTAMP]",
  "updated_at": "[TIMESTAMP]",
  "title": "Build Auth System",
  "kind": "epic",
  "status": "open",
  "priority": 1,
  "description": "Users need OAuth and SAML auth",
  "labels": [],
  "dependencies": [],
  "child_order_hints": [
    "is-[ULID]"
  ],
  "displayId": "test-[SHORTID]"
}
? 0
```
