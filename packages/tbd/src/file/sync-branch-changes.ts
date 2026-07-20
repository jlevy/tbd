/**
 * Strict, worktree-free reads of issue snapshots from committed Git refs.
 */

import { spawn } from 'node:child_process';
import { posix } from 'node:path';

import type {
  IssueSnapshot,
  IssueChangeSelection,
  IssueChangesReport,
} from '../lib/issue-changes.js';
import { createIssueChangesReport, validateIssueChangeSelection } from '../lib/issue-changes.js';
import { gitSafeEnv } from '../lib/git-env.js';
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

export interface SyncBranchChangesDependencies {
  git?: typeof git;
  readObjects?: typeof readGitObjects;
}

interface GitTreeEntry {
  objectId: string;
  path: string;
}

const GIT_BATCH_MAX_BUFFER = 50 * 1024 * 1024;

function parseBatchOutput(objectIds: readonly string[], output: Buffer): Map<string, string> {
  const contents = new Map<string, string>();
  let offset = 0;
  for (const objectId of objectIds) {
    const headerEnd = output.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error(`Invalid git cat-file response for ${objectId}`);
    const header = output.subarray(offset, headerEnd).toString('utf8');
    const match = /^([0-9a-f]{40,64}) blob (\d+)$/.exec(header);
    if (match?.[1] !== objectId) {
      throw new Error(`Invalid git cat-file response for ${objectId}: ${header}`);
    }
    const size = Number(match[2]);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (!Number.isSafeInteger(size) || contentEnd >= output.length || output[contentEnd] !== 0x0a) {
      throw new Error(`Truncated git cat-file response for ${objectId}`);
    }
    contents.set(objectId, output.subarray(contentStart, contentEnd).toString('utf8'));
    offset = contentEnd + 1;
  }
  if (offset !== output.length) throw new Error('Unexpected trailing git cat-file output');
  return contents;
}

/** Read many committed blobs through one `git cat-file --batch` subprocess. */
export async function readGitObjects(
  repoDir: string,
  requestedObjectIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const objectIds = Array.from(new Set(requestedObjectIds));
  if (objectIds.length === 0) return new Map();

  return new Promise((resolve, reject) => {
    const args = ['-C', repoDir, 'cat-file', '--batch'];
    const child = spawn('git', args, { env: gitSafeEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutSize = 0;
    let settled = false;

    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutSize += chunk.length;
      if (stdoutSize > GIT_BATCH_MAX_BUFFER) {
        child.kill();
        fail(new Error('git cat-file output exceeded 50 MB'));
        return;
      }
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error) => {
      fail(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();
        fail(new Error(`git cat-file --batch failed${stderr ? `: ${stderr}` : ''}`));
        return;
      }
      try {
        const parsed = parseBatchOutput(objectIds, Buffer.concat(stdoutChunks));
        settled = true;
        resolve(parsed);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    });
    child.stdin.on('error', (error) => {
      fail(error);
    });
    child.stdin.end(`${objectIds.join('\n')}\n`);
  });
}

function parseTreeEntries(listing: string, ref: string): GitTreeEntry[] {
  return listing
    .split('\0')
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf('\t');
      const metadata = separator < 0 ? [] : entry.slice(0, separator).split(' ');
      const path = separator < 0 ? '' : entry.slice(separator + 1);
      const objectId = metadata[2];
      if (metadata[1] !== 'blob' || !objectId || !/^[0-9a-f]{40,64}$/.test(objectId) || !path) {
        throw new Error(`Invalid Git tree entry at ${ref}: ${entry}`);
      }
      return { objectId, path };
    });
}

async function resolveCommit(
  repoDir: string,
  ref: string,
  runGit: typeof git,
  suggestSync: boolean,
): Promise<string> {
  try {
    return await runGit(
      '-C',
      repoDir,
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${ref}^{commit}`,
    );
  } catch (error) {
    const hint = suggestSync ? '. Run tbd sync first to initialize the local sync branch' : '';
    throw new Error(`Invalid or missing commit ${ref}${hint}`, { cause: error });
  }
}

async function readSnapshot(
  repoDir: string,
  ref: string,
  dependencies: SyncBranchChangesDependencies,
): Promise<IssueSnapshot> {
  const runGit = dependencies.git ?? git;
  const readObjects = dependencies.readObjects ?? readGitObjects;
  const issuesPath = `${GIT_DATA_SYNC_DIR}/issues`;
  const issuePathPrefix = `${issuesPath}/`;
  const mappingPath = `${GIT_DATA_SYNC_DIR}/mappings/ids.yml`;
  const listing = await runGit(
    '-C',
    repoDir,
    'ls-tree',
    '-r',
    '-z',
    ref,
    '--',
    issuesPath,
    mappingPath,
  );
  const entries = parseTreeEntries(listing, ref);
  const issueEntries = entries
    .filter(({ path }) => path.startsWith(issuePathPrefix) && path.endsWith('.md'))
    .sort((left, right) => left.path.localeCompare(right.path));
  const mappingEntry = entries.find(({ path }) => path === mappingPath);
  const objectContents = await readObjects(repoDir, [
    ...issueEntries.map(({ objectId }) => objectId),
    ...(mappingEntry ? [mappingEntry.objectId] : []),
  ]);
  const issues = new Map<string, ReturnType<typeof parseIssue>>();

  for (const { objectId, path } of issueEntries) {
    if (path.slice(issuePathPrefix.length).includes('/')) {
      throw new Error(`Invalid issue path at ${ref}:${path}: issue files must not be nested`);
    }
    let issue;
    try {
      const content = objectContents.get(objectId);
      if (content === undefined) throw new Error(`missing blob ${objectId}`);
      issue = parseIssue(content);
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

  if (mappingEntry === undefined) {
    if (issues.size > 0) {
      throw new Error(`Invalid ID mapping at ${ref}:${mappingPath}: mapping file is missing`);
    }
    return { issues, shortToUlid: new Map(), ulidToShort: new Map() };
  }

  try {
    const mappingContent = objectContents.get(mappingEntry.objectId);
    if (mappingContent === undefined) throw new Error(`missing blob ${mappingEntry.objectId}`);
    const mapping = parseIdMappingFromYaml(mappingContent);
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

/** Read and validate one committed issue snapshot without checking it out. */
export async function readIssueSnapshotFromRef(
  repoDir: string,
  ref: string,
  dependencies: SyncBranchChangesDependencies = {},
): Promise<IssueSnapshot> {
  const runGit = dependencies.git ?? git;
  const commit = await resolveCommit(repoDir, ref, runGit, true);
  return readSnapshot(repoDir, commit, dependencies);
}

/** Validate a static bead selection against one local committed sync snapshot. */
export async function validateBeadSelectionAtRef(
  repoDir: string,
  ref: string,
  selection: IssueChangeSelection,
): Promise<void> {
  if (selection.kind !== 'beads') return;
  validateIssueChangeSelection(await readIssueSnapshotFromRef(repoDir, ref), selection);
}

/** Resolve, validate, read, and diff two commits without checking either one out. */
export async function createChangesReportFromRefs(
  options: CreateChangesReportFromRefsOptions,
  dependencies: SyncBranchChangesDependencies = {},
): Promise<IssueChangesReport> {
  const runGit = dependencies.git ?? git;
  const tip = await resolveCommit(options.repoDir, options.tipRef, runGit, true);
  const since = await resolveCommit(options.repoDir, options.sinceRef, runGit, false);
  try {
    await runGit('-C', options.repoDir, 'merge-base', '--is-ancestor', since, tip);
  } catch (error) {
    throw new Error(`Baseline ${since} is not an ancestor of tip ${tip}`, { cause: error });
  }
  const [before, after] = await Promise.all([
    readSnapshot(options.repoDir, since, dependencies),
    readSnapshot(options.repoDir, tip, dependencies),
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
