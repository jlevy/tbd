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
export const TBD_INSTALL_COMMAND =
  'npm install -g --ignore-scripts ' +
  `--before="$(node -p 'new Date(Date.now() - 14 * 86400000).toISOString()')" get-tbd`;
