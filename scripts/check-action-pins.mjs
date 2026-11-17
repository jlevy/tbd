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
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';

const requireFromTbdPackage = createRequire(
  new URL('../packages/tbd/package.json', import.meta.url),
);
const { LineCounter, isMap, isScalar, isSeq, parseDocument } = requireFromTbdPackage('yaml');
const PINNED = /^[^@]+@[0-9a-f]{40}$/;

function pairForKey(map, key) {
  if (!isMap(map)) {
    return undefined;
  }
  return map.items.find((pair) => isScalar(pair.key) && pair.key.value === key);
}

function actionReference(map, lineCounter, file) {
  const pair = pairForKey(map, 'uses');
  if (!pair) {
    return undefined;
  }
  const reference = isScalar(pair.value) ? String(pair.value.value) : '<non-scalar uses value>';
  const offset = pair.key?.range?.[0] ?? pair.value?.range?.[0] ?? 0;
  return { file, line: lineCounter.linePos(offset).line, reference };
}

/** Action and reusable-workflow references from the two locations GitHub executes. */
function workflowReferences(source, file) {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, { lineCounter, prettyErrors: false });
  if (document.errors.length > 0) {
    throw new Error(`${file}: invalid workflow YAML: ${document.errors[0].message}`);
  }

  const jobs = pairForKey(document.contents, 'jobs')?.value;
  if (!isMap(jobs)) {
    return [];
  }

  const references = [];
  for (const jobPair of jobs.items) {
    const job = jobPair.value;
    if (!isMap(job)) {
      continue;
    }
    const reusableWorkflow = actionReference(job, lineCounter, file);
    if (reusableWorkflow) {
      references.push(reusableWorkflow);
    }
    const steps = pairForKey(job, 'steps')?.value;
    if (!isSeq(steps)) {
      continue;
    }
    for (const step of steps.items) {
      const reference = actionReference(step, lineCounter, file);
      if (reference) {
        references.push(reference);
      }
    }
  }
  return references;
}

function findUnpinnedUses(source, file) {
  return workflowReferences(source, file).filter(({ reference }) => {
    if (reference.startsWith('./') || reference.startsWith('.\\')) {
      return false;
    }
    return !PINNED.test(reference);
  });
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
  let files;
  let problems;
  try {
    ({ files, problems } = checkWorkflows(directory));
  } catch (error) {
    console.error(`check-action-pins: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
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
