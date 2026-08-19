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

/** A label as Linear models it: a group flag and a parent, with `name` as the leaf. */
export interface MockLabel {
  id: string;
  name: string;
  isGroup?: boolean;
  parent?: { id: string; name: string };
}

export interface MockIssue {
  id: string;
  identifier: string;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  updatedAt: string;
  /** Backdatable on create only, like the real API. */
  createdAt: string;
  completedAt: string | null;
  state: { id: string; name: string; type: string };
  assignee: { id: string; name: string; displayName: string; email?: string } | null;
  delegate: { id: string; name: string; displayName: string } | null;
  labels: { nodes: MockLabel[] };
  parent: { id: string; identifier: string } | null;
  archivedAt: string | null;
  trashed: boolean;
  projectId: string | null;
}

const ISSUE_LABEL_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 250;

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
  createdAt: string;
  resolvedAt: string | null;
  user: { name: string; displayName: string } | null;
}

export class LinearMockServer {
  private server?: Server;
  private port = 0;
  private sequence = 0;

  readonly issues = new Map<string, MockIssue>();
  readonly attachments: MockAttachment[] = [];
  readonly comments: MockComment[] = [];
  readonly requests: { query: string; variables: Record<string, unknown> }[] = [];
  /** Installed agents (app users). Linear delegates are these, never people. */
  readonly appUsers = [
    { id: '00000000-0000-4000-8000-000000000a11', name: 'Cyrus', displayName: 'Cyrus' },
  ];
  readonly users = [
    { id: 'user-1', name: 'Josh', displayName: 'Josh', email: 'josh@example.com' },
    { id: 'user-2', name: 'Test User', displayName: 'Test User', email: 'test@example.com' },
  ];
  readonly projects: { id: string; name: string; slugId: string; url?: string }[] = [];

  /** Number of requests to fail with RATELIMITED before succeeding. */
  rateLimitFailures = 0;
  /** Refuse issue creates once `issues.size` reaches this, like the free tier. */
  freeIssueLimit?: number;
  /** Hard-fail creates with these titles: a per-item rejection, unlike the limit. */
  readonly failCreateTitles = new Set<string>();
  /** Number of requests to fail with a 500 before succeeding. */
  serverFailures = 0;
  /** Number of attachment upserts to reject without retry. */
  attachmentFailures = 0;

  states = [
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

  labels: MockLabel[] = [
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

  /**
   * Rewrite markdown the way Linear does when it stores a description.
   *
   * Linear wraps every link destination in angle brackets: `[a](https://x)` is read back
   * as `[a](<https://x>)`. CommonMark renders the two identically, so it is invisible to
   * a person and lethal to a raw string comparison — tbd's managed block renders the
   * plain form, and comparing it raw against the stored form found a difference on every
   * sync, rewriting a settled mirror forever.
   *
   * Modelled here because a mock that round-trips prose more faithfully than the real
   * tracker cannot catch that class of bug at all: the suite was green throughout.
   */
  private static storeDescription(text: string | null): string | null {
    if (text === null) {
      return null;
    }
    return text.replace(/\]\((?!<)([^()\s]+)\)/g, '](<$1>)');
  }

  addIssue(partial: Partial<MockIssue> & { id: string; identifier: string }): MockIssue {
    const issue: MockIssue = {
      url: `https://linear.app/acme/issue/${partial.identifier}`,
      title: 'Issue',
      description: null,
      priority: 0,
      updatedAt: '2026-08-10T00:00:00.000Z',
      createdAt: '2026-08-10T00:00:00.000Z',
      completedAt: null,
      state: this.states[1]!,
      assignee: null,
      delegate: null,
      labels: { nodes: [] },
      parent: null,
      archivedAt: null,
      trashed: false,
      projectId: null,
      ...partial,
    };
    this.issues.set(issue.id, issue);
    return issue;
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private issueResponse(issue: MockIssue): MockIssue & {
    labels: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: { id: string; name: string }[];
    };
  } {
    const nodes = issue.labels.nodes.slice(0, ISSUE_LABEL_PAGE_SIZE);
    const hasNextPage = nodes.length < issue.labels.nodes.length;
    return {
      ...issue,
      labels: {
        pageInfo: {
          hasNextPage,
          endCursor: hasNextPage ? String(nodes.length) : null,
        },
        nodes,
      },
    };
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
                  labels: {
                    pageInfo: {
                      hasNextPage: this.labels.length > MAX_PAGE_SIZE,
                      endCursor: this.labels.length > MAX_PAGE_SIZE ? String(MAX_PAGE_SIZE) : null,
                    },
                    nodes: this.labels.slice(0, MAX_PAGE_SIZE),
                  },
                },
              ],
            },
          },
        },
      };
    }

    if (query.includes('mutation WorkflowStateCreate')) {
      const input = variables.input as {
        name: string;
        type: string;
        position: number;
        teamId: string;
      };
      if (input.teamId !== 'team-1') {
        return {
          status: 200,
          payload: { errors: [{ message: `Unknown team: ${input.teamId}` }] },
        };
      }
      // Linear enforces state-name uniqueness within a team, so a mock that allowed
      // duplicates would let a non-idempotent provisioner look correct.
      if (this.states.some((state) => state.name.toLowerCase() === input.name.toLowerCase())) {
        return {
          status: 200,
          payload: { errors: [{ message: `Workflow state already exists: ${input.name}` }] },
        };
      }
      const created = {
        id: this.nextId('state'),
        name: input.name,
        type: input.type,
        position: input.position,
      };
      this.states.push(created);
      return {
        status: 200,
        payload: { data: { workflowStateCreate: { success: true, workflowState: created } } },
      };
    }

    if (query.includes('mutation ProjectCreate')) {
      const input = variables.input as { name: string; teamIds: string[] };
      // Linear rejects a project create naming an unknown team; without this the
      // mock would accept a provisioning bug the real API refuses.
      if (!input.teamIds?.length || input.teamIds.some((id) => id !== 'team-1')) {
        return {
          status: 200,
          payload: {
            errors: [{ message: `Unknown team in teamIds: ${input.teamIds?.join(',')}` }],
          },
        };
      }
      const project = {
        id: this.nextId('project'),
        name: input.name,
        slugId: `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}${this.projects.length}`,
        url: `https://linear.app/acme/project/${input.name.toLowerCase()}`,
      };
      this.projects.push(project);
      return {
        status: 200,
        payload: { data: { projectCreate: { success: true, project } } },
      };
    }

    if (query.includes('query Projects')) {
      const first = variables.first as number;
      const offset = Number(variables.after ?? 0);
      const nodes = this.projects.slice(offset, offset + first);
      const nextOffset = offset + nodes.length;
      const hasNextPage = nextOffset < this.projects.length;
      return {
        status: 200,
        payload: {
          data: {
            projects: {
              pageInfo: {
                hasNextPage,
                endCursor: hasNextPage ? String(nextOffset) : null,
              },
              nodes,
            },
          },
        },
      };
    }

    if (query.includes('query UsersByEmail')) {
      const email = (variables.email as string).toLowerCase();
      const nodes = this.users.filter((user) => user.email.toLowerCase() === email);
      return { status: 200, payload: { data: { users: { nodes } } } };
    }

    if (query.includes('query TeamLabels')) {
      const offset = Number(variables.after ?? 0);
      const first = variables.first as number;
      const nodes = this.labels.slice(offset, offset + first);
      const nextOffset = offset + nodes.length;
      const hasNextPage = nextOffset < this.labels.length;
      return {
        status: 200,
        payload: {
          data: {
            team:
              variables.id === 'team-1'
                ? {
                    labels: {
                      pageInfo: {
                        hasNextPage,
                        endCursor: hasNextPage ? String(nextOffset) : null,
                      },
                      nodes,
                    },
                  }
                : null,
          },
        },
      };
    }

    if (query.includes('query IssueLabels')) {
      const issue = this.issues.get(variables.id as string);
      const offset = Number(variables.after ?? 0);
      const first = variables.first as number;
      const nodes = issue?.labels.nodes.slice(offset, offset + first) ?? [];
      const nextOffset = offset + nodes.length;
      const hasNextPage = nextOffset < (issue?.labels.nodes.length ?? 0);
      return {
        status: 200,
        payload: {
          data: {
            issue: issue
              ? {
                  labels: {
                    pageInfo: {
                      hasNextPage,
                      endCursor: hasNextPage ? String(nextOffset) : null,
                    },
                    nodes,
                  },
                }
              : null,
          },
        },
      };
    }

    if (query.includes('query IssueByIdentifier')) {
      const identifier = variables.id as string;
      const issue = [...this.issues.values()].find((i) => i.identifier === identifier);
      return {
        status: 200,
        payload: { data: { issue: issue ? this.issueResponse(issue) : null } },
      };
    }

    if (query.includes('query IssuesById')) {
      const ids = (variables.ids as string[]) ?? [];
      const nodes = ids
        .map((id) => this.issues.get(id))
        .filter((issue): issue is MockIssue => Boolean(issue))
        .map((issue) => this.issueResponse(issue));
      return {
        status: 200,
        payload: {
          data: { issues: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
        },
      };
    }

    if (query.includes('mutation IssueArchive')) {
      const issue = this.issues.get(variables.id as string);
      if (!issue) {
        return {
          status: 200,
          payload: { errors: [{ message: 'Could not find referenced Issue.' }] },
        };
      }
      issue.archivedAt = new Date().toISOString();
      return { status: 200, payload: { data: { issueArchive: { success: true } } } };
    }

    if (query.includes('mutation IssueUnarchive')) {
      const issue = this.issues.get(variables.id as string);
      if (!issue) {
        return {
          status: 200,
          payload: { errors: [{ message: 'Could not find referenced Issue.' }] },
        };
      }
      issue.archivedAt = null;
      return { status: 200, payload: { data: { issueUnarchive: { success: true } } } };
    }

    if (query.includes('mutation IssueCreate')) {
      const input = variables.input as Record<string, unknown>;
      if (this.failCreateTitles.has(input.title as string)) {
        return {
          status: 200,
          payload: {
            errors: [{ message: `create rejected by test for title: ${input.title as string}` }],
          },
        };
      }
      const clientId = input.id as string | undefined;
      // Order matters, and is taken from live behavior: a replayed create whose
      // client id already exists gets the DUPLICATE error even when the
      // workspace is over its issue limit — observed as a full backlog of
      // already-created issues recovering while new creates were being
      // refused. Duplicate detection first, then the limit.
      if (this.freeIssueLimit !== undefined && this.issues.size >= this.freeIssueLimit) {
        if (!(clientId && this.issues.has(clientId))) {
          return {
            status: 200,
            payload: {
              errors: [
                {
                  message: 'issue limit exceeded',
                  extensions: {
                    type: 'invalid input',
                    code: 'INPUT_ERROR',
                    statusCode: 400,
                    userError: true,
                    userPresentableMessage:
                      "You've exceeded the free issue limit for this workspace. Please upgrade or contact sales@linear.app for a free trial.",
                  },
                },
              ],
            },
          };
        }
      }
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
      // Linear rejects a create naming a parent that does not exist; silently
      // storing `parent: null` instead let the suite bless orphan creates that
      // the real API refuses — observed live when a parent's create failed and
      // its children were attempted against the never-created client id.
      if (typeof input.parentId === 'string' && !this.issues.has(input.parentId)) {
        return {
          status: 200,
          payload: {
            errors: [{ message: 'parentId contained an entry that could not be found.' }],
          },
        };
      }
      // Backdating rules, enforced exactly as the real API states them. Modelled
      // because a mock that accepts any date would let tbd ship an import that
      // Linear rejects outright — the create fails whole, it does not drop the field.
      const nowMs = Date.now();
      const createdAtIn = input.createdAt as string | undefined;
      const completedAtIn = input.completedAt as string | undefined;
      if (createdAtIn !== undefined && Date.parse(createdAtIn) >= nowMs) {
        return {
          status: 200,
          payload: { errors: [{ message: 'createdAt must be a time in the past' }] },
        };
      }
      if (completedAtIn !== undefined) {
        const state = this.states.find((s) => s.id === input.stateId);
        if (Date.parse(completedAtIn) >= nowMs) {
          return {
            status: 200,
            payload: { errors: [{ message: 'completedAt must be a time in the past' }] },
          };
        }
        if (createdAtIn !== undefined && Date.parse(completedAtIn) <= Date.parse(createdAtIn)) {
          return {
            status: 200,
            payload: { errors: [{ message: 'completedAt must be after createdAt' }] },
          };
        }
        if (state?.type !== 'completed') {
          return {
            status: 200,
            payload: {
              errors: [{ message: 'completedAt cannot be provided with an incompatible state' }],
            },
          };
        }
      }
      const identifier = `FIN-${this.issues.size + 1}`;
      const issue = this.addIssue({
        id,
        identifier,
        ...(createdAtIn !== undefined ? { createdAt: createdAtIn } : {}),
        ...(completedAtIn !== undefined ? { completedAt: completedAtIn } : {}),
        title: (input.title as string) ?? 'Untitled',
        description: LinearMockServer.storeDescription(
          (input.description as string | null) ?? null,
        ),
        priority: (input.priority as number) ?? 0,
        projectId: typeof input.projectId === 'string' ? input.projectId : null,
        assignee:
          typeof input.assigneeId === 'string'
            ? (this.users.find((user) => user.id === input.assigneeId) ?? null)
            : null,
        // Linear delegates are app users, never people — asking for a human here is
        // rejected rather than quietly accepted, which is what the adapter must respect.
        delegate:
          typeof input.delegateId === 'string'
            ? (this.appUsers.find((agent) => agent.id === input.delegateId) ?? null)
            : null,
        parent:
          typeof input.parentId === 'string'
            ? (() => {
                const parent = this.issues.get(input.parentId);
                return parent ? { id: parent.id, identifier: parent.identifier } : null;
              })()
            : null,
        // Real Linear applies labelIds on create, and the IssueUpdate handler below
        // already does. Ignoring them here made a created issue come back unlabelled,
        // so anything asserting a label on create looked like it had failed to apply
        // and would re-assert on the next sync forever.
        ...(Array.isArray(input.labelIds)
          ? {
              labels: {
                nodes: (input.labelIds as string[])
                  .map((lid) => this.labels.find((l) => l.id === lid))
                  .filter((l): l is { id: string; name: string } => Boolean(l)),
              },
            }
          : {}),
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
        issue.description = LinearMockServer.storeDescription(input.description as string | null);
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
      if ('parentId' in input) {
        const parent =
          typeof input.parentId === 'string' ? this.issues.get(input.parentId) : undefined;
        issue.parent = parent ? { id: parent.id, identifier: parent.identifier } : null;
      }
      if ('assigneeId' in input) {
        issue.assignee =
          typeof input.assigneeId === 'string'
            ? (this.users.find((user) => user.id === input.assigneeId) ?? null)
            : null;
      }
      if ('delegateId' in input) {
        issue.delegate =
          typeof input.delegateId === 'string'
            ? (this.appUsers.find((agent) => agent.id === input.delegateId) ?? null)
            : null;
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
      if (this.attachmentFailures > 0) {
        this.attachmentFailures -= 1;
        return {
          status: 200,
          payload: { errors: [{ message: 'attachment transport died' }] },
        };
      }
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
      const clientId = input.id as string | undefined;
      if (clientId && this.comments.some((c) => c.id === clientId)) {
        // Verified live 2026-08-10: unlike issueCreate's HTTP 400, a duplicate
        // comment id arrives as HTTP 200 with an errors array.
        return {
          status: 200,
          payload: {
            errors: [
              {
                message: 'conflict on insert of Comment',
                extensions: {
                  code: 'INPUT_ERROR',
                  statusCode: 400,
                  userPresentableMessage: `Entity Comment with id ${clientId} already exists.`,
                },
              },
            ],
          },
        };
      }
      this.sequence += 1;
      const comment: MockComment = {
        id: clientId ?? this.nextId('comment'),
        issueId: input.issueId as string,
        body: input.body as string,
        createdAt: new Date(1754800000000 + this.sequence * 1000).toISOString(),
        resolvedAt: null,
        user: { name: 'Mock User', displayName: 'Mock User' },
      };
      this.comments.push(comment);
      return {
        status: 200,
        payload: {
          data: {
            commentCreate: {
              success: true,
              comment: {
                id: comment.id,
                url: 'https://linear.app/c',
                createdAt: comment.createdAt,
              },
            },
          },
        },
      };
    }

    if (query.includes('mutation CommentResolve')) {
      const id = variables.id as string;
      const comment = this.comments.find((c) => c.id === id);
      if (!comment) {
        return { status: 200, payload: { errors: [{ message: `Comment not found: ${id}` }] } };
      }
      comment.resolvedAt = new Date(1754800000000 + this.sequence * 1000).toISOString();
      return { status: 200, payload: { data: { commentResolve: { success: true } } } };
    }

    if (query.includes('query IssueComments')) {
      const id = variables.id as string;
      const first = variables.first as number;
      const offset = Number(variables.after ?? 0);
      const allComments = this.comments
        .filter((c) => c.issueId === id)
        .map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          resolvedAt: c.resolvedAt,
          user: c.user,
        }));
      const nodes = allComments.slice(offset, offset + first);
      const nextOffset = offset + nodes.length;
      const hasNextPage = nextOffset < allComments.length;
      return {
        status: 200,
        payload: {
          data: {
            issue: this.issues.has(id)
              ? {
                  comments: {
                    pageInfo: {
                      hasNextPage,
                      endCursor: hasNextPage ? String(nextOffset) : null,
                    },
                    nodes,
                  },
                }
              : null,
          },
        },
      };
    }

    if (query.includes('query IssueAttachments')) {
      const id = variables.id as string;
      const first = variables.first as number;
      const offset = Number(variables.after ?? 0);
      const allAttachments = this.attachments
        .filter((attachment) => attachment.issueId === id)
        .map((attachment) => ({ url: attachment.url }));
      const nodes = allAttachments.slice(offset, offset + first);
      const nextOffset = offset + nodes.length;
      const hasNextPage = nextOffset < allAttachments.length;
      return {
        status: 200,
        payload: {
          data: {
            issue: this.issues.has(id)
              ? {
                  attachments: {
                    pageInfo: {
                      hasNextPage,
                      endCursor: hasNextPage ? String(nextOffset) : null,
                    },
                    nodes,
                  },
                }
              : null,
          },
        },
      };
    }

    if (query.includes('query IssuesUpdatedSince')) {
      const since = variables.since as string;
      const projectId = variables.projectId as string | undefined;
      const nodes = [...this.issues.values()]
        .filter((issue) => issue.updatedAt > since && (!projectId || issue.projectId === projectId))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
        .map((issue) => this.issueResponse(issue));
      return {
        status: 200,
        payload: {
          data: { issues: { pageInfo: { hasNextPage: false, endCursor: null }, nodes } },
        },
      };
    }

    if (query.includes('mutation LabelCreate')) {
      const input = variables.input as Record<string, unknown>;
      const parentId = input.parentId as string | undefined;
      const parent = parentId ? this.labels.find((l) => l.id === parentId) : undefined;
      if (parentId && !parent) {
        return {
          status: 200,
          payload: { errors: [{ message: `Unknown parent label: ${parentId}` }] },
        };
      }
      // Label names are unique across the whole team, and a group does NOT scope them:
      // Linear stores only the leaf in `name` and rejects a second label using it, even
      // inside a group. Enforced here because omitting it let the suite bless a shape
      // Linear refuses — a root `tbd` beside a `repo/tbd` child — which passed every
      // test and then failed against the real API on the first live provisioning run.
      const name = input.name as string;
      if (this.labels.some((l) => l.name === name)) {
        return {
          status: 200,
          payload: {
            errors: [
              {
                message: 'duplicate label name',
                extensions: {
                  type: 'invalid input',
                  code: 'INPUT_ERROR',
                  statusCode: 400,
                  userError: true,
                  userPresentableMessage: `Label "${name}" already exists in team FIN. Please pick a different name and try again.`,
                },
              },
            ],
          },
        };
      }
      // Linear stores the LEAF name on a grouped label; the group is carried by `parent`.
      const label: MockLabel = {
        id: this.nextId('label'),
        name,
        ...(input.isGroup === true ? { isGroup: true } : {}),
        ...(parent ? { parent: { id: parent.id, name: parent.name } } : {}),
      };
      this.labels.push(label);
      return {
        status: 200,
        payload: { data: { issueLabelCreate: { success: true, issueLabel: label } } },
      };
    }

    return { status: 200, payload: { errors: [{ message: `Unhandled query: ${query}` }] } };
  }
}
