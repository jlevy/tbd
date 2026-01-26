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
  # Initialize tbd with test prefix
  tbd init --prefix=test
---
# tbd CLI: Spec Linking Feature

Tests for the spec_path field that links beads to specification documents.

* * *

## Backward Compatibility (Non-Spec Workflows)

# Test: Create without --spec (existing workflow unchanged)

```console
$ tbd create "Task without spec"
✓ Created test-[SHORTID]: Task without spec
? 0
```

# Test: Create another issue without spec

```console
$ tbd create "Second task no spec" --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('nospec_id.txt', d.id); console.log('Created')"
Created
? 0
```

# Test: Show issue without spec_path (no spec_path in output)

```console
$ tbd show $(cat nospec_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('has_spec:', !!d.spec_path)"
has_spec: false
? 0
```

* * *

## Create with --spec Option

# Test: Create with --spec (full path)

```console
$ tbd create "Schema changes" --spec docs/project/specs/active/plan-2026-01-26-my-feature.md --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('spec1_id.txt', d.id); console.log('Created')"
Created
? 0
```

# Test: Verify spec_path was stored (full path)

```console
$ tbd show $(cat spec1_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('spec:', d.spec_path)"
spec: docs/project/specs/active/plan-2026-01-26-my-feature.md
? 0
```

# Test: Create with --spec (filename only)

```console
$ tbd create "CLI updates" --spec plan-2026-01-26-my-feature.md --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('spec2_id.txt', d.id); console.log('Created')"
Created
? 0
```

# Test: Verify spec_path was stored (filename only)

```console
$ tbd show $(cat spec2_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('spec:', d.spec_path)"
spec: plan-2026-01-26-my-feature.md
? 0
```

# Test: Create with --spec (partial path)

```console
$ tbd create "Add tests" --spec specs/active/plan-2026-01-26-my-feature.md --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('spec3_id.txt', d.id); console.log('Created')"
Created
? 0
```

* * *

## List with --spec Filter (Gradual Matching)

# Test: List --spec with exact path match

```console
$ tbd list --spec docs/project/specs/active/plan-2026-01-26-my-feature.md --count
1
? 0
```

# Test: List --spec with filename-only match (matches full path stored)

The first issue stored full path, which should match when querying by filename only:

```console
$ tbd list --spec plan-2026-01-26-my-feature.md --count
3
? 0
```

# Test: List --spec with partial path match

Both issue 1 (full path) and issue 3 (partial path stored) match this query:

```console
$ tbd list --spec active/plan-2026-01-26-my-feature.md --count
2
? 0
```

# Test: List --spec combined with other filters

```console
$ tbd list --spec plan-2026-01-26-my-feature.md --status open --count
3
? 0
```

# Test: List --spec with no matches returns 0

```console
$ tbd list --spec nonexistent-spec.md --count
0
? 0
```

# Test: List without --spec returns all issues

At this point we have 5 issues: 2 without spec, 3 with spec

```console
$ tbd list --count
5
? 0
```

* * *

## Show Command with spec_path

# Test: Show displays spec_path in output

```console
$ tbd show $(cat spec1_id.txt) | grep -c "spec_path:"
1
? 0
```

# Test: Show JSON includes spec_path

```console
$ tbd show $(cat spec1_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('has_spec_path:', 'spec_path' in d)"
has_spec_path: true
? 0
```

* * *

## Update Command with --spec

# Test: Update to set spec_path

```console
$ tbd update $(cat nospec_id.txt) --spec new-spec.md
✓ Updated [..]
? 0
```

# Test: Verify spec_path was set

```console
$ tbd show $(cat nospec_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('spec:', d.spec_path)"
spec: new-spec.md
? 0
```

# Test: Update to change spec_path

```console
$ tbd update $(cat nospec_id.txt) --spec different-spec.md
✓ Updated [..]
? 0
```

# Test: Verify spec_path was changed

```console
$ tbd show $(cat nospec_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('spec:', d.spec_path)"
spec: different-spec.md
? 0
```

# Test: Update to clear spec_path with empty string

```console
$ tbd update $(cat nospec_id.txt) --spec ""
✓ Updated [..]
? 0
```

# Test: Verify spec_path was cleared

```console
$ tbd show $(cat nospec_id.txt) --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('has_spec:', !!d.spec_path)"
has_spec: false
? 0
```

* * *

## Mixed Workflows

# Test: List returns both spec-linked and unlinked issues by default

```console
$ tbd list --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.length)"
total: 5
? 0
```

# Test: JSON output includes spec_path when present

```console
$ tbd list --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); const withSpec = d.filter(i => i.spec_path); console.log('with_spec:', withSpec.length)"
with_spec: 3
? 0
```

# Test: Create issue, link to spec, then close (full workflow)

```console
$ tbd create "Full workflow task" --spec workflow-spec.md --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); require('fs').writeFileSync('workflow_id.txt', d.id); console.log('Created')"
Created
? 0
```

```console
$ tbd close $(cat workflow_id.txt)
✓ Closed [..]
? 0
```

# Test: Closed spec-linked issue not shown by default

```console
$ tbd list --spec workflow-spec.md --count
0
? 0
```

# Test: Closed spec-linked issue shown with --all

```console
$ tbd list --spec workflow-spec.md --all --count
1
? 0
```

* * *

## Edge Cases

# Test: Create with --spec containing special characters in filename

```console
$ tbd create "Special chars" --spec "docs/my-feature_v2.0.md" --json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('Created')"
Created
? 0
```

# Test: List with --spec containing special characters

```console
$ tbd list --spec "my-feature_v2.0.md" --count
1
? 0
```

# Test: Dry run with --spec

```console
$ tbd create "Dry run spec" --spec test-spec.md --dry-run
[DRY-RUN] Would create issue
? 0
```
