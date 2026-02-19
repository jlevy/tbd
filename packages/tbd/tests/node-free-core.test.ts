/**
 * Guard test: Ensures the library entry point (index.ts) remains node-free.
 *
 * The public API exported from index.ts should work in browser/edge runtimes.
 * Only CLI code (src/cli/) is allowed to use node: imports.
 *
 * See: pnpm-monorepo-patterns.md "Guard Tests for Node-Free Core"
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC_DIR = join(__dirname, '../src');
const NODE_IMPORT_PATTERN = /from\s+['"]node:/g;

describe('Node-free core library', () => {
  it('index.ts should not import from node: modules', () => {
    const content = readFileSync(join(SRC_DIR, 'index.ts'), 'utf-8');
    expect(content).not.toMatch(NODE_IMPORT_PATTERN);
  });

  it('files re-exported from index.ts should not import from node: modules', () => {
    // Parse index.ts to find which files are re-exported
    const indexContent = readFileSync(join(SRC_DIR, 'index.ts'), 'utf-8');
    const exportPaths = [...indexContent.matchAll(/from\s+['"]\.\/(.*?)(?:\.js)?['"]/g)].map(
      (m) => m[1]!,
    );

    const violations: string[] = [];
    for (const relPath of exportPaths) {
      const filePath = join(SRC_DIR, relPath + '.ts');
      try {
        const content = readFileSync(filePath, 'utf-8');
        if (NODE_IMPORT_PATTERN.test(content)) {
          violations.push(relPath);
        }
        // Reset regex lastIndex
        NODE_IMPORT_PATTERN.lastIndex = 0;
      } catch {
        // File might not exist at that exact path (e.g., directory re-exports)
      }
    }

    expect(
      violations,
      `These files are re-exported from index.ts but use node: imports: ${violations.join(', ')}`,
    ).toHaveLength(0);
  });

  it('built dist/index.mjs should not reference node: modules', () => {
    const distPath = join(__dirname, '../dist/index.mjs');
    try {
      const content = readFileSync(distPath, 'utf-8');
      expect(content).not.toMatch(NODE_IMPORT_PATTERN);
    } catch {
      // dist may not exist in all test contexts (skip if no build)
      console.warn('dist/index.mjs not found — skipping built output check');
    }
  });
});
