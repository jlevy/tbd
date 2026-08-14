---
title: Setup Linear
description: Set up the Linear integration end to end—first-time configuration for a repository, or adding your own API key to a repository your team already configured
category: session
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Use this when a user wants to connect this repository to Linear, or says their Linear
sync “isn’t working” and you do not yet know whether the repository is configured, the
key is missing, or both.

Operate tbd for the user throughout this workflow.
Do not hand them a list of tbd commands to run.
The one deliberate exception is the secret itself: the user must enter their personal
Linear key through their local shell, secret manager, or environment settings rather
than sending it to the agent.

Two things must be true before Linear sync works, and they are set up in different
places by different people:

| What | Where it lives | Who sets it | Shared? |
| --- | --- | --- | --- |
| **Configuration** — team, project, policy | `.tbd/config.yml`, committed to git | Whoever sets the repository up, once | Yes—everyone on the team gets it by cloning |
| **Credential** — `LINEAR_API_KEY` | Environment or a **gitignored** `.env` | Every person and agent, individually | **Never**—a key is personal and is never committed |

That split is the whole shape of this workflow.
A user joining a team that already uses Linear needs only the second one.

## Step 0: Make sure tbd is initialized

Run `tbd status`. If tbd is not ready, initialize or refresh it before configuring
Linear:

- If `.tbd/config.yml` is absent, ask the user for the 2–8 letter issue prefix, then run
  `tbd setup --auto --prefix=<their-prefix>`. Never guess the prefix.
- If the clone already contains `.tbd/config.yml`, run `tbd setup --auto` with no
  prefix. This installs or refreshes the local agent surfaces without changing the team’s
  issue prefix.

Do not continue until `tbd status` succeeds.

## Step 1: Find out which case you are in

Do this before anything else.
Do not edit config or ask for a key until you know which case applies.

```bash
tbd integration status --offline   # No network call: just config and credential
```

Read the output and match it:

| What `status` says | Case | What is missing |
| --- | --- | --- |
| `No external tracker integrations are configured.` | **A. First-time setup** | Config and key |
| `✓ enabled: yes` and `✓ target: <KEY>`, but `✗ credential: LINEAR_API_KEY not found` | **B. Joining a configured repo** | Just your key |
| `✓ enabled`, `✓ target`, `✓ credential` | **C. Already set up** | Nothing—go to Step 4 |
| `- enabled: configured but disabled` | **D. Deliberately off** | Ask before changing it |

Case B is the common one on a team: the `integrations` block is committed, so it arrived
with the clone. **Do not re-run first-time setup in case B.** Changing `team_key` or
`project` when teammates and other agents are already syncing points this repository at
a different place than theirs.

## Step 2 (case A only): First-time setup for the repository

Skip this entirely for cases B, C, and D.

You cannot infer the team or project—**ask the user**:

- **Team key**: the prefix on their Linear issue identifiers.
  `FIN-123` means the team key is `FIN`.
- **Project** (optional but recommended): scopes both new issue creation and automatic
  inbound discovery to one project, so tbd never wanders into unrelated team work.

Then add to `.tbd/config.yml`:

```yaml
integrations:
  linear:
    enabled: true
    team_key: FIN # theirs, from the user
    project: my-project # optional; omit if they did not name one
    policy: default # open epics + anything with a live plan spec
```

Leave `policy: default` unless the user asks for something else.
It selects open epics plus anything whose `spec_path` points into `specs/active/`—the
right starting point for “track our specs and major work”, and roughly 10% of a typical
repository’s beads.

Two optional keys worth mentioning only if the user raises the need:

- `user_map: { alias: person@example.com }` — the **only** identities tbd may push as
  assignees. Without it, assignees do not sync in either direction, and no email or raw
  Linear user ever enters bead data.
- `mirror_labels: true` — pushes bead labels as Linear labels.
  Off by default on purpose: a repository can carry a hundred-plus labels, and creating
  one Linear label each pollutes a shared team namespace.

This block is committed.
Commit it in the same change as any other setup, so the next teammate to clone gets it.

## Step 3 (cases A and B): Add your own API key

This step is per person and per machine.
It is the *only* step a user in case B needs.

**First, verify `.env` is gitignored — before writing anything into it.** When an
integration is configured, `status` reports either `not present and gitignored` or the
warning `not present and not gitignored`. Fix that warning before a key exists.
The Step 1 output for case A was inert and intentionally returned before printing the
`.env` finding, so check the path directly in every case:

```bash
git check-ignore -q .env && echo "safe" || echo "NOT IGNORED — fix .gitignore first"
```

If it prints `NOT IGNORED`, add `.env` to `.gitignore` and commit that **before** the
key exists on disk. This ordering is the point: it is what stops a key from being
committed.

Then have the user create a personal API key in Linear under
[**Settings > Account > Security & Access**](https://linear.app/docs/api-and-webhooks#api-keys).
Full access works; for a restricted key, enable **Read**, **Write**, **Create issues**,
and **Create comments**, and include the configured team.
If Linear does not offer personal key creation, a workspace admin may need to enable
**Settings > Administration > API > Member API keys**.

Do not ask the user to paste or send the raw key in chat.
Ask them to enter it locally through their shell, secret manager, or project environment
settings. A local gitignored `.env` at the repository root may contain:

```
LINEAR_API_KEY=lin_api_...
```

Rules that are not negotiable:

- **Never** ask the user to paste the raw key into chat or a command you will echo.
- **Never** echo the key, print it, paste it into a commit message or PR body, or put it
  anywhere tracked by git.
- **Never** write it into `.tbd/config.yml`—that file is committed.
- If a key was ever committed, say so plainly and tell the user to rotate it in Linear.
  Removing the commit is not enough.

tbd reads `LINEAR_API_KEY` from the process environment first, then from `.env`. An
exported environment variable is equally fine and needs no file.

## Step 4: Verify

```bash
tbd integration status   # Now with the network check
```

Every line should be `✓`, including `reachable`. If `reachable` fails, the key is wrong,
revoked, or lacks access to that team—not a tbd problem.
Have the user re-check the key and the team key.

Report the result to the user in plain terms: configured or not, which credential source
is in use (the masked form `status` prints, never the key itself), and which team and
project.

## Step 5: The first sync

**Which command depends on the case, and getting this wrong matters.**

**Case C (already set up):** stop after verification unless the user also asked to sync.
If they did, use the case B preview and full-sync sequence below.
Do not create a new key or rewrite working configuration.

**Case B (joining a configured repo that already syncs):** the links between beads and
Linear issues are stored in the beads themselves and arrived with your clone.
Run a full sync, and preview it first:

```bash
tbd --dry-run integration sync   # Preview: reconciles nothing, writes nothing
tbd sync                         # Pulls team bead state, reconciles Linear, then pushes
```

Show the preview to the user before the first write if it is not empty.
Do **not** run `integration sync --push` as a joiner.
The outbound-only path projects local bead values over the tracker without a three-way
reconcile, so it can overwrite a teammate’s Linear-side edit that a full `sync` would
have detected and reported as a conflict.
Plain `tbd sync` first pulls the current issue state from the team’s sync branch, runs
the full tracker reconciliation in place, and then publishes the resulting bead state.

If the shared config deliberately sets `integrations.sync_on_tbd_sync: false`, preserve
that team choice. In that exceptional case, run `tbd sync` first to pull the latest bead
state, preview and run `tbd integration sync` explicitly, then run `tbd sync` again to
publish the reconciled state.
Do not silently remove the override.

**Case A (first repository setup):** nothing is linked yet, so stage the initial
projection rather than creating dozens of issues in one shot:

```bash
tbd --dry-run integration sync --push              # Every bead id it would touch
tbd integration sync --push --type epic --limit 5  # A handful first
```

Have the user look at those five in Linear.
When they are happy with how it reads, widen, then switch to full sync for good:

```bash
tbd integration sync --push   # The rest of the policy's outbound set
tbd sync                      # Pull, reconcile all enabled surfaces, and push from now on
```

Runs above **20 creates** or **40 updates** refuse without `--yes`. That guard is there
because a mis-set selector turns “a couple of epics” into “every bead in the repo”.
If you hit it, re-read the dry run before adding `--yes`.

After the first sync, plain `tbd sync` includes enabled trackers automatically, so a
session-end `tbd sync` keeps Linear current with no extra command.

## What to tell the user when you are done

- Which case it was, and what you changed (config, `.env`, or nothing).
- That the config is committed and shared, but their key is personal and stays local.
- That `tbd sync` now covers Linear too.
- For case A: that `.tbd/config.yml` needs committing so teammates inherit it.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `LINEAR_API_KEY not found` | No key in env or `.env` | Step 3 |
| `.env: present and NOT gitignored` | Key is one `git add` from being committed | Add `.env` to `.gitignore` now; rotate the key if it was ever committed |
| `reachable` fails with a valid-looking key | Key revoked, missing a required permission, or no access to that team | Re-issue under Settings > Account > Security & Access; confirm permissions and `team_key` |
| Integration block vanished from `config.yml` | `tbd setup` was run by a tbd older than this feature | `git checkout .tbd/config.yml`, then upgrade tbd |
| Sync says `nothing to do` but Linear looks stale | The policy does not select those beads | Check `policy.outbound` against what the user expects; `--dry-run integration sync --push` lists the selected set |
| A bead reports malformed managed-block markers | A human edited inside the `⟦tbd⟧` … `⟦/tbd⟧` region in Linear | Repair the region in Linear (one `⟦tbd⟧` and one `⟦/tbd⟧`, in that order) or delete it entirely; the next sync rewrites it |

Full reference: the External Tracker Integrations section of `tbd docs`.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
