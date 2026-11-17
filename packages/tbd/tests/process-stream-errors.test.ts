import { afterEach, describe, expect, it } from 'vitest';

import {
  handleDiagnosticStreamError,
  handlePrimaryStdoutError,
} from '../src/cli/lib/process-stream-errors.js';
import { EXIT_SUCCESS } from '../src/cli/lib/exit-codes.js';

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
});

function streamError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}

describe('process stream error policy', () => {
  it('treats primary stdout EPIPE as quiet success when no outcome exists', () => {
    process.exitCode = undefined;
    handlePrimaryStdoutError(streamError('EPIPE'));
    expect(process.exitCode).toBe(EXIT_SUCCESS);
  });

  it('preserves an existing nonzero outcome when primary stdout closes', () => {
    process.exitCode = 17;
    handlePrimaryStdoutError(streamError('EPIPE'));
    expect(process.exitCode).toBe(17);
  });

  it('propagates non-EPIPE stdout failures', () => {
    const error = streamError('EIO');
    expect(() => {
      handlePrimaryStdoutError(error);
    }).toThrow(error);
  });

  it('propagates stderr EPIPE instead of converting it to success', () => {
    const error = streamError('EPIPE');
    expect(() => handleDiagnosticStreamError(error)).toThrow(error);
  });
});
