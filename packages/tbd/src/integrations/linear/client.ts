/**
 * A thin Linear GraphQL client.
 *
 * Raw `fetch` rather than `@linear/sdk`: the query surface here is a handful of
 * documents, and the SDK is a large dependency to carry for that. Rate-limit
 * accounting and error classification are the parts worth owning anyway.
 *
 * Facts below were verified against the live API and several contradict Linear's
 * published documentation; see
 * docs/project/research/current/research-2026-08-09-linear-task-surfaces.md.
 */

export const LINEAR_API_URL = 'https://api.linear.app/graphql';

/** Largest page Linear accepts. Undocumented; `first: 500` is rejected. */
export const MAX_PAGE_SIZE = 250;

/** Rate-limit accounting read from response headers. */
export interface RateLimitSnapshot {
  requestsRemaining?: number;
  requestsLimit?: number;
  /** Epoch milliseconds when the request window resets. */
  requestsReset?: number;
  complexity?: number;
  complexityRemaining?: number;
}

export class LinearApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LinearApiError';
  }
}

/** Raised when a client-supplied id collides with an existing entity. */
export class LinearDuplicateIdError extends LinearApiError {
  constructor(message: string) {
    super(message, 'INPUT_ERROR', false);
    this.name = 'LinearDuplicateIdError';
  }
}

export interface LinearClientOptions {
  apiKey: string;
  /** Overridable so tests can point at a local mock server. */
  endpoint?: string;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Attempts for a retryable failure, including the first. */
  maxAttempts?: number;
  /** Injected so tests do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: {
    message: string;
    extensions?: {
      code?: string;
      type?: string;
      statusCode?: number;
      /** Linear's operator-facing text; far more specific than `message`. */
      userPresentableMessage?: string;
    };
  }[];
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class LinearClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  /** Most recent rate-limit headers, for `tbd integration status`. */
  lastRateLimit: RateLimitSnapshot = {};

  constructor(options: LinearClientOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint ?? process.env.LINEAR_API_URL ?? LINEAR_API_URL;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Execute one GraphQL document.
   *
   * Retries only failures that can succeed later (rate limiting, 5xx, network),
   * with exponential backoff bounded by the reset header when present.
   */
  async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.attempt<T>(query, variables);
      } catch (error) {
        lastError = error;
        const retryable = error instanceof LinearApiError && error.retryable;
        if (!retryable || attempt === this.maxAttempts) {
          throw error;
        }
        await this.sleep(this.backoffMs(attempt));
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * Delay before the next attempt: exponential, but never past the window reset
   * that the server already told us about.
   */
  private backoffMs(attempt: number): number {
    const exponential = Math.min(1_000 * 2 ** (attempt - 1), 30_000);
    const reset = this.lastRateLimit.requestsReset;
    if (reset === undefined) {
      return exponential;
    }
    const untilReset = reset - this.now();
    if (untilReset <= 0) {
      return exponential;
    }
    return Math.min(Math.max(untilReset, 0), 60_000);
  }

  private async attempt<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // A personal API key is sent raw. `Bearer` is for OAuth access tokens
          // only, and using it here fails authentication.
          Authorization: this.apiKey,
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
        signal: controller.signal,
      });
    } catch (error) {
      // Network failure or timeout: worth another attempt.
      throw new LinearApiError(
        `Linear request failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        true,
      );
    } finally {
      clearTimeout(timer);
    }

    this.readRateLimit(response.headers);

    if (response.status >= 500) {
      throw new LinearApiError(
        `Linear server error (${response.status})`,
        undefined,
        true,
        response.status,
      );
    }

    let body: GraphQLResponse<T>;
    try {
      body = (await response.json()) as GraphQLResponse<T>;
    } catch {
      throw new LinearApiError(
        `Linear returned a non-JSON response (${response.status})`,
        undefined,
        response.status >= 500,
        response.status,
      );
    }

    // A GraphQL error can arrive with HTTP 200, so the errors array is the
    // authority, not the status code.
    const firstError = body.errors?.[0];
    if (firstError) {
      const code = firstError.extensions?.code;
      if (code === 'RATELIMITED') {
        // Rate limiting arrives as HTTP 400 with this code, not as HTTP 429.
        throw new LinearApiError(firstError.message, code, true, response.status);
      }
      // Linear sends two strings: a terse internal `message` ("duplicate label name")
      // and a `userPresentableMessage` that names the offending value, the team, and the
      // remedy. Prefer the latter — it is the difference between an operator knowing
      // what to fix and filing a bug. Classification reads both, because the terse form
      // routinely omits the phrase the detailed one spells out.
      const presentable = firstError.extensions?.userPresentableMessage;
      const detail = presentable ?? firstError.message;
      const haystack = `${firstError.message} ${presentable ?? ''}`;
      if (/already exists/i.test(haystack) || /conflict on insert/i.test(haystack)) {
        throw new LinearDuplicateIdError(detail);
      }
      throw new LinearApiError(detail, code, false, response.status);
    }

    if (body.data === undefined) {
      throw new LinearApiError('Linear returned no data', undefined, false, response.status);
    }
    return body.data;
  }

  private readRateLimit(headers: Headers): void {
    const num = (name: string): number | undefined => {
      const raw = headers.get(name);
      if (raw === null) {
        return undefined;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    this.lastRateLimit = {
      requestsRemaining: num('x-ratelimit-requests-remaining'),
      requestsLimit: num('x-ratelimit-requests-limit'),
      requestsReset: num('x-ratelimit-requests-reset'),
      complexity: num('x-complexity'),
      complexityRemaining: num('x-ratelimit-complexity-remaining'),
    };
  }
}
