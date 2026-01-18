/**
 * `tbd doctor` - Diagnose and repair repository.
 *
 * See: tbd-design-spec.md §4.9 Doctor
 */

import { Command } from 'commander';
import { access, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { BaseCommand } from '../lib/baseCommand.js';
import { requireInit } from '../lib/errors.js';
import { listIssues } from '../../file/storage.js';
import { readConfig } from '../../file/config.js';
import type { Issue } from '../../lib/types.js';
import { resolveDataSyncDir, TBD_DIR } from '../../lib/paths.js';
import { validateIssueId } from '../../lib/ids.js';
import { checkGitVersion, MIN_GIT_VERSION } from '../../file/git.js';
import { type DiagnosticResult, renderDiagnostics } from '../lib/diagnostics.js';

const CONFIG_DIR = TBD_DIR;

interface DoctorOptions {
  fix?: boolean;
}

class DoctorHandler extends BaseCommand {
  private dataSyncDir = '';

  async run(options: DoctorOptions): Promise<void> {
    await requireInit();

    this.dataSyncDir = await resolveDataSyncDir();
    const checks: DiagnosticResult[] = [];
    let issues: Issue[] = [];

    // Check 1: Git version
    const gitVersionCheck = await this.checkGitVersion();
    checks.push(gitVersionCheck);

    // Check 2: Config directory and file
    const configCheck = await this.checkConfig();
    checks.push(configCheck);

    // Check 3: Issues directory
    const issuesDirCheck = await this.checkIssuesDirectory();
    checks.push(issuesDirCheck);

    // If issues directory exists, load issues for further checks
    if (issuesDirCheck.status === 'ok') {
      try {
        issues = await listIssues(this.dataSyncDir);
      } catch {
        // Already handled by issuesDirCheck
      }
    }

    // Check 4: Orphaned dependencies
    const orphanCheck = this.checkOrphanedDependencies(issues);
    checks.push(orphanCheck);

    // Check 5: Duplicate IDs
    const duplicateCheck = this.checkDuplicateIds(issues);
    checks.push(duplicateCheck);

    // Check 6: Orphaned temp files
    const tempFilesCheck = await this.checkTempFiles(options.fix);
    checks.push(tempFilesCheck);

    // Check 7: Issue validity
    const validityCheck = this.checkIssueValidity(issues);
    checks.push(validityCheck);

    // Check 8: Claude Code skill file
    const skillCheck = await this.checkClaudeSkill();
    checks.push(skillCheck);

    const allOk = checks.every((c) => c.status === 'ok');
    const hasFixable = checks.some((c) => c.fixable && c.status !== 'ok');

    this.output.data({ checks, healthy: allOk }, () => {
      const colors = this.output.getColors();
      renderDiagnostics(checks, colors);
      console.log('');
      if (allOk) {
        this.output.success('Repository is healthy');
      } else if (hasFixable && !options.fix) {
        this.output.warn('Issues found. Run with --fix to repair.');
      } else {
        this.output.warn('Issues found that may require manual intervention.');
      }
    });
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
      await access(join(process.cwd(), configPath));
      await readConfig(process.cwd());
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

  private async checkTempFiles(fix?: boolean): Promise<DiagnosticResult> {
    const issuesPath = join(CONFIG_DIR, 'issues');
    const issuesDir = join(this.dataSyncDir, 'issues');
    let tempFiles: string[] = [];

    try {
      const files = await readdir(issuesDir);
      tempFiles = files.filter((f) => f.endsWith('.tmp'));
    } catch {
      // Directory doesn't exist - no temp files
      return { name: 'Temp files', status: 'ok', path: issuesPath };
    }

    if (tempFiles.length === 0) {
      return { name: 'Temp files', status: 'ok', path: issuesPath };
    }

    if (fix) {
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

  private checkIssueValidity(issues: Issue[]): DiagnosticResult {
    const invalid: { id: string; reason: string }[] = [];

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
      message: `${invalid.length} invalid issue(s)`,
      details: invalid.map((i) => `${i.id}: ${i.reason}`),
      suggestion: 'Manually fix or delete invalid issue files',
    };
  }

  private async checkClaudeSkill(): Promise<DiagnosticResult> {
    const skillRelPath = join('.claude', 'skills', 'tbd', 'SKILL.md');
    const skillPath = join(process.cwd(), skillRelPath);
    try {
      await access(skillPath);
      return { name: 'Claude Code skill', status: 'ok', path: skillRelPath };
    } catch {
      return {
        name: 'Claude Code skill',
        status: 'warn',
        message: 'not installed',
        path: skillRelPath,
        suggestion: 'Run: tbd setup claude',
      };
    }
  }
}

export const doctorCommand = new Command('doctor')
  .description('Diagnose and repair repository')
  .option('--fix', 'Attempt to fix issues')
  .action(async (options, command) => {
    const handler = new DoctorHandler(command);
    await handler.run(options);
  });
