/**
 * `tbd search` - Search issues.
 *
 * See: tbd-design-v3.md §4.8 Search Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/baseCommand.js';
import { listIssues } from '../../file/storage.js';
import { IssueStatus } from '../../lib/schemas.js';
import type { Issue, IssueStatusType } from '../../lib/types.js';

// Base directory for issues
const ISSUES_BASE_DIR = '.tbd-sync';

interface SearchOptions {
  status?: string;
  limit?: string;
}

interface SearchResult {
  issue: Issue;
  matchField: string;
  matchText: string;
}

class SearchHandler extends BaseCommand {
  async run(query: string, options: SearchOptions): Promise<void> {
    // Load all issues
    let issues: Issue[];
    try {
      issues = await listIssues(ISSUES_BASE_DIR);
    } catch {
      this.output.error('No issue store found. Run `tbd init` first.');
      return;
    }

    // Parse status filter
    let statusFilter: IssueStatusType | null = null;
    if (options.status) {
      const result = IssueStatus.safeParse(options.status);
      if (!result.success) {
        this.output.error(`Invalid status: ${options.status}`);
        return;
      }
      statusFilter = result.data;
    }

    // Search (case-insensitive)
    const queryLower = query.toLowerCase();
    let results: SearchResult[] = [];

    for (const issue of issues) {
      // Apply status filter
      if (statusFilter && issue.status !== statusFilter) continue;

      // Search in title
      if (issue.title.toLowerCase().includes(queryLower)) {
        results.push({ issue, matchField: 'title', matchText: issue.title });
        continue;
      }

      // Search in description
      if (issue.description?.toLowerCase().includes(queryLower)) {
        const snippet = this.extractSnippet(issue.description, queryLower);
        results.push({ issue, matchField: 'description', matchText: snippet });
        continue;
      }

      // Search in notes
      if (issue.notes?.toLowerCase().includes(queryLower)) {
        const snippet = this.extractSnippet(issue.notes, queryLower);
        results.push({ issue, matchField: 'notes', matchText: snippet });
        continue;
      }

      // Search in labels
      for (const label of issue.labels) {
        if (label.toLowerCase().includes(queryLower)) {
          results.push({ issue, matchField: 'labels', matchText: `label: ${label}` });
          break;
        }
      }
    }

    // Apply limit
    if (options.limit) {
      const limit = parseInt(options.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        results = results.slice(0, limit);
      }
    }

    // Format output
    const output = results.map((r) => ({
      id: `bd-${r.issue.id.slice(3)}`,
      title: r.issue.title,
      status: r.issue.status,
      matchField: r.matchField,
      match: r.matchText,
    }));

    this.output.data(output, () => {
      if (output.length === 0) {
        this.output.info(`No issues matching "${query}"`);
        return;
      }

      const colors = this.output.getColors();
      console.log(`Found ${output.length} result${output.length === 1 ? '' : 's'}:\n`);
      for (const result of output) {
        console.log(`${colors.id(result.id)} ${result.title}`);
        console.log(`  ${colors.dim(`[${result.matchField}]`)} ${result.match}`);
        console.log('');
      }
    });
  }

  private extractSnippet(text: string, query: string): string {
    const lower = text.toLowerCase();
    const index = lower.indexOf(query);
    if (index === -1) return text.slice(0, 60);

    // Extract snippet around match
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + query.length + 40);
    let snippet = text.slice(start, end);

    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet.replace(/\n/g, ' ');
  }
}

export const searchCommand = new Command('search')
  .description('Search issues by text')
  .argument('<query>', 'Search query')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Limit results')
  .action(async (query, options, command) => {
    const handler = new SearchHandler(command);
    await handler.run(query, options);
  });
