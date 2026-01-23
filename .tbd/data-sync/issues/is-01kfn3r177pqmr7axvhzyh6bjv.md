---
close_reason: Created DocCommandHandler base class in doc-command-handler.ts
closed_at: 2026-01-23T09:55:08.441Z
created_at: 2026-01-23T09:42:40.614Z
dependencies: []
id: is-01kfn3r177pqmr7axvhzyh6bjv
kind: task
labels: []
parent_id: is-01kfn3qm96pv26s4bnntywy0ht
priority: 2
status: closed
title: Extract shared doc command handler base class
type: is
updated_at: 2026-01-23T09:55:08.442Z
version: 2
---
Extract reusable logic from ShortcutHandler into a base class (e.g., DocCommandHandler) that can be shared by shortcuts, guidelines, and templates commands. Include: handleList(), handleQuery(), handleNoQuery(), printWrappedDescription(), extractFallbackText(). The base class should be parameterized with doc type name and paths.
