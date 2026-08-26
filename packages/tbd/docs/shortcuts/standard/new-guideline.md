---
title: New Guideline
description: Create a new coding guideline document for tbd
category: meta
author: Joshua Levy (github.com/jlevy) with LLM assistance
---
This shortcut helps create new guideline documents that agents can reference via
`tbd guidelines <name>`.

## Guideline Types

There are two types of guidelines:

1. **Official tbd guidelines** (bundled with tbd):
   - Location: `packages/tbd/docs/guidelines/`
   - Available to all tbd users after npm publish
   - Should be general-purpose, not project-specific

2. **Project-level guidelines** (custom):
   - Location: `.tbd/docs/guidelines/`
   - Shadow/override official guidelines with same name
   - Project-specific rules and patterns

## Instructions

Create a to-do list with the following items then perform all of them:

1. **Determine guideline type**: Ask the user if this is:
   - An official tbd guideline (for the tbd package itself)
   - A project-level custom guideline

2. **Choose the location**:
   - Official: `packages/tbd/docs/guidelines/<name>.md`
   - Custom: `.tbd/docs/guidelines/<name>.md`

3. **Name the guideline**:
   - Use kebab-case: `typescript-rules`, `api-design-patterns`
   - Be descriptive but concise
   - For domain-specific: `{domain}-rules` or `{domain}-{subtopic}-rules`

4. **Create the guideline file** with this structure:

   ````markdown
   ---
   title: [Human-readable title]
   description: [One-line description for `tbd guidelines --list`]
   ---
   # [Title]

   [Introduction paragraph explaining what this guideline covers and when to use it.]

   ## [Section 1]

   - **Rule name**: Explanation of the rule.

     ```typescript
     // Example code if applicable
   ````

   ## [Section 2]

   …

   ## Related Guidelines

   - For [related topic], see `tbd guidelines [related-guideline]`
   ```
   ```

5. **Required elements**:
   - YAML frontmatter with `title`, `description`, `author`, and `category`. `category`
     must be one of the values in `DOC_CATEGORIES`
     (`packages/tbd/src/lib/doc-categories.ts`); a new category needs adding there *and*
     in `doc-categories.test.ts`, which deliberately keeps its own copy of the
     vocabulary.
   - The `description` is what `tbd guidelines --list` and the generated skill tables
     render, so make it self-routing—say what the document covers and when to load it.
     Keep it to one sentence or two; it is re-rendered in every session that loads the
     skill. **Do not put a colon-space in it**: the frontmatter is YAML, and an unquoted
     `foo: bar` causes a YAML parse error ("Nested mappings are not allowed in compact
     mappings") and fails the doc-categories test.
     Quote the whole scalar—`description: 'Reads foo: bar and…'`—rather than avoiding
     the punctuation; the same applies to a leading `-`, `[`, `{`, `*`, `&`, or `%`.
   - A `**Related**:` block immediately under the H1, listing the guidelines this one
     assumes or hands off to.
     One list per document—do not also add a trailing “Related Guidelines” section.
   - `globs` for language-specific documents.
     Do not add document-local `alwaysApply`: `globs` declare file applicability, while
     the generated skill directory owns always-load policy.
     Duplicate always-load metadata can contradict that routing.
   - Clear introduction explaining scope, and actionable rules with examples.

6. **Register the guideline** (official guidelines only—without this, `tbd docs sync`
   does not serve it and no user receives it):
   - Add `guidelines/<name>.md: internal:guidelines/<name>.md` to `docs_cache.files` in
     `.tbd/config.yml`.
   - If the name does not start with a language-group prefix (`typescript-`, `python-`,
     `rust-`, `convex-`, `electron-`) or end with `monorepo-patterns`, add it to the
     right explicit name set in `GUIDELINE_GROUPS`
     (`packages/tbd/src/file/doc-cache.ts`) or it lands in the “Docs, process & tooling”
     catch-all. Note: `general-` is not a prefix match—`general-testing-rules` is routed
     by explicit name, and a new `general-*` name falls through without it.
     Those sets are exported and asserted in `guideline-groups.test.ts`—a name added
     there without a bundled document fails that test rather than silently rendering an
     empty heading.

7. **Link hygiene** (for official guidelines):
   - Use full public URLs for external references
   - Example: `https://github.com/jlevy/tbd/blob/main/docs/...`
   - Don’t use relative paths that break when doc is installed elsewhere

8. **Build, then test — in that order, and through the local build.** A bare `tbd` is
   the *globally installed* CLI carrying the previously published document bundle.
   It cannot serve a guideline you just wrote, so running it first reports on the old
   bundle and looks like a pass.
   `docs/development.md` covers this; the order matters more here than anywhere else,
   because the thing being validated is the bundling itself.

   In this repository:

   ```bash
   pnpm build                                     # bundle the new file into dist/docs/
   ls packages/tbd/dist/docs/guidelines/<name>.md # it is in the bundle
   node packages/tbd/dist/bin.mjs docs sync       # local build, not global tbd
   node packages/tbd/dist/bin.mjs setup --auto    # regenerate the skill surfaces
   ls .tbd/docs/guidelines/<name>.md              # it reached the cache
   node packages/tbd/dist/bin.mjs guidelines <name>
   node packages/tbd/dist/bin.mjs guidelines --list | grep <name>
   ```

   In a downstream project consuming published tbd, there is no build step and plain
   `tbd docs sync` / `tbd guidelines <name>` is correct.

9. **Update documentation** (for official guidelines):
   - Add to root `README.md` “Built-in Engineering Knowledge” table
   - Note: `packages/tbd/README.md` is auto-copied from root during build

## Guideline Quality Checklist

- [ ] Frontmatter has title, description, author, and a valid category
- [ ] Description with a colon-space (or other YAML punctuation) is quoted
- [ ] `**Related**:` block under the H1, and no trailing duplicate list
- [ ] Language-specific docs have `globs`; no document-local `alwaysApply`
- [ ] Registered in `.tbd/config.yml` `docs_cache.files`
- [ ] Grouped correctly (prefix match, or added to an explicit name set)
- [ ] Introduction explains when to use the guideline
- [ ] Rules are actionable (not vague principles)
- [ ] Code examples where applicable
- [ ] Cross-references to related guidelines
- [ ] No relative links (use full URLs for external refs)
- [ ] Tested with `tbd guidelines <name>`
- [ ] (Official) Added to root README.md “Built-in Engineering Knowledge” table
- [ ] (Official) Docs cache synced: `tbd setup --auto`

## Example Frontmatter

```yaml
---
title: TypeScript API Design Rules
description: Best practices for designing TypeScript APIs including naming, types, and error handling
---
```

## Naming Conventions

| Pattern | Example | Use For |
| --- | --- | --- |
| `{lang}-rules` | `typescript-rules` | General language rules |
| `{lang}-{topic}-rules` | `typescript-cli-tool-rules` | Specialized patterns |
| `{domain}-rules` | `convex-rules` | Framework/platform rules |
| `general-{topic}-rules` | `general-testing-rules` | Language-agnostic rules |

<!-- This document follows common-doc-guidelines.md.
See github.com/jlevy/practical-prose and review guidelines before editing.
-->
