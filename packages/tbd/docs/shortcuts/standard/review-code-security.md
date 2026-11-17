---
title: Review Code (Security)
description: Dedicated security review pass (kind=security) for a change that touches authentication or authorization, secrets, untrusted input, network exposure, sandboxing and permissions, file-system mutation, or dependency and build-time execution; runs on top of review-code
category: review
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut performs a **dedicated security review**: a separate pass over a change
that is sensitive in security, by a reviewer thinking only about how the change can be
abused. It is one of the dedicated reviews in Review Coverage and Rounds in
`tbd shortcut pr-review-workflows`: its own published review, with its own letter and
`kind=security`, addressed like any other review.

It runs on top of `tbd shortcut review-code`, the review engine.
The engine’s rules apply unchanged and are not restated here: the scope options, the
pinned head checked out in the working tree for PR scope, running the tests, keeping
scratch files out of the repository, and reporting every finding with its severity.
The senior engineering review owns design, style, and general correctness; this pass
does not repeat that work.

## When It Applies

Run this review when `tbd shortcut review-github-pr` or the coordinator decides the PR
is sensitive in security, or when the user asks for a security review.
A change is sensitive in security when it touches any of:

- **Authentication and authorization:** who a caller is, or what a caller may do
- **Secrets:** reading, storing, forwarding, or printing credentials and tokens
- **Untrusted input:** parsing or acting on data someone other than the user controls
- **Network exposure:** a server that listens, or requests sent with credentials
- **Sandboxing and permissions:** grants, policies, subprocesses, and what they inherit
- **File-system mutation:** writes, deletes, renames, or traversal under any root
- **Dependency and build-time execution:** dependencies, install scripts, CI workflows

Judge by what the change can reach, not by which files it edits: a new call to an
existing deletion helper is file-system mutation; a comment change in an auth module is
not. When it is unclear whether the area applies, ask the user.

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Establish the scope and diff** as `tbd shortcut review-code` does (determine scope,
   get the diff, identify files and languages).

2. **Load the guidelines:**

   - Run `tbd guidelines code-review-rules` (severity, risk ordering, and the quick-scan
     rows on destructive scope, authorization, and dependencies)
   - Run `tbd guidelines error-handling-rules` (a check that fails open violates
     Principle 2: success must be proven, not assumed)
   - Add the topic guidelines the change touches:
     - File-system mutation, paths, or traversal: `filesystem-rules` (symlink and root
       boundaries, destructive scope, revalidation before mutation)
     - Dependencies, install, build, or CI: `supply-chain-hardening` and
       `ci-and-gates-rules` (least-privilege workflow authority)
     - Publishing or release artifacts: `release-engineering-rules`
     - Grants, policies, or agent permissions: `agent-policy-grants`
   - Add the language rules that carry security content: `rust-code-review-rules`
     (unsafe and FFI) for Rust, `typescript-rules` (file operations) for TypeScript,
     `python-rules` for Python.
     The senior review owns the lint and format floors.

   The topic guidelines own the rules for each surface; the checklist below is the
   security substance of this pass.

3. **Map the attack surface before reading line by line.** List every input the changed
   code reads that someone other than the user controls (files in a cloned repository,
   network responses, issue and PR bodies, comments, fetched pages, archive entries, git
   refs and paths, and arguments when the invoker is untrusted), and every privileged
   effect it has (credentials read or forwarded, files written or deleted, subprocesses
   spawned, sockets bound, outbound requests, policy checks).
   A finding is a path from an input to an effect without an adequate check between
   them.

4. **Work through the checklist** for each area the change touches.
   Each question names the failure it catches; severity follows from reachability and
   impact, as `code-review-rules` defines, not from the match.

   **Authentication and authorization**
   - Is the decision made on the value that is used, after resolution and normalization,
     and immediately before the privileged action?
     A check on the pre-resolution path, name, or ID can be changed between check and
     use.
   - Does every new command, route, or entry point check authorization itself, or assume
     a caller did? A lower-level entry point added for reuse often bypasses the check on
     the public one.
   - What happens when the check cannot run (missing config, network error, exception)?
     It must fail closed; a `catch` that continues, or “allowed” as the default when no
     policy is recorded, is a bypass.
   - Are identities compared by stable identifier rather than display name or email, and
     at the right scope (repository permission, not organization membership)?

   **Secrets**
   - Trace each credential from where it is read to every place it can land: a child’s
     environment, a subprocess argument (visible in the process table), a log line or
     error message, a URL or query string, a committed file, a test fixture.
     Each landing outside the intended boundary is a finding.
   - Is a stored credential written with a restrictive mode to a gitignored, unsynced
     location, and does the write path preserve that mode (an atomic-rename helper can
     reset it)?
   - Does redaction match specific token formats?
     Then a token in a new format leaks.

   **Untrusted input**
   - For each untrusted input, where is it validated, and is that validation on every
     path that uses it, including defaults, error paths, and retries?
   - Is untrusted data concatenated into a shell command, a `git` or `gh` command line,
     a regex, SQL, a file path, a URL, a YAML, JSON, or HTML document, or Markdown that
     an agent will read? Subprocesses take argument arrays, not strings; a value that can
     start with `-` goes after `--`, or `git` and `gh` treat it as an option.
   - Are parsers bounded: size and depth limits, only the safe YAML schema (no custom
     tags), `__proto__` and `constructor` keys never merged into objects, no regex with
     nested quantifiers over attacker-controlled text, decompression limited?
   - Prompt injection: does the change put text from an issue, PR, comment, fetched
     page, or repository file where an agent reads it as instructions rather than data?

   **Network exposure**
   - What does a server bind to?
     Loopback unless the user asked for more, and a loopback server still needs an
     `Origin` or `Host` check, since any page open in the browser can send it requests.
   - Do outbound requests go only to hosts the user or configuration named, with TLS
     verification on, credentials attached only to the intended host and dropped on a
     cross-host redirect, and timeouts and response size limits?
     A user-supplied URL fetched from a privileged position is server-side request
     forgery.

   **Sandboxing and permissions**
   - Which grant, policy, or permission gates the new action, and does this code path
     check it? Is the default, when nothing is recorded, the restrictive one?
   - What does a spawned process inherit: environment (including secrets), working
     directory, stdin? Is it started with `shell: true`, or by a bare executable name
     that a repository can shadow through `node_modules/.bin`, a local script, or
     `PATH`?
   - Does the change run code from a repository that may be untrusted: git hooks and
     `core.hooksPath`, install lifecycle scripts, config-loaded plugins, build files?
     Running `pnpm install` or `git` commands in a cloned third-party repository
     executes that repository’s code.

   **File-system mutation**
   - Is the containment check on the resolved path, after symlinks and `..`, and is it
     repeated immediately before the mutation?
   - What is the widest path a delete, overwrite, or recursive operation can reach, and
     which input decides it?
   - Are temporary files created exclusively in a private directory, rather than at a
     predictable name in a shared temp directory where a symlink can be planted first?
     Do files holding sensitive data get their restrictive mode at creation?
   - When extracting archives or copying trees, are entries with absolute paths, `..`,
     or symlinks rejected or contained?

   **Dependency and build-time execution**
   - Does the diff follow `supply-chain-hardening`: the 14-day cool-off, lockfile
     consistent with the manifest, install scripts still disabled, no new lifecycle
     script in the project’s own manifest that runs on consumers’ machines, no mutable
     reference (a git branch, a `latest` tag, an action pinned by tag rather than SHA)?
   - Does a build or CI step now fetch and execute something: a download without a
     pinned checksum, a plugin resolved at build time, `curl | sh`?
   - In workflows: a least-privilege `permissions:` block, no `pull_request_target` that
     checks out and runs the PR head, and no `${{ github.event.* }}` text interpolated
     into `run:`.

   **Weakened defenses.** Did the change remove a validation, widen an allowlist, add a
   bypass flag, or make an existing check unable to fail?
   These look like small green diffs; compare the checks at the head with those at the
   base.

5. **Confirm with reproductions and tests.** Run the test suite as `review-code` does.
   For each suspected path, write a reproduction in the session scratch directory: a
   filename beginning with `-`, a symlink out of the root, a `__proto__` key, a request
   with a foreign `Origin` header.
   A finding you could not reproduce says so and names the check that would settle it.

6. **Compile the review** in the artifact format `review-code` specifies, with
   `kind=security` in the header and marker.
   Add a **Surface reviewed** section listing the inputs and effects traced in step 3
   and which were confirmed safe, so the next reviewer does not repeat the work.
   Keep security findings first; a finding outside this area is still reported, marked
   as outside the security scope, and a finding already open on the PR is referenced by
   its ID rather than duplicated.
   Then determine the next action as `review-code` does: `review-github-pr` publishes
   the review, and `address-pr-review` addresses it.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
