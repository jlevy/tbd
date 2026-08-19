---
type: is
id: is-01m00k6rrtay18j0gb1snphxge
title: Give tbd web an addressable bead so Linear can link into it
kind: feature
status: open
priority: 2
version: 6
spec_path: docs/project/specs/active/plan-2026-08-14-external-sync-and-traceability.md
labels:
  - traceability
  - phase-3
dependencies: []
parent_id: is-01m00h43nvt17wxyhxqm88wh3c
created_at: 2026-08-14T16:55:40.058Z
updated_at: 2026-08-16T00:13:59.364Z
extensions:
  linear:
    id: 61b9801f-a7e5-4b43-b0bf-f9df8dac4a5d
    linked_at: 2026-08-16T00:13:59.364Z
---
The web server exposes /, /api/board, /api/bead?id=, and /api/events (http.ts:383-411), and the client never reads location.hash or a query parameter to select a bead at load. There is no URL that opens the browser on a specific bead, so 'click through into the bead browser' has nothing to link to (F13).

Fix: read location.hash at load, select that bead, write the hash on selection, so http://127.0.0.1:PORT/#tbd-dzme works. Then the managed block can name it.

A loopback URL is not shareable between machines, and that is fine — it targets the person who has the repo checked out and wants the dependency graph and full field set Linear structurally cannot render. Rendering 'tbd web --open' beside the id gives the same affordance without pretending a localhost link travels.

Research: research-2026-08-14-agent-sync-protocol-and-hooks.md F13, §5.2, E16
