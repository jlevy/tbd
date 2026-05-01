/**
 * Helpers for rendering Zod errors without relying on object inspection.
 */

import { ZodError } from 'zod';

/**
 * Format a ZodError as concise path-qualified messages for CLI output.
 */
export function formatZodError(error: ZodError): string {
  const messages = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
    return `${path}: ${issue.message}`;
  });

  return messages.length > 0 ? messages.join('; ') : error.message;
}

/**
 * Format unknown thrown values as safe strings for warnings and diagnostics.
 */
export function formatUnknownError(error: unknown): string {
  if (error instanceof ZodError) {
    return formatZodError(error);
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
