---
type: is
id: is-01m0xk4jp6m91jy8jn9b6skp4f
title: Make CI scripting guidance language-neutral and testable
kind: task
status: closed
priority: 2
version: 3
labels: []
dependencies: []
created_at: 2026-08-25T23:12:26.815Z
updated_at: 2026-08-25T23:34:54.806Z
closed_at: 2026-08-25T23:34:54.796Z
close_reason: Added specific, language-neutral guidance for thin CI/build orchestration and tested project-native gate programs in commit 51e96481; 67 focused tests, the full 2,443-test pre-push suite, and all seven GitHub checks passed.
resolution: null
duplicate_of: null
---
Strengthen ci-and-gates guidance against non-trivial Bash or inline workflow/Makefile logic. Recommend thin orchestration plus a checked-in, locally runnable, tested program shared by CI and developer entry points. Explain how to choose Node, Python, or another project-native implementation without prescribing one language, and cover exit-code and structured-output contracts.
