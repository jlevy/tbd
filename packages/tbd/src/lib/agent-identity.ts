/**
 * Agent identity: who is doing the work.
 *
 * Every bead change has an actor, and until now tbd recorded none — `assignee` was free
 * text that nothing set, and across 1,681 beads it had never once been used. That makes
 * "what is every agent working on right now" unanswerable, which is the question a
 * shared tracker exists to answer.
 *
 * ## Format
 *
 * The canonical id is `agid-{ulid}`: tbd's existing internal-ID shape with a different
 * prefix. That choice is load-bearing rather than cosmetic. Agent ids are minted
 * independently on many machines at session start, with no shared lock and no chance to
 * consult a registry before pushing — so the short, registry-checked form that makes
 * 4-character bead display ids safe cannot be used here. A ULID carries 80 bits of
 * randomness alongside its millisecond timestamp, which makes uncoordinated minting safe
 * by construction. See research-2026-08-14-agent-and-session-identity.md §5.2.
 *
 * The friendly name is a separate field joined onto that id, never concatenated into it.
 * Renaming an agent must not change who it is — the mistake in the January design, whose
 * `ag-{slugified-name}-{ulid}` made identity a function of a mutable label.
 *
 * ## Resolution
 *
 * Explicit beats ambient, and ambient beats derived:
 *
 *   1. `--as <name>`         an operator saying so outright
 *   2. `$TBD_AGENT`          the environment a harness or CI set up
 *   3. session state         minted at session start, stored machine-locally
 *   4. derived               `<harness>@<host>`, the honest last resort
 *
 * Resolution is total: something always comes back, because a bead claimed by an
 * unnameable agent is still better recorded than a bead claimed by nobody.
 */

import { hostname, userInfo } from 'node:os';

import { generateInternalId, extractUlidFromInternalId } from './ids.js';

/** Prefix for agent ids. Parallel to `is-` for issues. */
export const AGENT_ID_PREFIX = 'agid';

const AGENT_ID_PATTERN = new RegExp(`^${AGENT_ID_PREFIX}-[0-9a-z]{26}$`);

/**
 * Mint a new agent id.
 *
 * No registry is consulted, and none is needed: two agents collide only by drawing the
 * same 80 random bits inside the same millisecond.
 */
export function generateAgentId(): string {
  return `${AGENT_ID_PREFIX}-${extractUlidFromInternalId(generateInternalId())}`;
}

/** Whether a string is a well-formed agent id. */
export function isAgentId(value: string): boolean {
  return AGENT_ID_PATTERN.test(value.toLowerCase());
}

/**
 * Detect the coding-agent harness from the environment.
 *
 * Deliberately env-var based even though the agent-identity research argues hook stdin
 * is the portable channel: this runs inside an ordinary CLI invocation, which has no
 * stdin payload. `CLAUDECODE` is set in *every* subprocess Claude Code spawns, so a bare
 * `tbd start` self-attributes correctly with no hook installed at all. Codex sets no
 * equivalent, which is exactly why this degrades to `unknown` rather than guessing.
 */
export function detectHarness(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE_ENTRYPOINT) {
    return 'claude-code';
  }
  if (env.CURSOR_PROJECT_DIR || env.CURSOR_VERSION) {
    return 'cursor';
  }
  if (env.CODEX_HOME || env.CODEX_SESSION_ID) {
    return 'codex';
  }
  if (env.GEMINI_CLI || env.GEMINI_API_KEY) {
    return 'gemini-cli';
  }
  return 'unknown';
}

/**
 * The model this agent is running, when the harness says so.
 *
 * Best-effort and frequently absent: Claude Code does not guarantee a model in hook
 * payloads and sets no `$CLAUDE_MODEL`, so this is recorded when offered and omitted
 * otherwise rather than inferred.
 */
export function detectModel(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.TBD_AGENT_MODEL ?? env.ANTHROPIC_MODEL ?? env.CODEX_MODEL ?? undefined;
}

/** Where a resolved identity came from, so `tbd whoami` can explain itself. */
export type AgentIdentitySource = 'flag' | 'env' | 'session' | 'derived';

export interface AgentIdentity {
  /** Friendly name. This is what lands in `assignee`. */
  name: string;
  /** Canonical id, when the session has one minted. */
  id?: string;
  /** Which harness this is running under, or 'unknown'. */
  harness: string;
  /** Model, when the harness exposed one. */
  model?: string;
  source: AgentIdentitySource;
}

/**
 * Slugify a name into something safe to put in `assignee` and to filter on.
 *
 * Kept conservative — lowercase, alphanumerics, `-`, `_`, `@`, `.` — because the value
 * flows into tracker labels and query strings.
 */
export function slugifyAgentName(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'agent';
}

/**
 * A non-person-identifying default: the harness plus the host.
 *
 * Deliberately not the OS username. The existing `user_map` stance keeps person
 * identity out of synced data by default, and an agent's identity should not be the
 * first thing to leak it. `userInfo()` is consulted only when there is no hostname to
 * use, where something is better than `agent@unknown`.
 */
export function derivedAgentName(env: NodeJS.ProcessEnv = process.env): string {
  const harness = detectHarness(env);
  let host = '';
  try {
    host = hostname();
  } catch {
    host = '';
  }
  if (!host) {
    try {
      host = userInfo().username;
    } catch {
      host = 'unknown';
    }
  }
  return slugifyAgentName(`${harness}@${host}`);
}

/**
 * Resolve the acting identity.
 *
 * `session` carries whatever a SessionStart hook minted for this working directory; it
 * is machine-local state, not something committed.
 */
export function resolveAgentIdentity(options: {
  as?: string;
  session?: { agent_id?: string; agent_name?: string };
  env?: NodeJS.ProcessEnv;
}): AgentIdentity {
  const env = options.env ?? process.env;
  const harness = detectHarness(env);
  const model = detectModel(env);

  if (options.as) {
    return { name: slugifyAgentName(options.as), harness, model, source: 'flag' };
  }

  const fromEnv = env.TBD_AGENT?.trim();
  if (fromEnv) {
    return { name: slugifyAgentName(fromEnv), harness, model, source: 'env' };
  }

  const sessionName = options.session?.agent_name?.trim();
  if (sessionName) {
    return {
      name: slugifyAgentName(sessionName),
      id: options.session?.agent_id,
      harness,
      model,
      source: 'session',
    };
  }

  return {
    name: derivedAgentName(env),
    id: options.session?.agent_id,
    harness,
    model,
    source: 'derived',
  };
}
