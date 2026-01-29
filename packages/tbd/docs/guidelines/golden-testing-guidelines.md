---
title: Golden Testing Guidelines
description: Guidelines for implementing golden/snapshot testing for complex systems
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# Golden Testing Guidelines

## TL;DR

- **Prefer raw output over abstractions** - capture console strings, not structured
  models.
- Define a session schema (events) with stable vs unstable fields.
- Capture full execution for scenarios (inputs, outputs, side effects) as YAML.
- Normalize or remove unstable fields at serialization time.
- Provide a mock mode for all nondeterminism and slow dependencies.
- Add a CLI to run scenarios, update goldens, and print diffs.
- Keep scenarios few but end-to-end; tests must run fast in CI (<100ms each).
- Prefer many small artifacts (shard by scenario/phase) over monolithic traces.
- Layer domain-focused assertions alongside raw diffs for critical invariants.
- Review and commit session files with code; treat them as behavioral specs.
- **For CLIs: use `--show-subprocess`** to log all subprocess calls with exit codes.

## When to Use Golden Tests

Golden session testing excels for complex systems where writing and maintaining hundreds
of unit or integration tests is burdensome.
Traditional unit tests struggle to capture the full behavior of systems with many
interacting components, non-deterministic outputs, and complex state transitions.

## Core Principles

### 1. Model Events Formally

All events should be modeled with type-safe schemas (Zod, Pydantic, TypeScript
interfaces). Events are serialized to YAML for human readability.

### 2. Classify Fields as Stable or Unstable

- **Stable**: Deterministic values that must match exactly (symbols, actions,
  quantities)
- **Unstable**: Non-deterministic values filtered during comparison (timestamps, IDs)

Filter unstable fields before writing session files by replacing with placeholders like
`"[TIMESTAMP]"` or omitting entirely.

### 3. Use Switchable Mock Modes

- **Live mode**: Calls real external services for debugging and updating golden files
- **Mocked mode**: Uses recorded/stubbed responses for fast, deterministic CI

### 4. Prefer Low-Level Raw Capture Over High-Level Modeling

**Critical principle: Capture raw output, not abstractions.**

- **Capture raw console output** directly rather than parsing into structured models
- **Include command exit codes** as plain text in output, not just success/failure flags
- **Log sub-command invocations** inline as strings, not as JSON/YAML structures
- **Let the diff be the assertion** - raw diffs catch bugs that structured comparisons
  miss

High-level abstractions (structured schemas, parsed events, modeled operations) can miss
unexpected behaviors because they only capture what you anticipated.
Raw output captures everything, including the bugs you didn’t predict.

**Example: Silent failure bug**

High-level model only captures what was modeled:
```yaml
sync_result: { status: "success", commits_synced: 0 }  # Looks fine
```

Raw output reveals the truth:
```
[git] push origin main -> exit 1                       # BUG REVEALED
[git]   stderr: HTTP 403
Sync complete.
Exit code: 0
```

The raw output shows the mismatch between `git push exit 1` and overall `exit 0` that a
high-level model would hide.

### 5. Design for Fast CI

Golden tests should run in under 100ms per scenario:
- Run in mocked mode (no network, no external services)
- Use in-memory mocks over file-based fixtures
- Parallelize independent scenarios
- Cache expensive setup

## Do / Don’t

- Do capture full payloads and side effects that influence behavior.
- Do normalize/remap unstable values at write time, not in comparisons.
- Do keep scenarios few, representative, and fast.
- Do prefer many small artifacts over monolithic traces.
- Don’t depend on real clocks, random, network, or database in CI.
- Don’t hide differences with overly broad placeholders.
- Don’t fork logic for tests vs production; share code paths.
- Don’t let artifacts grow unbounded.

## Transparent Subprocess Logging for CLIs

When a CLI tool calls external commands (git, npm, curl, docker, etc.), capturing those
operations in golden tests creates a “transparent box” that reveals internal behavior.
This pattern catches bugs where user output doesn’t match actual subprocess results.

### The Simple Pattern: Console Logging with Debug Flags

The simplest and most robust approach is to **print subprocess details directly to
console as strings**. No structured data model needed—just log the command and exit
code. Tryscript captures all console output, which gets committed as the golden file.

This approach is:
- **Simple**: No parsing or data modeling required
- **Robust**: Catches unexpected subprocess behavior automatically
- **Complete**: The full output becomes the golden file

#### Implementation

Add a `--show-subprocess` flag (or env var `SHOW_SUBPROCESS=1`) that logs each call:

```typescript
// Generic subprocess runner with transparent logging
async function runSubprocess(
  cmd: string,
  args: string[]
): Promise<{ stdout: string; exitCode: number }> {
  const result = await exec(cmd, args);

  // Log directly to console when flag is set
  if (process.env.SHOW_SUBPROCESS === '1' || options.showSubprocess) {
    console.log(`[${cmd}] ${args.join(' ')} -> exit ${result.exitCode}`);
    if (result.stderr) console.log(`[${cmd}]   stderr: ${result.stderr.trim()}`);
  }

  return result;
}

// Use for all subprocess calls
const gitResult = await runSubprocess('git', ['push', 'origin', 'main']);
const npmResult = await runSubprocess('npm', ['install']);
const curlResult = await runSubprocess('curl', ['-s', url]);
```

That’s it. The tryscript will capture everything.

### Tryscript Golden Test Example

```bash
#!/bin/bash
# tryscripts/sync-push-failure.tryscript.sh

# Enable subprocess logging - output appears in golden file
export SHOW_SUBPROCESS=1

# Setup: repo with unpushed commits
git commit --allow-empty -m "local commit"

# Run the sync command
mycli sync
echo "Exit code: $?"
```

The captured output becomes the golden file:

```
[git] fetch origin -> exit 0
[git] rev-list --count origin/main..main -> exit 0
[git] push origin main -> exit 1
[git]   stderr: error: failed to push some refs
Push failed: HTTP 403 - Permission denied
2 commit(s) not pushed.
Exit code: 1
```

### Why This Catches Bugs

**Without subprocess logging**, a golden test only captures user-visible output:
```
Already in sync.
Exit code: 0
```
This looks correct!

**With subprocess logging**, the golden file reveals the truth:
```
[git] fetch origin -> exit 0
[git] push origin main -> exit 1        ← BUG REVEALED!
[git]   stderr: HTTP 403
Already in sync.
Exit code: 0
```

The mismatch between `[git] push -> exit 1` and `Exit code: 0` is now obvious to any
reviewer. The bug cannot hide.

### Key Advantages Over Structured Logging

| Approach | Pros | Cons |
| --- | --- | --- |
| **Console strings (recommended)** | Simple, catches everything, no parsing | Less programmatic analysis |
| Structured JSON/YAML | Queryable, can run assertions | Complex, may miss unexpected commands |

**Always prefer console strings for tryscript tests.** Structured logging is only useful
if you need programmatic assertions, and even then the console approach catches more
bugs because it doesn’t require predicting what subprocesses might fail.

### Best Practices

1. **Always enable subprocess logging in tryscript tests** - Add
   `export SHOW_SUBPROCESS=1` at the top of every test that exercises subprocess calls.

2. **Log the exit code explicitly** - End tests with `echo "Exit code: $?"` so it’s
   captured in the golden file.

3. **Review subprocess operations in PR diffs** - When golden files change, verify that
   subprocess exit codes align with user-facing output.

4. **Catch silent error swallowing** - If you see a subprocess with `exit 1` but the
   overall `Exit code: 0`, that’s a bug.

### Benefits

| Benefit | Description |
| --- | --- |
| Bug detection | Reveals mismatches between subprocess results and user output |
| Regression protection | Any change in subprocess behavior shows in diff |
| Documentation | Golden files document expected subprocess sequences |
| Debugging | When tests fail, see exactly what operations occurred |
| Catches unexpected failures | No need to model which subprocesses might fail |

## Common Pitfalls

- Missing unstable field classification -> flaky diffs.
- File I/O captured without contents/checksums -> silent regressions.
- Slow or network-bound scenarios -> skipped in practice, regressions leak.
- LLM output not recorded or scrubbed -> non-deterministic sessions.
- Monolithic traces that grow unbounded -> hard to review, slow to diff.
- **Subprocess failures not captured** -> silent error swallowing bugs leak through.
- **Exit codes not captured** -> mismatches between internal state and user feedback.
