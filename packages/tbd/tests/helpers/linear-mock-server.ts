/**
 * A local stand-in for the Linear GraphQL API.
 *
 * Deliberately reproduces the API's real quirks rather than an idealized version
 * of them, because those quirks are what the adapter has to get right:
 * errors arriving with HTTP 200, rate limiting arriving as HTTP 400 with a
 * `RATELIMITED` code rather than 429, `issueCreate` rejecting a duplicate
 * client id, and `attachmentCreate` upserting on `url`.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface MockIssue {
  id: string;
  identifier: string;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  updatedAt: string;
  state: { id: string; name: string; type: string };
  assignee: { id: string; name: string; displayName: string } | null;
  labels: { nodes: { id: string; name: string }[] };
  parent: { id: string; identifier: string } | null;
}

export interface MockAttachment {
  id: string;
  url: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
  issueId: string;
}

export interface MockComment {
  id: string;
  issueId: string;
  body: string;
}

export class LinearMockServer {
  private server?: Server;
  private port = 0;
  private sequence = 0;

  readonly issues = new Map<string, MockIssue>();
  readonly attachments: MockAttachment[] = [];
  readonly comments: MockComment[] = [];
  readonly requests: { query: string; variables: Record<string, unknown> }[] = [];

  /** Number of requests to fail with RATELIMITED before succeeding. */
  rateLimitFailures = 0;
  /** Number of requests to fail with a 500 before succeeding. */
  serverFailures = 0;

  readonly states = [
    { id: 'state-backlog', name: 'Backlog', type: 'backlog', position: 0 },
    { id: 'state-unstarted', name: 'Todo', type: 'unstarted', position: 1 },
    { id: 'state-started', name: 'In Progress', type: 'started', position: 2 },
    // A second `started` state: the adapter must pick the lowest position so the
    // choice is stable rather than response-order dependent.
    { id: 'state-review', name: 'In Review', type: 'started', position: 1002 },
    { id: 'state-completed', name: 'Done', type: 'completed', position: 3 },
    { id: 'state-canceled', name: 'Canceled', type: 'canceled', position: 4 },
    { id: 'state-duplicate', name: 'Duplicate', type: 'duplicate', position: 5 },
  ];

  labels = [
    { id: 'label-bug', name: 'Bug' },
    { id: 'label-feature', name: 'Feature' },
  ];

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString('utf8');
      });
      req.on('end', () => {
        const { status, payload } = this.handle(body);
        res.writeHead(status, {
          'content-type': 'application/json',
          'x-ratelimit-requests-limit': '2500',
          'x-ratelimit-requests-remaining': '2499',
          'x-ratelimit-requests-reset': String(Date.now() + 3_600_000),
          'x-complexity': '17',
        });
        res.end(JSON.stringify(payload));
      });
    });

    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.port = (this.server.address() as AddressInfo).port;
    return this.endpoint;
  }

  get endpoint(): string {
    return `http://127.0.0.1:${this.port}/graphql`;
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) =>
        this.server!.close(() => {
          resolve();
        }),
      );
      this.server = undefined;
    }
  }

  addIssue(partial: Partial<MockIssue> & { id: string; identifier: string }): MockIssue {
    const issue: MockIssue = {
      url: `https://linear.app/acme/issue/${partial.identifier}`,
      title: 'Issue',
      description: null,
      priority: 0,
      updatedAt: '2026-08-10T00:00:00.000Z',
      state: this.states[1]!,
      assignee: null,
      labels: { nodes: [] },
      parent: null,
      ...partial,
    };
    this.issues.set(issue.id, issue);
    return issue;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private handle(body: string): { status: number; payload: unknown } {
    const parsed = JSON.parse(body) as { query: string; variables: Record<string, unknown> };
    this.requests.push(parsed);

    if (this.serverFailures > 0) {
      this.serverFailures -= 1;
      return { status: 500, payload: { errors: [{ message: 'upstream boom' }] } };
    }

    if (this.rateLimitFailures > 0) {
      this.rateLimitFailures -= 1;
      // Real Linear returns HTTP 400 here, not 429.
      return {
        status: 400,
        payload: {
          errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATELIMITED' } }],
        },
      };
    }

    const { query, variables } = parsed;

    if (query.includes('query Viewer')) {
      return {
        status: 200,
        payload: {
          data: {
            viewer: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
            organization: { id: 'org-1', name: 'Acme', urlKey: 'acme' },
          },
        },
      };
    }

    if (query.includes('query TeamMeta')) {
      const key = variables.key as string;
      if (key !== 'FIN') {
        return { status: 200, payload: { data: { teams: { nodes: [] } } } };
      }
      return {
        status: 200,
        payload: {
          data: {
            teams: {
              nodes: [
                {
                  id: 'team-1',
                  key: 'FIN',
                  name: 'Finance',
                  states: { nodes: this.states },
                  labels: { nodes: this.labels },
                },
              ],
            },
          },
        },
      };
    }

    if (query.includes('query IssueByIdentifier')) {
      const identifier = variables.id as string;
      const issue = [...this.issues.values()].find((i) => i.identifier === identifier);
      return { status: 200, payload: { data: { issue: issue ?? null } } };
    }

    if (query.includes('query IssuesById')) {
      const ids = (variables.ids as string[]) ?? [];
      const nodes = ids.map((id) => this.issues.get(id)).filter(Boolean);
      return {
        status: 200,
        payload: {
          data: { issues: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
        },
      };
    }

    if (query.includes('mutation IssueCreate')) {
      const input = variables.input as Record<string, unknown>;
      const clientId = input.id as string | undefined;
      if (clientId && this.issues.has(clientId)) {
        // Matches the real API: a duplicate client id is a hard error, so a
        // retried create must treat this as success rather than failure.
        return {
          status: 200,
          payload: {
            errors: [
              {
                message: 'conflict on insert of Issue',
                extensions: {
                  code: 'INPUT_ERROR',
                  statusCode: 400,
                  userPresentableMessage: `Entity Issue with id ${clientId} already exists.`,
                },
              },
            ],
          },
        };
      }
      const id = clientId ?? this.nextId('issue');
      const identifier = `FIN-${this.issues.size + 1}`;
      const issue = this.addIssue({
        id,
        identifier,
        title: (input.title as string) ?? 'Untitled',
        description: (input.description as string | null) ?? null,
        priority: (input.priority as number) ?? 0,
        updatedAt: new Date(Date.now() + this.sequence * 1000).toISOString(),
      });
      return {
        status: 200,
        payload: { data: { issueCreate: { success: true, issue } } },
      };
    }

    if (query.includes('mutation IssueUpdate')) {
      const id = variables.id as string;
      const input = variables.input as Record<string, unknown>;
      const issue = this.issues.get(id);
      if (!issue) {
        return { status: 200, payload: { errors: [{ message: `Issue not found: ${id}` }] } };
      }
      if (typeof input.title === 'string') {
        issue.title = input.title;
      }
      if ('description' in input) {
        issue.description = input.description as string | null;
      }
      if (typeof input.priority === 'number') {
        issue.priority = input.priority;
      }
      if (typeof input.stateId === 'string') {
        const state = this.states.find((s) => s.id === input.stateId);
        if (state) {
          issue.state = state;
        }
      }
      if (Array.isArray(input.labelIds)) {
        issue.labels = {
          nodes: (input.labelIds as string[])
            .map((lid) => this.labels.find((l) => l.id === lid))
            .filter((l): l is { id: string; name: string } => Boolean(l)),
        };
      }
      this.sequence += 1;
      issue.updatedAt = new Date(Date.parse(issue.updatedAt) + 1000).toISOString();
      return { status: 200, payload: { data: { issueUpdate: { success: true, issue } } } };
    }

    if (query.includes('mutation AttachmentUpsert')) {
      const input = variables.input as Record<string, unknown>;
      const url = input.url as string;
      const issueId = input.issueId as string;
      // Upsert on url, exactly as the real API does.
      const existing = this.attachments.find((a) => a.url === url && a.issueId === issueId);
      if (existing) {
        existing.title = input.title as string;
        existing.subtitle = input.subtitle as string | undefined;
        existing.metadata = input.metadata as Record<string, unknown> | undefined;
        return {
          status: 200,
          payload: { data: { attachmentCreate: { success: true, attachment: existing } } },
        };
      }
      const attachment: MockAttachment = {
        id: this.nextId('attachment'),
        url,
        title: input.title as string,
        subtitle: input.subtitle as string | undefined,
        metadata: input.metadata as Record<string, unknown> | undefined,
        issueId,
      };
      this.attachments.push(attachment);
      return {
        status: 200,
        payload: { data: { attachmentCreate: { success: true, attachment } } },
      };
    }

    if (query.includes('mutation CommentCreate')) {
      const input = variables.input as Record<string, unknown>;
      const comment: MockComment = {
        id: this.nextId('comment'),
        issueId: input.issueId as string,
        body: input.body as string,
      };
      this.comments.push(comment);
      return {
        status: 200,
        payload: {
          data: {
            commentCreate: {
              success: true,
              comment: { id: comment.id, url: 'https://linear.app/c', createdAt: 'now' },
            },
          },
        },
      };
    }

    if (query.includes('mutation LabelCreate')) {
      const input = variables.input as Record<string, unknown>;
      const label = { id: this.nextId('label'), name: input.name as string };
      this.labels.push(label);
      return {
        status: 200,
        payload: { data: { issueLabelCreate: { success: true, issueLabel: label } } },
      };
    }

    return { status: 200, payload: { errors: [{ message: `Unhandled query: ${query}` }] } };
  }
}
