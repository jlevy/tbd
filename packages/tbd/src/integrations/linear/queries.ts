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

/** Resolve a team key (e.g. `FIN`) to its UUID plus states and labels. */
export const TEAM_META_QUERY = `query TeamMeta($key: String!) {
  teams(filter: { key: { eq: $key } }, first: 1) {
    nodes {
      id
      key
      name
      states(first: 50) { nodes { id name type position } }
      labels(first: 250) { nodes { id name } }
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
  assignee { id name displayName }
  labels(first: 50) { nodes { id name } }
  parent { id identifier }
`;

/** Fetch issues by UUID. Batched: one request covers a whole mirror run. */
export const ISSUES_BY_ID_QUERY = `query IssuesById($ids: [ID!], $first: Int!, $after: String) {
  issues(filter: { id: { in: $ids } }, first: $first, after: $after) {
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
