import { AGENT_INTEGRATION_FORMAT } from './integration-paths.js';
import {
  POLICY_BEGIN_MARKER,
  POLICY_BEGIN_MARKER_PREFIX,
  POLICY_BLOCK_HEADING,
  POLICY_BLOCK_PROSE,
  POLICY_END_MARKER,
  PolicyBlockError,
  displayPolicyValue,
  locateIntegrationBlock,
  parsePolicyBlock,
  withPolicyBlock,
} from './policy-grants.js';
import { integrationFormatNumber, locateManagedBlock } from '../cli/lib/managed-artifact.js';

/** Match generated prose despite Markdown wrapping or checkout line endings. */
function prosePattern(prose: string): RegExp {
  return new RegExp(
    prose
      .trim()
      .split(/\s+/u)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
      .join('\\s+'),
    'u',
  );
}

/** Whether the block carries all current guidance, without imposing grant or note formatting. */
export function hasCurrentPolicyBlockProse(block: string): boolean {
  return prosePattern(POLICY_BLOCK_PROSE).test(block);
}

// These are the previously generated paragraphs. Match only known generated text:
// replacing an arbitrary paragraph would also discard user notes in that paragraph.
const LEGACY_INTRO = `The user granted these policies explicitly for this project. A user instruction in the
current conversation overrides them. For what each policy means, run
\`tbd guidelines agent-policy-grants\`; to change them, run \`tbd policy\`.`;
const DEFAULT_BRANCH_GUIDANCE = `Only the copy committed on the default branch is in effect; a branch or working-tree
copy is a proposal, and \`tbd policy show\` reports the effective grants.`;
const LEGACY_PROSE = [
  `${LEGACY_INTRO}\n${DEFAULT_BRANCH_GUIDANCE}`,
  POLICY_BLOCK_PROSE.replace(`\n${DEFAULT_BRANCH_GUIDANCE}`, ''),
  LEGACY_INTRO,
];

/**
 * Refresh generated policy guidance without re-rendering grants, notes, or the Recorded
 * date. As for other policy writes, the integration stamp advances to the supported
 * format; newer formats and unreadable blocks are refused. An unfamiliar edited
 * introduction needs manual repair rather than deletion.
 */
export function refreshPolicyBlockProse(content: string): string {
  const parse = parsePolicyBlock(content);
  switch (parse.status) {
    case 'missing':
      throw new PolicyBlockError(
        'AGENTS.md has no policy block to refresh; record grants with tbd policy first.',
      );
    case 'unknown-version':
      throw new PolicyBlockError(
        `Cannot refresh policy block version v=${displayPolicyValue(parse.version)}; upgrade tbd.`,
      );
    case 'malformed':
      throw new PolicyBlockError(
        `Cannot refresh malformed policy block: ${parse.problems.join('; ')}`,
      );
    case 'ok':
      break;
    default: {
      const unhandled: never = parse;
      throw new Error(`Unhandled policy block: ${JSON.stringify(unhandled)}`);
    }
  }

  const normalized = content.replace(/\r\n?/gu, '\n');
  const integration = locateIntegrationBlock(normalized)!;
  if (
    integrationFormatNumber(integration.format) > integrationFormatNumber(AGENT_INTEGRATION_FORMAT)
  ) {
    throw new PolicyBlockError(
      `AGENTS.md uses newer integration format ${integration.format}; upgrade tbd before refreshing it.`,
    );
  }
  if (hasCurrentPolicyBlockProse(parse.text)) {
    return integration.format === AGENT_INTEGRATION_FORMAT
      ? content
      : withPolicyBlock(content, parse.text);
  }
  const location = locateManagedBlock(normalized, POLICY_BEGIN_MARKER_PREFIX, POLICY_END_MARKER)!;
  const block = normalized.slice(location.start, location.end);
  let refreshed: string | undefined;
  for (const legacy of LEGACY_PROSE) {
    const pattern = prosePattern(legacy);
    if (pattern.test(block)) {
      refreshed = block.replace(pattern, () => POLICY_BLOCK_PROSE);
      break;
    }
  }
  if (refreshed === undefined) {
    if (block.includes('The user granted these policies explicitly for this project.')) {
      throw new PolicyBlockError(
        'The policy introduction contains unrecognized edits; update its guidance by hand ' +
          '(tbd guidelines agent-policy-grants). Grants and notes were left unchanged.',
      );
    }
    const heading = `${POLICY_BEGIN_MARKER}\n${POLICY_BLOCK_HEADING}\n`;
    const insertAt = block.startsWith(heading) ? heading.length : block.indexOf('\n') + 1;
    const intro = block.startsWith(heading) ? '' : `${POLICY_BLOCK_HEADING}\n`;
    refreshed =
      block.slice(0, insertAt) + `${intro}\n${POLICY_BLOCK_PROSE}\n\n` + block.slice(insertAt);
  }
  return withPolicyBlock(content, refreshed);
}
