/**
 * `tbd docs fork` / `unfork` / `status` — the forkable-docs command handlers.
 *
 * These are added as subcommands of `tbd docs`. Resolution uses the gitignored
 * cache (the pristine upstream) so forking copies upstream content into the visible
 * fork dir; serving precedence (fork dir shadows cache) is handled by the lookup
 * paths in paths.ts.
 */

import type { Command } from 'commander';
import { dirname, join, relative, sep } from 'node:path';
import { mkdir } from 'node:fs/promises';

import { writeFile } from 'atomically';

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
  DEFAULT_GUIDELINES_PATHS,
  DEFAULT_SHORTCUT_PATHS,
  DEFAULT_TEMPLATE_PATHS,
  FORK_DIR,
  TBD_DOCS_DIR,
} from '../../lib/paths.js';
import { formatDocSize } from '../../lib/format-utils.js';
import {
  type ForkEntry,
  type ForkKind,
  findFork,
  hashContent,
  hasUnresolvedConflict,
  readForkManifest,
  writeForkManifest,
  writeBaseContent,
  upsertFork,
  withForkManifestLock,
} from '../../file/fork-manifest.js';
import {
  forkDoc,
  unforkDoc,
  forkStatusFor,
  forkFilePath,
  readForkFile,
  readForkBase,
  listLocalForkFiles,
  regenerateForkDirReadme,
  ForkConflictError,
  KIND_DIR,
} from '../../file/doc-fork.js';
import { updateOne, diffContents, type UpdateStrategy } from '../../file/fork-update.js';
import { createDocMap, type DocMapEntry } from '../../docmap/index.js';

/** Kinds that can be resolved from the cache and forked today. */
const RESOLVABLE_KINDS: ForkKind[] = ['guideline', 'shortcut', 'template'];

/**
 * Validate a user-supplied --kind value. Without this, an unknown kind silently
 * produces an empty cache and misleading "no docs" output.
 */
function parseKindOption(kind: string | undefined): ForkKind | undefined {
  if (kind === undefined) return undefined;
  if (!(RESOLVABLE_KINDS as string[]).includes(kind)) {
    throw new CLIError(`Unknown kind "${kind}". Valid kinds: ${RESOLVABLE_KINDS.join(', ')}.`);
  }
  return kind as ForkKind;
}

// 'reference' joins with Phase 5 (references/ cache dir); until then a manifest
// entry of that kind resolves as orphaned by design, and parseKindOption keeps
// the CLI from creating one.
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

      const forked: string[] = [];
      await withForkManifestLock(tbdRoot, async () => {
        let manifest = await readForkManifest(tbdRoot);
        for (const t of targets) {
          let result;
          try {
            result = await forkDoc({
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
          } catch (err) {
            if (err instanceof ForkConflictError && err.code === 'overwrite') {
              throw new CLIError(
                `${err.message}. Refusing to overwrite it. Options:\n` +
                  `  tbd docs diff ${t.name}           # see how it differs\n` +
                  `  tbd docs fork ${t.name} --force   # overwrite with upstream`,
              );
            }
            throw err;
          }
          manifest = result.manifest;
          forked.push(result.relPath);
          if (!this.ctx.json) {
            this.output.success(`Forked ${t.name} → ${result.relPath}`);
          }
        }
        await writeForkManifest(tbdRoot, manifest);
        await regenerateForkDirReadme(tbdRoot, FORK_DIR, manifest);
      });

      if (this.ctx.json) {
        this.output.data({ forked });
      } else {
        const colors = this.output.getColors();
        console.log(colors.dim(`  Regenerated ${FORK_DIR}/README.md`));
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
    const parsedKind = parseKindOption(options.kind);
    const kinds = parsedKind ? [parsedKind] : RESOLVABLE_KINDS;

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
      const removed: string[] = [];
      await withForkManifestLock(tbdRoot, async () => {
        let manifest = await readForkManifest(tbdRoot);

        const targetNames = options.all ? manifest.forks.map((f) => f.name) : names;
        if (targetNames.length === 0) {
          throw new CLIError('Specify a doc name to unfork, or use --all.');
        }

        for (const name of targetNames) {
          try {
            const result = await unforkDoc({
              tbdRoot,
              forkDir: FORK_DIR,
              manifest,
              name,
              kind: parseKindOption(options.kind),
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
        await regenerateForkDirReadme(tbdRoot, FORK_DIR, manifest);
      });
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
      interface StatusRow {
        name: string;
        kind: string;
        label: string;
        path: string;
        source: string;
        customized: boolean;
        stale: boolean;
        conflicted: boolean;
        missing: boolean;
      }
      const rows: StatusRow[] = [];

      for (const entry of manifest.forks) {
        const kind = entry.kind;
        if (!caches.has(kind)) caches.set(kind, await buildKindCache(kind, tbdRoot));
        const cacheHit = caches.get(kind)!.get(entry.name);
        const status = await forkStatusFor(tbdRoot, FORK_DIR, entry, cacheHit?.doc.content ?? null);
        rows.push({
          name: entry.name,
          kind: entry.kind,
          label: stateLabel(status.state, status.stale),
          path: entry.path,
          source: entry.source,
          customized: status.customized,
          stale: status.stale,
          conflicted: status.conflicted,
          missing: status.state === 'missing',
        });
      }

      // Hand-authored fork-dir files with no manifest entry (state `local`).
      // These cover adds, the new half of a rename, and a deleted manifest.
      const locals = await listLocalForkFiles(tbdRoot, FORK_DIR, manifest);
      for (const l of locals) {
        rows.push({
          name: l.name,
          kind: l.kind,
          label: 'local',
          path: l.relPath,
          source: '—',
          customized: false,
          stale: false,
          conflicted: false,
          missing: false,
        });
      }
      rows.sort((a, b) => a.name.localeCompare(b.name));

      if (this.ctx.json) {
        const docs: DocMapEntry[] = rows.map((r) => ({
          name: r.name,
          type: r.kind,
          path: r.path,
          ...(r.source !== '—' ? { source: r.source } : {}),
          state: r.label,
          stale: r.stale,
        }));
        this.output.data(createDocMap(docs, { name: 'tbd-forks' }));
        return;
      }

      if (rows.length === 0) {
        console.log('No docs forked into the repo.');
        console.log(
          `Make some visible: ${colors.bold('tbd docs fork <name>')} or ${colors.bold('tbd docs fork --all')}`,
        );
        return;
      }

      const nameW = Math.max(4, ...rows.map((r) => r.name.length));
      const kindW = Math.max(4, ...rows.map((r) => r.kind.length));
      const stateW = Math.max(5, ...rows.map((r) => r.label.length));
      const header = `${'NAME'.padEnd(nameW)}  ${'KIND'.padEnd(kindW)}  ${'STATE'.padEnd(stateW)}  SOURCE`;
      console.log(colors.dim(header));
      for (const r of rows) {
        const line = `${r.name.padEnd(nameW)}  ${r.kind.padEnd(kindW)}  ${r.label.padEnd(stateW)}  ${r.source}`;
        console.log(r.label === 'local' ? colors.dim(line) : line);
      }

      const forkedRows = rows.filter((r) => r.label !== 'local');
      const customizedCount = forkedRows.filter((r) => r.customized).length;
      const staleCount = forkedRows.filter((r) => r.stale).length;
      const conflictCount = forkedRows.filter((r) => r.conflicted).length;
      const missingRows = forkedRows.filter((r) => r.missing);
      const parts = [`${customizedCount} customized`];
      if (staleCount > 0) parts.push(`${staleCount} with upstream updates — run 'tbd docs update'`);
      if (conflictCount > 0) parts.push(`${conflictCount} conflict pending`);
      if (locals.length > 0) parts.push(`${locals.length} local`);
      console.log('');
      console.log(`${forkedRows.length} forked: ${parts.join(', ')}`);

      if (missingRows.length > 0) {
        console.log('');
        console.log(`${missingRows.length} doc(s) missing (forked file deleted or renamed):`);
        for (const r of missingRows) {
          console.log(
            `  ${r.name}   restore with 'tbd docs fork ${r.name} --force', or finalize with 'tbd docs unfork ${r.name}'`,
          );
        }
      }
    }, 'Failed to read docs status');
  }
}

interface UpdateOptions {
  merge?: boolean;
  keepOurs?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

class DocsUpdateHandler extends BaseCommand {
  async run(names: string[], options: UpdateOptions): Promise<void> {
    await this.execute(async () => {
      if (options.merge && options.keepOurs) {
        throw new CLIError('--merge and --keep-ours are mutually exclusive.');
      }
      const strategy: UpdateStrategy = options.merge
        ? 'merge'
        : options.keepOurs
          ? 'keep-ours'
          : 'default';

      const tbdRoot = await requireInit();
      const applied: { entry: ForkEntry; message: string }[] = [];
      const decisions: string[] = [];
      const skipped: string[] = [];

      await withForkManifestLock(tbdRoot, async () => {
        let manifest = await readForkManifest(tbdRoot);
        if (names.length > 0) {
          const known = new Set(manifest.forks.map((f) => f.name));
          const unknown = names.filter((n) => !known.has(n));
          if (unknown.length > 0) {
            throw new CLIError(
              `Not forked: ${unknown.join(', ')}. Run \`tbd docs status\` to see forked docs.`,
            );
          }
        }
        const selected =
          names.length > 0 ? manifest.forks.filter((f) => names.includes(f.name)) : manifest.forks;

        const caches = new Map<ForkKind, DocCache>();
        const upstreamFor = async (entry: ForkEntry): Promise<string | null> => {
          const kind = entry.kind;
          if (!caches.has(kind)) caches.set(kind, await buildKindCache(kind, tbdRoot));
          return caches.get(kind)!.get(entry.name)?.doc.content ?? null;
        };

        for (const entry of selected) {
          const forkContent = await readForkFile(tbdRoot, FORK_DIR, entry);
          const result = await updateOne({
            entry,
            forkContent,
            baseContent: await readForkBase(tbdRoot, entry),
            upstreamContent: await upstreamFor(entry),
            strategy,
            runningVersion: VERSION,
          });

          const { newFileContent, newBaseContent } = result;
          if (newFileContent === undefined && newBaseContent === undefined) {
            // The conflicted flag auto-clears once markers are resolved (spec);
            // persist the clear so the committed manifest matches computed state.
            if (
              !options.dryRun &&
              entry.conflicted &&
              forkContent !== null &&
              !hasUnresolvedConflict(forkContent)
            ) {
              const cleared: ForkEntry = { ...entry };
              delete cleared.conflicted;
              manifest = upsertFork(manifest, cleared);
            }
            if (result.needsDecision) {
              decisions.push(result.message);
            } else if (result.action !== 'skip-not-stale') {
              // Conflicted / orphaned / missing / version-skewed: actionable but
              // not applied here — surface, never silently swallow.
              skipped.push(result.message);
            }
            continue;
          }

          if (!options.dryRun) {
            if (newFileContent !== undefined) {
              const abs = forkFilePath(tbdRoot, FORK_DIR, entry.kind, entry.name);
              await mkdir(dirname(abs), { recursive: true });
              await writeFile(abs, newFileContent);
            }
            const updated: ForkEntry = { ...entry };
            if (newBaseContent !== undefined) {
              await writeBaseContent(tbdRoot, entry.kind, entry.name, newBaseContent);
              updated.base_hash = hashContent(newBaseContent);
              // The base records its fork point's tbd version so older clients
              // can detect (and refuse) a downgrade — see the update guard.
              updated.tbd_version = VERSION;
            }
            if (result.setConflicted) {
              updated.conflicted = true;
            } else {
              delete updated.conflicted;
            }
            manifest = upsertFork(manifest, updated);
          }
          applied.push({ entry, message: result.message });
        }

        if (!options.dryRun) {
          await writeForkManifest(tbdRoot, manifest);
          await regenerateForkDirReadme(tbdRoot, FORK_DIR, manifest);
        }
      }); // end withForkManifestLock

      if (this.ctx.json) {
        this.output.data({
          dryRun: Boolean(options.dryRun),
          updated: applied.map((a) => a.entry.name),
          needsDecision: decisions,
          skipped,
        });
        return;
      }

      const colors = this.output.getColors();
      if (applied.length === 0 && decisions.length === 0 && skipped.length === 0) {
        console.log('All forked docs are up to date.');
        return;
      }
      if (applied.length > 0) {
        const verb = options.dryRun ? 'Would update' : 'Updated';
        console.log(`${verb} ${applied.length} forked doc(s):`);
        for (const a of applied) {
          console.log(`  ${colors.success('✓')} ${a.message}`);
        }
      }
      if (skipped.length > 0) {
        console.log('');
        console.log(`${skipped.length} doc(s) skipped:`);
        for (const msg of skipped) {
          console.log(`  ${colors.warn('⚠')} ${msg}`);
        }
      }
      if (decisions.length > 0) {
        console.log('');
        console.log(`${decisions.length} doc(s) need a decision:`);
        for (const msg of decisions) {
          console.log(`  ${colors.warn('⚠')} ${msg}`);
        }
        console.log('  re-run with one of:');
        console.log(
          '    tbd docs update <name> --merge      # combine, then resolve conflict markers',
        );
        console.log(
          '    tbd docs update <name> --keep-ours  # keep your version, advance the fork point',
        );
      }
    }, 'Failed to update forked docs');
  }
}

/** Serving lookup paths per kind (fork dir prepended, so forks are reflected). */
const KIND_SERVE_PATHS: Record<string, string[]> = {
  guideline: DEFAULT_GUIDELINES_PATHS,
  shortcut: DEFAULT_SHORTCUT_PATHS,
  template: DEFAULT_TEMPLATE_PATHS,
};

interface ListOptions {
  kind?: string;
  json?: boolean;
}

class DocsListHandler extends BaseCommand {
  async run(options: ListOptions): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      const manifest = await readForkManifest(tbdRoot);
      const config = await readConfig(tbdRoot);
      const files = config.docs_cache?.files;
      const parsedKind = parseKindOption(options.kind);
      const kinds = parsedKind ? [parsedKind] : RESOLVABLE_KINDS;
      const colors = this.output.getColors();

      interface Row {
        name: string;
        title?: string;
        description?: string;
        sizeInfo: string;
        marker: string;
        state: string;
        path: string;
      }
      const grouped: { kind: ForkKind; rows: Row[] }[] = [];
      const docmapEntries: DocMapEntry[] = [];

      for (const kind of kinds) {
        const cache = new DocCache(KIND_SERVE_PATHS[kind] ?? [], tbdRoot);
        await cache.load({ quiet: true });
        const rows: Row[] = [];
        for (const doc of cache.list()) {
          const fork = findFork(manifest, doc.name, kind);
          const isLocal = !fork && doc.sourceDir.startsWith(FORK_DIR);
          let state = 'upstream';
          let marker = '';
          if (fork) {
            const customized = hashContent(doc.content) !== fork.base_hash;
            state = customized ? 'customized' : 'forked';
            marker = customized ? '[forked, customized]' : '[forked]';
          } else if (isLocal) {
            state = 'local';
            marker = '[local]';
          }
          rows.push({
            name: doc.name,
            title: doc.frontmatter?.title,
            description: doc.frontmatter?.description,
            sizeInfo: formatDocSize(doc.sizeBytes, doc.approxTokens),
            marker,
            state,
            path: fork?.path ?? doc.sourceDir + '/' + doc.name + '.md',
          });
          // Every docmap entry must carry a location (path and/or source):
          // forked docs have both; local files have a path but no upstream;
          // upstream docs are located by their provenance docref.
          const localPath = `${FORK_DIR}/${KIND_DIR[kind]}/${doc.name}.md`;
          docmapEntries.push({
            name: doc.name,
            type: kind,
            ...(fork
              ? { path: fork.path, source: fork.source }
              : isLocal
                ? { path: localPath }
                : { source: sourceDocRef(tbdRoot, files, doc.path) }),
            title: doc.frontmatter?.title,
            description: doc.frontmatter?.description,
            state,
          });
        }
        grouped.push({ kind, rows });
      }

      if (this.ctx.json) {
        this.output.data(createDocMap(docmapEntries, { name: 'tbd-docs' }));
        return;
      }

      for (const { kind, rows } of grouped) {
        if (rows.length === 0) continue;
        if (!options.kind) console.log(colors.bold(kind));
        for (const r of rows) {
          const indent = options.kind ? '' : '  ';
          const markerStr = r.marker ? ` ${colors.dim(r.marker)}` : '';
          console.log(`${indent}${colors.bold(r.name)} ${colors.dim(r.sizeInfo)}${markerStr}`);
          const desc =
            r.title && r.description ? `${r.title}: ${r.description}` : (r.title ?? r.description);
          if (desc) console.log(`${indent}   ${desc}`);
        }
      }
    }, 'Failed to list docs');
  }
}

interface DiffOptions {
  base?: boolean;
  upstream?: boolean;
  kind?: string;
}

class DocsDiffHandler extends BaseCommand {
  async run(name: string, options: DiffOptions): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      const manifest = await readForkManifest(tbdRoot);
      const entry = findFork(manifest, name, parseKindOption(options.kind));
      if (!entry) {
        throw new CLIError(`${name} is not a forked doc. Run \`tbd docs status\` to see forks.`);
      }

      const forkContent = await readForkFile(tbdRoot, FORK_DIR, entry);
      const baseContent = await readForkBase(tbdRoot, entry);
      const cache = await buildKindCache(entry.kind, tbdRoot);
      const upstreamContent = cache.get(entry.name)?.doc.content ?? null;

      // Default: your file vs current upstream (the net fork).
      let left = upstreamContent;
      let right = forkContent;
      let labels = { left: 'upstream', right: 'ours' };
      if (options.base) {
        left = baseContent;
        right = forkContent;
        labels = { left: 'base', right: 'ours' };
      } else if (options.upstream) {
        left = baseContent;
        right = upstreamContent;
        labels = { left: 'base', right: 'upstream' };
      }

      if (left === null || right === null) {
        throw new CLIError(
          `Cannot diff ${name}: one side is unavailable ` +
            `(forked file missing, base missing, or upstream gone).`,
        );
      }

      const diff = await diffContents(left, right, labels);
      if (this.ctx.json) {
        this.output.data({ name: entry.name, kind: entry.kind, diff });
        return;
      }
      if (!diff.trim()) {
        console.log(`No differences (${labels.left} vs ${labels.right}).`);
        return;
      }
      console.log(diff.trimEnd());
    }, 'Failed to diff');
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
    .command('list')
    .description('List all docs across kinds, with [forked]/[customized]/[local] markers')
    .option('--kind <kind>', 'restrict to a kind (guideline|shortcut|template)')
    .action(async (options: ListOptions, command: Command) => {
      await new DocsListHandler(command).run({
        kind: options.kind,
        json: command.optsWithGlobals().json === true,
      });
    });

  docs
    .command('status')
    .description('Show forked docs and their states')
    .action(async (_options: { json?: boolean }, command: Command) => {
      await new DocsStatusHandler(command).run({ json: command.optsWithGlobals().json === true });
    });

  docs
    .command('update')
    .description('Reconcile forked docs with upstream after an upgrade (--merge / --keep-ours)')
    .argument('[names...]', 'doc name(s) to update (default: all)')
    .option('--merge', 'on conflict: combine and write conflict markers to resolve')
    .option('--keep-ours', 'on conflict: keep your version and advance the fork point')
    .action(async (names: string[], options: UpdateOptions, command: Command) => {
      const g = command.optsWithGlobals();
      await new DocsUpdateHandler(command).run(names, {
        merge: options.merge,
        keepOurs: options.keepOurs,
        dryRun: g.dryRun === true,
        json: g.json === true,
      });
    });

  docs
    .command('diff')
    .description(
      'Diff a forked doc against upstream (default), its base (--base), or incoming (--upstream)',
    )
    .argument('<name>', 'forked doc name')
    .option('--base', 'diff your file against its base (what you changed)')
    .option('--upstream', 'diff the base against current upstream (incoming changes)')
    .option('--kind <kind>', 'restrict to a kind')
    .action(async (name: string, options: DiffOptions, command: Command) => {
      await new DocsDiffHandler(command).run(name, options);
    });
}
