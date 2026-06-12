/**
 * `tbd docs` — manage tbd-served docs: browse, fork into the repo, sync the
 * cache, and pull upstream updates into forks.
 *
 * Surface (the f05 reorganization of the old manual viewer):
 *   tbd docs                     status overview of managed docs (landing page)
 *   tbd docs show <name>         read any doc by name (kind-agnostic; --section)
 *   tbd docs show tbd-docs       the CLI manual (old bare `tbd docs`)
 *   tbd docs manual [topic]      alias for `tbd docs show tbd-docs`
 *   tbd docs sync                refresh the gitignored cache (canonical form of
 *                                the deprecated `tbd sync --docs` alias)
 *   tbd docs list/status/fork/unfork/update/diff   (see docs-fork.ts)
 */

import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { BaseCommand } from '../lib/base-command.js';
import { registerForkSubcommands, parseKindOption, RESOLVABLE_KINDS } from './docs-fork.js';
import { shouldUseInteractiveOutput } from '../lib/context.js';
import { CLIError, NotFoundError, NotInitializedError, requireInit } from '../lib/errors.js';
import { renderMarkdown, paginateOutput } from '../lib/output.js';
import {
  printDocSyncResult,
  printDocSyncStatus,
  printForkDriftNotice,
} from '../lib/docs-sync-output.js';
import { syncDocsWithDefaults } from '../../file/doc-sync.js';
import { DocCache } from '../../file/doc-cache.js';
import {
  DEFAULT_GUIDELINES_PATHS,
  DEFAULT_SHORTCUT_PATHS,
  DEFAULT_TEMPLATE_PATHS,
  FORK_DIR,
} from '../../lib/paths.js';
import { readForkManifest, type ForkKind } from '../../file/fork-manifest.js';
import { computeForkDriftSummary } from '../../file/doc-fork.js';
import type { DocSection } from '../../lib/types.js';
import GithubSlugger from 'github-slugger';

/** Reserved name that serves the bundled CLI manual (`tbd-docs.md`). */
const MANUAL_DOC_NAME = 'tbd-docs';

/** Serving lookup paths per kind (fork dir first, so forks shadow the cache). */
const SHOW_PATHS: Record<ForkKind, string[]> = {
  guideline: DEFAULT_GUIDELINES_PATHS,
  shortcut: DEFAULT_SHORTCUT_PATHS,
  template: DEFAULT_TEMPLATE_PATHS,
  reference: [],
};

/**
 * Path to the bundled manual. The docs file is copied to dist/docs/ during
 * build; in development it is read from the package docs/ directory.
 */
async function readManualContent(): Promise<string> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  try {
    return await readFile(join(__dirname, 'docs', 'tbd-docs.md'), 'utf-8');
  } catch {
    try {
      return await readFile(join(__dirname, '..', '..', '..', 'docs', 'tbd-docs.md'), 'utf-8');
    } catch {
      throw new CLIError('Documentation file not found. Please rebuild the CLI.');
    }
  }
}

/** Extract `## ` section metadata (title + GitHub slug) from a markdown doc. */
function extractSections(content: string): DocSection[] {
  const sections: DocSection[] = [];
  const slugger = new GithubSlugger();
  for (const line of content.split('\n')) {
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      sections.push({ title, slug: slugger.slug(title) });
    }
  }
  return sections;
}

/**
 * Extract one `## ` section (header through the next header), matching by slug
 * or partial title. Returns null when no section matches.
 */
function extractSection(content: string, sections: DocSection[], query: string): string | null {
  const lowerQuery = query.toLowerCase();
  const matched =
    sections.find((s) => s.slug === lowerQuery) ??
    sections.find((s) => s.title.toLowerCase().includes(lowerQuery));
  if (!matched) {
    return null;
  }

  const lines = content.split('\n');
  let inSection = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.slice(3).trim() === matched.title) {
        inSection = true;
        sectionLines.push(line);
      }
    } else if (inSection) {
      sectionLines.push(line);
    }
  }
  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1]?.trim() === '') {
    sectionLines.pop();
  }
  return sectionLines.length > 0 ? sectionLines.join('\n') : null;
}

/**
 * Bare `tbd docs`: the status overview / landing page for managed docs.
 * Mirrors `tbd status`: a summary plus pointers, never the full table.
 */
class DocsOverviewHandler extends BaseCommand {
  async run(): Promise<void> {
    await this.execute(async () => {
      let tbdRoot: string;
      try {
        tbdRoot = await requireInit();
      } catch (err) {
        if (!(err instanceof NotInitializedError)) throw err;
        // The overview stays useful before setup (the old viewer worked
        // anywhere): point at the bundled manual and at initialization.
        const colors = this.output.getColors();
        console.log(`${colors.bold('tbd docs')} — managed documentation`);
        console.log('');
        console.log('  tbd is not initialized in this repo (run: tbd setup --auto).');
        console.log('  The CLI manual is bundled and always available:');
        console.log('');
        console.log('  Learn more: tbd docs show tbd-docs   (alias: tbd docs manual)');
        return;
      }
      const manifest = await readForkManifest(tbdRoot);
      const drift = await computeForkDriftSummary(tbdRoot, FORK_DIR, manifest);

      let total = 0;
      for (const kind of RESOLVABLE_KINDS) {
        const cache = new DocCache(SHOW_PATHS[kind], tbdRoot);
        await cache.load({ quiet: true });
        total += cache.list().length;
      }

      if (this.ctx.json) {
        this.output.data({ available: total, ...drift });
        return;
      }

      const colors = this.output.getColors();
      console.log(`${colors.bold('tbd docs')} — managed documentation`);
      console.log('');

      if (drift.forks === 0) {
        console.log(
          `  ${total} docs available in the cache (.tbd/docs/, gitignored); none forked into the repo.`,
        );
        console.log(
          '  Guidelines are active from the cache. Three postures, all serving the same docs:',
        );
        console.log('');
        console.log('  Hidden (default):  keep the cache as-is — zero repo footprint');
        console.log(
          `  Curated:           ${colors.bold('tbd docs fork <name> [...]')}  fork chosen docs into ${FORK_DIR}/`,
        );
        console.log(
          `  Everything:        ${colors.bold('tbd docs fork --all')}         all docs, visible and editable`,
        );
        console.log('');
        console.log(`  Browse / read: tbd docs list / tbd docs show <name>`);
        console.log(
          `  Learn more:    tbd docs show tbd-docs   (the manual; alias: tbd docs manual)`,
        );
        return;
      }

      const upstream = total - drift.forks;
      console.log(
        `  ${total} available  (${upstream} upstream, ${drift.forks} forked into ${FORK_DIR}/)`,
      );
      const parts = [`${drift.customized} customized`];
      if (drift.stale > 0) {
        parts.push(`${drift.stale} with upstream updates — run 'tbd docs update'`);
      }
      if (drift.conflicted > 0) parts.push(`${drift.conflicted} conflict pending`);
      if (drift.missing > 0) parts.push(`${drift.missing} missing — see 'tbd docs status'`);
      if (drift.local > 0) parts.push(`${drift.local} local`);
      console.log(`  ${drift.forks} forked: ${parts.join(', ')}`);
      console.log('');
      console.log('  Inspect:    tbd docs status');
      console.log('  Browse:     tbd docs list');
      console.log('  Update:     tbd docs update');
      console.log('  Learn more: tbd docs show tbd-docs');
    }, 'Failed to read docs overview');
  }
}

interface ShowOptions {
  section?: string;
  sections?: boolean;
  kind?: string;
}

/**
 * `tbd docs show <name>`: kind-agnostic read of any managed doc. The reserved
 * `tbd-docs` name serves the bundled CLI manual (with `--section` navigation,
 * relocated here from the old bare `tbd docs` viewer).
 */
class DocsShowHandler extends BaseCommand {
  async run(name: string, options: ShowOptions): Promise<void> {
    await this.execute(async () => {
      let content: string;
      let provenance: string | null = null;

      if (name === MANUAL_DOC_NAME) {
        content = await readManualContent();
      } else {
        const tbdRoot = await requireInit();
        const requestedKind = parseKindOption(options.kind);
        const kinds = requestedKind ? [requestedKind] : RESOLVABLE_KINDS;
        const matches: { kind: ForkKind; content: string; sourceDir: string; path: string }[] = [];
        for (const kind of kinds) {
          const cache = new DocCache(SHOW_PATHS[kind], tbdRoot);
          await cache.load({ quiet: true });
          const hit = cache.get(name);
          if (hit) {
            matches.push({
              kind,
              content: hit.doc.content,
              sourceDir: hit.doc.sourceDir,
              path: hit.doc.path,
            });
          }
        }
        if (matches.length === 0) {
          throw new NotFoundError('Doc', `"${name}" (run \`tbd docs list\` to see names)`);
        }
        if (matches.length > 1) {
          const kindList = matches.map((m) => m.kind).join(', ');
          throw new CLIError(
            `"${name}" exists in multiple kinds (${kindList}). Use --kind to disambiguate.`,
          );
        }
        const match = matches[0]!;
        content = match.content;
        if (match.sourceDir.startsWith(FORK_DIR)) {
          provenance = relative(tbdRoot, match.path).split('\\').join('/');
        }
      }

      const sections = extractSections(content);

      if (options.sections) {
        this.output.data(sections, () => {
          const colors = this.output.getColors();
          console.log(colors.bold(`Sections in ${name}:`));
          console.log('');
          const maxSlugLen = Math.max(...sections.map((s) => s.slug.length));
          for (const section of sections) {
            console.log(`  ${colors.id(section.slug.padEnd(maxSlugLen))}  ${section.title}`);
          }
          console.log('');
          console.log(
            `Use ${colors.dim(`tbd docs show ${name} --section <name>`)} to view a section.`,
          );
        });
        return;
      }

      if (options.section) {
        const sectionContent = extractSection(content, sections, options.section);
        if (!sectionContent) {
          throw new NotFoundError(
            'Section',
            `"${options.section}" (use --sections to see available sections)`,
          );
        }
        content = sectionContent;
      }

      // Provenance to stderr so piped stdout stays clean (on by default;
      // the extra context helps agents recall which docs are customized).
      if (provenance && !this.ctx.quiet && !this.ctx.json) {
        process.stderr.write(`(serving forked copy: ${provenance})\n`);
      }

      if (shouldUseInteractiveOutput(this.ctx)) {
        const rendered = renderMarkdown(content, this.ctx.color);
        await paginateOutput(rendered, true);
      } else {
        console.log(content);
      }
    }, 'Failed to show doc');
  }
}

/** `tbd docs sync`: refresh the gitignored docs cache (canonical command). */
class DocsSyncHandler extends BaseCommand {
  async run(): Promise<void> {
    await this.execute(async () => {
      const tbdRoot = await requireInit();
      if (this.ctx.dryRun) {
        const result = await syncDocsWithDefaults(tbdRoot, { dryRun: true });
        printDocSyncStatus(this.output, result);
        return;
      }
      const spinner = this.output.spinner('Syncing docs...');
      const result = await syncDocsWithDefaults(tbdRoot);
      spinner.stop();
      printDocSyncResult(this.output, result);
      await printForkDriftNotice(this.output, tbdRoot);
    }, 'Failed to sync docs');
  }
}

export const docsCommand = new Command('docs')
  .description('Manage tbd-served docs: browse, fork into your repo, and pull upstream updates')
  .action(async (_options: unknown, command: Command) => {
    await new DocsOverviewHandler(command).run();
  });

docsCommand
  .command('show')
  .description('Read any managed doc by name (tbd-docs is the CLI manual)')
  .argument('<name>', 'doc name (e.g. python-rules, tbd-docs)')
  .option('--section <name>', 'show one section of the doc')
  .option('--sections', 'list the doc’s sections')
  .option('--kind <kind>', 'restrict to a kind (guideline|shortcut|template)')
  .action(async (name: string, options: ShowOptions, command: Command) => {
    await new DocsShowHandler(command).run(name, options);
  });

docsCommand
  .command('manual')
  .description('Show the tbd CLI manual (alias for: tbd docs show tbd-docs)')
  .argument('[topic]', 'section to display (e.g. "commands", "id-system")')
  .option('--section <name>', 'show one section of the manual')
  .option('--sections', 'list the manual’s sections')
  .action(async (topic: string | undefined, options: ShowOptions, command: Command) => {
    await new DocsShowHandler(command).run(MANUAL_DOC_NAME, {
      ...options,
      section: options.section ?? topic,
    });
  });

docsCommand
  .command('sync')
  .description('Refresh the gitignored docs cache (.tbd/docs/) from bundled and URL sources')
  .action(async (_options: unknown, command: Command) => {
    await new DocsSyncHandler(command).run();
  });

// Fork lifecycle operations (fork / unfork / status / list / update / diff).
registerForkSubcommands(docsCommand);
