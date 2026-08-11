---
title: General Coding Rules
description: Rules for constants, magic numbers, cryptographic hash checks, and general coding practices
author: Joshua Levy (github.com/jlevy) with LLM assistance
category: general
---
# General Coding Rules

## Constants and Magic Numbers

- NEVER hardcode numeric values directly in code.
  Always use descriptive named constants.

- All numeric constants must have clear, descriptive names and docstrings explaining
  their purpose.

- Constants should be defined in appropriate settings files (e.g., `settings.ts`) for
  easy maintenance. Do not restate a constant’s value in a comment; see
  `general-comment-rules`.

  ```typescript
  // BAD: Hardcoded numbers
  const tradeCount = Math.min(trades.length, 50);

  // GOOD: Named constants with documentation
  /**
   * Execution statistics counting limits for dialog tab display.
   * These control the "X+" display thresholds and query performance.
   */
  export const EXECUTION_STATS_LIMITS = {
    /** Maximum trades to count before showing "50+" */
    maxTradeCount: 50,
    /** Maximum conversation turns to count before showing "100+" */
    maxConversationTurnCount: 100,
  } as const;

  // Usage:
  const tradeCount = Math.min(trades.length, EXECUTION_STATS_LIMITS.maxTradeCount);
  ```

## Cryptographic Hash Checks

A cryptographic hash check (SHA-256 or similar) is a tool for verifying data across a
trust boundary. A common agent antipattern is adding hash checks as process ceremony:
they impose real costs in code, complexity, and failure modes while adding no assurance.
NEVER add a hash check “for good luck”; if you cannot state what failure or tampering
the check catches, remove it.

- **The test**: A hash comparison adds assurance only when the two values are computed
  independently and the data passes outside your control in between—through another
  party, an untrusted channel, or long-lived storage.
  If the same trusted process computes both sides moments apart, the check can only
  catch bugs in the check itself.

- **Appropriate uses**:

  - Verifying untrusted external data against a fixed, known, trusted value, such as
    checking a downloaded artifact against a checksum pinned in your repo (see
    `supply-chain-hardening`).

  - A hash table or content-addressed store that must be tamper-resistant, where
    collisions must be infeasible even for adversarial inputs.

  - Integrity manifests for large numbers of files written to disk and persisted for
    long periods, when external verification is genuinely needed later.

- **Inappropriate uses (ceremony)**:

  - A trusted application saves a file, immediately reads it back, and hashes both sides
    of its own round trip.
    The comparison verifies nothing.
    If corruption or truncation on disk is a real operational risk, address it
    operationally instead: write output files atomically (write to a temp file, then
    rename).

  - Content-hashing a reference to an external resource, such as a file in a GitHub
    repository, when an exact release tag or Git revision identifies it more clearly and
    maintainably.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
