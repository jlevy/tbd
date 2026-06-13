---
sandbox: true
env:
  NO_COLOR: '1'
  FORCE_COLOR: '0'
path:
  - ../dist
timeout: 30000
patterns:
  SHORTID: '[0-9a-z]{4,5}'
before: |
  # Set up a test git repository
  git init --initial-branch=main
  git config user.email "test@example.com"
  git config user.name "Test User"
  git config commit.gpgsign false
  echo "# Test repo" > README.md
  git add README.md
  git commit -m "Initial commit"
  # Initialize tbd with test prefix
  tbd init --prefix=test
---
# tbd CLI: File and stdin body input

Phase 1 agent CLI ergonomics.
Free-text bodies (`--description`, `--notes`, `--reason`) accept a value inline, from a
file, or from stdin via the `-` convention — so agents can pass shell-sensitive text
(`$`, backticks, quotes) without fighting shell escaping.

`printf '%s'` with a single-quoted argument writes the literal text, which is what these
tests round-trip through `show --json`.

* * *

## Description from a file and from stdin (create)

# Test: create --file reads a shell-sensitive description verbatim

```console
$ printf '%s' 'price=$9 `whoami` "ok"' > desc.txt
? 0
```

```console
$ tbd create "Body A" -f desc.txt --json | jq -r '.id' | tee ba.txt
test-[SHORTID]
? 0
```

```console
$ tbd show $(cat ba.txt) --json | jq -r '.description'
price=$9 `whoami` "ok"
? 0
```

# Test: create -d - reads the description from stdin

```console
$ printf '%s' 'pipe=$X `cmd` "y"' | tbd create "Body B" -d - --json | jq -r '.id' | tee bb.txt
test-[SHORTID]
? 0
```

```console
$ tbd show $(cat bb.txt) --json | jq -r '.description'
pipe=$X `cmd` "y"
? 0
```

# Test: create -f - reads the description from stdin

```console
$ printf '%s' 'file-dash $Z `q`' | tbd create "Body C" -f - --json | jq -r '.id' | tee bc.txt
test-[SHORTID]
? 0
```

```console
$ tbd show $(cat bc.txt) --json | jq -r '.description'
file-dash $Z `q`
? 0
```

# Test: inline text and a file together is rejected

```console
$ tbd create "Conflict" -d hi -f desc.txt 2>&1
[..]
? 1
```

* * *

## Reason from a file and from stdin (close)

# Test: close --reason-file reads a shell-sensitive reason verbatim

```console
$ tbd create "Body D" --json | jq -r '.id' | tee bd.txt
test-[SHORTID]
? 0
```

```console
$ printf '%s' 'fixed $BUG via `patch`' > reason.txt
? 0
```

```console
$ tbd close $(cat bd.txt) --reason-file reason.txt --quiet
? 0
```

```console
$ tbd show $(cat bd.txt) --json | jq -r '.close_reason'
fixed $BUG via `patch`
? 0
```

# Test: close --reason - reads the reason from stdin

```console
$ tbd create "Body E" --json | jq -r '.id' | tee be.txt
test-[SHORTID]
? 0
```

```console
$ printf '%s' 'stdin $REASON `now`' | tbd close $(cat be.txt) --reason - --quiet
? 0
```

```console
$ tbd show $(cat be.txt) --json | jq -r '.close_reason'
stdin $REASON `now`
? 0
```

# Test: --reason and --reason-file together is rejected

```console
$ tbd close $(cat bd.txt) --reason hi --reason-file reason.txt 2>&1
[..]
? 1
```

* * *

## Notes and description from a file and stdin (update)

`tbd show --json` only surfaces working `notes` after the first notes write (tbd-649r, a
pre-existing read-back quirk), so the notes tests below establish a notes body first.
`--description` round-trips on the first write.

# Test: update --description - reads the description from stdin

```console
$ tbd create "Body F" --json | jq -r '.id' | tee bf.txt
test-[SHORTID]
? 0
```

```console
$ printf '%s' 'desc $D `r` "s"' | tbd update $(cat bf.txt) --description - --quiet
? 0
```

```console
$ tbd show $(cat bf.txt) --json | jq -r '.description'
desc $D `r` "s"
? 0
```

# Test: update --notes-file reads shell-sensitive notes verbatim

Establish a notes body first (see tbd-649r):

```console
$ tbd update $(cat bf.txt) --notes "established" --quiet
? 0
```

```console
$ printf '%s' 'note $N `x` "y"' > notes.txt
? 0
```

```console
$ tbd update $(cat bf.txt) --notes-file notes.txt --quiet
? 0
```

```console
$ tbd show $(cat bf.txt) --json | jq -r '.notes'
note $N `x` "y"
? 0
```

# Test: update --notes - reads notes from stdin

```console
$ printf '%s' 'stdin note $Z `q`' | tbd update $(cat bf.txt) --notes - --quiet
? 0
```

```console
$ tbd show $(cat bf.txt) --json | jq -r '.notes'
stdin note $Z `q`
? 0
```
