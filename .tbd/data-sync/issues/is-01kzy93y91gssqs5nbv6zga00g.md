---
type: is
id: is-01kzy93y91gssqs5nbv6zga00g
title: Replace Linear managed-block comment markers with stable, unobtrusive delimiters
kind: bug
status: in_progress
priority: 1
version: 4
spec_path: docs/project/specs/active/plan-2026-08-10-external-tracker-integrations.md
labels:
  - linear
  - integration
dependencies: []
parent_id: is-01kzn2w85qxpbp8cqtn7mkbvkg
child_order_hints:
  - is-01kzyc5t80m7hs7b4y6gfh2qd8
created_at: 2026-08-13T19:20:52.767Z
updated_at: 2026-08-13T20:14:19.903Z
---
Linear visibly renders the current <!-- tbd:begin --> / <!-- tbd:end --> markers and its typography turns the closing hyphens into an arrow-like ligature. Select and document a minimal delimiter that survives Markdown/rich-text/API round trips, cannot be confused with user prose, preserves text on both sides, and supports safe migration of existing descriptions. Implement parser/writer compatibility and live round-trip validation if the design is accepted.

## Notes

Design investigation (2026-08-13): Linear GraphQL introspection defines Issue.description as Markdown and keeps an internal YJS descriptionState; the live TBD-162 API round-trip preserves the legacy comment markers verbatim, while the app renders them visibly with an arrow-like ligature. CommonMark treats both HTML comments and arbitrary custom tags such as <tbd> as raw HTML, so XML-style tags are renderer/sanitizer-dependent. Recommended stable delimiter is the two-line plain-text pair ⟦tbd⟧ and ⟦/tbd⟧: compact, human-recognizable, UTF-8-safe, and semantically inert in Markdown. Keep two boundaries to preserve arbitrary human prose on both sides. Migration should read legacy and current pairs, write only the new pair, atomically replace legacy on the next successful outbound splice, and fail closed for duplicate, mixed, reversed, or incomplete markers. Add Markdown/API round-trip tests and document this invariant before closing.
