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

Cryptographic hashes (SHA-256 and similar) verify data across a trust boundary.
A common agent antipattern is hash checking as process ceremony: real costs in code,
complexity, and failure modes, no benefit.
NEVER add a hash check “for good luck”; if you cannot name the failure or tampering it
catches, remove it.

- **The test**: A comparison adds assurance only if the two hashes are computed
  independently, with the data outside your control in between (another party, an
  untrusted channel, long-lived storage).
  When one trusted process computes both sides moments apart, the check can only catch
  bugs in the check itself.

- **Appropriate**:

  - Verifying untrusted external data against a fixed, known, trusted value, such as a
    downloaded artifact against a checksum pinned in your repo (see
    `supply-chain-hardening`).

  - A hash table or content-addressed store that must resist adversarial collisions (an
    ordinary hash table needs only a fast non-cryptographic hash).

  - Integrity manifests for many files persisted long-term, when external verification
    is genuinely needed later.

- **Ceremony**:

  - Hashing both sides of your own save-then-read-back round trip: the comparison
    verifies nothing. If disk corruption or truncation is a real risk, write files
    atomically (temp file, then rename) instead of adding checks.

  - Content-hashing a reference to an external resource, such as a file in a GitHub
    repository, when an exact release or Git revision is the clearer, maintainable pin.

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
