/**
 * GraphQL documents for the Linear adapter.
 *
 * Kept as named constants rather than inline strings so the mock server used in
 * tests can key fixtures off the same documents the real client sends.
 */

/** Identity probe for `tbd integration status`: cheap and unambiguous. */
export const VIEWER_QUERY = `query Viewer {
  viewer { id name email }
  organization { id name urlKey }
}`;

/** Resolve a project by name or slug id, so mirrored issues can be filed under it. */
export const PROJECT_QUERY = `query Projects($first: Int!, $after: String) {
  projects(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id name slugId url }
  }
}`;

/** Resolve a team key (e.g. `FIN`) to its UUID plus states and labels. */
export const TEAM_META_QUERY = `query TeamMeta($key: String!) {
  teams(filter: { key: { eq: $key } }, first: 1) {
    nodes {
      id
      key
      name
      states(first: 50) { nodes { id name type position } }
      labels(first: 250) {
        pageInfo { hasNextPage endCursor }
        nodes { id name isGroup parent { id name } }
      }
    }
  }
}`;

/** Fields every issue read shares. */
const ISSUE_FIELDS = `
  id
  identifier
  url
  title
  description
  priority
  updatedAt
  state { id name type }
  assignee { id name displayName email }
  labels(first: 50) {
    pageInfo { hasNextPage endCursor }
    nodes { id name isGroup parent { id name } }
  }
  parent { id identifier }
  archivedAt
  trashed
`;

/** Fetch issues by UUID. Batched: one request covers a whole mirror run. */
export const ISSUES_BY_ID_QUERY = `query IssuesById($ids: [ID!], $first: Int!, $after: String) {
  issues(filter: { id: { in: $ids } }, includeArchived: true, first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {${ISSUE_FIELDS}}
  }
}`;

/** Resolve a human identifier such as `FIN-123`. */
export const ISSUE_BY_IDENTIFIER_QUERY = `query IssueByIdentifier($id: String!) {
  issue(id: $id) {${ISSUE_FIELDS}}
}`;

/**
 * Incremental pull: everything in the team touched since a timestamp.
 *
 * `updatedAt` with a comparator is the delta primitive; page size is capped at
 * 250 by the API.
 */
export const ISSUES_UPDATED_SINCE_QUERY = `query IssuesUpdatedSince(
  $teamId: ID!
  $since: DateTimeOrDuration!
  $first: Int!
  $after: String
) {
  issues(
    filter: { team: { id: { eq: $teamId } }, updatedAt: { gt: $since } }
    orderBy: updatedAt
    first: $first
    after: $after
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {${ISSUE_FIELDS}}
  }
}`;

/** Incremental pull restricted to the configured Linear project. */
export const ISSUES_UPDATED_SINCE_IN_PROJECT_QUERY = `query IssuesUpdatedSinceInProject(
  $teamId: ID!
  $projectId: ID!
  $since: DateTimeOrDuration!
  $first: Int!
  $after: String
) {
  issues(
    filter: {
      team: { id: { eq: $teamId } }
      project: { id: { eq: $projectId } }
      updatedAt: { gt: $since }
    }
    orderBy: updatedAt
    first: $first
    after: $after
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {${ISSUE_FIELDS}}
  }
}`;

export const ISSUE_CREATE_MUTATION = `mutation IssueCreate($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id identifier url updatedAt }
  }
}`;

export const ISSUE_UPDATE_MUTATION = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue { id identifier url updatedAt }
  }
}`;

/** Resolve a configured assignee email to its stable Linear user UUID. */
export const USERS_BY_EMAIL_QUERY = `query UsersByEmail($email: String!) {
  users(filter: { email: { eq: $email } }, first: 2) {
    nodes { id email }
  }
}`;

/** Remaining labels for one issue when its nested first page is full. */
export const ISSUE_LABELS_QUERY = `query IssueLabels($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    labels(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id name isGroup parent { id name } }
    }
  }
}`;

/** Remaining labels in a team namespace after the metadata query's first page. */
export const TEAM_LABELS_QUERY = `query TeamLabels($id: String!, $first: Int!, $after: String) {
  team(id: $id) {
    labels(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id name isGroup parent { id name } }
    }
  }
}`;

/**
 * Upsert an attachment.
 *
 * Linear keys attachments on `url`, so re-sending the same url updates the
 * existing attachment in place and returns its original id. This is the only
 * naturally idempotent write in the API and is what makes the mirror safe to
 * retry.
 */
export const ATTACHMENT_UPSERT_MUTATION = `mutation AttachmentUpsert($input: AttachmentCreateInput!) {
  attachmentCreate(input: $input) {
    success
    attachment { id url title }
  }
}`;

export const COMMENT_CREATE_MUTATION = `mutation CommentCreate($input: CommentCreateInput!) {
  commentCreate(input: $input) {
    success
    comment { id url createdAt }
  }
}`;

export const LABEL_CREATE_MUTATION = `mutation LabelCreate($input: IssueLabelCreateInput!) {
  issueLabelCreate(input: $input) {
    success
    issueLabel { id name }
  }
}`;

/** Comments on one issue, oldest first, for append-only comment sync. */
export const ISSUE_COMMENTS_QUERY = `query IssueComments($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    comments(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id body createdAt resolvedAt user { name displayName } }
    }
  }
}`;

/** Attachment URLs on one issue, used to detect another tbd repository's claim. */
export const ISSUE_ATTACHMENTS_QUERY = `query IssueAttachments($id: String!, $first: Int!, $after: String) {
  issue(id: $id) {
    attachments(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { url }
    }
  }
}`;

/**
 * Mark a conflict-report comment handled. Gives the report a native
 * resolved/unresolved lifecycle a human or agent can query.
 */
export const COMMENT_RESOLVE_MUTATION = `mutation CommentResolve($id: String!) {
  commentResolve(id: $id) { success }
}`;
