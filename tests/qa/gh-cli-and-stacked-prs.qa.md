---
title: QA Playbook
description: Fresh-machine validation of gh CLI provisioning (version floor, pinned install) and stacked-PR support (gh-stack extension, official skill, PR shortcut behavior)
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
# QA Playbook: gh CLI Provisioning and Stacked PRs

Validates the work in epic `tbd-ewsw` on a machine that is not the one it was written
on.

**Purpose**: prove that (a) `ensure-gh-cli.sh` enforces a version floor instead of
accepting any `gh` it finds, (b) it never downgrades a newer `gh`, (c) the pinned
gh-stack extension and its official agent skill install cleanly, (d) a real two-layer
stack can be created and submitted, and (e) the PR shortcuts no longer flatten a stack
by targeting the trunk.

**Estimated time**: 45 to 60 minutes.

**Why manual**: this exercises real network installs, a real GitHub repo, and real PR
state. None of it is meaningfully coverable in unit tests.

> **Instructions to the validating agent.** Report what actually happened, including
> anything that contradicts this document.
> A step that fails is a useful result, not a problem to work around: record the actual
> output and continue.
> Do not edit this playbook to match observed behavior.
> If a step is skipped or blocked, say so explicitly rather than leaving it blank.

* * *

## Current Status (last update: not yet run)

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0: Environment prep | ⏳ Pending |  |
| Phase 1: Old gh is upgraded | ⏳ Pending |  |
| Phase 2: Missing gh is installed | ⏳ Pending |  |
| Phase 3: Newer gh is left alone | ⏳ Pending |  |
| Phase 4: Stack tooling provisioning | ⏳ Pending |  |
| Phase 5: Real two-layer stack | ⏳ Pending |  |
| Phase 6: PR shortcut does not flatten a stack | ⏳ Pending |  |
| Phase 7: Idempotency | ⏳ Pending |  |

**Status Legend**: ✅ Passed | ❌ Failed | ⏳ Pending | ⏸️ Blocked

* * *

## Phase 0: Environment Prep

Linux, x86_64 or arm64, with network access to GitHub.

1. Confirm a clean starting point and record it:
   ```bash
   command -v gh || echo "no gh"
   gh --version 2>/dev/null | head -1
   uname -s -m
   ```
2. Authenticate, since later phases create real PRs.
   Either export `GH_TOKEN`, or run `gh auth login` once `gh` exists.
3. Clone the repo under test and check out the branch carrying this playbook.
4. Pick a scratch GitHub repo you may freely create and close PRs in.
   Do **not** use a production repo.

**Record**: starting `gh` version (or absent), OS, arch, scratch repo name.

## Phase 1: An Old gh Is Upgraded (the important case)

This is the regression that motivated the work.
Before the fix, any existing `gh` was accepted forever, so a distro package silently
defeated the pin.

1. Install an old `gh` deliberately, ahead of `~/.local/bin` in PATH:
   ```bash
   sudo apt-get install -y gh    # or any build older than 2.97.0
   command -v gh && gh --version | head -1
   ```
   If apt provides 2.97.0 or newer, install an older release manually from
   `https://github.com/cli/cli/releases`; the phase needs a genuinely old binary.
2. Run the ensure script:
   ```bash
   bash .claude/scripts/ensure-gh-cli.sh
   ```

**Expected**:
- Output names the found version and states it is below the required 2.97.0.
- The pinned 2.97.0 is downloaded, its checksum verified, and it is installed to
  `~/.local/bin/gh`.
- If the old `gh` still precedes `~/.local/bin` in PATH, a PATH warning is printed
  naming both paths.

3. Confirm the effective version:
   ```bash
   hash -r; command -v gh; gh --version | head -1
   ```
   Expect 2.97.0 or higher.
   If an older one still wins, the PATH warning should have said so; record whether it
   did.

**Fails if**: the script reports the old `gh` as fine and installs nothing.

## Phase 2: A Missing gh Is Installed

1. Remove `gh` from PATH entirely (uninstall the distro package and move
   `~/.local/bin/gh` aside).
2. Run `bash .claude/scripts/ensure-gh-cli.sh`.

**Expected**: reports `CLI not found`, installs pinned 2.97.0, verifies the checksum,
and exits 0. A checksum mismatch must abort with a non-zero exit and install nothing.

## Phase 3: A Newer gh Is Left Alone

The script must never downgrade.

1. Install a `gh` newer than the pin, for example 2.98.0, into `~/.local/bin`.
2. Run `bash .claude/scripts/ensure-gh-cli.sh`.

**Expected**: reports the found version and exits without downloading anything.
`gh --version` is unchanged afterward.

**Fails if**: the newer `gh` is replaced with 2.97.0.

## Phase 4: Stack Tooling Provisioning

1. Confirm the default run installs no stack tooling:
   ```bash
   bash .claude/scripts/ensure-gh-cli.sh
   gh extension list        # expect NO gh-stack row
   ```
   Stack tooling is opt-in; a default session must not pay for it.
2. Opt in:
   ```bash
   bash .claude/scripts/ensure-gh-cli.sh --with-stack
   ```

**Expected**, matching the checklist in `setup-github-cli.md`:

| Command | Expected |
| --- | --- |
| `gh --version` | 2.97.0 or higher |
| `gh auth status` | `Logged in to github.com` |
| `gh extension list` | `gh stack  github/gh-stack  v0.1.0` |
| `gh skill list` | a `gh-stack` row |
| `gh stack --help` | exits 0 |

3. Confirm the pin held: the extension row must read `v0.1.0`, not a later tag.
4. Simulate failure by running `--with-stack` with no network.
   **Expected**: a warning, and exit 0. It must not block the session.

## Phase 5: A Real Two-Layer Stack

In the scratch repo:

1. Create the stack and two commits:
   ```bash
   gh stack init layer-one
   # edit a file, commit
   gh stack add layer-two
   # edit a different file, commit
   gh stack submit --auto
   ```
2. Inspect:
   ```bash
   gh stack view --json
   ```

**Expected**:
- Two PRs exist.
- `layer-one` is based on the trunk.
- **`layer-two` is based on `layer-one`, not on the trunk.** This is the core assertion.
- GitHub shows the two PRs linked as a stack.
- `gh pr diff <layer-two PR>` shows only layer two’s changes.

3. Confirm the documented agent rules hold:
   - `gh stack view --json` returns promptly and exits 0.
   - On a non-stacked branch, `gh stack view --json` exits 2 with `not part of a stack`
     rather than hanging.

## Phase 6: The PR Shortcut Does Not Flatten a Stack

This is the guidance regression fixed in this change.

1. Check out `layer-two` from Phase 5.
2. Follow `tbd shortcut create-or-update-pr-simple` exactly as written, running its
   commands verbatim.

**Expected**:
- Step 1’s `TRUNK=$(gh repo view $REPO --json defaultBranchRef ...)` returns the trunk
  name and exits 0.
- Step 3 detects that the branch is part of a stack.
- Step 6 takes the stacked path: it does **not** run `gh pr create ... --base <trunk>`.
- After the shortcut completes, `gh stack view --json` still shows `layer-two` based on
  `layer-one`.

**Fails if**: the PR for `layer-two` ends up based on the trunk, or the stack is no
longer linked on GitHub.

3. Repeat on an ordinary non-stacked branch and confirm the simple path is unchanged and
   no more laborious than before.

## Phase 7: Idempotency

1. Run each of these twice in a row and confirm the second run is a clean no-op:
   ```bash
   bash .claude/scripts/ensure-gh-cli.sh
   bash .claude/scripts/ensure-gh-cli.sh --with-stack
   ```
   **Expected**: the second `--with-stack` run reports both the extension and the skill
   as already installed, and reinstalls neither.
2. Confirm the three copies of the script are still byte-identical:
   ```bash
   diff packages/tbd/docs/install/ensure-gh-cli.sh .claude/scripts/ensure-gh-cli.sh
   diff packages/tbd/docs/install/ensure-gh-cli.sh .codex/ensure-gh-cli.sh
   ```
   **Expected**: no output from either.

## Reporting

Update the status table above, then record for each phase: the command run, actual
output, and pass or fail.
File a bead for each failure, linked to epic `tbd-ewsw`, and note anything this playbook
told you to expect that turned out not to be true.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
