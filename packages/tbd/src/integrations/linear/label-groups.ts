/**
 * Linear label groups, and the qualified names that make them addressable.
 *
 * Linear models a label group as an ordinary label with `isGroup: true`; a label inside
 * the group carries `parent` and a `name` that is **only the leaf**. So the group `repo`
 * containing `tbd` yields a label whose `name` is `"tbd"`, not `"repo/tbd"`.
 *
 * That is the whole problem this module exists to solve. tbd names origin labels
 * canonically as `repo/<name>`, and a bare-name map cannot represent them:
 *
 * - **Lookup misses.** Searching for `"repo/tbd"` among bare names never matches, so the
 *   adapter falls through to creation and makes a *flat* label literally named
 *   `repo/tbd` — no group, and therefore none of the one-label-per-issue guarantee that
 *   made the group worth having.
 * - **Collisions.** A workspace whose repository is itself called `tbd` has a root label
 *   `tbd` (the origin marker) and a child `tbd` under `repo`. Keyed by bare name those
 *   are the same entry, and one silently wins.
 * - **A permanent write loop.** Reading an issue's labels back as bare names reports
 *   `"tbd"` for the grouped one, so the engine diffs its required `"repo/tbd"` against a
 *   set that never contains it, finds it missing, and re-asserts it on every sync
 *   forever — the same shape of loop `labels.create` had.
 *
 * Qualifying both directions through this module is what keeps the comparison honest:
 * the name tbd asks for, the name that comes back, and the key in the id map are all the
 * same string.
 */

/** The separator between a group and its leaf in a qualified name. */
export const GROUP_SEPARATOR = '/';

/** A label as Linear returns it, reduced to the parts identity depends on. */
export interface RawLabelNode {
  id: string;
  name: string;
  isGroup?: boolean;
  parent?: { id: string; name: string } | null;
}

/** A label keyed the way tbd refers to it. */
export interface QualifiedLabel {
  id: string;
  /** `group/leaf` for a grouped label, else the bare name. */
  qualifiedName: string;
  /** The leaf name as Linear stores it. */
  leafName: string;
  /** The containing group's name, when there is one. */
  groupName?: string;
  /** Whether this label is itself a group (a container, not appliable). */
  isGroup: boolean;
}

/**
 * Split a qualified name into its group and leaf.
 *
 * Only the first separator splits: Linear groups are one level deep, so a name with more
 * separators keeps the rest in the leaf rather than inventing nesting the API cannot
 * represent.
 */
export function splitQualifiedName(name: string): { group?: string; leaf: string } {
  const index = name.indexOf(GROUP_SEPARATOR);
  if (index <= 0 || index === name.length - 1) {
    return { leaf: name };
  }
  return { group: name.slice(0, index), leaf: name.slice(index + 1) };
}

/** Join a group and leaf into the canonical qualified name. */
export function joinQualifiedName(group: string | undefined, leaf: string): string {
  return group ? `${group}${GROUP_SEPARATOR}${leaf}` : leaf;
}

/** The name tbd uses for a label Linear just handed us. */
export function qualifyLabel(node: RawLabelNode): QualifiedLabel {
  const groupName = node.parent?.name;
  return {
    id: node.id,
    qualifiedName: joinQualifiedName(groupName, node.name),
    leafName: node.name,
    groupName,
    isGroup: node.isGroup === true,
  };
}

/**
 * Index a team's labels by qualified name.
 *
 * Groups are included: provisioning needs the group's id to create a child under it, and
 * a group is addressable by its own bare name because it has no parent of its own.
 */
export function indexLabels(nodes: readonly RawLabelNode[]): Map<string, QualifiedLabel> {
  const index = new Map<string, QualifiedLabel>();
  for (const node of nodes) {
    const label = qualifyLabel(node);
    // First write wins. Linear permits a root label and a grouped leaf to share a bare
    // name, but two labels cannot share a qualified one, so a duplicate here means the
    // workspace has genuinely ambiguous data and the stable choice is the earlier entry.
    if (!index.has(label.qualifiedName)) {
      index.set(label.qualifiedName, label);
    }
  }
  return index;
}

/**
 * The qualified names of the labels applied to one issue.
 *
 * Group labels are dropped: Linear does not apply a group to an issue, and letting one
 * through would put a name in the comparison set that tbd can never assert.
 */
export function qualifiedIssueLabels(nodes: readonly RawLabelNode[]): string[] {
  return nodes
    .filter((node) => node.isGroup !== true)
    .map((node) => qualifyLabel(node).qualifiedName);
}
