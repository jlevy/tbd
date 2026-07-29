/**
 * `tbd dep` - Dependency management commands.
 *
 * See: tbd-design.md §4.6 Dependency Commands
 */

import { Command } from 'commander';

import { BaseCommand } from '../lib/base-command.js';
import { requireInit, NotFoundError, ValidationError } from '../lib/errors.js';
import { getDependencyDirections } from '../lib/dependency-format.js';
import { readIssue, writeIssue, listIssues } from '../../file/storage.js';
import { formatDisplayId, formatDebugId } from '../../lib/ids.js';
import type { Issue } from '../../lib/types.js';
import { now } from '../../utils/time-utils.js';
import { resolveToInternalId } from '../../file/id-mapping.js';
import { loadDataContext, withDataSyncContext } from '../lib/data-context.js';
import { issueNotFoundHint } from '../lib/id-suggestions.js';

// Add dependency: "A depends on B" means B blocks A
class DependsAddHandler extends BaseCommand {
  async run(issueId: string, dependsOnIds: string[]): Promise<void> {
    if (dependsOnIds.length > 1) {
      await this.runMulti(issueId, dependsOnIds);
      return;
    }
    await this.runSingle(issueId, dependsOnIds[0]!);
  }

  /**
   * Multi-blocker form: one call declares "this issue depends on these N".
   * All IDs resolve before anything is written (fail-closed); duplicate
   * blockers are processed once; already-present edges are counted, not
   * errors. Each edge lives on its blocker's issue file, so N blockers are N
   * writes under one lock.
   */
  private async runMulti(issueId: string, dependsOnIds: string[]): Promise<void> {
    const tbdRoot = await requireInit();

    let displayIssueId = issueId;
    const addedDisplay: string[] = [];
    const existingDisplay: string[] = [];
    let wasDryRun = false;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const displayOf = (internalId: string) =>
            this.ctx.debug
              ? formatDebugId(internalId, mapping, config.display.id_prefix)
              : formatDisplayId(internalId, mapping, config.display.id_prefix);

          let internalIssueId: string;
          try {
            internalIssueId = resolveToInternalId(issueId, mapping);
          } catch {
            throw new NotFoundError('Issue', issueId);
          }
          try {
            await readIssue(dataSyncDir, internalIssueId);
          } catch {
            throw new NotFoundError('Issue', issueId);
          }

          // Resolve every blocker before writing anything.
          const targets: { input: string; internalId: string }[] = [];
          const missing: string[] = [];
          const seen = new Set<string>();
          for (const input of dependsOnIds) {
            try {
              const internalId = resolveToInternalId(input, mapping);
              if (seen.has(internalId)) continue;
              seen.add(internalId);
              targets.push({ input, internalId });
            } catch {
              missing.push(input);
            }
          }
          if (missing.length > 0) {
            throw new NotFoundError(
              'Issue',
              missing.join(', '),
              issueNotFoundHint(missing, mapping, config.display.id_prefix),
            );
          }
          if (targets.some((t) => t.internalId === internalIssueId)) {
            throw new ValidationError('Issue cannot depend on itself');
          }

          // Read all blockers up front (validate-all-then-apply).
          const blockers: { internalId: string; issue: Issue }[] = [];
          for (const { input, internalId } of targets) {
            try {
              blockers.push({ internalId, issue: await readIssue(dataSyncDir, internalId) });
            } catch {
              throw new NotFoundError('Issue', input);
            }
          }

          if (
            this.checkDryRun('Would add dependencies', {
              issue: internalIssueId,
              dependsOn: targets.map((t) => t.internalId),
            })
          ) {
            wasDryRun = true;
            return;
          }

          for (const { internalId, issue: blockerIssue } of blockers) {
            const exists = blockerIssue.dependencies.some(
              (dep) => dep.type === 'blocks' && dep.target === internalIssueId,
            );
            if (exists) {
              existingDisplay.push(displayOf(internalId));
              continue;
            }
            blockerIssue.dependencies.push({ type: 'blocks', target: internalIssueId });
            blockerIssue.version += 1;
            blockerIssue.updated_at = now();
            await writeIssue(dataSyncDir, blockerIssue);
            addedDisplay.push(displayOf(internalId));
          }

          displayIssueId = displayOf(internalIssueId);
        },
      );
    }, 'Failed to update issue');

    if (wasDryRun) return;

    this.output.data(
      {
        issue: displayIssueId,
        dependsOn: [...addedDisplay, ...existingDisplay],
        added: addedDisplay.length,
        existing: existingDisplay.length,
      },
      () => {
        const suffix =
          existingDisplay.length > 0 ? ` (${existingDisplay.length} already existed)` : '';
        const all = [...addedDisplay, ...existingDisplay].join(' ');
        this.output.success(`${displayIssueId} now depends on: ${all}${suffix}`);
      },
    );
  }

  private async runSingle(issueId: string, dependsOnId: string): Promise<void> {
    const tbdRoot = await requireInit();

    let displayIssueId = issueId;
    let displayDependsOnId = dependsOnId;
    let didAdd = false;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          // Resolve both IDs to internal IDs
          // issueId = the issue that depends on something
          // dependsOnId = the issue it depends on (the blocker)
          let internalIssueId: string;
          let internalDependsOnId: string;
          try {
            internalIssueId = resolveToInternalId(issueId, mapping);
          } catch {
            throw new NotFoundError('Issue', issueId);
          }
          try {
            internalDependsOnId = resolveToInternalId(dependsOnId, mapping);
          } catch {
            throw new NotFoundError('Issue', dependsOnId);
          }

          // Verify issueId exists
          try {
            await readIssue(dataSyncDir, internalIssueId);
          } catch {
            throw new NotFoundError('Issue', issueId);
          }

          // Load the blocking issue (dependsOnId) - this is where we add the dependency
          let blockerIssue;
          try {
            blockerIssue = await readIssue(dataSyncDir, internalDependsOnId);
          } catch {
            throw new NotFoundError('Issue', dependsOnId);
          }

          // Check for self-reference
          if (internalIssueId === internalDependsOnId) {
            throw new ValidationError('Issue cannot depend on itself');
          }

          if (
            this.checkDryRun('Would add dependency', {
              issue: internalIssueId,
              dependsOn: internalDependsOnId,
            })
          ) {
            return;
          }

          // Check if dependency already exists (dependsOnId blocks issueId)
          const exists = blockerIssue.dependencies.some(
            (dep) => dep.type === 'blocks' && dep.target === internalIssueId,
          );
          if (exists) {
            this.output.info('Dependency already exists');
            return;
          }

          // Add the dependency: dependsOnId blocks issueId
          blockerIssue.dependencies.push({ type: 'blocks', target: internalIssueId });
          blockerIssue.version += 1;
          blockerIssue.updated_at = now();

          await writeIssue(dataSyncDir, blockerIssue);

          displayIssueId = this.ctx.debug
            ? formatDebugId(internalIssueId, mapping, config.display.id_prefix)
            : formatDisplayId(internalIssueId, mapping, config.display.id_prefix);
          displayDependsOnId = this.ctx.debug
            ? formatDebugId(internalDependsOnId, mapping, config.display.id_prefix)
            : formatDisplayId(internalDependsOnId, mapping, config.display.id_prefix);
          didAdd = true;
        },
      );
    }, 'Failed to update issue');

    if (!didAdd) return;

    this.output.data({ issue: displayIssueId, dependsOn: displayDependsOnId }, () => {
      this.output.success(`${displayIssueId} now depends on ${displayDependsOnId}`);
    });
  }
}

// Remove dependency: "A no longer depends on B" means B no longer blocks A
class DependsRemoveHandler extends BaseCommand {
  async run(issueId: string, dependsOnIds: string[]): Promise<void> {
    if (dependsOnIds.length > 1) {
      await this.runMulti(issueId, dependsOnIds);
      return;
    }
    await this.runSingle(issueId, dependsOnIds[0]!);
  }

  /**
   * Multi-blocker form, mirroring `dep add`: all IDs resolve up front,
   * duplicates are processed once, and edges that were not present are
   * counted rather than treated as errors.
   */
  private async runMulti(issueId: string, dependsOnIds: string[]): Promise<void> {
    const tbdRoot = await requireInit();

    let displayIssueId = issueId;
    const removedDisplay: string[] = [];
    const notPresentDisplay: string[] = [];
    let wasDryRun = false;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          const displayOf = (internalId: string) =>
            this.ctx.debug
              ? formatDebugId(internalId, mapping, config.display.id_prefix)
              : formatDisplayId(internalId, mapping, config.display.id_prefix);

          let internalIssueId: string;
          try {
            internalIssueId = resolveToInternalId(issueId, mapping);
          } catch {
            throw new NotFoundError('Issue', issueId);
          }

          const targets: { input: string; internalId: string }[] = [];
          const missing: string[] = [];
          const seen = new Set<string>();
          for (const input of dependsOnIds) {
            try {
              const internalId = resolveToInternalId(input, mapping);
              if (seen.has(internalId)) continue;
              seen.add(internalId);
              targets.push({ input, internalId });
            } catch {
              missing.push(input);
            }
          }
          if (missing.length > 0) {
            throw new NotFoundError(
              'Issue',
              missing.join(', '),
              issueNotFoundHint(missing, mapping, config.display.id_prefix),
            );
          }

          const blockers: { internalId: string; issue: Issue }[] = [];
          for (const { input, internalId } of targets) {
            try {
              blockers.push({ internalId, issue: await readIssue(dataSyncDir, internalId) });
            } catch {
              throw new NotFoundError('Issue', input);
            }
          }

          if (
            this.checkDryRun('Would remove dependencies', {
              issue: internalIssueId,
              dependsOn: targets.map((t) => t.internalId),
            })
          ) {
            wasDryRun = true;
            return;
          }

          for (const { internalId, issue: blockerIssue } of blockers) {
            const initialLength = blockerIssue.dependencies.length;
            blockerIssue.dependencies = blockerIssue.dependencies.filter(
              (dep) => !(dep.type === 'blocks' && dep.target === internalIssueId),
            );
            if (blockerIssue.dependencies.length === initialLength) {
              notPresentDisplay.push(displayOf(internalId));
              continue;
            }
            blockerIssue.version += 1;
            blockerIssue.updated_at = now();
            await writeIssue(dataSyncDir, blockerIssue);
            removedDisplay.push(displayOf(internalId));
          }

          displayIssueId = displayOf(internalIssueId);
        },
      );
    }, 'Failed to update issue');

    if (wasDryRun) return;

    this.output.data(
      {
        issue: displayIssueId,
        removed: removedDisplay,
        notPresent: notPresentDisplay,
      },
      () => {
        const suffix =
          notPresentDisplay.length > 0 ? ` (${notPresentDisplay.length} not present)` : '';
        const all = [...removedDisplay, ...notPresentDisplay].join(' ');
        this.output.success(`${displayIssueId} no longer depends on: ${all}${suffix}`);
      },
    );
  }

  private async runSingle(issueId: string, dependsOnId: string): Promise<void> {
    const tbdRoot = await requireInit();

    let displayIssueId = issueId;
    let displayDependsOnId = dependsOnId;
    let didRemove = false;

    await this.execute(async () => {
      await withDataSyncContext(
        tbdRoot,
        { lock: true },
        async ({ dataSyncDir, mapping, config }) => {
          // Resolve both IDs to internal IDs
          let internalIssueId: string;
          let internalDependsOnId: string;
          try {
            internalIssueId = resolveToInternalId(issueId, mapping);
          } catch {
            throw new NotFoundError('Issue', issueId);
          }
          try {
            internalDependsOnId = resolveToInternalId(dependsOnId, mapping);
          } catch {
            throw new NotFoundError('Issue', dependsOnId);
          }

          // Load the blocker issue (dependsOnId) - this is where the dependency is stored
          let blockerIssue;
          try {
            blockerIssue = await readIssue(dataSyncDir, internalDependsOnId);
          } catch {
            throw new NotFoundError('Issue', dependsOnId);
          }

          if (
            this.checkDryRun('Would remove dependency', {
              issue: internalIssueId,
              dependsOn: internalDependsOnId,
            })
          ) {
            return;
          }

          // Find and remove the dependency (dependsOnId blocks issueId)
          const initialLength = blockerIssue.dependencies.length;
          blockerIssue.dependencies = blockerIssue.dependencies.filter(
            (dep) => !(dep.type === 'blocks' && dep.target === internalIssueId),
          );

          if (blockerIssue.dependencies.length === initialLength) {
            this.output.info('Dependency not found');
            return;
          }

          blockerIssue.version += 1;
          blockerIssue.updated_at = now();

          await writeIssue(dataSyncDir, blockerIssue);

          displayIssueId = this.ctx.debug
            ? formatDebugId(internalIssueId, mapping, config.display.id_prefix)
            : formatDisplayId(internalIssueId, mapping, config.display.id_prefix);
          displayDependsOnId = this.ctx.debug
            ? formatDebugId(internalDependsOnId, mapping, config.display.id_prefix)
            : formatDisplayId(internalDependsOnId, mapping, config.display.id_prefix);
          didRemove = true;
        },
      );
    }, 'Failed to update issue');

    if (!didRemove) return;

    this.output.data({ issue: displayIssueId, removed: displayDependsOnId }, () => {
      this.output.success(`${displayIssueId} no longer depends on ${displayDependsOnId}`);
    });
  }
}

// List dependencies
class DependsListHandler extends BaseCommand {
  async run(id: string): Promise<void> {
    const tbdRoot = await requireInit();

    const { dataSyncDir, mapping, config } = await loadDataContext(tbdRoot);

    // Resolve input ID to internal ID
    let internalId: string;
    try {
      internalId = resolveToInternalId(id, mapping);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Load the issue
    let issue;
    try {
      issue = await readIssue(dataSyncDir, internalId);
    } catch {
      throw new NotFoundError('Issue', id);
    }

    // Load all issues to find reverse dependencies
    let allIssues: Issue[];
    try {
      allIssues = await listIssues(dataSyncDir);
    } catch {
      allIssues = [];
    }

    const showDebug = this.ctx.debug;
    const prefix = config.display.id_prefix;

    const deps = getDependencyDirections(issue, allIssues, (dependencyId) =>
      showDebug
        ? formatDebugId(dependencyId, mapping, prefix)
        : formatDisplayId(dependencyId, mapping, prefix),
    );
    this.output.data(deps, () => {
      const colors = this.output.getColors();
      if (deps.blocks.length > 0) {
        console.log(`${colors.bold('Blocks:')} ${deps.blocks.join(', ')}`);
      }
      if (deps.blockedBy.length > 0) {
        console.log(`${colors.bold('Blocked by:')} ${deps.blockedBy.join(', ')}`);
      }
      if (deps.blocks.length === 0 && deps.blockedBy.length === 0) {
        console.log('No dependencies');
      }
    });
  }
}

const addCommand = new Command('add')
  .description('Add dependencies (issue depends on each depends-on)')
  .argument('<issue>', 'Issue ID that depends on something')
  .argument('<depends-on...>', 'Issue ID(s) that must be completed first')
  .action(async (issue, dependsOn, _options, command) => {
    const handler = new DependsAddHandler(command);
    await handler.run(issue, dependsOn);
  });

const removeCommand = new Command('remove')
  .description('Remove dependencies (issue no longer depends on each depends-on)')
  .argument('<issue>', 'Issue ID')
  .argument('<depends-on...>', 'Issue ID(s) it depended on')
  .action(async (issue, dependsOn, _options, command) => {
    const handler = new DependsRemoveHandler(command);
    await handler.run(issue, dependsOn);
  });

const listDepsCommand = new Command('list')
  .description('List dependencies for an issue')
  .argument('<id>', 'Issue ID')
  .action(async (id, _options, command) => {
    const handler = new DependsListHandler(command);
    await handler.run(id);
  });

export const depCommand = new Command('dep')
  .description('Manage issue dependencies')
  .addCommand(addCommand)
  .addCommand(removeCommand)
  .addCommand(listDepsCommand);
