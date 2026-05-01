/**
 * Unit tests for Zod / unknown-error formatting helpers.
 */

import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import { formatZodError, formatUnknownError } from '../src/utils/zod-error-utils.js';

describe('formatZodError', () => {
  it('formats a simple field error with its path', () => {
    const schema = z.object({ title: z.string().min(1) });
    const result = schema.safeParse({ title: '' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const formatted = formatZodError(result.error);
    expect(formatted).toContain('title:');
  });

  it('uses <root> for top-level errors with no path', () => {
    const schema = z.string().min(5);
    const result = schema.safeParse('hi');
    expect(result.success).toBe(false);
    if (result.success) return;

    const formatted = formatZodError(result.error);
    expect(formatted).toMatch(/^<root>:/);
  });

  it('joins multiple issues with semicolons', () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    const result = schema.safeParse({ a: 1, b: 'oops' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const formatted = formatZodError(result.error);
    expect(formatted).toContain('a:');
    expect(formatted).toContain('b:');
    expect(formatted).toContain(';');
  });

  it('renders nested paths with dots', () => {
    const schema = z.object({ outer: z.object({ inner: z.string() }) });
    const result = schema.safeParse({ outer: { inner: 5 } });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatZodError(result.error)).toContain('outer.inner:');
  });
});

describe('formatUnknownError', () => {
  it('formats a ZodError via formatZodError', () => {
    const schema = z.string().max(3);
    const result = schema.safeParse('toolong');
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatUnknownError(result.error)).toBe(formatZodError(result.error));
  });

  it('returns the message of a regular Error', () => {
    expect(formatUnknownError(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(formatUnknownError('plain string')).toBe('plain string');
    expect(formatUnknownError(42)).toBe('42');
    expect(formatUnknownError(null)).toBe('null');
  });

  it('does not throw on a custom thrown object', () => {
    const weird = { weird: true } as unknown;
    expect(() => formatUnknownError(weird)).not.toThrow();
  });

  it('handles empty ZodError gracefully', () => {
    const error = new ZodError([]);
    expect(formatUnknownError(error)).toBe(error.message);
  });
});
