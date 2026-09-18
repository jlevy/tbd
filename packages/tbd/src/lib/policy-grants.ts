/**
 * Agent policy grants: the schema of the seven policies and their custom-value
 * grammar, the policy block inside the AGENTS.md tbd block (parser, renderer,
 * insertion), and effective grants read from the default branch.
 *
 * The single definition of the policies is the `agent-policy-grants` guideline
 * (docs/guidelines/agent-policy-grants.md); this module implements it, and tests
 * keep the two in agreement. `tbd policy` records grants through this module,
 * and `tbd setup`, `tbd doctor`, and `tbd prime` read them through it.
 *
 * Grants are consent for agents, not a switch inside tbd: nothing here gates
 * sync or any other engine behavior on a grant.
 *
 * Not the Linear selection policy (integrations/core/policy.ts).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { git, GitError } from '../file/git.js';
import {
  integrationFormatNumber,
  parseManagedIntegrationFormat,
} from '../cli/lib/managed-artifact.js';
import { AGENTS_MD_REL, AGENT_INTEGRATION_FORMAT } from './integration-paths.js';

// =============================================================================
// Schema
// =============================================================================

/** The seven policies, in the order of the guideline's table. */
export const POLICY_NAMES = [
  'github-workflows',
  'github-editing',
  'github-merge',
  'github-stacked-prs',
  'subagents',
  'pr-review-requirements',
  'linear',
] as const;

export type PolicyName = (typeof POLICY_NAMES)[number];

/** One row of the guideline's policy table plus its grant/revoke values. */
export interface PolicyDefinition {
  name: PolicyName;
  /** The fixed values, in the guideline's order. Custom values come from the grammar. */
  values: readonly string[];
  /** Which custom-value grammar applies, if any. */
  grammar: 'pr-review-requirements' | 'linear' | null;
  /** The recommended value; null when tbd makes no recommendation (linear). */
  recommended: string | null;
  /** Value agents assume while the policy is unanswered. */
  unansweredValue: string;
  /** What `tbd policy grant` records. */
  grantValue: string;
  /** What `tbd policy revoke` records; null when only `set` applies. */
  revokeValue: string | null;
  /** Values tbd recommends against; recorded only through `set`. */
  discouraged: readonly string[];
  /** One line for `tbd policy show`. */
  summary: string;
}

export const POLICIES: Readonly<Record<PolicyName, PolicyDefinition>> = {
  'github-workflows': {
    name: 'github-workflows',
    values: ['granted', 'not-granted'],
    grammar: null,
    recommended: 'granted',
    unansweredValue: 'not-granted',
    grantValue: 'granted',
    revokeValue: 'not-granted',
    discouraged: [],
    summary: 'GitHub issues, labels, and CI runs through any tool',
  },
  'github-editing': {
    name: 'github-editing',
    values: ['granted', 'not-granted'],
    grammar: null,
    recommended: 'granted',
    unansweredValue: 'not-granted',
    grantValue: 'granted',
    revokeValue: 'not-granted',
    discouraged: [],
    summary: 'branches and PRs short of merging, through any tool',
  },
  'github-merge': {
    name: 'github-merge',
    values: ['not-granted', 'per-request', 'unconditional'],
    grammar: null,
    recommended: 'per-request',
    unansweredValue: 'not-granted',
    grantValue: 'per-request',
    revokeValue: 'not-granted',
    discouraged: ['unconditional'],
    summary: 'merging PRs once the review requirements are met',
  },
  'github-stacked-prs': {
    name: 'github-stacked-prs',
    values: ['granted', 'not-granted'],
    grammar: null,
    recommended: 'granted',
    unansweredValue: 'not-granted',
    grantValue: 'granted',
    revokeValue: 'not-granted',
    discouraged: [],
    summary: 'gh stack tooling and formal stacked PRs',
  },
  subagents: {
    name: 'subagents',
    values: ['granted', 'not-granted'],
    grammar: null,
    recommended: 'granted',
    unansweredValue: 'not-granted',
    grantValue: 'granted',
    revokeValue: 'not-granted',
    discouraged: [],
    summary: 'delegating to sub-agents (delegate-to-subagents)',
  },
  'pr-review-requirements': {
    name: 'pr-review-requirements',
    values: ['standard', 'none'],
    grammar: 'pr-review-requirements',
    recommended: 'standard',
    unansweredValue: 'standard',
    grantValue: 'standard',
    revokeValue: null,
    discouraged: ['none'],
    summary: 'reviews required before a PR is merged',
  },
  linear: {
    name: 'linear',
    values: ['not-granted', 'epics', 'custom'],
    grammar: 'linear',
    recommended: null,
    unansweredValue: 'not-granted',
    grantValue: 'epics',
    revokeValue: 'not-granted',
    discouraged: [],
    summary: 'syncing beads with Linear over the named selection',
  },
};

/** A grant line's content: the policy name and its value as written (trimmed). */
export interface PolicyGrant {
  name: string;
  value: string;
}

/** "All recommended": every policy with a recommendation, at that value. Linear is asked separately. */
export const RECOMMENDED_GRANTS: readonly PolicyGrant[] = POLICY_NAMES.flatMap((name) => {
  const recommended = POLICIES[name].recommended;
  return recommended === null ? [] : [{ name, value: recommended }];
});

const POLICY_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Whether a string is a well-formed policy name (`[a-z][a-z0-9-]*`), known or not. */
export function isValidPolicyName(name: string): boolean {
  return POLICY_NAME_PATTERN.test(name);
}

export function isKnownPolicy(name: string): name is PolicyName {
  return (POLICY_NAMES as readonly string[]).includes(name);
}

// =============================================================================
// Values and the custom-value grammar
// =============================================================================

export type PolicyValueCheck = { ok: true; canonical: string } | { ok: false; reason: string };

const REVIEW_KINDS = ['security', 'performance', 'correctness'] as const;
const ROUNDS_PATTERN = /^(\d+) rounds$/;

/**
 * Split `base + addition + ...`, with optional whitespace around each `+`.
 * Returns null when a term is empty (`standard +`, `+ security`).
 */
function splitAdditions(value: string): { base: string; additions: string[] } | null {
  const terms = value.split('+').map((term) => term.trim());
  if (terms.some((term) => term === '')) {
    return null;
  }
  const [base, ...additions] = terms;
  return { base: base!, additions };
}

function checkReviewRequirements(value: string): PolicyValueCheck {
  const parts = splitAdditions(value);
  if (!parts) {
    return { ok: false, reason: 'a term around "+" is empty' };
  }
  const { base, additions } = parts;
  if (base === 'none') {
    return additions.length === 0
      ? { ok: true, canonical: 'none' }
      : { ok: false, reason: '"none" takes no additions' };
  }
  if (base !== 'standard') {
    return { ok: false, reason: 'the value must be "standard", "none", or "standard + ..."' };
  }
  const kinds = new Set<string>();
  let rounds: number | null = null;
  for (const addition of additions) {
    if ((REVIEW_KINDS as readonly string[]).includes(addition)) {
      if (kinds.has(addition)) {
        return { ok: false, reason: `"${addition}" appears more than once` };
      }
      kinds.add(addition);
      continue;
    }
    const match = ROUNDS_PATTERN.exec(addition);
    if (match) {
      const count = Number.parseInt(match[1]!, 10);
      if (count < 2) {
        return { ok: false, reason: `"${addition}" restates standard; rounds must be 2 or more` };
      }
      if (rounds !== null) {
        return { ok: false, reason: 'a rounds term appears more than once' };
      }
      rounds = count;
      continue;
    }
    return {
      ok: false,
      reason: `"${addition}" is not an addition (security, performance, correctness, or "N rounds")`,
    };
  }
  const ordered = REVIEW_KINDS.filter((kind) => kinds.has(kind)).map(String);
  if (rounds !== null) {
    ordered.push(`${rounds} rounds`);
  }
  return { ok: true, canonical: ['standard', ...ordered].join(' + ') };
}

function checkLinear(value: string): PolicyValueCheck {
  const parts = splitAdditions(value);
  if (!parts) {
    return { ok: false, reason: 'a term around "+" is empty' };
  }
  const { base, additions } = parts;
  if (base === 'not-granted' || base === 'custom') {
    return additions.length === 0
      ? { ok: true, canonical: base }
      : { ok: false, reason: `"${base}" takes no additions` };
  }
  if (base !== 'epics') {
    return { ok: false, reason: 'the value must be not-granted, epics, epics + specs, or custom' };
  }
  if (additions.length === 0) {
    return { ok: true, canonical: 'epics' };
  }
  if (additions.length === 1 && additions[0] === 'specs') {
    return { ok: true, canonical: 'epics + specs' };
  }
  return { ok: false, reason: 'the only addition to "epics" is "specs", at most once' };
}

/**
 * Validate a value for a known policy and give its canonical spelling (one
 * space around each `+`, additions in canonical order). Case-sensitive: values
 * are lowercase ASCII.
 */
export function checkPolicyValue(policy: PolicyName, value: string): PolicyValueCheck {
  const definition = POLICIES[policy];
  const trimmed = value.trim();
  if (definition.values.includes(trimmed)) {
    return { ok: true, canonical: trimmed };
  }
  switch (definition.grammar) {
    case 'pr-review-requirements':
      return checkReviewRequirements(trimmed);
    case 'linear':
      return checkLinear(trimmed);
    case null:
      return {
        ok: false,
        reason: `${policy} accepts ${definition.values.map((v) => `"${v}"`).join(', ')}`,
      };
    default: {
      const _exhaustive: never = definition.grammar;
      throw new Error(`Unhandled grammar: ${String(_exhaustive)}`);
    }
  }
}

/** The canonical spelling of a valid value; an unknown value or policy is returned as written. */
export function canonicalPolicyValue(name: string, value: string): string {
  const trimmed = value.trim();
  if (!isKnownPolicy(name)) {
    return trimmed;
  }
  const check = checkPolicyValue(name, trimmed);
  return check.ok ? check.canonical : trimmed;
}

// =============================================================================
// The policy block
// =============================================================================

/** Version of the block syntax this module reads and writes. */
export const POLICY_BLOCK_VERSION = '1';
export const POLICY_BEGIN_MARKER_PREFIX = '<!-- BEGIN TBD POLICY GRANTS';
export const POLICY_BEGIN_MARKER = `${POLICY_BEGIN_MARKER_PREFIX} v=${POLICY_BLOCK_VERSION} -->`;
export const POLICY_END_MARKER = '<!-- END TBD POLICY GRANTS -->';
export const POLICY_BLOCK_HEADING = '### Agent Policy Grants';

/** The fixed paragraph of the block, exactly as the guideline shows it. */
export const POLICY_BLOCK_PROSE = `The user granted these policies explicitly for this project. A user instruction in the
current conversation overrides them. For what each policy means, run
\`tbd guidelines agent-policy-grants\`; to change them, run \`tbd policy\`.
Only the copy committed on the default branch is in effect; a branch or working-tree
copy is a proposal, and \`tbd policy show\` reports the effective grants.`;

/**
 * The AGENTS.md tbd block markers. `INTEGRATION_BEGIN_MARKER` is the stable
 * prefix of the begin line; the format stamp follows on the same line. These
 * equal setup's CODEX_BEGIN_MARKER/CODEX_END_MARKER (a test pins that) and live
 * here so the library does not import the setup command.
 */
export const INTEGRATION_BEGIN_MARKER = '<!-- BEGIN TBD INTEGRATION';
export const INTEGRATION_END_MARKER = '<!-- END TBD INTEGRATION -->';
/** The begin line every write leaves in place, stamped with the current integration format. */
export const INTEGRATION_BEGIN_LINE = `${INTEGRATION_BEGIN_MARKER} format=${AGENT_INTEGRATION_FORMAT} surface=agents-md -->`;

export type PolicyBlockParse =
  /** AGENTS.md has no policy block. */
  | { status: 'missing' }
  /** The block's `v=` is not one this tbd knows; it is neither read nor rewritten. */
  | { status: 'unknown-version'; version: string }
  /** One of the guideline's malformed cases; every policy is treated as unanswered. */
  | { status: 'malformed'; problems: string[] }
  | {
      status: 'ok';
      grants: PolicyGrant[];
      /** The `Recorded YYYY-MM-DD.` date, or null when the line is absent. */
      recorded: string | null;
      /** The block text, both marker lines included. */
      text: string;
    };

/** The tbd block's position in AGENTS.md and its stamped integration format. */
export interface IntegrationBlockLocation {
  /** Index of the begin marker. */
  start: number;
  /** Index just past the begin line's newline. */
  bodyStart: number;
  /** Index of the END TBD INTEGRATION marker. */
  endMarker: number;
  /** Stamped format (`f01` for an unstamped legacy block). */
  format: string;
}

/** Locate the tbd block, or null when AGENTS.md has none. */
export function locateIntegrationBlock(agentsMd: string): IntegrationBlockLocation | null {
  const start = agentsMd.indexOf(INTEGRATION_BEGIN_MARKER);
  if (start < 0) {
    return null;
  }
  const endMarker = agentsMd.indexOf(INTEGRATION_END_MARKER, start);
  if (endMarker < 0) {
    return null;
  }
  const beginLineEnd = agentsMd.indexOf('\n', start);
  const bodyStart = beginLineEnd < 0 || beginLineEnd > endMarker ? endMarker : beginLineEnd + 1;
  const beginLine = agentsMd.slice(start, bodyStart);
  return { start, bodyStart, endMarker, format: parseManagedIntegrationFormat(beginLine) ?? 'f01' };
}

/** A begin or end policy-marker line, after trim; each marker is on its own line. */
const POLICY_BEGIN_LINE = /^<!-- BEGIN TBD POLICY GRANTS v=(\S+) -->$/;

/**
 * Offsets of policy-marker *lines* in LF text. A prose mention of the marker
 * text is not a marker; the line's trim must equal the marker.
 */
function policyMarkerLineOffsets(agentsMd: string): { begins: number[]; ends: number[] } {
  const begins: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const line of agentsMd.split('\n')) {
    const trimmed = line.trim();
    const leading = line.length - line.trimStart().length;
    if (POLICY_BEGIN_LINE.test(trimmed)) {
      begins.push(offset + leading);
    } else if (trimmed === POLICY_END_MARKER) {
      ends.push(offset + leading);
    }
    offset += line.length + 1;
  }
  return { begins, ends };
}

/** First policy-marker line of `kind` at or after `from`, or -1. */
function indexOfPolicyMarkerLine(agentsMd: string, kind: 'begin' | 'end', from: number): number {
  const { begins, ends } = policyMarkerLineOffsets(agentsMd);
  const offsets = kind === 'begin' ? begins : ends;
  return offsets.find((offset) => offset >= from) ?? -1;
}

/**
 * A line is a grant candidate when it is a list item whose text starts with a
 * backtick, or that contains a backticked known policy name followed by a colon
 * (including bold-wrapped names like `- **github-merge**: …`). Candidates that
 * do not match GRANT_LINE are malformed.
 */
const GRANT_LINE_CANDIDATE = /^[-*+]\s+/;
const GRANT_LINE = /^[-*+]\s+`([^`]*)`:\s+(\S.*)$/;
const RECORDED_LINE = /^Recorded (\d{4}-\d{2}-\d{2})\.$/;
const BOLD_GRANT_NAME = /^\*\*([^*]+)\*\*:/;

function isGrantLineCandidate(line: string): boolean {
  const list = GRANT_LINE_CANDIDATE.exec(line);
  if (!list) {
    return false;
  }
  const text = line.slice(list[0].length);
  if (text.startsWith('`')) {
    return true;
  }
  const bold = BOLD_GRANT_NAME.exec(text);
  if (bold && isKnownPolicy(bold[1]!)) {
    return true;
  }
  return POLICY_NAMES.some((name) => text.includes(`\`${name}\`:`));
}

/** `text` with CRLF line breaks converted to LF. */
function toLf(text: string): string {
  return text.replace(/\r\n/gu, '\n');
}

/**
 * Whether a write to `text` should use CRLF: true when any line break in it is
 * CRLF. A Windows checkout has CRLF, and the LF lines such a file can also hold
 * come from tbd's own writes (setup writes the tbd block with LF), so a single
 * CRLF line marks the file as CRLF.
 */
function usesCrlf(text: string): boolean {
  return text.includes('\r\n');
}

/**
 * Read the policy block from the full AGENTS.md text, applying the guideline's
 * rules: the block must sit inside the tbd block, appear once, carry a known
 * version, and hold well-formed grant lines with no policy listed twice.
 * Lines between the markers that are not grant lines are ignored. CRLF line
 * endings read the same as LF, and the returned `text` has LF line endings.
 */
export function parsePolicyBlock(content: string): PolicyBlockParse {
  const agentsMd = toLf(content);
  const { begins, ends } = policyMarkerLineOffsets(agentsMd);
  if (begins.length === 0 && ends.length === 0) {
    return { status: 'missing' };
  }
  const problems: string[] = [];
  if (begins.length > 1 || ends.length > 1) {
    problems.push('AGENTS.md holds more than one policy block');
  }
  if (begins.length === 0) {
    problems.push(`the ${POLICY_BEGIN_MARKER} marker is missing`);
  }
  if (ends.length === 0) {
    problems.push(`the ${POLICY_END_MARKER} marker is missing`);
  }
  if (problems.length > 0) {
    return { status: 'malformed', problems };
  }

  const start = begins[0]!;
  const beginLineEnd = agentsMd.indexOf('\n', start);
  const beginLine = beginLineEnd < 0 ? agentsMd.slice(start) : agentsMd.slice(start, beginLineEnd);
  const versionMatch = /^<!-- BEGIN TBD POLICY GRANTS v=(\S+) -->$/.exec(beginLine.trim());
  if (!versionMatch) {
    return {
      status: 'malformed',
      problems: [`the begin marker line is not "${POLICY_BEGIN_MARKER}"`],
    };
  }
  if (versionMatch[1] !== POLICY_BLOCK_VERSION) {
    return { status: 'unknown-version', version: versionMatch[1]! };
  }
  const endStart = ends[0]!;
  if (endStart < start) {
    return { status: 'malformed', problems: ['the END marker comes before the BEGIN marker'] };
  }
  const integration = locateIntegrationBlock(agentsMd);
  if (
    !integration ||
    start < integration.bodyStart ||
    endStart + POLICY_END_MARKER.length > integration.endMarker
  ) {
    problems.push(
      `the policy block is not inside the tbd block (between ${INTEGRATION_BEGIN_MARKER} ... --> and ${INTEGRATION_END_MARKER})`,
    );
  }

  const inner = beginLineEnd < 0 ? '' : agentsMd.slice(beginLineEnd + 1, endStart);
  const grants: PolicyGrant[] = [];
  const seen = new Set<string>();
  let recorded: string | null = null;
  for (const rawLine of inner.split('\n')) {
    const line = rawLine.trim();
    const recordedMatch = RECORDED_LINE.exec(line);
    if (recordedMatch) {
      recorded = recordedMatch[1]!;
      continue;
    }
    if (!isGrantLineCandidate(line)) {
      continue;
    }
    const match = GRANT_LINE.exec(line);
    if (!match || !isValidPolicyName(match[1]!)) {
      problems.push(`grant line does not match "- \`<policy>\`: <value>": ${line}`);
      continue;
    }
    const name = match[1]!;
    if (seen.has(name)) {
      problems.push(`policy "${name}" is listed twice`);
      continue;
    }
    seen.add(name);
    grants.push({ name, value: match[2]!.trim() });
  }
  if (problems.length > 0) {
    return { status: 'malformed', problems };
  }
  const endOfEnd = endStart + POLICY_END_MARKER.length;
  return { status: 'ok', grants, recorded, text: `${agentsMd.slice(start, endOfEnd)}\n` };
}

/** Known policies in table order, then unknown names in the order given. */
export function orderGrants(grants: readonly PolicyGrant[]): PolicyGrant[] {
  const known = POLICY_NAMES.flatMap((name) => grants.filter((grant) => grant.name === name));
  const unknown = grants.filter((grant) => !isKnownPolicy(grant.name));
  return [...known, ...unknown];
}

/** A copy of `grants` with `name` set to `value`, replacing in place or appending. */
export function upsertGrant(
  grants: readonly PolicyGrant[],
  name: string,
  value: string,
): PolicyGrant[] {
  const index = grants.findIndex((grant) => grant.name === name);
  if (index < 0) {
    return [...grants, { name, value }];
  }
  return grants.map((grant, i) => (i === index ? { name, value } : grant));
}

/**
 * Render the block as the guideline defines it: markers, heading, the fixed
 * prose, one grant line per policy (known ones in table order with canonical
 * values, then unknown names as found), and the Recorded line.
 */
export function renderPolicyBlock(grants: readonly PolicyGrant[], recordedDate: string): string {
  const lines = orderGrants(grants).map(
    (grant) => `- \`${grant.name}\`: ${canonicalPolicyValue(grant.name, grant.value)}`,
  );
  return [
    POLICY_BEGIN_MARKER,
    POLICY_BLOCK_HEADING,
    '',
    POLICY_BLOCK_PROSE,
    '',
    ...lines,
    '',
    `Recorded ${recordedDate}.`,
    POLICY_END_MARKER,
    '',
  ].join('\n');
}

/** Thrown when AGENTS.md cannot take a policy block; the message tells the user what to do. */
export class PolicyBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyBlockError';
  }
}

export const SETUP_AGENTS_MD_HINT =
  'run `tbd setup --auto` (or `tbd setup --auto --surfaces=agents-md`) to create it, then record grants';

/**
 * Return AGENTS.md `content` with `block` (from renderPolicyBlock) as its policy block:
 * replacing the existing block in place, or inserting it after one blank line
 * immediately before END TBD INTEGRATION. The tbd block's begin line is
 * restamped with the current integration format so that an older tbd, which
 * would drop the block when regenerating, refuses to rewrite it instead.
 *
 * The result uses CRLF throughout when `content` has any CRLF line break, as a
 * Windows checkout does, and LF otherwise, whatever line endings `block` has.
 *
 * Throws PolicyBlockError when there is no tbd block or it was stamped by a
 * newer tbd. Callers parse first and refuse to write over a malformed or
 * unknown-version block.
 */
export function withPolicyBlock(content: string, block: string): string {
  const updated = withPolicyBlockLf(toLf(content), toLf(block));
  return usesCrlf(content) ? updated.replace(/\n/gu, '\r\n') : updated;
}

/** withPolicyBlock for LF text. */
function withPolicyBlockLf(agentsMd: string, block: string): string {
  const integration = locateIntegrationBlock(agentsMd);
  if (!integration) {
    throw new PolicyBlockError(`AGENTS.md has no tbd block; ${SETUP_AGENTS_MD_HINT}`);
  }
  if (
    integrationFormatNumber(integration.format) > integrationFormatNumber(AGENT_INTEGRATION_FORMAT)
  ) {
    throw new PolicyBlockError(
      `AGENTS.md was generated by a newer tbd (integration format ${integration.format}; ` +
        `this tbd supports up to ${AGENT_INTEGRATION_FORMAT}).\n` +
        `Upgrade tbd to manage it: npm install -g get-tbd@latest`,
    );
  }

  const beginLineEnd = agentsMd.indexOf('\n', integration.start);
  if (beginLineEnd < 0 || beginLineEnd > integration.endMarker) {
    throw new PolicyBlockError(
      'the tbd block markers in AGENTS.md must be on separate lines; ' +
        'put BEGIN TBD INTEGRATION and END TBD INTEGRATION each on its own line',
    );
  }
  const head = agentsMd.slice(0, integration.start) + INTEGRATION_BEGIN_LINE;
  const rest = agentsMd.slice(beginLineEnd);
  const restamped = head + rest;
  const located = locateIntegrationBlock(restamped);
  if (!located) {
    throw new PolicyBlockError(
      'the tbd block markers in AGENTS.md must be on separate lines; ' +
        'put BEGIN TBD INTEGRATION and END TBD INTEGRATION each on its own line',
    );
  }

  const policyStart = indexOfPolicyMarkerLine(restamped, 'begin', located.bodyStart);
  const policyEndMarker = indexOfPolicyMarkerLine(restamped, 'end', located.bodyStart);
  if (policyStart >= 0 && policyEndMarker >= 0 && policyEndMarker < located.endMarker) {
    let policyEnd = policyEndMarker + POLICY_END_MARKER.length;
    if (restamped[policyEnd] === '\n') {
      policyEnd += 1;
    }
    return restamped.slice(0, policyStart) + block + restamped.slice(policyEnd);
  }

  const before = restamped.slice(located.bodyStart, located.endMarker).replace(/\n*$/, '');
  const separator = before === '' ? '' : `${before}\n\n`;
  return (
    restamped.slice(0, located.bodyStart) + separator + block + restamped.slice(located.endMarker)
  );
}

// =============================================================================
// Effective grants
// =============================================================================

/** What one policy is for agents, from one reading of a block. */
export interface PolicyStatus {
  name: string;
  /** One of the seven policies this tbd defines. */
  known: boolean;
  /** Listed in the block, whatever its value. */
  answered: boolean;
  /** The recorded value as written; null when unanswered. */
  value: string | null;
  /**
   * The recorded value is a fixed value or a grammar product. True when
   * unanswered, and for an unknown policy, which has no schema to violate.
   */
  valid: boolean;
  /**
   * What agents act on: the canonical recorded value, or the unanswered default
   * when the policy is unanswered or its value is unknown. For an unknown policy,
   * the value as written.
   */
  effective: string | null;
  recommended: string | null;
}

/**
 * Derive each policy's status from a parsed block: the seven known policies in
 * table order, then any unknown names in the block. A missing, malformed, or
 * unknown-version block leaves every policy unanswered.
 */
export function resolvePolicyStatuses(parse: PolicyBlockParse): PolicyStatus[] {
  const grants = parse.status === 'ok' ? parse.grants : [];
  const statuses: PolicyStatus[] = POLICY_NAMES.map((name) => {
    const definition = POLICIES[name];
    const grant = grants.find((g) => g.name === name);
    if (!grant) {
      return {
        name,
        known: true,
        answered: false,
        value: null,
        valid: true,
        effective: definition.unansweredValue,
        recommended: definition.recommended,
      };
    }
    const check = checkPolicyValue(name, grant.value);
    return {
      name,
      known: true,
      answered: true,
      value: grant.value,
      valid: check.ok,
      effective: check.ok ? check.canonical : definition.unansweredValue,
      recommended: definition.recommended,
    };
  });
  for (const grant of grants) {
    if (!isKnownPolicy(grant.name)) {
      statuses.push({
        name: grant.name,
        known: false,
        answered: true,
        value: grant.value,
        valid: true,
        effective: grant.value,
        recommended: null,
      });
    }
  }
  return statuses;
}

/** A policy whose recorded value differs between two readings (null = unanswered). */
export interface PolicyDifference {
  name: string;
  from: string | null;
  to: string | null;
}

function recordedValue(status: PolicyStatus | undefined): string | null {
  if (!status?.answered || status.value === null) {
    return null;
  }
  return canonicalPolicyValue(status.name, status.value);
}

/** Policies recorded differently in `to` than in `from`, in `from` order then new names. */
export function diffPolicyStatuses(
  from: readonly PolicyStatus[],
  to: readonly PolicyStatus[],
): PolicyDifference[] {
  const names = [...from.map((s) => s.name)];
  for (const status of to) {
    if (!names.includes(status.name)) {
      names.push(status.name);
    }
  }
  const differences: PolicyDifference[] = [];
  for (const name of names) {
    const before = recordedValue(from.find((s) => s.name === name));
    const after = recordedValue(to.find((s) => s.name === name));
    if (before !== after) {
      differences.push({ name, from: before, to: after });
    }
  }
  return differences;
}

/** The ref grants are read from and how it was chosen. */
export interface DefaultBranchRef {
  branch: string;
  /** Full ref (`refs/remotes/origin/main`, `refs/heads/main`) or `HEAD` for the fallback. */
  ref: string;
  /**
   * `remote-tracking`: the remote's copy of the default branch (as of the last
   * fetch), preferred because it is what every clone shares. `local`: the local
   * default branch, only when the repository has no remotes. `head`: no default
   * branch could be found and the repository has no remotes, so the current
   * commit is used. `unresolved`: the clone has a remote but no trusted default
   * branch, so every policy is unanswered.
   */
  kind: 'remote-tracking' | 'local' | 'head' | 'unresolved';
  /** How to make the default branch resolvable; set when `kind` is `unresolved`. */
  repair?: string;
  /** Short SHA of the commit grants were read from, when known. */
  shortSha?: string;
  /** Relative age of that commit (`3 days ago`), when known. */
  age?: string;
}

/** ` as of origin/main 16de5bc, 3 days ago` when SHA is known; otherwise empty. */
export function describeGrantStamp(source: DefaultBranchRef): string {
  if (!source.shortSha) {
    return '';
  }
  const name =
    source.kind === 'remote-tracking'
      ? source.ref.replace(/^refs\/remotes\//, '')
      : source.kind === 'head'
        ? 'HEAD'
        : source.branch;
  return ` as of ${name} ${source.shortSha}${source.age ? `, ${source.age}` : ''}`;
}

const POLICY_VALUE_DISPLAY_MAX = 60;

/** Bound a recorded value for hook and `policy show` output: strip controls, cap length. */
export function displayPolicyValue(value: string, maxLength = POLICY_VALUE_DISPLAY_MAX): string {
  const stripped = value.replace(/[\p{Cc}\p{Cf}]/gu, '');
  if (stripped.length <= maxLength) {
    return stripped;
  }
  return `${stripped.slice(0, maxLength)}…`;
}

async function refExists(repoDir: string, ref: string): Promise<boolean> {
  try {
    await git('-C', repoDir, 'rev-parse', '--verify', '-q', `${ref}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

interface RefStamp {
  shortSha: string;
  age: string;
}

/** Existing remote-tracking and local branch refs, with SHA and age, in one git call. */
async function listBranchRefs(repoDir: string, remote: string): Promise<Map<string, RefStamp>> {
  const refs = new Map<string, RefStamp>();
  try {
    const output = await git(
      '-C',
      repoDir,
      'for-each-ref',
      '--format=%(refname)\t%(objectname:short)\t%(committerdate:relative)',
      `refs/remotes/${remote}/`,
      'refs/heads/',
    );
    if (output === '') {
      return refs;
    }
    for (const line of output.split('\n')) {
      const [refname, shortSha, age] = line.split('\t');
      if (refname && shortSha) {
        refs.set(refname, { shortSha, age: age ?? '' });
      }
    }
  } catch {
    // Not a git repository, or for-each-ref failed; treat as no refs.
  }
  return refs;
}

async function stampSource(repoDir: string, source: DefaultBranchRef): Promise<DefaultBranchRef> {
  if (source.kind === 'unresolved' || source.shortSha) {
    return source;
  }
  try {
    const output = await git('-C', repoDir, 'log', '-1', '--format=%h\t%cr', source.ref);
    const [shortSha, age] = output.split('\t');
    return shortSha ? { ...source, shortSha, age: age ?? '' } : source;
  } catch {
    return source;
  }
}

/** Remotes configured in this clone (`git remote`). Empty when there are none. */
async function listRemotes(repoDir: string): Promise<string[]> {
  try {
    const output = await git('-C', repoDir, 'remote');
    return output === '' ? [] : output.split('\n');
  } catch {
    return [];
  }
}

function unresolvedSource(branch: string, repair: string): DefaultBranchRef {
  return { branch, ref: '', kind: 'unresolved', repair };
}

function unansweredGrants(source: DefaultBranchRef | null): EffectiveGrants {
  const parse: PolicyBlockParse = { status: 'missing' };
  return { source, parse, policies: resolvePolicyStatuses(parse), committed: null };
}

/**
 * Find the default branch: the branch `<remote>/HEAD` names (set by clone), else
 * `init.defaultBranch`, `main`, or `master`, whichever exists first. For each
 * candidate the remote-tracking ref is preferred over the local branch, and the
 * local branch is used only when `allowLocal` is true (the repository has no
 * remotes). Returns null when none exists. No network access.
 */
export async function resolveDefaultBranch(
  repoDir: string,
  remote: string,
  options: { allowLocal?: boolean } = {},
): Promise<DefaultBranchRef | null> {
  const allowLocal = options.allowLocal ?? true;
  const candidates: string[] = [];
  try {
    const target = await git('-C', repoDir, 'symbolic-ref', '-q', `refs/remotes/${remote}/HEAD`);
    const prefix = `refs/remotes/${remote}/`;
    if (target.startsWith(prefix)) {
      candidates.push(target.slice(prefix.length));
    }
  } catch {
    // No remote HEAD (not a clone, or the remote is unset).
  }
  try {
    const configured = await git('-C', repoDir, 'config', '--get', 'init.defaultBranch');
    if (configured) {
      candidates.push(configured);
    }
  } catch {
    // Not configured.
  }
  candidates.push('main', 'master');

  const refs = await listBranchRefs(repoDir, remote);
  for (const branch of [...new Set(candidates)]) {
    const tracking = `refs/remotes/${remote}/${branch}`;
    const trackingStamp = refs.get(tracking);
    if (trackingStamp) {
      return {
        branch,
        ref: tracking,
        kind: 'remote-tracking',
        shortSha: trackingStamp.shortSha,
        age: trackingStamp.age,
      };
    }
    if (allowLocal) {
      const local = `refs/heads/${branch}`;
      const localStamp = refs.get(local);
      if (localStamp) {
        return {
          branch,
          ref: local,
          kind: 'local',
          shortSha: localStamp.shortSha,
          age: localStamp.age,
        };
      }
    }
  }
  return null;
}

/**
 * Read AGENTS.md as committed at `ref`, or null when the ref or the file is
 * absent there (git exit 128). `repoDir` may be a subdirectory of the repository.
 */
export async function readCommittedAgentsMd(repoDir: string, ref: string): Promise<string | null> {
  try {
    const prefix = await git('-C', repoDir, 'rev-parse', '--show-prefix');
    return await git('-C', repoDir, 'show', `${ref}:${prefix}${AGENTS_MD_REL}`);
  } catch (error) {
    if (error instanceof GitError && error.exitCode === 128) {
      return null;
    }
    throw error;
  }
}

/** Grants as committed on the default branch: what agents act on. */
export interface EffectiveGrants {
  /** Null only when the repository has no commit to read from. */
  source: DefaultBranchRef | null;
  parse: PolicyBlockParse;
  policies: PolicyStatus[];
  /** AGENTS.md as committed at `source.ref`; null when unread. */
  committed: string | null;
}

/**
 * Read the effective grants: the policy block in AGENTS.md as committed on the
 * default branch (see resolveDefaultBranch), so a grant on an unmerged branch or
 * in the working tree is not effective. Falls back to HEAD only when the
 * repository has no remotes. When a remote exists but no trusted default branch
 * can be resolved (a single-branch or CI-style checkout, or a `sync.remote` this
 * clone does not have), returns an `unresolved` source and every policy unanswered.
 */
export async function readEffectiveGrants(
  repoDir: string,
  remote: string,
): Promise<EffectiveGrants> {
  const remotes = await listRemotes(repoDir);
  const hasRemotes = remotes.length > 0;
  if (hasRemotes && !remotes.includes(remote)) {
    return unansweredGrants(
      unresolvedSource(
        remote,
        `sync.remote is "${remote}" but this clone's remotes are: ${remotes.join(', ')}. ` +
          `Set sync.remote to an existing remote, or git fetch <remote> <default-branch>.`,
      ),
    );
  }

  let source = await resolveDefaultBranch(repoDir, remote, { allowLocal: !hasRemotes });
  if (!source) {
    if (hasRemotes) {
      return unansweredGrants(
        unresolvedSource(
          remote,
          `git remote set-head ${remote} --auto, or git fetch ${remote} <default-branch>`,
        ),
      );
    }
    let branch = 'HEAD';
    try {
      branch = await git('-C', repoDir, 'rev-parse', '--abbrev-ref', 'HEAD');
    } catch {
      // Unborn HEAD: nothing is committed yet.
    }
    source = (await refExists(repoDir, 'HEAD')) ? { branch, ref: 'HEAD', kind: 'head' } : null;
  }
  if (source) {
    source = await stampSource(repoDir, source);
  }
  const committed = source ? await readCommittedAgentsMd(repoDir, source.ref) : null;
  const parse: PolicyBlockParse =
    committed === null ? { status: 'missing' } : parsePolicyBlock(committed);
  return { source, parse, policies: resolvePolicyStatuses(parse), committed };
}

/** The working tree's AGENTS.md, which `tbd policy` edits; grants here are pending until committed. */
export interface WorkingTreeGrants {
  agentsMdExists: boolean;
  /** AGENTS.md holds a tbd block (the policy block's home). */
  integrationBlock: boolean;
  parse: PolicyBlockParse;
  policies: PolicyStatus[];
}

export async function readWorkingTreeGrants(projectRoot: string): Promise<WorkingTreeGrants> {
  let content: string | null = null;
  try {
    content = await readFile(join(projectRoot, AGENTS_MD_REL), 'utf-8');
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }
  const parse: PolicyBlockParse =
    content === null ? { status: 'missing' } : parsePolicyBlock(content);
  return {
    agentsMdExists: content !== null,
    integrationBlock: content !== null && locateIntegrationBlock(content) !== null,
    parse,
    policies: resolvePolicyStatuses(parse),
  };
}
