/**
 * The install and upgrade command tbd gives in its skill, `tbd prime`, help, error
 * messages, and doctor suggestions.
 *
 * It follows the install rules in SUPPLY-CHAIN-SECURITY.md (`tbd guidelines
 * supply-chain-hardening`): npm resolves `get-tbd` to the newest release published at
 * least 14 days ago (`--before` also applies to every dependency), and installs it with
 * no lifecycle scripts. Recommending `get-tbd@latest` instead would install whatever the
 * registry served that minute, which is the fast-yanked-compromise window the cool-off
 * exists to skip. The cutoff is computed with node, which every tbd install already
 * needs.
 */
const COOL_OFF_INSTALL =
  'npm install -g --ignore-scripts ' +
  `--before="$(node -p 'new Date(Date.now() - 14 * 86400000).toISOString()')"`;

export const TBD_INSTALL_COMMAND = `${COOL_OFF_INSTALL} get-tbd`;

/**
 * What a cool-off miss means, for advice that answers "this repository requires a newer
 * tbd". Under `--before`, npm cannot install a release younger than 14 days: it reports
 * no matching version, or it installs an older release that still refuses the
 * repository. Saying so keeps an agent from reaching for `get-tbd@latest`.
 */
export const TBD_COOL_OFF_NOTE =
  'If npm finds no matching version, or tbd still refuses, the release it needs is under ' +
  '14 days old: wait, or ask the user for an exception (tbd guidelines supply-chain-hardening).';

/** An exact release as setup records it in `tbd_fallback_version`; nothing else is quoted. */
const EXACT_RELEASE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

/**
 * The upgrade command for a repository this tbd cannot read. With `requiredVersion`,
 * the release that last set the repository up (`tbd_fallback_version` in
 * `.tbd/config.yml`), npm installs the newest release at least that new that is past
 * the cool-off, and fails with no matching version, instead of installing something
 * stale or older, while that release is under 14 days old.
 */
export function tbdUpgradeCommand(requiredVersion?: string): string {
  if (requiredVersion === undefined || !EXACT_RELEASE.test(requiredVersion)) {
    return TBD_INSTALL_COMMAND;
  }
  return `${COOL_OFF_INSTALL} 'get-tbd@>=${requiredVersion}'`;
}

/**
 * The full advice for "requires a newer tbd": `lead` (for example `Upgrade tbd`), the
 * minimum release when it is known, the command, and the cool-off note on its own line.
 */
export function tbdUpgradeAdvice(lead: string, requiredVersion?: string): string {
  const command = tbdUpgradeCommand(requiredVersion);
  const target = command === TBD_INSTALL_COMMAND ? '' : ` to get-tbd ${requiredVersion} or newer`;
  return `${lead}${target}: ${command}\n${TBD_COOL_OFF_NOTE}`;
}
