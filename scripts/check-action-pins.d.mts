export interface UnpinnedUse {
  file: string;
  line: number;
  reference: string;
}

export function findUnpinnedUses(source: string, file: string): UnpinnedUse[];

export function checkWorkflows(directory: string): { files: string[]; problems: UnpinnedUse[] };
