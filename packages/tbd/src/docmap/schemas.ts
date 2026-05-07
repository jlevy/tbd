/**
 * docmap/0.1 — Zod schemas for the manifest, lockfile, and doc map.
 *
 * Reference implementation matching the format spec in
 * `packages/tbd/docs/design-docmap-format.md`. The spec and these
 * schemas MUST stay in exact sync.
 *
 * Standalone module: depends only on zod and the docref module. Could
 * be extracted as its own package without modification.
 */

import { z } from 'zod';

import { parseDocref } from '../docref/index.js';

const FORMAT_VERSION = 'docmap/0.1';

/** A docref string, validated by parseDocref. */
export const DocrefStringSchema = z.string().refine(
  (s) => {
    try {
      parseDocref(s);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Not a valid docref' },
);

/** A bundle name: lowercase alphanumeric + hyphen, 1-32 chars. */
export const BundleNameSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/, 'Bundle names must be lowercase alphanumeric or hyphen');

/** A doc-type name (consumer-defined; same lexical rules as bundle names). */
export const DocTypeNameSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/);

export const DocTypeSchema = z.object({
  name: DocTypeNameSchema,
  dir: z.string().min(1),
  command: z.string().optional(),
});

export const ContentRuleSchema = z.object({
  path: z.string().min(1),
  type: DocTypeNameSchema,
  as: z.string().optional(),
});

export const SourceMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  when: z.string().optional(),
});

export const SourceSchema = z.object({
  docref: DocrefStringSchema,
  bundle: BundleNameSchema.optional(),
  glob: z.string().optional(),
  ignore: z.array(z.string()).optional(),
  contents: z.array(ContentRuleSchema).optional(),
  as: z.string().optional(),
  type: DocTypeNameSchema.optional(),
  depth: z.union([z.number().int().positive(), z.literal('full')]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  when: z.string().optional(),
  metadata: z.record(z.string(), SourceMetadataSchema).optional(),
});

export const ManifestSchema = z.object({
  schema: z.literal(FORMAT_VERSION),
  doc_types: z.array(DocTypeSchema).min(1),
  sources: z.array(SourceSchema),
});

/** Top-level wrapper as it appears in YAML: { docmap: {schema, ...} }. */
export const ManifestEnvelopeSchema = z.object({
  docmap: ManifestSchema,
});

const MaterializationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('git-shallow'),
    depth: z.union([z.number().int().positive(), z.literal('full')]),
  }),
  z.object({
    kind: z.literal('git-full'),
    depth: z.literal('full'),
  }),
  z.object({
    kind: z.literal('fetched-file'),
    format: z.enum(['markdown', 'original']),
  }),
]);

export const LockEntrySchema = z.object({
  docref: DocrefStringSchema,
  revision: z.string().optional(),
  hash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  etag: z.string().optional(),
  materialization: MaterializationSchema,
  synced_at: z.string().datetime(),
});

export const LockfileSchema = z.object({
  docmap: z.object({ schema: z.literal(FORMAT_VERSION) }),
  sources: z.array(LockEntrySchema),
});

export const DocMapEntrySchema = z.object({
  key: z.string().min(1),
  bundle: BundleNameSchema,
  type: DocTypeNameSchema,
  path: z.string(),
  upstream_path: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  when: z.string().optional(),
  word_count: z.number().int().nonnegative().optional(),
});

export const DocMapSchema = z.object({
  docmap: z.object({ schema: z.literal(FORMAT_VERSION) }),
  built: z.string().datetime(),
  documents: z.array(DocMapEntrySchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestEnvelope = z.infer<typeof ManifestEnvelopeSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type DocType = z.infer<typeof DocTypeSchema>;
export type ContentRule = z.infer<typeof ContentRuleSchema>;
export type Lockfile = z.infer<typeof LockfileSchema>;
export type LockEntry = z.infer<typeof LockEntrySchema>;
export type DocMap = z.infer<typeof DocMapSchema>;
export type DocMapEntry = z.infer<typeof DocMapEntrySchema>;

export { FORMAT_VERSION };
