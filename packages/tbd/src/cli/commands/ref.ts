/**
 * `tbd ref` and `tbd doc` — attach external references and supporting documents
 * to a bead (f08+).
 *
 * Three linkage concerns stay deliberately separate, because they resolve differently:
 *
 * - `spec_path` is *the doc this work is defined by*. Singular, inherited by
 *   descendants, and load-bearing for mirror selection. Not managed here.
 * - `docs` is *what else you should read*: repo-relative paths, plural, not inherited.
 *   A path rather than a URL because the file lives in this repository, where a path is
 *   stable and a URL is branch-dependent.
 * - `refs` is *what this work touches in other systems*: absolute URLs that may 404
 *   independently and that tbd never tries to resolve.
 *
 * Both lists union-merge on their identity field (`path` / `url`), so adding the same
 * entry twice is a no-op and two agents attaching different entries concurrently both
 * survive.
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import { readIssue, writeIssue } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import { now } from '../../utils/time-utils.js';
import { withDataSyncContext } from '../lib/data-context.js';
import { resolveIssueId } from '../lib/id-suggestions.js';
import type { Issue, IssueDocEntry, IssueRefEntry } from '../../lib/types.js';

/** Known kinds and roles. Open sets: an unknown value renders, it does not fail. */
const KNOWN_REF_KINDS = ['pr', 'issue', 'design', 'other'];
const KNOWN_DOC_ROLES = ['research', 'architecture', 'qa', 'design'];

/**
 * A ref must be an absolute URL. Rejecting a bare path here is worth the strictness:
 * a path in `refs` would be silently unresolvable, and the field that *does* take paths
 * is one command away.
 */
function assertAbsoluteUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(
      `Not an absolute URL: ${url}\n` +
        'refs point outside this repository. For a file in this repo, use `tbd doc add`.',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError(`Unsupported URL scheme in ref: ${url} (expected http or https)`);
  }
}

/**
 * Infer the ref kind from a GitHub URL so the common cases need no flag.
 * Anything unrecognized is `other` rather than a guess.
 */
function inferRefKind(url: string): string {
  if (/\/pull\/\d+/.test(url)) {
    return 'pr';
  }
  if (/\/issues\/\d+/.test(url)) {
    return 'issue';
  }
  return 'other';
}

/** Outcome of a list mutation: whether anything changed, and what to report. */
interface MutationOutcome {
  changed: boolean;
  message: string;
}

/**
 * Shared load-mutate-write for both lists, so the four commands cannot drift apart on
 * locking, dry-run handling, version bumping, or how an already-present entry reports.
 */
abstract class LinkListCommand extends BaseCommand {
  protected async mutateIssue(
    id: string,
    dryRunLabel: string,
    dryRunPayload: Record<string, unknown>,
    mutate: (issue: Issue) => MutationOutcome,
  ): Promise<void> {
    const tbdRoot = await requireInit();
    let displayId = id;
    let result: MutationOutcome | undefined;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const internalId = resolveIssueId(id, mapping, config.display.id_prefix);

          let issue: Issue;
          try {
            issue = await readIssue(dataSyncDir, internalId);
          } catch {
            throw new NotFoundError('Issue', id);
          }

          if (this.checkDryRun(dryRunLabel, { id: internalId, ...dryRunPayload })) {
            return;
          }

          result = mutate(issue);
          if (!result.changed) {
            return;
          }

          issue.version += 1;
          issue.updated_at = now();
          await writeIssue(dataSyncDir, issue);

          displayId = this.ctx.debug
            ? formatDebugId(issue.id, mapping, config.display.id_prefix)
            : formatDisplayId(issue.id, mapping, config.display.id_prefix);
        },
      );
    }, 'Failed to update issue');

    if (!result) {
      return;
    }
    if (!result.changed) {
      this.output.info(result.message);
      return;
    }
    const message = result.message;
    this.output.data({ id: displayId }, () => {
      this.output.success(`${message} on ${displayId}`);
    });
  }
}

class RefAddHandler extends LinkListCommand {
  async run(id: string, urls: string[], options: { kind?: string; title?: string }): Promise<void> {
    for (const url of urls) {
      assertAbsoluteUrl(url);
    }
    if (options.title && urls.length > 1) {
      throw new ValidationError(
        '--title applies to a single ref; pass one URL at a time to title it.',
      );
    }

    await this.mutateIssue(id, 'Would add refs', { urls, kind: options.kind }, (issue) => {
      const existing = issue.refs ?? [];
      const byUrl = new Map(existing.map((ref) => [ref.url, ref]));
      const added: string[] = [];

      for (const url of urls) {
        if (byUrl.has(url)) {
          continue;
        }
        const entry: IssueRefEntry = {
          kind: options.kind ?? inferRefKind(url),
          url,
          at: now(),
        };
        if (options.title) {
          entry.title = options.title;
        }
        byUrl.set(url, entry);
        added.push(url);
      }

      if (added.length === 0) {
        return { changed: false, message: 'All refs already present' };
      }
      issue.refs = [...byUrl.values()];
      return { changed: true, message: `Added ${added.length} ref(s)` };
    });
  }
}

class RefRemoveHandler extends LinkListCommand {
  async run(id: string, urls: string[]): Promise<void> {
    await this.mutateIssue(id, 'Would remove refs', { urls }, (issue) => {
      const existing = issue.refs ?? [];
      const remove = new Set(urls);
      const kept = existing.filter((ref) => !remove.has(ref.url));
      if (kept.length === existing.length) {
        return { changed: false, message: 'No matching refs found' };
      }
      // An empty list is stored as absent, not as `refs: []`: the field is optional
      // precisely so a bead that has none carries no line for it.
      issue.refs = kept.length > 0 ? kept : undefined;
      return { changed: true, message: `Removed ${existing.length - kept.length} ref(s)` };
    });
  }
}

class DocAddHandler extends LinkListCommand {
  async run(
    id: string,
    paths: string[],
    options: { role?: string; title?: string },
  ): Promise<void> {
    if (options.title && paths.length > 1) {
      throw new ValidationError(
        '--title applies to a single doc; pass one path at a time to title it.',
      );
    }
    for (const path of paths) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
        throw new ValidationError(
          `Not a repo-relative path: ${path}\n` +
            'docs point at files in this repository. For an external URL, use `tbd ref add`.',
        );
      }
    }

    await this.mutateIssue(id, 'Would add docs', { paths, role: options.role }, (issue) => {
      const existing = issue.docs ?? [];
      const byPath = new Map(existing.map((doc) => [doc.path, doc]));
      const added: string[] = [];

      for (const path of paths) {
        if (byPath.has(path)) {
          continue;
        }
        const entry: IssueDocEntry = { path };
        if (options.role) {
          entry.role = options.role;
        }
        if (options.title) {
          entry.title = options.title;
        }
        byPath.set(path, entry);
        added.push(path);
      }

      if (added.length === 0) {
        return { changed: false, message: 'All docs already present' };
      }
      issue.docs = [...byPath.values()];
      return { changed: true, message: `Added ${added.length} doc(s)` };
    });
  }
}

class DocRemoveHandler extends LinkListCommand {
  async run(id: string, paths: string[]): Promise<void> {
    await this.mutateIssue(id, 'Would remove docs', { paths }, (issue) => {
      const existing = issue.docs ?? [];
      const remove = new Set(paths);
      const kept = existing.filter((doc) => !remove.has(doc.path));
      if (kept.length === existing.length) {
        return { changed: false, message: 'No matching docs found' };
      }
      issue.docs = kept.length > 0 ? kept : undefined;
      return { changed: true, message: `Removed ${existing.length - kept.length} doc(s)` };
    });
  }
}

const refAddCommand = new Command('add')
  .description('Attach external references (PRs, issues, dashboards) to an issue')
  .argument('<id>', 'Issue ID')
  .argument('<urls...>', 'Absolute URLs to attach')
  .option('--kind <kind>', `Reference kind (${KNOWN_REF_KINDS.join(', ')}); inferred when omitted`)
  .option('--title <title>', 'Human-readable title for a single reference')
  .action(async (id, urls, options, command) => {
    const handler = new RefAddHandler(command);
    await handler.run(id, urls, options);
  });

const refRemoveCommand = new Command('rm')
  .alias('remove')
  .description('Remove external references from an issue')
  .argument('<id>', 'Issue ID')
  .argument('<urls...>', 'URLs to remove')
  .action(async (id, urls, _options, command) => {
    const handler = new RefRemoveHandler(command);
    await handler.run(id, urls);
  });

export const refCommand = new Command('ref')
  .description('Manage external references on an issue')
  .addCommand(refAddCommand)
  .addCommand(refRemoveCommand);

const docAddCommand = new Command('add')
  .description('Attach supporting documents (repo-relative paths) to an issue')
  .argument('<id>', 'Issue ID')
  .argument('<paths...>', 'Repo-relative paths to attach')
  .option('--role <role>', `Document role (${KNOWN_DOC_ROLES.join(', ')})`)
  .option('--title <title>', 'Human-readable title for a single document')
  .action(async (id, paths, options, command) => {
    const handler = new DocAddHandler(command);
    await handler.run(id, paths, options);
  });

const docRemoveCommand = new Command('rm')
  .alias('remove')
  .description('Remove supporting documents from an issue')
  .argument('<id>', 'Issue ID')
  .argument('<paths...>', 'Paths to remove')
  .action(async (id, paths, _options, command) => {
    const handler = new DocRemoveHandler(command);
    await handler.run(id, paths);
  });

export const docRefCommand = new Command('doc')
  .description('Manage supporting documents on an issue')
  .addCommand(docAddCommand)
  .addCommand(docRemoveCommand);
