# Validation Plan: Streamlined Init/Setup Design

**Spec:** `plan-2026-01-20-streamlined-init-setup-design.md` **Branch:**
`claude/review-init-setup-spec-SysOy` **Date:** 2026-01-21

## Summary of Changes

This PR implements the streamlined init/setup design that simplifies the user/agent
onboarding experience:

1. **Single entry point**: `tbd setup --auto` handles all scenarios (fresh, beads
   migration, already initialized)
2. **Prime-first design**: Running `tbd` with no args shows a dashboard via `tbd prime`
3. **New `tbd skill` command**: Outputs full SKILL.md content for agents
4. **Surgical init**: `tbd init` now only creates `.tbd/` directory (no auto-calls)
5. **Prefix auto-detection**: Automatically detects project name from git remote

## Files Changed

### New Files

- `packages/tbd/src/cli/commands/skill.ts` - New `tbd skill` command
- `packages/tbd/src/cli/lib/prefix-detection.ts` - Prefix auto-detection module
- `packages/tbd/tests/setup-flows.test.ts` - Integration tests for setup flows
- `docs/skill-brief.md` - Condensed workflow rules for agents

### Modified Files

- `packages/tbd/src/cli/cli.ts` - Added skill command, prime-first behavior
- `packages/tbd/src/cli/commands/setup.ts` - Added SetupDefaultHandler,
  --auto/--interactive
- `packages/tbd/src/cli/commands/prime.ts` - Refactored to show dashboard
- `packages/tbd/src/cli/commands/init.ts` - Made surgical (no auto-calls)
- `packages/tbd/src/cli/commands/import.ts` - Added deprecation notice for --from-beads
- `packages/tbd/src/cli/lib/errors.ts` - Updated error messages
- `packages/tbd/src/docs/CURSOR.mdc` - Added proper MDC frontmatter
- `README.md` - Updated quick start to use `tbd setup --auto`
- `docs/tbd-docs.md` - Updated CLI documentation

## Manual Validation Steps

### 1. Fresh Repository Setup

```bash
# Create a new git repo
mkdir /tmp/test-fresh && cd /tmp/test-fresh
git init && git config user.email "test@test.com" && git config user.name "Test"
git remote add origin https://github.com/testuser/myproject.git

# Run setup
tbd setup --auto

# Expected: Should initialize with prefix "myproject" auto-detected
# Expected: Should show "Setup complete!" followed by dashboard
```

### 2. Prime-First Behavior

```bash
# In an initialized repo
tbd

# Expected: Should show dashboard with:
# - tbd vX.X.X
# - --- INSTALLATION ---
# - --- PROJECT STATUS ---
# - --- WORKFLOW RULES ---
# - --- QUICK REFERENCE ---
```

### 3. Skill Command

```bash
tbd skill

# Expected: Should output full SKILL.md content

tbd skill --brief

# Expected: Should output condensed workflow rules
```

### 4. Surgical Init

```bash
mkdir /tmp/test-init && cd /tmp/test-init
git init && git config user.email "test@test.com" && git config user.name "Test"

# Without prefix should fail
tbd init
# Expected: Error requiring --prefix

# With prefix should work
tbd init --prefix=myapp
# Expected: Creates .tbd/ directory only, shows next steps
```

### 5. Beads Migration

```bash
mkdir /tmp/test-beads && cd /tmp/test-beads
git init && git config user.email "test@test.com" && git config user.name "Test"

# Create mock beads setup
mkdir .beads
echo "display:" > .beads/config.yaml
echo "  id_prefix: legacyproj" >> .beads/config.yaml
touch .beads/issues.jsonl

# Run setup
tbd setup --auto

# Expected: Should detect beads, migrate, use "legacyproj" prefix
```

### 6. Error Messages

```bash
cd /tmp/not-a-tbd-repo
tbd list

# Expected: "Error: Not a tbd repository (run 'tbd setup --auto' first)"
```

## Automated Tests

All 448 tests pass including:

- `tests/prefix-detection.test.ts` - 17 tests for prefix auto-detection
- `tests/setup-flows.test.ts` - 9 tests for setup flow scenarios
- `tests/integration-files.test.ts` - 4 tests for CURSOR.mdc format
- `tests/errors.test.ts` - Updated error message expectations

```bash
npm test
# Expected: 448 passed
```

## Backward Compatibility Notes

- `tbd setup auto` still works (not removed)
- `tbd import --from-beads` shows deprecation notice but still works
- `tbd setup beads --disable` still available for manual use

## Known Limitations

- `--interactive` mode not fully implemented (prompts not added)
- Design doc §6.4 not fully updated
- Golden tests for output formats not comprehensive
