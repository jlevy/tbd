---
type: is
id: is-01kzy93y91gssqs5nbv6zga00g
title: Replace Linear managed-block comment markers with stable, unobtrusive delimiters
kind: bug
status: closed
priority: 1
version: 8
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
child_order_hints:
  - is-01kzyc5t80m7hs7b4y6gfh2qd8
  - is-01kzycnk9d3twwpm9az84tvfan
  - is-01kzydg1771r1wn3csas8pqcwc
  - is-01kzydychmx52zhy9by6xmh1ne
created_at: 2026-08-13T19:20:52.767Z
updated_at: 2026-08-13T20:50:49.386Z
closed_at: 2026-08-13T20:50:49.385Z
close_reason: "Implemented and validated end to end. The one authoritative writer pair is MANAGED_BLOCK_MARKERS = ⟦tbd⟧ / ⟦/tbd⟧ in core/managed-block.ts; readers retain private compatibility with the legacy HTML-comment pair, writers migrate on the next outbound splice, human prose is preserved, and mixed/incomplete/reversed/duplicate markers fail closed. One-way and full bidirectional synchronization now cover all linked items regardless of creation max_nesting, use reconciled canonical values, and journal the managed projection safely. Migrated all 163 existing linked Linear issues; an independent UUID-based GraphQL audit found 163/163 current and zero legacy, malformed, or missing. Updated design, user docs, generated skills, and repeatable QA. Final evidence: 11/11 live Linear scenarios and pnpm run ci with 134 files / 1,973 tests passing."
---
Linear visibly renders the current <!-- tbd:begin --> / <!-- tbd:end --> markers and its typography turns the closing hyphens into an arrow-like ligature. Select and document a minimal delimiter that survives Markdown/rich-text/API round trips, cannot be confused with user prose, preserves text on both sides, and supports safe migration of existing descriptions. Implement parser/writer compatibility and live round-trip validation if the design is accepted.

## Notes

Design investigation (2026-08-13): Linear GraphQL introspection defines Issue.description as Markdown and keeps an internal YJS descriptionState; the live TBD-162 API round-trip preserves the legacy comment markers verbatim, while the app renders them visibly with an arrow-like ligature. CommonMark treats both HTML comments and arbitrary custom tags such as <tbd> as raw HTML, so XML-style tags are renderer/sanitizer-dependent. Recommended stable delimiter is the two-line plain-text pair ⟦tbd⟧ and ⟦/tbd⟧: compact, human-recognizable, UTF-8-safe, and semantically inert in Markdown. Keep two boundaries to preserve arbitrary human prose on both sides. Migration should read legacy and current pairs, write only the new pair, atomically replace legacy on the next successful outbound splice, and fail closed for duplicate, mixed, reversed, or incomplete markers. Add Markdown/API round-trip tests and document this invariant before closing.
