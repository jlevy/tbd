/**
 * docmap/0.1 — manifest, lockfile, doc map, and lookup-key resolution.
 *
 * Spec: packages/tbd/docs/design-docmap-format.md
 *
 * Standalone module: depends only on zod and the docref module. Could
 * be extracted as its own package or repo without modification.
 */

export type {
  Manifest,
  ManifestEnvelope,
  Source,
  DocType,
  ContentRule,
  Lockfile,
  LockEntry,
  DocMap,
  DocMapEntry,
} from './schemas.js';

export {
  ManifestSchema,
  ManifestEnvelopeSchema,
  SourceSchema,
  DocTypeSchema,
  ContentRuleSchema,
  LockfileSchema,
  LockEntrySchema,
  DocMapSchema,
  DocMapEntrySchema,
  DocrefStringSchema,
  BundleNameSchema,
  DocTypeNameSchema,
  FORMAT_VERSION,
} from './schemas.js';

export type { ParsedLookupKey } from './resolve.js';
export {
  parseLookupKey,
  resolveLookupKey,
  entryBasename,
  LookupNotFound,
  LookupAmbiguous,
} from './resolve.js';
