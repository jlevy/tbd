/**
 * `tbd doctor` - Diagnose and repair repository.
 *
 * A comprehensive health check that includes status, stats, and health checks.
 *
 * See: tbd-design.md §4.9 Doctor
 */

import { Command } from 'commander';
import { access, mkdir, readdir, readFile, rmdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit } from '../lib/errors.js';
import { listIssues, type InvalidIssueFile } from '../../file/storage.js';
import { IncompatibleFormatError, readConfig } from '../../file/config.js';
import { prepareDataSyncContext } from '../lib/data-context.js';
import type { Config, Issue, IssueStatusType } from '../../lib/types.js';
import {
  isCommonDirOutsideProject,
  resolveSharedTbdPaths,
  TBD_DIR,
  DATA_SYNC_DIR,
  FORK_DIR,
  CACHE_GUIDELINES_PATHS,
  CACHE_REFERENCE_PATHS,
  CACHE_SHORTCUT_PATHS,
  CACHE_TEMPLATE_PATHS,
} from '../../lib/paths.js';
import type { ForkEntry } from '../../file/fork-manifest.js';
import { detectDuplicateYamlKeys } from '../../utils/yaml-utils.js';
import {
  getClaudePaths,
  getAgentsMdPath,
  getAgentSkillPaths,
  CLAUDE_SKILL_REL,
  AGENTS_MD_REL,
  AGENTS_SKILL_REL,
  CODEX_HOOKS_REL,
  AGENT_INTEGRATION_FORMAT,
} from '../../lib/integration-paths.js';
import { validateIssueId, extractUlidFromInternalId } from '../../lib/ids.js';
import { git } from '../../file/git.js';
import {
  checkGitVersion,
  MIN_GIT_VERSION,
  getCurrentBranch,
  checkWorktreeHealth,
  checkLocalBranchHealth,
  checkRemoteBranchHealth,
  checkSyncConsistency,
  repairWorktree,
  migrateDataToWorktree,
  initWorktree,
  countRemoteIssues,
  rescueUnrelatedHistory,
  type RemoteBranchHealth,
} from '../../file/git.js';
import {
  CommonDirLayoutError,
  isLayoutUpgradeable,
  readCommonDirLayout,
  validateCommonDirLayout,
  withSharedDataSyncLock,
  writeCommonDirLayout,
} from '../../file/common-dir-layout.js';
import { isCompatibleFormat } from '../../lib/tbd-format.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';
import { VERSION } from '../lib/version.js';
import {
  extractManagedBlock,
  inspectManagedArtifact,
  type ManagedArtifactInspection,
} from '../lib/managed-artifact.js';
import {
  buildSkillPayload,
  CODEX_BEGIN_MARKER,
  CODEX_END_MARKER,
  getCodexTbdSection,
  inspectCodexHooksSurface,
} from './setup.js';

function managedArtifactFinding(
  name: string,
  path: string,
  surface: 'portable' | 'agents-md' | 'claude' | 'codex',
  inspection: ManagedArtifactInspection,
): DiagnosticResult {
  const setupCommand = `tbd setup --auto --surfaces=${surface}`;
  switch (inspection.state) {
    case 'current':
      return { name, status: 'ok', message: 'current', path };
    case 'stale':
      return {
        name,
        status: 'warn',
        message: 'stale managed file',
        path,
        suggestion: `Run: ${setupCommand}`,
      };
    case 'missing':
      return {
        name,
        status: 'warn',
        message: 'missing',
        path,
        suggestion: `Run: ${setupCommand}`,
      };
    case 'user-owned':
      if (surface === 'agents-md' || surface === 'codex') {
        return {
          name,
          status: 'warn',
          message: 'user-owned file (tbd integration missing)',
          path,
          suggestion: `Run: ${setupCommand}`,
        };
      }
      return {
        name,
        status: 'warn',
        message: 'user-owned file (not managed by tbd)',
        path,
        suggestion: `Move the file, then run: ${setupCommand}`,
      };
    case 'too-new':
      return {
        name,
        status: 'error',
        message: `managed file uses newer integration format ${inspection.format} (supported: ${AGENT_INTEGRATION_FORMAT})`,
        path,
        suggestion: 'Upgrade tbd to manage this file: npm install -g get-tbd@latest',
      };
  }
}

/**
 * Map remote sync-branch health to a "Remote sync branch" diagnostic.
 *
 * Returns null when the remote branch does not exist (the caller then falls
 * through to local-branch / new-repo handling). Unrelated histories are a hard
 * ✗ finding routed to `tbd doctor --fix` (the rescue), NOT `tbd sync`; push
 * can never fast-forward and a plain merge refuses, so `tbd sync` cannot help.
 */
export function classifyRemoteSyncHealth(
  health: RemoteBranchHealth,
  remote: string,
  syncBranch: string,
): DiagnosticResult | null {
  if (!health.exists) {
    return null;
  }
  if (health.unrelated) {
    return {
      name: 'Remote sync branch',
      status: 'error',
      fixable: true,
      message: `${remote}/${syncBranch} histories are unrelated (no common ancestor); push cannot succeed`,
      suggestion: 'Run: tbd doctor --fix to reconcile the unrelated histories',
    };
  }
  if (health.diverged) {
    return {
      name: 'Remote sync branch',
      status: 'warn',
      message: `${remote}/${syncBranch} has diverged`,
      suggestion: 'Run: tbd sync to reconcile changes',
    };
  }
  return { name: 'Remote sync branch', status: 'ok', message: `${remote}/${syncBranch}` };
}

/**
 * The "Sync consistency" finding for a branch that is both ahead and behind.
 *
 * When the histories are unrelated, the remediation is the rescue
 * (`tbd doctor --fix`), NOT `tbd sync`; otherwise the unrelated-history error
 * (which says "run doctor --fix") and this warning (which would say "run sync")
 * point at each other in a loop with no terminating instruction. See #158.
 */
export function divergenceFinding(
  ahead: number,
  behind: number,
  unrelated: boolean,
): DiagnosticResult {
  if (unrelated) {
    return {
      name: 'Sync consistency',
      status: 'warn',
      message: `diverged (${ahead} ahead, ${behind} behind): unrelated histories`,
      suggestion: 'Run: tbd doctor --fix to reconcile the unrelated histories',
    };
  }
  return {
    name: 'Sync consistency',
    status: 'warn',
    message: `diverged (${ahead} ahead, ${behind} behind)`,
    suggestion: 'Run: tbd sync to reconcile',
  };
}

/**
 * Inputs for {@link buildLockWritabilityFinding}: the errno from the lock-write
 * probe plus the resolved shared-tbd paths used to phrase the finding and its
 * remediation.
 */
export interface LockWritabilityProbe {
  /** errno from the probe `mkdir`, or undefined when the lock path is writable. */
  code: string | undefined;
  sharedLockPath: string;
  sharedLocksDir: string;
  sharedTbdDir: string;
  gitCommonDir: string;
  projectRoot: string;
}

/**
 * Build the "Shared lock writability" finding from a probe result.
 *
 * `code` is the errno from attempting to create a directory under the shared
 * locks dir, or undefined on success. EPERM/EACCES is a hard error: every write
 * command must acquire this lock, so an unwritable lock path breaks all writes
 * (the #164 Codex-sandbox case), and a lock tbd needs but cannot take is a
 * fatal condition, not a soft warning. Any other probe failure is reported as a
 * warning since it cannot be positively interpreted. Never `fixable`: tbd cannot
 * widen a sandbox or change filesystem permissions itself.
 */
export function buildLockWritabilityFinding(params: LockWritabilityProbe): DiagnosticResult {
  const { code, sharedLockPath, sharedLocksDir, sharedTbdDir, gitCommonDir, projectRoot } = params;

  if (!code) {
    return { name: 'Shared lock writability', status: 'ok', path: sharedLocksDir };
  }

  if (code === 'EPERM' || code === 'EACCES') {
    const outsideProject = isCommonDirOutsideProject(gitCommonDir, projectRoot);
    const details = [
      `Cannot create the shared data-sync lock (${code}): ${sharedLockPath}`,
      'Read-only commands work, but every write command (create, update, sync) needs',
      'this lock, so they will fail until the lock path is writable.',
    ];
    if (outsideProject) {
      details.push(
        `The checkout (${projectRoot}) is writable, but the shared tbd state under`,
        `${sharedTbdDir} lives in the Git common dir (${gitCommonDir}) outside it —`,
        'a common situation in agent sandboxes such as Codex worktrees.',
      );
    }
    const suggestion = outsideProject
      ? `Grant write access to ${sharedTbdDir} (in an agent sandbox such as Codex, add it ` +
        `to the writable roots), or re-run the write command with sandbox escalation.`
      : `Ensure ${sharedTbdDir} is writable by this user (check filesystem permissions).`;
    return {
      name: 'Shared lock writability',
      status: 'error',
      message: `lock path not writable (${code})`,
      path: sharedLockPath,
      details,
      suggestion,
    };
  }

  return {
    name: 'Shared lock writability',
    status: 'warn',
    message: `unable to verify (${code})`,
    path: sharedLocksDir,
  };
}
import { formatHeading } from '../lib/output.js';
import {
  renderRepositorySection,
  renderConfigSection,
  renderStatisticsSection,
} from '../lib/sections.js';

const CONFIG_DIR = TBD_DIR;

interface DoctorOptions {
  fix?: boolean;
  maxHistory?: string;
}

class DoctorHandler extends BaseCommand {
  private dataSyncDir = '';
  private cwd = '';
  private config: Config | null = null;
  private issues: Issue[] = [];
  private invalidIssueFiles: InvalidIssueFile[] = [];

  async run(options: DoctorOptions): Promise<void> {
    const tbdRoot = await requireInit();

    this.cwd = tbdRoot;
    this.dataSyncDir = (await resolveSharedTbdPaths(tbdRoot)).sharedDataSyncDir;

    // Load config
    try {
      this.config = await readConfig(this.cwd);
    } catch {
      // Config may be invalid - will be caught by health checks
    }

    // Load issues
    try {
      this.invalidIssueFiles = [];
      this.issues = await listIssues(this.dataSyncDir, {
        warnOnInvalid: false,
        onInvalidIssue: (invalidIssue) => this.invalidIssueFiles.push(invalidIssue),
      });
    } catch {
      // May fail if no issues yet
    }

    // Gather status info
    const statusInfo = await this.gatherStatusInfo();

    // Gather stats info (async to check remote when local is empty)
    const statsInfo = await this.gatherStatsInfo();

    // Run health checks (core system checks). Each check runs under safeCheck so
    // a single unexpected failure produces an error finding instead of aborting
    // the whole report; doctor must list every issue it can find. (issue #164)
    const healthChecks: DiagnosticResult[] = [];

    // Check 1: Git version
    healthChecks.push(await this.safeCheck('Git version', () => this.checkGitVersion()));

    // Check 2: Config directory and file
    healthChecks.push(await this.safeCheck('Config file', () => this.checkConfig()));

    // Check 3: Issues directory
    healthChecks.push(await this.safeCheck('Issues directory', () => this.checkIssuesDirectory()));

    // Check 4: Orphaned dependencies
    healthChecks.push(
      await this.safeCheck('Dependencies', async () => this.checkOrphanedDependencies(this.issues)),
    );

    // Check 5: Duplicate IDs
    healthChecks.push(
      await this.safeCheck('Unique IDs', async () => this.checkDuplicateIds(this.issues)),
    );

    // Check 5b: Merge conflict markers in ids.yml
    healthChecks.push(
      await this.safeCheck('ID mapping conflicts', () => this.checkIdMappingConflicts(options.fix)),
    );

    // Check 6: Duplicate mapping keys in ids.yml
    healthChecks.push(
      await this.safeCheck('ID mapping keys', () => this.checkIdMappingDuplicates(options.fix)),
    );

    // Check 7: Orphaned temp files
    healthChecks.push(await this.safeCheck('Temp files', () => this.checkTempFiles(options.fix)));

    // Check 8: Issue validity
    healthChecks.push(
      await this.safeCheck('Issue validity', async () =>
        this.checkIssueValidity(this.issues, this.invalidIssueFiles),
      ),
    );

    // Check 9: Worktree health (with fix support)
    // Run BEFORE ID mapping check; worktree repair and data migration can
    // overwrite ids.yml, so mappings must be verified after migration.
    healthChecks.push(await this.safeCheck('Worktree', () => this.checkWorktree(options.fix)));

    // Check 9b: Common-dir layout metadata against config (with fix support)
    healthChecks.push(
      await this.safeCheck('Common-dir layout', () => this.checkCommonDirLayout(options.fix)),
    );

    // Check 9c: Shared data-sync lock is writable by this process
    healthChecks.push(
      await this.safeCheck('Shared lock writability', () => this.checkSharedLockWritability()),
    );

    // Check 10: Data location (issues in wrong path, with fix support)
    const dataLocationResult = await this.safeCheck('Data location', () =>
      this.checkDataLocation(options.fix),
    );
    healthChecks.push(dataLocationResult);

    // If data was migrated, reload issues and refresh dataSyncDir so
    // subsequent checks (especially ID mappings) see the current state.
    if (dataLocationResult.status === 'ok' && dataLocationResult.message?.includes('migrated')) {
      this.dataSyncDir = (await resolveSharedTbdPaths(this.cwd)).sharedDataSyncDir;
      try {
        this.invalidIssueFiles = [];
        this.issues = await listIssues(this.dataSyncDir, {
          warnOnInvalid: false,
          onInvalidIssue: (invalidIssue) => this.invalidIssueFiles.push(invalidIssue),
        });
      } catch {
        // Will be caught by other health checks
      }
    }

    // Check 8b: Missing ID mappings (issues without short IDs)
    // Runs AFTER worktree/migration checks to ensure ids.yml is in its final location.
    const parsedMaxHistory = options.maxHistory ? parseInt(options.maxHistory, 10) : 50;
    const maxHistory =
      Number.isNaN(parsedMaxHistory) || parsedMaxHistory < 0 ? 50 : parsedMaxHistory;
    healthChecks.push(
      await this.safeCheck('ID mapping coverage', () =>
        this.checkMissingMappings(options.fix, maxHistory),
      ),
    );

    // Check 11: Local sync branch health
    healthChecks.push(await this.safeCheck('Local sync branch', () => this.checkLocalSyncBranch()));

    // Check 12: Remote sync branch health
    healthChecks.push(
      await this.safeCheck('Remote sync branch', () => this.checkRemoteSyncBranch(options.fix)),
    );

    // Check 13: Local has data but remote empty (ai-trade-arena bug detection)
    healthChecks.push(await this.safeCheck('Sync status', () => this.checkLocalVsRemoteData()));

    // Check 14: Multi-user/clone scenario detection
    healthChecks.push(await this.safeCheck('Clone status', () => this.checkCloneScenarios()));

    // Check 15: Sync consistency (worktree matches local, ahead/behind counts)
    healthChecks.push(await this.safeCheck('Sync consistency', () => this.checkSyncConsistency()));

    // Check 16: Forked docs (manifest ↔ base snapshots ↔ fork dir consistency).
    // A check *group*: contributes zero lines when nothing is forked and no
    // fork dir exists (doctor output for non-fork users must not grow), one ✓
    // line when all forks are healthy, and one ⚠ line per issue category
    // otherwise. Unexpected throws degrade to one error finding (safeCheck
    // semantics, adapted for a multi-result check).
    try {
      healthChecks.push(...(await this.checkForkedDocs(options.fix)));
    } catch (error) {
      healthChecks.push({
        name: 'Forked docs',
        status: 'error',
        message: `check could not complete: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }

    // Run integration checks (optional IDE/agent integrations)
    const integrationChecks: DiagnosticResult[] = [];

    // Integration 1: Portable Agent Skill (.agents/skills, primary)
    integrationChecks.push(
      await this.safeCheck('Portable Agent Skill', () => this.checkPortableSkill()),
    );

    // Integration 2: Claude Code skill mirror
    integrationChecks.push(
      await this.safeCheck('Claude Code skill', () => this.checkClaudeSkill()),
    );

    // Integration 3: Codex AGENTS.md (also used by Cursor since v1.6)
    integrationChecks.push(await this.safeCheck('AGENTS.md', () => this.checkCodexAgents()));

    // Integration 4: Codex hooks
    integrationChecks.push(await this.safeCheck('Codex hooks', () => this.checkCodexHooks()));

    // Combine for overall status
    const allChecks = [...healthChecks, ...integrationChecks];
    const allOk = allChecks.every((c) => c.status === 'ok');
    const hasErrors = allChecks.some((c) => c.status === 'error');
    const hasFixable = allChecks.some((c) => c.fixable && c.status !== 'ok');

    this.output.data(
      { statusInfo, statsInfo, healthChecks, integrationChecks, healthy: allOk },
      () => {
        const colors = this.output.getColors();

        // REPOSITORY section (shared with status command)
        renderRepositorySection(
          {
            version: VERSION,
            workingDirectory: this.cwd,
            initialized: true, // doctor requires init
            gitRepository: !!statusInfo.gitBranch,
            gitBranch: statusInfo.gitBranch,
            gitVersion: null, // Git version is shown in health checks
            gitVersionSupported: true,
          },
          colors,
          { showHeading: true },
        );

        // CONFIG section (shared with status command)
        if (this.config) {
          renderConfigSection(
            {
              syncBranch: this.config.sync.branch,
              remote: this.config.sync.remote,
              displayPrefix: this.config.display.id_prefix,
            },
            colors,
          );
        }

        // STATISTICS section (shared with stats command)
        renderStatisticsSection(statsInfo, colors);

        // INTEGRATIONS section
        console.log('');
        console.log(colors.bold(formatHeading('Integrations')));
        renderDiagnostics(integrationChecks, colors);

        // HEALTH CHECKS section (doctor-only)
        console.log('');
        console.log(colors.bold(formatHeading('Health Checks')));
        renderDiagnostics(healthChecks, colors);

        // Final summary
        console.log('');
        if (allOk) {
          this.output.success('Repository is healthy');
        } else if (hasFixable && !options.fix) {
          this.output.warn('Issues found. Run with --fix to repair.');
        } else {
          this.output.warn('Issues found that may require manual intervention.');
        }
      },
    );

    // Exit code. ⚠ (warn-level) findings are recoverable state and stay at exit 0
    // so existing tooling that runs `tbd doctor` on a clean-but-incomplete repo
    // doesn't break. ✗ (error-level) findings (invalid config, future-format
    // layout, corrupted data, future-format on-disk markers) are hard problems
    // that scripts and CI deserve to learn about via a non-zero exit.
    // See: docs/tbd-format-versioning.md (internal contributor guide).
    if (hasErrors) {
      process.exitCode = 1;
    }
  }

  private async gatherStatusInfo(): Promise<{
    gitBranch: string | null;
    worktreeHealthy: boolean;
  }> {
    let gitBranch: string | null = null;
    try {
      gitBranch = await getCurrentBranch(this.cwd);
    } catch {
      // Not in a git repo or no commits
    }

    const worktreeHealth = await checkWorktreeHealth(this.cwd);

    return {
      gitBranch,
      worktreeHealthy: worktreeHealth.valid,
    };
  }

  private async gatherStatsInfo(): Promise<{
    total: number;
    ready: number;
    inProgress: number;
    blocked: number;
    open: number;
    remoteTotal: number | null;
  }> {
    // Count by status
    const byStatus: Record<IssueStatusType, number> = {
      open: 0,
      in_progress: 0,
      blocked: 0,
      deferred: 0,
      closed: 0,
    };

    // Build set of blocked issue IDs
    const blockedIds = new Set<string>();
    for (const issue of this.issues) {
      for (const dep of issue.dependencies) {
        if (dep.type === 'blocks') {
          const blockedIssue = this.issues.find((i) => i.id === dep.target);
          if (blockedIssue && blockedIssue.status !== 'closed') {
            blockedIds.add(dep.target);
          }
        }
      }
    }

    // Count ready issues (open and not blocked)
    let readyCount = 0;

    for (const issue of this.issues) {
      byStatus[issue.status]++;
      if (issue.status === 'open' && !blockedIds.has(issue.id)) {
        readyCount++;
      }
    }

    // Check remote issue count when local is empty
    // This helps users on fresh clones understand that data exists
    let remoteTotal: number | null = null;
    if (this.issues.length === 0 && this.config) {
      const remote = this.config.sync.remote ?? 'origin';
      const syncBranch = this.config.sync.branch ?? 'tbd-sync';
      remoteTotal = await countRemoteIssues(remote, syncBranch, this.cwd);
    }

    return {
      total: this.issues.length,
      ready: readyCount,
      inProgress: byStatus.in_progress,
      blocked: blockedIds.size,
      open: byStatus.open,
      remoteTotal,
    };
  }

  private async checkGitVersion(): Promise<DiagnosticResult> {
    try {
      const { version, supported } = await checkGitVersion();
      const versionStr = `${version.major}.${version.minor}.${version.patch}`;

      if (supported) {
        return {
          name: 'Git version',
          status: 'ok',
          message: versionStr,
        };
      }

      return {
        name: 'Git version',
        status: 'error',
        message: `${versionStr} (requires ${MIN_GIT_VERSION}+)`,
        suggestion: 'Upgrade Git: https://git-scm.com/downloads',
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('git') || msg.includes('not found') || msg.includes('ENOENT')) {
        return {
          name: 'Git version',
          status: 'error',
          message: 'Git not found',
          suggestion: 'Install Git: https://git-scm.com/downloads',
        };
      }
      return {
        name: 'Git version',
        status: 'warn',
        message: `Unable to check: ${msg}`,
      };
    }
  }

  private async checkConfig(): Promise<DiagnosticResult> {
    const configPath = join(CONFIG_DIR, 'config.yml');
    try {
      await access(join(this.cwd, configPath));
      await readConfig(this.cwd);
      return { name: 'Config file', status: 'ok', path: configPath };
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('ENOENT')) {
        return {
          name: 'Config file',
          status: 'error',
          message: 'not found',
          path: configPath,
          suggestion: 'Run: tbd init',
        };
      }
      if (error instanceof IncompatibleFormatError) {
        return {
          name: 'Config file',
          status: 'error',
          message: `requires newer tbd (found ${error.foundFormat}, supported ${error.supportedFormat})`,
          path: configPath,
          suggestion: 'Upgrade: npm install -g get-tbd@latest',
        };
      }
      return {
        name: 'Config file',
        status: 'error',
        message: 'Invalid config file',
        path: configPath,
      };
    }
  }

  private async checkIssuesDirectory(): Promise<DiagnosticResult> {
    const issuesPath = join(CONFIG_DIR, 'issues');
    try {
      await access(join(this.dataSyncDir, 'issues'));
      return { name: 'Issues directory', status: 'ok', path: issuesPath };
    } catch {
      // No issues directory is normal for a fresh/empty repo
      return {
        name: 'Issues directory',
        status: 'ok',
        message: 'empty (no issues yet)',
        path: issuesPath,
      };
    }
  }

  private checkOrphanedDependencies(issues: Issue[]): DiagnosticResult {
    const issueIds = new Set(issues.map((i) => i.id));
    const orphans: string[] = [];

    for (const issue of issues) {
      for (const dep of issue.dependencies) {
        if (!issueIds.has(dep.target)) {
          orphans.push(`${issue.id} -> ${dep.target} (missing)`);
        }
      }
    }

    if (orphans.length === 0) {
      return { name: 'Dependencies', status: 'ok' };
    }

    return {
      name: 'Dependencies',
      status: 'warn',
      message: `${orphans.length} orphaned reference(s)`,
      details: orphans,
      fixable: true,
      suggestion: 'Run: tbd doctor --fix',
    };
  }

  private checkDuplicateIds(issues: Issue[]): DiagnosticResult {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const issue of issues) {
      if (seen.has(issue.id)) {
        duplicates.push(issue.id);
      }
      seen.add(issue.id);
    }

    if (duplicates.length === 0) {
      return { name: 'Unique IDs', status: 'ok' };
    }

    return {
      name: 'Unique IDs',
      status: 'error',
      message: `${duplicates.length} duplicate ID(s)`,
      details: duplicates.map((id) => `${id} (duplicate)`),
      suggestion: 'Manually remove duplicate issue files',
    };
  }

  /**
   * Check 5b: Merge conflict markers in ids.yml.
   *
   * After a failed git merge during sync, ids.yml may retain unresolved
   * conflict markers (<<<<<<< / ======= / >>>>>>>). This blocks all tbd
   * commands since YAML parsing throws MergeConflictError.
   *
   * For ids.yml, both sides are simple key-value pairs that are append-only,
   * so the resolution is trivial: keep all entries from both sides.
   *
   * With --fix, extracts both sides, merges them, and re-saves.
   */
  private async checkIdMappingConflicts(fix?: boolean): Promise<DiagnosticResult> {
    const mappingPath = join(this.dataSyncDir, 'mappings', 'ids.yml');
    let content: string;

    try {
      content = await readFile(mappingPath, 'utf-8');
    } catch {
      return { name: 'ID mapping conflicts', status: 'ok' };
    }

    const { hasMergeConflictMarkers } = await import('../../utils/yaml-utils.js');
    if (!hasMergeConflictMarkers(content)) {
      return { name: 'ID mapping conflicts', status: 'ok' };
    }

    if (fix && !this.checkDryRun('Resolve merge conflicts in ids.yml')) {
      try {
        const { resolveIdMappingConflicts, saveIdMapping } =
          await import('../../file/id-mapping.js');
        const resolved = resolveIdMappingConflicts(content);
        await saveIdMapping(this.dataSyncDir, resolved);
        return {
          name: 'ID mapping conflicts',
          status: 'ok',
          message: `resolved merge conflicts (${resolved.shortToUlid.size} entries)`,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          name: 'ID mapping conflicts',
          status: 'error',
          message: `failed to resolve conflicts: ${msg}`,
        };
      }
    }

    return {
      name: 'ID mapping conflicts',
      status: 'error',
      message: 'ids.yml contains unresolved merge conflict markers',
      fixable: true,
      suggestion: 'Run: tbd doctor --fix to auto-resolve',
    };
  }

  /**
   * Check for duplicate keys in the ID mapping file (ids.yml).
   *
   * After a git merge conflict resolution that keeps entries from both sides,
   * ids.yml can end up with duplicate YAML keys. The yaml parser throws
   * "Map keys must be unique" which breaks tbd commands.
   *
   * With --fix, re-saves the file to eliminate duplicates.
   */
  private async checkIdMappingDuplicates(fix?: boolean): Promise<DiagnosticResult> {
    const mappingPath = join(this.dataSyncDir, 'mappings', 'ids.yml');
    let content: string;

    try {
      content = await readFile(mappingPath, 'utf-8');
    } catch {
      // File doesn't exist; normal for repos with no issues yet
      return { name: 'ID mapping keys', status: 'ok' };
    }

    const duplicates = detectDuplicateYamlKeys(content);

    if (duplicates.length === 0) {
      return { name: 'ID mapping keys', status: 'ok' };
    }

    if (fix && !this.checkDryRun('Fix duplicate ID mapping keys')) {
      // Load and re-save to deduplicate (Map + saveIdMapping naturally dedupes)
      try {
        const { loadIdMapping, saveIdMapping } = await import('../../file/id-mapping.js');
        const mapping = await loadIdMapping(this.dataSyncDir);
        await saveIdMapping(this.dataSyncDir, mapping);
        return {
          name: 'ID mapping keys',
          status: 'ok',
          message: `fixed ${duplicates.length} duplicate key(s)`,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          name: 'ID mapping keys',
          status: 'error',
          message: `failed to fix duplicates: ${msg}`,
        };
      }
    }

    return {
      name: 'ID mapping keys',
      status: 'warn',
      message: `${duplicates.length} duplicate key(s) in ids.yml`,
      details: duplicates.map((k) => `"${k}" appears multiple times`),
      fixable: true,
      suggestion: 'Run: tbd doctor --fix to deduplicate',
    };
  }

  private async checkTempFiles(fix?: boolean): Promise<DiagnosticResult> {
    const issuesDir = join(this.dataSyncDir, 'issues');
    // Display the actual scanned path, not a stale `.tbd/issues` that
    // doesn't exist in current installs.
    const issuesPath = join(DATA_SYNC_DIR, 'issues');
    let tempFiles: string[] = [];

    try {
      const files = await readdir(issuesDir);
      // Catch both plain `.tmp` and `atomically`'s leftover
      // `<name>.md.tmp-NNNN` intermediates.
      tempFiles = files.filter((f) => f.endsWith('.tmp') || /\.tmp-\d+$/.test(f));
    } catch {
      // Directory doesn't exist - no temp files
      return { name: 'Temp files', status: 'ok', path: issuesPath };
    }

    if (tempFiles.length === 0) {
      return { name: 'Temp files', status: 'ok', path: issuesPath };
    }

    if (fix && !this.checkDryRun('Clean temp files')) {
      // Clean up temp files
      for (const file of tempFiles) {
        try {
          await unlink(join(issuesDir, file));
        } catch {
          // Ignore errors
        }
      }
      return {
        name: 'Temp files',
        status: 'ok',
        message: `Cleaned ${tempFiles.length} temp file(s)`,
        path: issuesPath,
      };
    }

    return {
      name: 'Temp files',
      status: 'warn',
      message: `${tempFiles.length} orphaned temp file(s)`,
      path: issuesPath,
      details: tempFiles,
      fixable: true,
      suggestion: 'Run: tbd doctor --fix',
    };
  }

  private checkIssueValidity(
    issues: Issue[],
    invalidIssueFiles: InvalidIssueFile[],
  ): DiagnosticResult {
    const invalid: { id: string; reason: string }[] = [];

    for (const invalidIssueFile of invalidIssueFiles) {
      invalid.push({ id: invalidIssueFile.file, reason: invalidIssueFile.reason });
    }

    for (const issue of issues) {
      const issueId = issue.id ?? 'unknown';
      // Check required fields
      if (!issue.id) {
        invalid.push({ id: issueId, reason: 'missing required field: id' });
        continue;
      }
      if (!issue.title) {
        invalid.push({ id: issueId, reason: 'missing required field: title' });
        continue;
      }
      if (!issue.status) {
        invalid.push({ id: issueId, reason: 'missing required field: status' });
        continue;
      }
      if (!issue.kind) {
        invalid.push({ id: issueId, reason: 'missing required field: kind' });
        continue;
      }
      // Check ID format
      if (!validateIssueId(issue.id)) {
        invalid.push({ id: issueId, reason: 'invalid ID format' });
        continue;
      }
      // Check priority range
      if (issue.priority < 0 || issue.priority > 4) {
        invalid.push({ id: issueId, reason: `invalid priority ${issue.priority} (must be 0-4)` });
      }
    }

    if (invalid.length === 0) {
      return { name: 'Issue validity', status: 'ok' };
    }

    return {
      name: 'Issue validity',
      status: 'error',
      message: `${invalid.length} invalid issue file(s)`,
      path: join(CONFIG_DIR, 'issues'),
      details: invalid.map((i) => `${i.id}: ${i.reason}`),
      suggestion: 'Manually fix or delete invalid issue files',
    };
  }

  /**
   * Check for issues that have no short ID mapping in ids.yml.
   *
   * This can happen when a git merge brings in issue files (e.g., from
   * a feature branch with outbox issues) without the corresponding
   * ids.yml entries. Without a mapping, any command that tries to
   * display the issue ID will crash.
   *
   * With --fix, creates missing mappings automatically.
   */
  private async checkMissingMappings(fix?: boolean, maxHistory = 50): Promise<DiagnosticResult> {
    if (this.issues.length === 0) {
      return { name: 'ID mapping coverage', status: 'ok' };
    }

    const { loadIdMapping, saveIdMapping, reconcileMappings } =
      await import('../../file/id-mapping.js');
    const mapping = await loadIdMapping(this.dataSyncDir);

    // Find issues missing from the mapping
    const missingIds: string[] = [];
    for (const issue of this.issues) {
      const ulid = extractUlidFromInternalId(issue.id);
      if (!mapping.ulidToShort.has(ulid)) {
        missingIds.push(issue.id);
      }
    }

    if (missingIds.length === 0) {
      return { name: 'ID mapping coverage', status: 'ok' };
    }

    if (fix && !this.checkDryRun('Create missing ID mappings')) {
      // Try to recover original short IDs from git history before generating new ones.
      // Search recent commits on the tbd-sync branch that touched ids.yml, not
      // just the latest. This handles the case where a bug (e.g., migration
      // overwrite) destroyed entries in a recent commit; the entries still exist
      // in earlier commits. Since mappings are append-only, merging all versions
      // is safe. Capped via --max-history (default 50, 0 = full history).
      const { parseIdMappingFromYaml, mergeIdMappings } = await import('../../file/id-mapping.js');
      let historicalMapping: Awaited<ReturnType<typeof loadIdMapping>> | undefined;
      try {
        const config = await import('../../file/config.js').then((m) => m.readConfig(this.cwd));
        const syncBranch = config.sync.branch;
        // Get recent commits that touched ids.yml (most recent first, capped)
        const logArgs = ['log', '--format=%H'];
        if (maxHistory > 0) {
          logArgs.push(`-${maxHistory}`);
        }
        logArgs.push(syncBranch, '--', `${DATA_SYNC_DIR}/mappings/ids.yml`);
        const commitLog = await git(...logArgs);
        const commitHashes = commitLog.trim().split('\n').filter(Boolean);
        for (const commitHash of commitHashes) {
          try {
            const idsContent = await git('show', `${commitHash}:${DATA_SYNC_DIR}/mappings/ids.yml`);
            if (idsContent) {
              const versionMapping = parseIdMappingFromYaml(idsContent);
              if (!historicalMapping) {
                historicalMapping = versionMapping;
              } else {
                historicalMapping = mergeIdMappings(historicalMapping, versionMapping);
              }
            }
          } catch {
            // Individual commit may be unreachable; skip
          }
        }
      } catch {
        // Git history not available - will generate new IDs
      }

      const historicalCount = historicalMapping?.shortToUlid.size ?? 0;
      const result = reconcileMappings(missingIds, mapping, historicalMapping);
      await saveIdMapping(this.dataSyncDir, mapping);

      const parts: string[] = [];
      if (result.recovered.length > 0) {
        parts.push(`recovered ${result.recovered.length} from git history`);
      }
      if (result.created.length > 0) {
        parts.push(`created ${result.created.length} new`);
      }
      const details: string[] = [
        `Scanned ${maxHistory > 0 ? `up to ${maxHistory}` : 'all'} git commits for ids.yml history`,
        `Found ${historicalCount} historical mapping(s) to use for recovery`,
        `${missingIds.length} issue(s) were missing short ID mappings`,
      ];
      if (result.recovered.length > 0) {
        details.push(`Recovered ${result.recovered.length} original short ID(s) from git history`);
      }
      if (result.created.length > 0) {
        details.push(
          `Generated ${result.created.length} new short ID(s) (originals not found in history)`,
        );
      }
      return {
        name: 'ID mapping coverage',
        status: 'ok',
        message: parts.join(', '),
        details,
      };
    }

    return {
      name: 'ID mapping coverage',
      status: 'error',
      message: `${missingIds.length} issue(s) without short ID mapping`,
      details: missingIds.map((id) => `${id} (no short ID)`),
      fixable: true,
      suggestion: 'Run: tbd doctor --fix to create missing mappings',
    };
  }

  private async checkPortableSkill(): Promise<DiagnosticResult> {
    const { portable } = getAgentSkillPaths(this.cwd);
    const inspection = await inspectManagedArtifact({
      path: portable,
      expectedContent: await buildSkillPayload(true, true),
      ownershipMarker: '<!-- DO NOT EDIT: Generated by tbd setup',
      supportedFormat: AGENT_INTEGRATION_FORMAT,
    });
    return managedArtifactFinding('Portable Agent Skill', AGENTS_SKILL_REL, 'portable', inspection);
  }

  private async checkClaudeSkill(): Promise<DiagnosticResult> {
    const claudePaths = getClaudePaths(this.cwd);
    const inspection = await inspectManagedArtifact({
      path: claudePaths.skill,
      expectedContent: await buildSkillPayload(true, true),
      ownershipMarker: '<!-- DO NOT EDIT: Generated by tbd setup',
      supportedFormat: AGENT_INTEGRATION_FORMAT,
    });
    return managedArtifactFinding('Claude Code skill', CLAUDE_SKILL_REL, 'claude', inspection);
  }

  private async checkCodexHooks(): Promise<DiagnosticResult> {
    return managedArtifactFinding(
      'Codex hooks',
      CODEX_HOOKS_REL,
      'codex',
      await inspectCodexHooksSurface(this.cwd),
    );
  }

  private async checkCodexAgents(): Promise<DiagnosticResult> {
    const agentsPath = getAgentsMdPath(this.cwd);
    const expected = getCodexTbdSection();
    const inspection = await inspectManagedArtifact({
      path: agentsPath,
      expectedContent: expected,
      ownershipMarker: CODEX_BEGIN_MARKER,
      supportedFormat: AGENT_INTEGRATION_FORMAT,
      selectManagedContent: (content) =>
        extractManagedBlock(content, CODEX_BEGIN_MARKER, CODEX_END_MARKER),
    });
    return managedArtifactFinding('AGENTS.md', AGENTS_MD_REL, 'agents-md', inspection);
  }

  /**
   * Check worktree health with enhanced status detection.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4
   */
  private async checkWorktree(fix?: boolean): Promise<DiagnosticResult> {
    const worktreePath = (await resolveSharedTbdPaths(this.cwd)).sharedWorktreePath;
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';
    const worktreeHealth = await checkWorktreeHealth(this.cwd, syncBranch);

    switch (worktreeHealth.status) {
      case 'valid':
        return { name: 'Worktree', status: 'ok', path: worktreePath };

      case 'missing':
        // Worktree not existing is OK in steady state; it gets created on the next
        // mutating command. But with --fix the user is explicitly asking for repair,
        // so initialize the shared data-sync layout now (this also migrates legacy
        // per-checkout worktrees and bumps the config to the current format, the same
        // path `tbd sync` takes).
        if (fix && !this.checkDryRun('Initialize shared data-sync worktree')) {
          try {
            // ensureSharedDataSyncLayout (inside prepareDataSyncContext) MUST run
            // under withSharedDataSyncLock; concurrent agents from sibling worktrees
            // must not race init/migrate/repair. Match the pattern used for the
            // prunable/corrupted repair below.
            // See: docs/tbd-format-versioning.md, packages/tbd/src/cli/lib/data-context.ts.
            await withSharedDataSyncLock(this.cwd, async () => {
              await prepareDataSyncContext(this.cwd);
            });
          } catch (error) {
            return {
              name: 'Worktree',
              status: 'error',
              message: `initialization failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
              path: worktreePath,
            };
          }
          // Refresh config in memory so checks that run after this one (e.g.
          // checkCommonDirLayout) see the just-bumped format instead of the stale
          // pre-migration view.
          try {
            this.config = await readConfig(this.cwd);
          } catch {
            // Leave stale config rather than blocking the report.
          }
          return {
            name: 'Worktree',
            status: 'ok',
            message: 'initialized',
            path: worktreePath,
          };
        }
        return { name: 'Worktree', status: 'ok', message: 'not created yet', path: worktreePath };

      case 'prunable':
      case 'corrupted': {
        // Attempt repair if --fix is provided and not in dry-run mode
        if (fix && !this.checkDryRun('Repair worktree')) {
          // Serialize worktree repair under the shared lock so concurrent
          // agents from sibling worktrees cannot race the repair.
          const repairStatus = worktreeHealth.status;
          const result = await withSharedDataSyncLock(this.cwd, async () =>
            repairWorktree(this.cwd, repairStatus, remote, syncBranch),
          );

          if (result.success) {
            const message = result.backedUp
              ? `repaired (backed up to ${result.backedUp})`
              : 'repaired successfully';
            return { name: 'Worktree', status: 'ok', message, path: worktreePath };
          }

          return {
            name: 'Worktree',
            status: 'error',
            message: `repair failed: ${result.error}`,
            path: worktreePath,
          };
        }

        // No --fix flag, report the issue
        if (worktreeHealth.status === 'prunable') {
          return {
            name: 'Worktree',
            status: 'error',
            message: 'prunable (directory deleted)',
            path: worktreePath,
            details: [
              'The worktree directory was deleted but git still tracks it.',
              'This can cause data to be written to the wrong location.',
            ],
            fixable: true,
            suggestion: 'Run: tbd doctor --fix to recreate worktree',
          };
        }

        return {
          name: 'Worktree',
          status: 'error',
          message: worktreeHealth.error ?? 'corrupted',
          path: worktreePath,
          details: ['The worktree exists but is not a valid git worktree.'],
          fixable: true,
          suggestion: 'Run: tbd doctor --fix to repair',
        };
      }

      default:
        return {
          name: 'Worktree',
          status: 'warn',
          message: worktreeHealth.error ?? 'unknown status',
          path: worktreePath,
          fixable: true,
          suggestion: 'Run: tbd doctor --fix',
        };
    }
  }

  /**
   * Check $GIT_COMMON_DIR/tbd/layout.yml against the checkout config.
   *
   * Reports missing (initialized on next mutating command), mismatched (rewrite
   * from config under --fix), or future-format (requires newer tbd, no fix).
   *
   * See: plan-2026-05-17-shared-common-dir-sync-worktree.md §Format And Layout
   * Versioning.
   */
  private async checkCommonDirLayout(fix?: boolean): Promise<DiagnosticResult> {
    if (!this.config) {
      return { name: 'Common-dir layout', status: 'ok', message: 'skipped (no config)' };
    }
    const sharedPaths = await resolveSharedTbdPaths(this.cwd);
    const layoutPath = sharedPaths.sharedLayoutPath;
    let layout;
    try {
      layout = await readCommonDirLayout(layoutPath);
    } catch (error) {
      // A corrupt/unparseable layout is machine-local and regenerable from the
      // config; make it fixable rather than a dead-end error.
      if (fix && !this.checkDryRun('Rewrite corrupt common-dir layout from config')) {
        const configRef = this.config;
        await withSharedDataSyncLock(this.cwd, async () =>
          writeCommonDirLayout(sharedPaths, configRef),
        );
        return {
          name: 'Common-dir layout',
          status: 'ok',
          message: 'rewritten from config (was unreadable)',
          path: layoutPath,
        };
      }
      return {
        name: 'Common-dir layout',
        status: 'error',
        message: `${error instanceof Error ? error.message : String(error)}`,
        path: layoutPath,
        fixable: true,
        suggestion: `Run: tbd doctor --fix (rewrites it from config), or delete ${layoutPath}`,
      };
    }
    if (!layout) {
      // Initialized lazily by the next mutating command. Not an error.
      return {
        name: 'Common-dir layout',
        status: 'ok',
        message: 'not initialized yet (created on first sync)',
        path: layoutPath,
      };
    }
    if (!isCompatibleFormat(layout.tbd_format)) {
      return {
        name: 'Common-dir layout',
        status: 'error',
        message: `requires newer tbd (found ${layout.tbd_format})`,
        path: layoutPath,
        suggestion: 'Upgrade: npm install -g get-tbd@latest',
      };
    }
    // A layout from an older but compatible format than the (in-memory,
    // already-migrated) config is the normal mid-migration state, not a
    // mismatch: the format bump applies on the next data command. Surface it as
    // an informational warning (exit 0, so CI on un-migrated f04 repos is not
    // broken); --fix applies the FULL migration (config + layout) via the locked
    // data-context path; never just the layout, which would half-migrate the
    // repo and lock out older clients with nothing to commit.
    if (isLayoutUpgradeable(layout, this.config)) {
      if (fix && !this.checkDryRun('Apply pending format migration')) {
        await prepareDataSyncContext(this.cwd);
        return {
          name: 'Common-dir layout',
          status: 'ok',
          message: `format migration applied (${layout.tbd_format} → ${this.config.tbd_format})`,
          path: layoutPath,
        };
      }
      return {
        name: 'Common-dir layout',
        status: 'warn',
        message: `format migration pending (${layout.tbd_format} → ${this.config.tbd_format}); applies on next write or 'tbd doctor --fix'`,
        path: layoutPath,
        fixable: true,
        suggestion: 'Run: tbd doctor --fix (or any write command) to apply',
      };
    }

    try {
      validateCommonDirLayout(layout, this.config);
      return { name: 'Common-dir layout', status: 'ok', path: layoutPath };
    } catch (error) {
      if (!(error instanceof CommonDirLayoutError)) throw error;
      if (fix && !this.checkDryRun('Repair common-dir layout')) {
        const configRef = this.config;
        await withSharedDataSyncLock(this.cwd, async () =>
          writeCommonDirLayout(sharedPaths, configRef, layout),
        );
        return {
          name: 'Common-dir layout',
          status: 'ok',
          message: 'rewritten from config',
          path: layoutPath,
        };
      }
      return {
        name: 'Common-dir layout',
        status: 'error',
        message: 'mismatched with config',
        path: layoutPath,
        fixable: true,
        suggestion: 'Run: tbd doctor --fix',
      };
    }
  }

  /**
   * Probe whether this process can create the shared data-sync lock.
   *
   * Read-only diagnostics never take the lock, so a checkout whose
   * `$GIT_COMMON_DIR/tbd` is outside the writable sandbox (e.g. a Codex
   * worktree) looks healthy here while every write command fails with EPERM on
   * the lock mkdir. This probe mirrors `withSharedDataSyncLock`: ensure the
   * locks dir, then create and remove a uniquely named probe directory inside
   * it. It is fully self-contained and never throws, so it cannot abort the
   * doctor run. See issue #164.
   */
  private async checkSharedLockWritability(): Promise<DiagnosticResult> {
    let paths;
    try {
      paths = await resolveSharedTbdPaths(this.cwd);
    } catch (error) {
      return {
        name: 'Shared lock writability',
        status: 'warn',
        message: `unable to resolve shared paths: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    const probeDir = join(paths.sharedLocksDir, `.tbd-doctor-probe-${randomUUID()}.lock`);
    let code: string | undefined;
    try {
      // Mirrors withSharedDataSyncLock: ensuring the locks dir may create it as a
      // side effect, which is harmless; any write command would create it anyway.
      await mkdir(paths.sharedLocksDir, { recursive: true });
      await mkdir(probeDir);
    } catch (error) {
      // The thrown value may not be an ErrnoException; optional-chain so a
      // non-Error throw degrades to 'UNKNOWN' instead of crashing the probe.
      code = (error as NodeJS.ErrnoException | undefined)?.code ?? 'UNKNOWN';
    } finally {
      await rmdir(probeDir).catch(() => {});
    }

    return buildLockWritabilityFinding({
      code,
      sharedLockPath: paths.sharedLockPath,
      sharedLocksDir: paths.sharedLocksDir,
      sharedTbdDir: paths.sharedTbdDir,
      gitCommonDir: paths.gitCommonDir,
      projectRoot: this.cwd,
    });
  }

  /**
   * Run a single diagnostic check, converting an unexpected throw into an error
   * finding instead of letting it abort the whole `tbd doctor` run. Doctor must
   * surface every issue it can find, not just the first failure. (issue #164)
   */
  private async safeCheck(
    name: string,
    fn: () => Promise<DiagnosticResult>,
  ): Promise<DiagnosticResult> {
    try {
      return await fn();
    } catch (error) {
      return {
        name,
        status: 'error',
        message: `check could not complete: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  /**
   * Check for issues in wrong location.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §5
   *
   * Issues should be in $GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/issues/
   * If they're in .tbd/data-sync/issues/ on main branch, the worktree was missing
   * and data was written to the fallback path - this is a bug requiring migration.
   */
  private async checkDataLocation(fix?: boolean): Promise<DiagnosticResult> {
    const wrongPath = join(this.cwd, DATA_SYNC_DIR);
    const wrongIssuesPath = join(wrongPath, 'issues');

    // Try to list issues in the wrong location
    let wrongPathIssues: Issue[] = [];
    try {
      wrongPathIssues = await listIssues(wrongPath);
    } catch {
      // No issues in wrong path - this is expected
    }

    if (wrongPathIssues.length === 0) {
      return { name: 'Data location', status: 'ok' };
    }

    // Issues found in wrong location - attempt migration if --fix and not dry-run
    if (fix && !this.checkDryRun('Migrate data to worktree')) {
      // First ensure worktree exists - create it if missing
      let worktreeHealth = await checkWorktreeHealth(this.cwd);
      if (worktreeHealth.status === 'missing') {
        // Worktree doesn't exist yet - create it for migration.
        // Serialize under the shared lock so concurrent agents cannot race.
        const initResult = await withSharedDataSyncLock(this.cwd, async () =>
          initWorktree(this.cwd),
        );
        if (!initResult.success) {
          return {
            name: 'Data location',
            status: 'error',
            message: `${wrongPathIssues.length} issue(s) in wrong location, failed to create worktree: ${initResult.error}`,
            path: wrongIssuesPath,
          };
        }
        worktreeHealth = await checkWorktreeHealth(this.cwd);
      }

      if (worktreeHealth.status !== 'valid') {
        return {
          name: 'Data location',
          status: 'error',
          message: `${wrongPathIssues.length} issue(s) in wrong location, worktree not ready`,
          path: wrongIssuesPath,
          details: [
            'Cannot migrate: worktree must be repaired first.',
            'The worktree repair should have run before this check.',
          ],
        };
      }

      // Migrate data to worktree (remove source after backup + copy)
      const result = await migrateDataToWorktree(this.cwd, true);

      if (result.success) {
        const details: string[] = [];
        if (result.backupPath) {
          details.push(`Backed up to ${result.backupPath}`);
        }
        details.push(
          `Migrated ${result.migratedCount} file(s) from .tbd/data-sync/ to worktree`,
          'Source files removed after successful migration',
        );
        const message = result.backupPath
          ? `migrated ${result.migratedCount} file(s), backed up to ${result.backupPath}`
          : `migrated ${result.migratedCount} file(s)`;
        return {
          name: 'Data location',
          status: 'ok',
          message,
          path: wrongIssuesPath,
          details,
        };
      }

      return {
        name: 'Data location',
        status: 'error',
        message: `migration failed: ${result.error}`,
        path: wrongIssuesPath,
      };
    }

    // No --fix flag, report the issue
    return {
      name: 'Data location',
      status: 'error',
      message: `${wrongPathIssues.length} issue(s) in wrong location`,
      path: wrongIssuesPath,
      details: [
        `Found ${wrongPathIssues.length} issues in .tbd/data-sync/ (wrong)`,
        'Issues should be in $GIT_COMMON_DIR/tbd/data-sync-worktree/.tbd/data-sync/',
        'This indicates the worktree was missing when issues were created',
      ],
      fixable: true,
      suggestion: 'Run: tbd doctor --fix to migrate issues to worktree',
    };
  }

  /**
   * Check local sync branch health.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
   */
  private async checkLocalSyncBranch(): Promise<DiagnosticResult> {
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const localHealth = await checkLocalBranchHealth(syncBranch, this.cwd);

    if (localHealth.exists && !localHealth.orphaned) {
      return { name: 'Local sync branch', status: 'ok', message: syncBranch };
    }

    if (!localHealth.exists) {
      // Local branch doesn't exist - check if remote exists
      const remote = this.config?.sync.remote ?? 'origin';
      const remoteHealth = await checkRemoteBranchHealth(remote, syncBranch, this.cwd);

      if (remoteHealth.exists) {
        // Remote exists but local doesn't - can be created from remote
        return {
          name: 'Local sync branch',
          status: 'warn',
          message: `${syncBranch} not found (remote exists)`,
          suggestion: 'Run: tbd sync to create from remote',
        };
      }

      // Neither local nor remote - new repo, this is OK
      return {
        name: 'Local sync branch',
        status: 'ok',
        message: 'not created yet',
      };
    }

    // Branch exists but is orphaned (no commits)
    return {
      name: 'Local sync branch',
      status: 'warn',
      message: `${syncBranch} exists but has no commits`,
      suggestion: 'Run: tbd sync to push data',
    };
  }

  /**
   * Check remote sync branch health.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4b
   */
  private async checkRemoteSyncBranch(fix?: boolean): Promise<DiagnosticResult> {
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';
    const remoteHealth = await checkRemoteBranchHealth(remote, syncBranch, this.cwd);

    // Unrelated histories: with --fix, run the non-destructive rescue (adopt
    // remote base + replay local work). Serialized under the shared lock so a
    // concurrent create/sync from a sibling worktree cannot race the
    // reset/replay window, matching the worktree-repair fix path.
    if (remoteHealth.unrelated && fix && !this.checkDryRun('Rescue unrelated tbd-sync histories')) {
      try {
        const result = await withSharedDataSyncLock(this.cwd, async () =>
          rescueUnrelatedHistory(this.cwd, remote, syncBranch),
        );
        return {
          name: 'Remote sync branch',
          status: 'ok',
          message:
            `rescued: adopted ${remote}/${syncBranch} base, reconciled ` +
            `${result.localOnly} local-only + ${result.merged} merged ` +
            `(backup: ${result.backupBranch})`,
        };
      } catch (error) {
        return {
          name: 'Remote sync branch',
          status: 'error',
          message: `rescue failed: ${error instanceof Error ? error.message : String(error)}`,
          suggestion: 'Resolve manually; the pre-rescue state is on the tbd-backup-* branch',
        };
      }
    }

    const diag = classifyRemoteSyncHealth(remoteHealth, remote, syncBranch);
    if (diag) {
      return diag;
    }

    // Remote branch doesn't exist
    const localHealth = await checkLocalBranchHealth(syncBranch, this.cwd);
    if (localHealth.exists) {
      // Local exists but remote doesn't - needs push
      return {
        name: 'Remote sync branch',
        status: 'warn',
        message: `${remote}/${syncBranch} not found`,
        suggestion: 'Run: tbd sync to push local branch',
      };
    }

    // Neither exists - new repo, this is OK
    return {
      name: 'Remote sync branch',
      status: 'ok',
      message: 'not created yet',
    };
  }

  /**
   * Check for local data that hasn't been synced to remote.
   * This detects the ai-trade-arena bug scenario.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4
   */
  private async checkLocalVsRemoteData(): Promise<DiagnosticResult> {
    // Only check if worktree exists and has issues
    const worktreeHealth = await checkWorktreeHealth(this.cwd);
    if (worktreeHealth.status !== 'valid') {
      // Worktree not valid - can't compare
      return { name: 'Sync status', status: 'ok', message: 'worktree not active' };
    }

    // Count local issues in worktree
    const localIssueCount = this.issues.length;
    if (localIssueCount === 0) {
      return { name: 'Sync status', status: 'ok' };
    }

    // Check if remote branch exists and has commits
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';
    const remoteHealth = await checkRemoteBranchHealth(remote, syncBranch, this.cwd);

    if (!remoteHealth.exists) {
      // Remote doesn't exist - issues haven't been pushed
      return {
        name: 'Sync status',
        status: 'warn',
        message: `${localIssueCount} local issues, remote branch not found`,
        suggestion: 'Run: tbd sync to push issues to remote',
      };
    }

    // Note: Full remote issue count comparison would require fetching the remote
    // For now, we flag if local has issues but remote branch exists but is empty
    // This is detected by comparing commit counts or checking issue files
    // A simpler check: if worktree has uncommitted changes, we know they aren't synced

    return { name: 'Sync status', status: 'ok' };
  }

  /**
   * Check for multi-user/clone scenarios that indicate lost data.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §6
   */
  private async checkCloneScenarios(): Promise<DiagnosticResult> {
    // Only relevant if we have no issues
    const localIssueCount = this.issues.length;
    if (localIssueCount > 0) {
      return { name: 'Clone status', status: 'ok' };
    }

    // Check 1: Beads migration evidence exists but tbd has no issues
    const beadsDisabledPath = join(this.cwd, '.beads-disabled');
    let beadsMigrationExists = false;
    try {
      await access(beadsDisabledPath);
      beadsMigrationExists = true;
    } catch {
      // No beads migration - that's fine
    }

    if (beadsMigrationExists) {
      // Check if beads had issues
      const beadsJsonl = join(beadsDisabledPath, '.beads', 'issues.jsonl');
      let beadsIssueCount = 0;
      try {
        const content = await readFile(beadsJsonl, 'utf-8');
        beadsIssueCount = content.trim().split('\n').filter(Boolean).length;
      } catch {
        // Can't read beads file - ignore
      }

      if (beadsIssueCount > 0) {
        return {
          name: 'Clone status',
          status: 'error',
          message: `Beads migration has ${beadsIssueCount} issues, tbd has none`,
          details: [
            'This repo was migrated from beads but issues were never synced.',
            'Another user may have the issues locally but they were not pushed.',
          ],
          suggestion: 'Contact the repo owner to run: tbd sync',
        };
      }
    }

    // Check 2: Config has id_prefix but no issues (suggests prior usage)
    if (!beadsMigrationExists && this.config?.display?.id_prefix) {
      return {
        name: 'Clone status',
        status: 'warn',
        message: `Config has prefix '${this.config.display.id_prefix}' but no issues`,
        details: [
          'This suggests issues may have been created but not synced,',
          'or were lost due to sync issues on another machine.',
        ],
        suggestion: 'If you expect issues to exist, contact the repo owner',
      };
    }

    // Check 3: Active beads directory exists (not migrated yet)
    const beadsPath = join(this.cwd, '.beads');
    let beadsActiveExists = false;
    try {
      await access(beadsPath);
      beadsActiveExists = true;
    } catch {
      // No active beads - that's fine
    }

    if (beadsActiveExists) {
      return {
        name: 'Clone status',
        status: 'ok',
        message: 'beads directory exists (migration available)',
      };
    }

    return { name: 'Clone status', status: 'ok' };
  }

  /**
   * Check sync consistency - worktree matches local, ahead/behind counts.
   * See: plan-2026-01-28-sync-worktree-recovery-and-hardening.md §4
   */
  private async checkSyncConsistency(): Promise<DiagnosticResult> {
    const syncBranch = this.config?.sync.branch ?? 'tbd-sync';
    const remote = this.config?.sync.remote ?? 'origin';

    // Only check if worktree is valid
    const worktreeHealth = await checkWorktreeHealth(this.cwd);
    if (worktreeHealth.status !== 'valid') {
      return { name: 'Sync consistency', status: 'ok', message: 'worktree not active' };
    }

    try {
      const consistency = await checkSyncConsistency(this.cwd, syncBranch, remote);

      // Check if worktree matches local
      if (!consistency.worktreeMatchesLocal) {
        return {
          name: 'Sync consistency',
          status: 'error',
          message: 'worktree HEAD does not match local branch',
          details: [
            `Worktree HEAD: ${consistency.worktreeHead.slice(0, 7)}`,
            `Local ${syncBranch}: ${consistency.localHead.slice(0, 7)}`,
          ],
          fixable: true,
          suggestion: 'Run: tbd doctor --fix to synchronize',
        };
      }

      // Check ahead/behind status
      if (consistency.localAhead > 0 && consistency.localBehind > 0) {
        // Unrelated histories are always "diverged" (no common ancestor), but
        // their remediation is the rescue; suggesting `tbd sync` here forms a
        // loop with the unrelated-history error. Defer to doctor --fix. (#158)
        const { unrelated } = await checkRemoteBranchHealth(remote, syncBranch, this.cwd);
        return divergenceFinding(consistency.localAhead, consistency.localBehind, unrelated);
      }

      if (consistency.localAhead > 0) {
        return {
          name: 'Sync consistency',
          status: 'ok',
          message: `${consistency.localAhead} local commit(s) not yet pushed; run \`tbd sync\` to push`,
        };
      }

      if (consistency.localBehind > 0) {
        return {
          name: 'Sync consistency',
          status: 'ok',
          message: `${consistency.localBehind} remote commit(s) not yet pulled; run \`tbd sync\` to pull`,
        };
      }

      return { name: 'Sync consistency', status: 'ok' };
    } catch (error) {
      // Sync consistency check failed - may be normal if branches don't exist yet
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('not found') || msg.includes('no commits')) {
        return { name: 'Sync consistency', status: 'ok', message: 'branches not yet established' };
      }
      return {
        name: 'Sync consistency',
        status: 'warn',
        message: `Unable to check: ${msg}`,
      };
    }
  }

  /**
   * Check 16 group: Forked docs (`.tbd/doc-forks/` ↔ base snapshots ↔ fork dir).
   *
   * Validates the forkable-docs state per the f05 spec (Phase 2 doctor checks):
   * manifest readability, missing forked files (--fix finalizes the unfork),
   * orphaned entries whose upstream doc is gone (--fix removes the entry),
   * base snapshot presence/hash integrity (no auto-fix; re-fork vs unfork is
   * the user's call), unresolved tbd conflict markers, user docs claiming the
   * reserved `tbd-` name prefix, and a gitignored fork dir.
   *
   * Returns zero findings when nothing is forked and no fork dir exists, so
   * doctor output is byte-identical for repos that never touched forking.
   * See: docs/project/specs/done/plan-2026-06-11-forkable-docs.md §`tbd doctor`.
   */
  private async checkForkedDocs(fix?: boolean): Promise<DiagnosticResult[]> {
    const name = 'Forked docs';
    const {
      DOC_FORKS_DIR,
      FORKS_FILE,
      findFork,
      hashContent,
      hasUnresolvedConflict,
      readForkManifest,
      removeBaseContent,
      removeFork,
      withForkManifestLock,
      writeForkManifest,
    } = await import('../../file/fork-manifest.js');
    const manifestPath = `${DOC_FORKS_DIR}/${FORKS_FILE}`;

    // 16a: manifest readability. readForkManifest tolerates per-entry corruption
    // (drops bad entries with a stderr warning) but throws on a totally
    // unparseable file; report that instead of crashing the doctor run.
    let manifest;
    try {
      manifest = await readForkManifest(this.cwd);
    } catch (error) {
      const reason = (error instanceof Error ? error.message : String(error)).split('\n')[0];
      return [
        {
          name,
          status: 'warn',
          message: `fork manifest unreadable: ${reason}`,
          path: manifestPath,
          suggestion: `Fix or delete ${manifestPath} (forked files stay in place), then re-run tbd doctor`,
        },
      ];
    }

    // Zero forks and no fork dir: print nothing.
    let forkDirExists = true;
    try {
      await access(join(this.cwd, FORK_DIR));
    } catch {
      forkDirExists = false;
    }
    if (manifest.forks.length === 0 && !forkDirExists) {
      return [];
    }

    const {
      forkStatusFor,
      listLocalForkFiles,
      readForkBase,
      readForkFile,
      regenerateForkDirReadme,
      unforkDoc,
    } = await import('../../file/doc-fork.js');
    const { DocCache } = await import('../../file/doc-cache.js');

    // Cache-only lookup paths per kind (the pristine upstream copies). Replica
    // of doc-fork.ts's module-private KIND_CACHE_PATHS, which is deliberately
    // not exported (doctor owns its own copy rather than widening that API).
    const kindCachePaths: Record<string, string[]> = {
      guideline: CACHE_GUIDELINES_PATHS,
      shortcut: CACHE_SHORTCUT_PATHS,
      template: CACHE_TEMPLATE_PATHS,
      reference: CACHE_REFERENCE_PATHS,
    };
    const caches = new Map<string, InstanceType<typeof DocCache>>();

    // Classify every manifest entry into at most one issue bucket
    // (missing > orphaned > base problem), with unresolved conflict markers
    // detected on every fork file that still exists.
    const missing: ForkEntry[] = [];
    const orphaned: ForkEntry[] = [];
    const baseProblems: string[] = [];
    const conflicted: string[] = [];

    for (const entry of manifest.forks) {
      let cache = caches.get(entry.kind);
      if (!cache) {
        cache = new DocCache(kindCachePaths[entry.kind] ?? [], this.cwd);
        await cache.load({ quiet: true });
        caches.set(entry.kind, cache);
      }
      const cacheContent = cache.get(entry.name)?.doc.content ?? null;
      const status = await forkStatusFor(this.cwd, FORK_DIR, entry, cacheContent);

      if (status.state === 'missing') {
        missing.push(entry);
        continue;
      }
      if (status.orphaned) {
        orphaned.push(entry);
        continue;
      }

      // 16d: base snapshot integrity for live forks.
      const base = await readForkBase(this.cwd, entry);
      if (base === null) {
        baseProblems.push(`${entry.name}: missing`);
      } else if (hashContent(base) !== entry.base_hash) {
        baseProblems.push(`${entry.name}: hash mismatch`);
      }

      // 16e: unresolved tbd conflict markers (flag-independent; detect markers
      // even when the manifest `conflicted` flag was never set or went stale).
      const content = await readForkFile(this.cwd, FORK_DIR, entry);
      if (content !== null && hasUnresolvedConflict(content)) {
        conflicted.push(entry.name);
      }
    }

    const results: DiagnosticResult[] = [];

    // 16b: manifest entries whose forked file was deleted out-of-band. The
    // deletion is read as intent to stop forking: --fix finalizes the unfork
    // (removes manifest entry + base snapshot; the doc is served from upstream).
    if (missing.length > 0) {
      const message = `${missing.length} missing (${missing.map((e) => e.name).join(', ')}: forked file deleted)`;
      if (fix && !this.checkDryRun('Finalize unfork of deleted forked docs')) {
        try {
          await withForkManifestLock(this.cwd, async () => {
            let current = await readForkManifest(this.cwd);
            for (const entry of missing) {
              if (!findFork(current, entry.name, entry.kind)) continue;
              const result = await unforkDoc({
                tbdRoot: this.cwd,
                forkDir: FORK_DIR,
                manifest: current,
                name: entry.name,
                kind: entry.kind,
              });
              current = result.manifest;
            }
            await writeForkManifest(this.cwd, current);
            await regenerateForkDirReadme(this.cwd, FORK_DIR, current);
          });
          results.push({
            name,
            status: 'warn',
            message,
            details: [
              'Fixed: finalized unfork (removed manifest entry + base); now served from upstream',
            ],
          });
        } catch (error) {
          results.push({
            name,
            status: 'error',
            message: `failed to finalize unfork: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      } else {
        results.push({
          name,
          status: 'warn',
          message,
          fixable: true,
          suggestion:
            'Run: tbd doctor --fix to finalize the unfork, or tbd docs fork <name> --force to restore',
        });
      }
    }

    // 16c: orphaned entries (upstream/cache doc no longer exists). --fix removes
    // the manifest entry + base but keeps the file (it becomes a local doc;
    // upstream is gone, so the file may be the only copy).
    if (orphaned.length > 0) {
      const message = `${orphaned.length} orphaned (${orphaned.map((e) => e.name).join(', ')}: upstream doc no longer exists)`;
      if (fix && !this.checkDryRun('Remove orphaned fork manifest entries')) {
        try {
          await withForkManifestLock(this.cwd, async () => {
            let current = await readForkManifest(this.cwd);
            for (const entry of orphaned) {
              current = removeFork(current, entry.name, entry.kind);
              await removeBaseContent(this.cwd, entry.kind, entry.name);
            }
            await writeForkManifest(this.cwd, current);
            await regenerateForkDirReadme(this.cwd, FORK_DIR, current);
          });
          results.push({
            name,
            status: 'warn',
            message,
            details: [
              `Fixed: removed orphaned manifest entr${orphaned.length === 1 ? 'y' : 'ies'} + base; file kept as a local doc`,
            ],
          });
        } catch (error) {
          results.push({
            name,
            status: 'error',
            message: `failed to remove orphaned entries: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      } else {
        results.push({
          name,
          status: 'warn',
          message,
          fixable: true,
          suggestion:
            'Run: tbd doctor --fix to remove the entry (your file is kept as a local doc)',
        });
      }
    }

    // 16d findings: no auto-fix; choosing between re-fork and unfork would
    // guess at user intent.
    if (baseProblems.length > 0) {
      results.push({
        name,
        status: 'warn',
        message: `${baseProblems.length} base snapshot problem${baseProblems.length === 1 ? '' : 's'} (${baseProblems.join(', ')})`,
        suggestion: 'Run: tbd docs fork <name> --force to re-fork, or tbd docs unfork <name>',
      });
    }

    // 16e findings.
    if (conflicted.length > 0) {
      results.push({
        name,
        status: 'warn',
        message: `${conflicted.length} unresolved merge conflict${conflicted.length === 1 ? '' : 's'} (${conflicted.join(', ')})`,
        suggestion: 'Run: resolve the conflict markers, then re-run tbd docs update',
      });
    }

    // Healthy headline: exactly one ✓ line when forks exist and 16b–16e found
    // nothing (reserved-name and fork-dir findings below have their own names).
    if (manifest.forks.length > 0 && results.length === 0) {
      results.push({
        name,
        status: 'ok',
        message: `${manifest.forks.length} forked, base snapshots intact`,
      });
    }

    // 16f: user docs claiming the reserved `tbd-` prefix (fork-dir files with
    // no manifest entry; forked tbd self-docs legitimately keep their entry).
    const locals = await listLocalForkFiles(this.cwd, FORK_DIR, manifest);
    const reserved = locals.filter((l) => l.name.startsWith('tbd-'));
    if (reserved.length > 0) {
      results.push({
        name: 'Reserved tbd- names',
        status: 'warn',
        message: `${reserved.length} user doc${reserved.length === 1 ? ' claims' : 's claim'} the reserved tbd- prefix`,
        details: reserved.map((l) => l.relPath),
        suggestion: 'Rename the file(s): the tbd- prefix is reserved for tbd self-docs',
      });
    }

    // 16g: fork dir gitignored (only meaningful when forks exist; a gitignored
    // fork dir defeats the purpose of forking: the docs would not be committed).
    if (manifest.forks.length > 0) {
      let ignored = false;
      try {
        await git('-C', this.cwd, 'check-ignore', '-q', FORK_DIR);
        ignored = true;
      } catch {
        // Exit 1 = not ignored (healthy). Other failures: cannot verify; do not
        // warn on a guess.
        ignored = false;
      }
      results.push(
        ignored
          ? {
              name: 'Fork dir',
              status: 'warn',
              message: `${FORK_DIR}/ is gitignored; forked docs will not be committed`,
              suggestion: `Remove the .gitignore rule covering ${FORK_DIR}/ so forks are tracked in git`,
            }
          : {
              name: 'Fork dir',
              status: 'ok',
              message: `${FORK_DIR}/ tracked in git (not gitignored)`,
            },
      );
    }

    return results;
  }
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose and repair repository')
  .option('--fix', 'Attempt to fix issues')
  .option(
    '--max-history <n>',
    'Max git commits to scan for ID mapping recovery (0 = full history)',
    '50',
  )
  .action(async (options, command) => {
    const handler = new DoctorHandler(command);
    await handler.run(options);
  });
