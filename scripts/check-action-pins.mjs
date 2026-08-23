#!/usr/bin/env node
/* global process, console */
/**
 * Every third-party GitHub Action must be pinned to a full commit SHA.
 *
 * A tag is a mutable reference whether it is `v4` or `v8.3.2`: it can be repointed at
 * different code with no diff in this repository. Only the SHA fixes the code that was
 * reviewed. `ci-and-gates-rules` carries the rule; this is the gate for it.
 *
 * Local actions (`./path`) and reusable workflows in this repository are exempt: their
 * code is in the diff already.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const USES = /^\s*(?:-\s+)?uses:\s*(\S+)/;
const PINNED = /^[^@]+@[0-9a-f]{40}$/;

function findUnpinnedUses(source, file) {
  const problems = [];
  source.split('\n').forEach((line, index) => {
    const match = USES.exec(line);
    if (!match) {
      return;
    }
    const reference = match[1].replace(/^['"]|['"]$/g, '');
    if (reference.startsWith('./') || reference.startsWith('.\\')) {
      return;
    }
    if (PINNED.test(reference)) {
      return;
    }
    problems.push({ file, line: index + 1, reference });
  });
  return problems;
}

function checkWorkflows(directory) {
  const files = readdirSync(directory).filter(
    (name) => name.endsWith('.yml') || name.endsWith('.yaml'),
  );
  const problems = files.flatMap((name) =>
    findUnpinnedUses(readFileSync(path.join(directory, name), 'utf8'), name),
  );
  return { files, problems };
}

// `file://${process.argv[1]}` does not match on Windows, where argv[1] is a drive path;
// that spelling silently turns this gate into a no-op there.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = process.argv.indexOf('--dir');
  const directory =
    flag === -1
      ? path.join(process.cwd(), '.github', 'workflows')
      : path.resolve(process.argv[flag + 1]);
  const { files, problems } = checkWorkflows(directory);
  // An empty workflow directory is the same green as a clean one. Say so.
  if (files.length === 0) {
    console.error(`check-action-pins: no workflow files found in ${directory}`);
    process.exit(1);
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(
        `${problem.file}:${problem.line}: not pinned to a commit SHA: ${problem.reference}`,
      );
    }
    console.error(
      '\nPin to a full 40-character commit SHA with the release tag in a trailing comment.',
    );
    process.exit(1);
  }
  console.log(
    `check-action-pins: ${files.length} workflow file(s), all action references pinned to commit SHAs`,
  );
}
