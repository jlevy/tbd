/**
 * `tbd guidelines` - Find and output coding guidelines.
 *
 * Guidelines are reusable coding rules and best practices documents.
 * Give a name or description and tbd will find the matching guideline.
 */

import { Command } from 'commander';
import pc from 'picocolors';

import { createDocMap } from '../../docmap/index.js';
import { DocCommandHandler, type DocCommandOptions } from '../lib/doc-command-handler.js';
import { CLIError } from '../lib/errors.js';
import { DEFAULT_GUIDELINES_PATHS } from '../../lib/paths.js';
import { truncate } from '../../lib/truncate.js';
import { DOC_CATEGORIES, docCategory, parseCategoryOption } from '../../lib/doc-categories.js';
import { formatDocSize } from '../../lib/format-utils.js';
import { getTerminalWidth } from '../lib/output.js';

interface GuidelinesOptions extends DocCommandOptions {
  category?: string;
  add?: string;
  name?: string;
}

class GuidelinesHandler extends DocCommandHandler {
  constructor(command: Command) {
    super(command, {
      typeName: 'guideline',
      typeNamePlural: 'guidelines',
      paths: DEFAULT_GUIDELINES_PATHS,
      docType: 'guideline',
    });
  }

  async run(query: string | undefined, options: GuidelinesOptions): Promise<void> {
    await this.execute(async () => {
      // Add mode
      if (options.add) {
        if (!options.name) {
          throw new CLIError('--name is required when using --add');
        }
        await this.handleAdd(options.add, options.name);
        return;
      }

      await this.initCache();

      // List mode (also triggered by --category)
      if (options.list || options.category) {
        await this.handleListWithCategory(options.all, options.category);
        return;
      }

      // No query: show help
      if (!query) {
        await this.handleNoQuery();
        return;
      }

      // Query provided: try exact match first, then fuzzy
      await this.handleQuery(query);
    }, 'Failed to find guideline');
  }

  /**
   * Handle --list mode with optional category filtering.
   */
  private async handleListWithCategory(includeAll?: boolean, category?: string): Promise<void> {
    if (!this.cache) throw new Error('Cache not initialized');

    let docs = this.cache.list(includeAll);

    // Filter by the declared frontmatter category (name-based inference retired)
    if (category) {
      const wanted = parseCategoryOption(category);
      docs = docs.filter((d) => docCategory(d.frontmatter) === wanted);
    }

    if (this.ctx.json) {
      // Same docmap as `tbd docs list`, filtered to guidelines, with the
      // category as a per-entry extension field.
      const entries = await this.docMapEntries(docs);
      const docByName = new Map(docs.map((d) => [d.name, d]));
      const withCategory = entries.map((e) => ({
        ...e,
        category: docCategory(docByName.get(e.name)?.frontmatter),
      }));
      this.output.data(createDocMap(withCategory, { name: 'tbd-docs' }));
      return;
    }

    if (docs.length === 0) {
      if (category) {
        console.log(`No guidelines found in category: ${category}`);
        console.log(`Valid categories: ${DOC_CATEGORIES.join(', ')}`);
      } else {
        console.log('No guidelines found.');
        console.log('Run `tbd setup --auto` to install built-in guidelines.');
      }
      return;
    }

    const maxWidth = getTerminalWidth();

    for (const doc of docs) {
      const shadowed = this.cache.isShadowed(doc);
      const name = doc.name;
      const title = doc.frontmatter?.title;
      const description = doc.frontmatter?.description ?? this.extractFallbackText(doc.content);

      if (shadowed) {
        const line = `${name} (${doc.sourceDir}) [shadowed]`;
        console.log(pc.dim(truncate(line, maxWidth)));
      } else {
        const sizeInfo = formatDocSize(doc.sizeBytes, doc.approxTokens);
        console.log(`${pc.bold(name)} ${pc.dim(sizeInfo)}`);
        const hasFrontmatter = title ?? doc.frontmatter?.description;
        const content =
          title && description ? `${title}: ${description}` : (title ?? description ?? '');
        if (content) {
          this.printWrappedDescription(content, maxWidth, !hasFrontmatter);
        }
      }
    }
  }
}

export const guidelinesCommand = new Command('guidelines')
  .description('Find and output coding guidelines')
  .argument('[query]', 'Guideline name or description to search for')
  .option('--list', 'List all available guidelines')
  .option('--all', 'Include shadowed guidelines (use with --list)')
  .option('--category <category>', 'Filter by category: typescript, python, testing, general')
  .option('--add <url>', 'Add a guideline from a URL')
  .option('--name <name>', 'Name for the added guideline (required with --add)')
  .action(async (query: string | undefined, options: GuidelinesOptions, command) => {
    const handler = new GuidelinesHandler(command);
    await handler.run(query, options);
  });
