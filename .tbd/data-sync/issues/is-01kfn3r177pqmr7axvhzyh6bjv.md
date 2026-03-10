---
type: is
id: is-01kfn3r177pqmr7axvhzyh6bjv
title: Extract shared doc command handler base class
kind: task
status: closed
priority: 2
version: 7
labels: []
dependencies: []
parent_id: is-01kfn3qm96pv26s4bnntywy0ht
created_at: 2026-01-23T09:42:40.614Z
updated_at: 2026-03-09T16:12:32.463Z
closed_at: 2026-01-23T09:55:08.441Z
close_reason: Created DocCommandHandler base class in doc-command-handler.ts
---
Extract reusable logic from ShortcutHandler into a base class (e.g., DocCommandHandler) that can be shared by shortcuts, guidelines, and templates commands. Include: handleList(), handleQuery(), handleNoQuery(), printWrappedDescription(), extractFallbackText(). The base class should be parameterized with doc type name and paths.
