/**
 * Strict, worktree-free reads of issue snapshots from committed Git refs.
 */

import { posix } from 'node:path';

import type {
  IssueSnapshot,
  IssueChangeSelection,
  IssueChangesReport,
} from '../lib/issue-changes.js';
import { createIssueChangesReport } from '../lib/issue-changes.js';
import { extractUlidFromInternalId } from '../lib/ids.js';
import { DATA_SYNC_DIR } from '../lib/paths.js';
import { parseIssue } from './parser.js';
import { parseIdMappingFromYaml } from './id-mapping.js';
import { git } from './git.js';

// Repository tree paths are always slash-separated, independent of the host OS.
const GIT_DATA_SYNC_DIR = DATA_SYNC_DIR.replaceAll('\\', '/');

export interface CreateChangesReportFromRefsOptions {
  repoDir: string;
  sinceRef: string;
  tipRef: string;
  prefix: string;
  selection: IssueChangeSelection;
}

async function resolveCommit(repoDir: string, ref: string): Promise<string> {
  try {
    return await git('-C', repoDir, 'rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
  } catch (error) {
    throw new Error(`Invalid or missing commit ${ref}`, { cause: error });
  }
}

async function refHasPath(repoDir: string, ref: string, path: string): Promise<boolean> {
  const listing = await git('-C', repoDir, 'ls-tree', '--name-only', ref, '--', path);
  return listing.split('\n').some((entry) => entry === path);
}

async function readSnapshot(repoDir: string, ref: string): Promise<IssueSnapshot> {
  const issuesPath = `${GIT_DATA_SYNC_DIR}/issues`;
  const issuePathPrefix = `${issuesPath}/`;
  const listing = await git('-C', repoDir, 'ls-tree', '-r', '--name-only', ref, '--', issuesPath);
  const issuePaths = listing
    .split('\n')
    .filter((path) => path.startsWith(issuePathPrefix) && path.endsWith('.md'))
    .sort((left, right) => left.localeCompare(right));
  const issues = new Map<string, ReturnType<typeof parseIssue>>();

  for (const path of issuePaths) {
    if (path.slice(issuePathPrefix.length).includes('/')) {
      throw new Error(`Invalid issue path at ${ref}:${path}: issue files must not be nested`);
    }
    let issue;
    try {
      issue = parseIssue(await git('-C', repoDir, 'show', `${ref}:${path}`));
    } catch (error) {
      throw new Error(`Invalid issue at ${ref}:${path}`, { cause: error });
    }
    // `git ls-tree` always emits POSIX paths, including on Windows.
    const filenameId = posix.basename(path, '.md');
    if (issue.id !== filenameId) {
      throw new Error(`Invalid issue at ${ref}:${path}: file name does not match ${issue.id}`);
    }
    issues.set(issue.id, issue);
  }

  const mappingPath = `${GIT_DATA_SYNC_DIR}/mappings/ids.yml`;
  if (!(await refHasPath(repoDir, ref, mappingPath))) {
    if (issues.size > 0) {
      throw new Error(`Invalid ID mapping at ${ref}:${mappingPath}: mapping file is missing`);
    }
    return { issues, shortToUlid: new Map(), ulidToShort: new Map() };
  }

  try {
    const mapping = parseIdMappingFromYaml(
      await git('-C', repoDir, 'show', `${ref}:${mappingPath}`),
    );
    const snapshot = {
      issues,
      shortToUlid: mapping.shortToUlid,
      ulidToShort: mapping.ulidToShort,
    };
    if (mapping.shortToUlid.size !== mapping.ulidToShort.size) {
      throw new Error('multiple public IDs map to the same internal ID');
    }
    for (const issue of issues.values()) {
      if (!mapping.ulidToShort.has(extractUlidFromInternalId(issue.id))) {
        throw new Error(`no mapping for ${issue.id}`);
      }
    }
    return snapshot;
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new Error(`Invalid ID mapping at ${ref}:${mappingPath}${detail}`, { cause: error });
  }
}

/** Resolve, validate, read, and diff two commits without checking either one out. */
export async function createChangesReportFromRefs(
  options: CreateChangesReportFromRefsOptions,
): Promise<IssueChangesReport> {
  const since = await resolveCommit(options.repoDir, options.sinceRef);
  const tip = await resolveCommit(options.repoDir, options.tipRef);
  try {
    await git('-C', options.repoDir, 'merge-base', '--is-ancestor', since, tip);
  } catch (error) {
    throw new Error(`Baseline ${since} is not an ancestor of tip ${tip}`, { cause: error });
  }
  const [before, after] = await Promise.all([
    readSnapshot(options.repoDir, since),
    readSnapshot(options.repoDir, tip),
  ]);
  return createIssueChangesReport({
    since,
    tip,
    before,
    after,
    prefix: options.prefix,
    selection: options.selection,
  });
}
