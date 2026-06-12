/**
 * The fixed category vocabulary for bundled docs. Every bundled guideline
 * declares exactly one in frontmatter (enforced by doc-categories.test.ts);
 * the old name-based inference is retired in favor of the declared field.
 */

export const DOC_CATEGORIES = ['general', 'typescript', 'python', 'convex', 'electron'] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

/** A doc's category: the declared frontmatter field, defaulting to general. */
export function docCategory(frontmatter: { category?: string } | undefined): DocCategory {
  const declared = frontmatter?.category;
  return (DOC_CATEGORIES as readonly string[]).includes(declared ?? '')
    ? (declared as DocCategory)
    : 'general';
}

/** Validate a user-supplied --category value. */
export function parseCategoryOption(value: string): DocCategory {
  if (!(DOC_CATEGORIES as readonly string[]).includes(value)) {
    throw new Error(`Unknown category "${value}". Valid categories: ${DOC_CATEGORIES.join(', ')}.`);
  }
  return value as DocCategory;
}
