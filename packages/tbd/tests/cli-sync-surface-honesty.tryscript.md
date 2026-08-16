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
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  tbd init --prefix=test
---
# tbd CLI: Sync Surface Honesty

Narrowing `tbd sync` to a surface excludes external trackers.
That is easy to do by accident — `--issues` reads like “the issue surface”, and the
tracker *is* issues — so the run has to say it skipped them rather than letting the
mirror go quietly stale.

The notice must survive the **default** invocation.
An earlier attempt routed it through `info()`, which only emits under `--verbose`, so
the ordinary command stayed exactly as silent as before.

* * *

## No integration configured: stay silent

A repository with no tracker has nothing to skip, so a scoped sync must not mention one.

# Test: --issues says nothing when no tracker is configured

```console
$ tbd sync --issues 2>&1 | grep -c "external tracker" || true
0
? 0
```

* * *

## An enabled integration: say so, by default

```console
$ printf 'integrations:\n  linear:\n    enabled: true\n    team_key: TEST\n' >> .tbd/config.yml
? 0
```

# Test: --issues reports the skipped tracker in a default run

```console
$ tbd sync --issues 2>&1 | grep -c "Skipping external trackers"
1
? 0
```

# Test: --docs reports it too

```console
$ tbd sync --docs 2>&1 | grep -c "Skipping external trackers"
1
? 0
```

# Test: --push narrows away from the tracker instead of projecting onto it

`--push` used to reach the outbound-only projection that `setup-linear` warns joiners
never to run, which writes local state over the tracker without reconciling first.
A natural-looking flag must not be the dangerous one.

```console
$ tbd sync --push --dry-run 2>&1 | grep -c "Skipping external trackers"
1
? 0
```

# Test: the --push notice names the command that does perform the projection

```console
$ tbd sync --push --dry-run 2>&1 | grep -c "tbd integration sync --push"
1
? 0
```

# Test: naming both the surface and the direction still performs it

```console
$ tbd sync --push --integrations --dry-run 2>&1 | grep -c "Skipping external trackers" || true
0
? 0
```

# Test: a dry run still reports it

```console
$ tbd sync --issues --dry-run 2>&1 | grep -c "Skipping external trackers"
1
? 0
```

# Test: capture JSON result and diagnostics on their separate channels

```console
$ tbd sync --issues --json > sync-output.json 2> sync-diagnostics.jsonl || true
? 0
```

# Test: JSON mode keeps stdout as one valid result document

```console
$ node -e "const fs=require('node:fs'); JSON.parse(fs.readFileSync('sync-output.json','utf8')); console.log('valid JSON result')"
valid JSON result
? 0
```

# Test: JSON mode carries the omission as a structured diagnostic

```console
$ node -e "const fs=require('node:fs'); const rows=fs.readFileSync('sync-diagnostics.jsonl','utf8').trim().split('\\n').map(JSON.parse); console.log(rows.find((row)=>row.skippedSurfaces)?.skippedSurfaces.join(','))"
integrations
? 0
```

* * *

## Not skipped: stay silent

A run that actually includes the tracker, or that only reports status, must not claim to
have skipped anything.

# Test: a full sync does not claim to skip trackers

```console
$ tbd sync 2>&1 | grep -c "Skipping external trackers" || true
0
? 0
```

# Test: --integrations does not claim to skip trackers

```console
$ tbd sync --integrations 2>&1 | grep -c "Skipping external trackers" || true
0
? 0
```

# Test: --status does not claim to skip trackers

```console
$ tbd sync --status 2>&1 | grep -c "Skipping external trackers" || true
0
? 0
```

* * *

## Deliberately excluded from `tbd sync`

A team that turns the fold off has already decided the tracker is manual, so a scoped
run has nothing to warn about.

```console
$ node -e "const f=require('fs'),p='.tbd/config.yml';f.writeFileSync(p,f.readFileSync(p,'utf8').replace('integrations:','integrations:\n  sync_on_tbd_sync: false'))"
? 0
```

# Test: an explicitly manual tracker is not reported as skipped

```console
$ tbd sync --issues 2>&1 | grep -c "Skipping external trackers" || true
0
? 0
```
