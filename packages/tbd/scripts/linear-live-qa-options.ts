export interface LinearLiveQaArgs {
  team: string;
  project: string;
}

const USAGE = 'Usage: validate-linear-integration-live.ts --team <key> --project <name-or-slug>';

/** Parse the Linear live release gate's required provider scope. */
export function parseLinearLiveQaArgs(argv: string[]): LinearLiveQaArgs {
  let team: string | undefined;
  let project: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--team') {
      team = argv[index + 1];
      index += 1;
    } else if (arg === '--project') {
      project = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  const normalizedTeam = team?.trim();
  const normalizedProject = project?.trim();
  if (!normalizedTeam || !normalizedProject) {
    throw new Error(USAGE);
  }
  return { team: normalizedTeam, project: normalizedProject };
}
