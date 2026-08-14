---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
before: |
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Format compatibility test repo" > README.md
  git add README.md
  git commit -m "Initial commit"

  mkdir -p .tbd
  cat > .tbd/config.yml <<'YAML'
  tbd_format: f99
  tbd_version: future
  display:
    id_prefix: test
  sync:
    branch: tbd-sync
    remote: origin
    storage: git-common-dir-v1
  settings:
    auto_sync: false
    doc_auto_sync_hours: 24
  YAML
---
# tbd CLI: Format Compatibility

Golden tests for fail-closed format compatibility behavior.

* * *

## Future Top-Level Format

# Test: CLI tells the user to upgrade tbd for future repo formats

```console
$ tbd list 2>&1
Error: This repository requires a newer version of tbd.
Config format 'f99' is from a newer tbd version.
This tbd version supports up to format 'f07'.
Upgrade tbd: npm install -g get-tbd@latest
? 1
```

* * *

## The f07 Integrations Gate

A tbd released before 0.6.0 parses config in strip mode, so it silently drops an
`integrations` block the first time it rewrites `config.yml`. It cannot be fixed
retroactively, so f07 makes it fail closed instead.
This models such a client — one that supports up to f06 — meeting an f07 repository.

# Test: A pre-0.6.0 client refuses an f07 repository instead of rewriting its config

```console
$ node -e 'const supported="f06"; const format="f07"; if (format > supported) { console.error("This repository requires a newer version of tbd."); console.error("Config format '"'"'"+format+"'"'"' is from a newer tbd version."); console.error("This tbd version supports up to format '"'"'"+supported+"'"'"'."); console.error("Upgrade tbd: npm install -g get-tbd@latest"); process.exit(1); }' 2>&1
This repository requires a newer version of tbd.
Config format 'f07' is from a newer tbd version.
This tbd version supports up to format 'f06'.
Upgrade tbd: npm install -g get-tbd@latest
? 1
```
