/**
 * `tbd docs fork` / `unfork` / `status` — the forkable-docs command handlers.
 *
 * These are added as subcommands of `tbd docs`. Resolution uses the gitignored
 * cache (the pristine upstream) so forking copies upstream content into the visible
 * fork dir; serving precedence (fork dir shadows cache) is handled by the lookup
 * paths in paths.ts.
 */

import type { Command } from 'commander';
import { join, relative, sep } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit } from '../lib/errors.js';
import { CLIError } from '../lib/errors.js';
import { VERSION } from '../lib/version.js';
import { readConfig } from '../../file/config.js';
import { DocCache } from '../../file/doc-cache.js';
import {
  CACHE_GUIDELINES_PATHS,
  CACHE_SHORTCUT_PATHS,
  CACHE_TEMPLATE_PATHS,
  FORK_DIR,
  TBD_DOCS_DIR,
} from '../../lib/paths.js';
import {
  type ForkEntry,
  type ForkKind,
  readForkManifest,
  writeForkManifest,
} from '../../file/fork-manifest.js';
import { forkDoc, unforkDoc, forkStatusFor, ForkConflictError } from '../../file/doc-fork.js';
import { createDocMap, type DocMapEntry } from '../../docmap/index.js';

/** Kinds that can be resolved from the cache and forked today. */
const RESOLVABLE_KINDS: ForkKind[] = ['guideline', 'shortcut', 'template'];

const KIND_CACHE_PATHS: Record<string, string[]> = {
  guideline: CACHE_GUIDELINES_PATHS,
  shortcut: CACHE_SHORTCUT_PATHS,
  template: CACHE_TEMPLATE_PATHS,
};

interface ResolvedDoc {
  kind: ForkKind;
  name: string;
  source: string;
  content: string;
}

/** Build a cache over a kind's cache-only paths (pristine upstream). */
async function buildKindCache(kind: ForkKind, tbdRoot: string): Promise<DocCache> {
  const cache = new DocCache(KIND_CACHE_PATHS[kind] ?? [], tbdRoot);
  await cache.load({ quiet: true });
  return cache;
}

/** Derive the provenance docref for a cached doc from config, defaulting to internal:. */
function sourceDocRef(
  tbdRoot: string,
  files: Record<string, string> | undefined,
  docPath: string,
): string {
  const cacheRoot = join(tbdRoot, TBD_DOCS_DIR);
  const rel = relative(cacheRoot, docPath).split(sep).join('/');
  return files?.[rel] ?? `internal:${rel}`;
}

interface ForkOptions {
  kind?: string;
  all?: boolean;
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

class DocsForkHandler extends BaseCommand {
  async run(names: string[], options: ForkOptions): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      const config = await readConfig(tbdRoot);
      const files = config.docs_cache?.files;

      const targets = await this.resolveTargets(tbdRoot, files, names, options);
      if (targets.length === 0) {
        throw new CLIError(
          'No matching docs to fork. Run `tbd docs status` or `tbd guidelines --list`.',
        );
      }

      if (options.dryRun) {
        this.output.dryRun(`Would fork ${targets.length} doc(s) into ${FORK_DIR}/`, {
          docs: targets.map((t) => `${t.kind}/${t.name}`),
        });
        if (!this.ctx.json) {
          for (const t of targets) {
            console.log(`  ${t.kind.padEnd(11)} ${t.name}`);
          }
          console.log('No files written. Re-run without --dry-run to apply.');
        }
        return;
      }

      let manifest = await readForkManifest(tbdRoot);
      const forked: string[] = [];
      for (const t of targets) {
        const result = await forkDoc({
          tbdRoot,
          forkDir: FORK_DIR,
          manifest,
          kind: t.kind,
          name: t.name,
          source: t.source,
          content: t.content,
          tbdVersion: VERSION,
          force: options.force,
        });
        manifest = result.manifest;
        forked.push(result.relPath);
        if (!this.ctx.json) {
          this.output.success(`Forked ${t.name} → ${result.relPath}`);
        }
      }
      await writeForkManifest(tbdRoot, manifest);

      if (this.ctx.json) {
        this.output.data({ forked });
      } else {
        console.log('');
        console.log('Edit in place — tbd now serves your copy wherever it served upstream.');
      }
    }, 'Failed to fork');
  }

  private async resolveTargets(
    tbdRoot: string,
    files: Record<string, string> | undefined,
    names: string[],
    options: ForkOptions,
  ): Promise<ResolvedDoc[]> {
    const kinds = options.kind ? [options.kind as ForkKind] : RESOLVABLE_KINDS;

    if (options.all) {
      const targets: ResolvedDoc[] = [];
      for (const kind of kinds) {
        const cache = await buildKindCache(kind, tbdRoot);
        for (const doc of cache.list()) {
          // Skip tbd-internal system shortcuts (skill-baseline etc.).
          if (kind === 'shortcut' && doc.sourceDir.endsWith('system')) continue;
          targets.push({
            kind,
            name: doc.name,
            source: sourceDocRef(tbdRoot, files, doc.path),
            content: doc.content,
          });
        }
      }
      return targets;
    }

    const caches = new Map<ForkKind, DocCache>();
    for (const kind of kinds) {
      caches.set(kind, await buildKindCache(kind, tbdRoot));
    }

    const targets: ResolvedDoc[] = [];
    for (const name of names) {
      const matches: ResolvedDoc[] = [];
      for (const kind of kinds) {
        const hit = caches.get(kind)!.get(name);
        if (hit) {
          matches.push({
            kind,
            name: hit.doc.name,
            source: sourceDocRef(tbdRoot, files, hit.doc.path),
            content: hit.doc.content,
          });
        }
      }
      if (matches.length === 0) {
        throw new CLIError(
          `No doc found named "${name}". Run \`tbd guidelines --list\` to see names.`,
        );
      }
      if (matches.length > 1) {
        const kindList = matches.map((m) => m.kind).join(', ');
        throw new CLIError(
          `"${name}" exists in multiple kinds (${kindList}). Use --kind to disambiguate.`,
        );
      }
      targets.push(matches[0]!);
    }
    return targets;
  }
}

interface UnforkOptions {
  kind?: string;
  all?: boolean;
  force?: boolean;
  json?: boolean;
}

class DocsUnforkHandler extends BaseCommand {
  async run(names: string[], options: UnforkOptions): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      let manifest = await readForkManifest(tbdRoot);

      const targetNames = options.all ? manifest.forks.map((f) => f.name) : names;
      if (targetNames.length === 0) {
        throw new CLIError('Specify a doc name to unfork, or use --all.');
      }

      const removed: string[] = [];
      for (const name of targetNames) {
        try {
          const result = await unforkDoc({
            tbdRoot,
            forkDir: FORK_DIR,
            manifest,
            name,
            kind: options.kind as ForkKind | undefined,
            force: options.force,
          });
          manifest = result.manifest;
          removed.push(name);
          if (!this.ctx.json) {
            this.output.success(`Unforked ${name} — served from upstream again.`);
          }
        } catch (err) {
          if (err instanceof ForkConflictError && err.code === 'customized') {
            throw new CLIError(
              `${name} has local customizations. Review with \`tbd docs status\`, then ` +
                `re-run with --force to discard them and fall back to upstream.`,
            );
          }
          throw err;
        }
      }
      await writeForkManifest(tbdRoot, manifest);
      if (this.ctx.json) {
        this.output.data({ unforked: removed });
      }
    }, 'Failed to unfork');
  }
}

/** Compose the display label for a doc's state, combining customized + stale. */
function stateLabel(state: string, stale: boolean): string {
  if ((state === 'customized' || state === 'orphaned' || state === 'conflicted') && stale) {
    return `${state}, stale`;
  }
  return state;
}

class DocsStatusHandler extends BaseCommand {
  async run(options: { json?: boolean }): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      const manifest = await readForkManifest(tbdRoot);
      const colors = this.output.getColors();

      // Resolve upstream (cache) content per entry for staleness.
      const caches = new Map<ForkKind, DocCache>();
      const rows: {
        entry: ForkEntry;
        label: string;
        customized: boolean;
        stale: boolean;
        conflicted: boolean;
      }[] = [];

      for (const entry of manifest.forks) {
        const kind = entry.kind as ForkKind;
        if (!caches.has(kind)) caches.set(kind, await buildKindCache(kind, tbdRoot));
        const cacheHit = caches.get(kind)!.get(entry.name);
        const status = await forkStatusFor(tbdRoot, FORK_DIR, entry, cacheHit?.doc.content ?? null);
        rows.push({
          entry,
          label: stateLabel(status.state, status.stale),
          customized: status.customized,
          stale: status.stale,
          conflicted: status.conflicted,
        });
      }

      if (this.ctx.json) {
        const docs: DocMapEntry[] = rows.map((r) => ({
          name: r.entry.name,
          type: r.entry.kind,
          path: r.entry.path,
          source: r.entry.source,
          state: r.label,
          stale: r.stale,
        }));
        this.output.data(createDocMap(docs, { name: 'tbd-forks' }));
        return;
      }

      if (rows.length === 0) {
        console.log('No docs forked into the repo.');
        console.log(
          `Make some visible: ${colors.bold('tbd docs fork --category=general')} (and your languages)`,
        );
        return;
      }

      const nameW = Math.max(4, ...rows.map((r) => r.entry.name.length));
      const kindW = Math.max(4, ...rows.map((r) => r.entry.kind.length));
      const stateW = Math.max(5, ...rows.map((r) => r.label.length));
      const header = `${'NAME'.padEnd(nameW)}  ${'KIND'.padEnd(kindW)}  ${'STATE'.padEnd(stateW)}  SOURCE`;
      console.log(colors.dim(header));
      for (const r of rows) {
        const line = `${r.entry.name.padEnd(nameW)}  ${r.entry.kind.padEnd(kindW)}  ${r.label.padEnd(stateW)}  ${r.entry.source}`;
        console.log(line);
      }

      const customizedCount = rows.filter((r) => r.customized).length;
      const staleCount = rows.filter((r) => r.stale).length;
      const conflictCount = rows.filter((r) => r.conflicted).length;
      const parts = [`${customizedCount} customized`];
      if (staleCount > 0) parts.push(`${staleCount} with upstream updates — run 'tbd docs update'`);
      if (conflictCount > 0) parts.push(`${conflictCount} conflict pending`);
      console.log('');
      console.log(`${rows.length} forked: ${parts.join(', ')}`);
    }, 'Failed to read docs status');
  }
}

/**
 * Merge a subcommand's local options with globals/ancestors. The parent `docs`
 * command also declares `--all` (its manual-viewer listing), so reading the local
 * option alone is unreliable; fall back to the merged view.
 */
function mergedForkOptions(local: ForkOptions, command: Command): ForkOptions {
  const g = command.optsWithGlobals();
  return {
    all: local.all ?? g.all,
    kind: local.kind ?? g.kind,
    force: local.force ?? g.force,
    dryRun: local.dryRun ?? g.dryRun,
    json: g.json,
  };
}

/** Register fork/unfork/status subcommands onto the `docs` command. */
export function registerForkSubcommands(docs: Command): void {
  docs
    .command('fork')
    .description(
      'Fork managed docs into the repo (default docs/tbd/) so they are visible and editable',
    )
    .argument('[names...]', 'doc name(s) to fork')
    .option('--kind <kind>', 'restrict to a kind (guideline|shortcut|template)')
    .option('--all', 'fork all available docs')
    .option('--force', 'overwrite an existing non-fork file')
    .action(async (names: string[], options: ForkOptions, command: Command) => {
      await new DocsForkHandler(command).run(names, mergedForkOptions(options, command));
    });

  docs
    .command('unfork')
    .description(
      'Remove a fork and fall back to upstream (refuses to discard edits without --force)',
    )
    .argument('[names...]', 'doc name(s) to unfork')
    .option('--kind <kind>', 'restrict to a kind')
    .option('--all', 'unfork all forked docs')
    .option('--force', 'discard local customizations')
    .action(async (names: string[], options: UnforkOptions, command: Command) => {
      const m = mergedForkOptions(options, command);
      await new DocsUnforkHandler(command).run(names, {
        all: m.all,
        kind: m.kind,
        force: m.force,
        json: m.json,
      });
    });

  docs
    .command('status')
    .description('Show forked docs and their states')
    .action(async (_options: { json?: boolean }, command: Command) => {
      await new DocsStatusHandler(command).run({ json: command.optsWithGlobals().json === true });
    });
}
