# Beads Restore Instructions

Beads was disabled on: 2026-01-18T10:58:15.198Z

## What Was Changed

| Original Location | Backup Location | Action |
| --- | --- | --- |
| `.beads/` | `.beads-disabled/.beads/` | moved directory |
| `.gitattributes` | `.beads-disabled/.gitattributes` | backed up original, removed beads merge driver lines |

## To Restore Beads

Run the following commands from your project root:

```bash
# Restore .beads/
mv .beads-disabled/.beads/ .beads/

# Restore .gitattributes
cp .beads-disabled/.gitattributes .gitattributes

# Optionally remove this backup directory
rm -rf .beads-disabled/
```

## Notes

- For files that had content removed (AGENTS.md, .claude/settings.local.json), restoring
  will overwrite current content with the backed-up version.
- If you have made changes to these files since disabling Beads, you may need to
  manually merge the Beads content back in.
- After restoring, you may need to restart the Beads daemon: `bd daemon start`
