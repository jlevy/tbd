# Golden Tests

This directory contains golden tests for the tbd CLI. Golden tests capture the complete output
of CLI commands and compare against expected "golden" files.

## Directory Structure

```
golden/
  scenarios/         # Scenario YAML files (golden outputs)
  runner.ts          # Test runner infrastructure
```

## Running Golden Tests

```bash
# Run all golden tests
pnpm test -- golden

# Update golden files (after intentional changes)
UPDATE_GOLDEN=1 pnpm test -- golden
```

## How It Works

1. Each scenario runs a sequence of CLI commands
2. stdout, stderr, and exit codes are captured
3. Unstable fields (ULIDs, timestamps) are normalized
4. Output is compared against committed golden files
5. Any diff causes test failure

## Normalization

The following unstable fields are normalized:

- ULIDs: `is-[ulid]` -> `is-[ULID]`
- Display IDs: `bd-[ulid]` -> `bd-[ULID]`
- Timestamps: ISO8601 dates -> `[TIMESTAMP]`

## Adding New Scenarios

1. Add test case to `golden.test.ts`
2. Run with `UPDATE_GOLDEN=1` to generate golden file
3. Review the generated output
4. Commit both test and golden file
