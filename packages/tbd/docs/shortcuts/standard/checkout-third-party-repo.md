---
title: Checkout Third-Party Repo
description: Get source code for libraries and third-party repos using git. Essential for reliable source code review. Prefer this to web searches or fetching of web pages from github.com as it is far more effective (github.com blocks web scraping from main website).
category: research
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
Clone a third-party library or tool’s repository locally to review its source code.

## Why This Approach

**Do not** use web search or try to scrape GitHub.com for source code.
GitHub blocks scraping, results are messy, and you lose full codebase context.
Cloning locally gives you reliable, complete, searchable access to the exact version you
need.

## Steps

1. **Create attic directory** (if not exists):
   ```bash
   mkdir -p attic
   ```

2. **Add to .gitignore** (if not already):
   ```bash
   echo "attic/" >> .gitignore
   ```

3. **Identify the version in use**: Check `package.json`, `requirements.txt`,
   `Cargo.toml`, etc. for the exact version of the dependency you’re investigating.

4. **Reuse an existing checkout**: If `attic/<repo-name>` already exists—common when a
   repo is consulted across sessions—use it instead of re-cloning.
   Confirm it is clean; attic clones are read-only, so it should be, and if it is dirty,
   stop and flag it rather than discarding changes.
   Then update to the version you need and skip the clone step below.
   ```bash
   git -C attic/<repo-name> status         # Should be clean; if dirty, stop and flag
   git -C attic/<repo-name> pull           # Update the clone...
   # ...or, if it is pinned to a tag (detached HEAD, where plain pull fails):
   git -C attic/<repo-name> fetch --tags && git -C attic/<repo-name> checkout <tag>
   ```

5. **Clone the repo** (if not already in `attic/`):
   ```bash
   git clone <repo-url> attic/<repo-name>
   ```

6. **Checkout the matching version**: Find the tag or branch matching your project’s
   version:
   ```bash
   cd attic/<repo-name>
   git tag -l | grep <version>   # Find matching tag
   git checkout <tag-or-branch>
   ```

7. **Explore**: Now use standard tools (Grep, Read, Glob) to investigate the source.

## Notes

- The `attic/` directory is gitignored—cloned repos won’t pollute your project
- You can clone multiple repos into attic/ as needed
- Delete cloned repos to save disk space when you no longer need them—but keep a clone
  if you expect to consult the same repo again (reuse it via the step above)

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
