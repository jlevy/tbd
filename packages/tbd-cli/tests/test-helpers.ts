/**
 * Test helpers and constants for tbd-cli tests.
 *
 * Provides valid ULID-format IDs for use in tests.
 * All ULIDs MUST be exactly 26 lowercase alphanumeric characters (a-z, 0-9).
 */

import type { Issue } from '../src/lib/types.js';

// Valid ULID strings for testing (exactly 26 lowercase alphanumeric characters)
// Each uses format: 01 + identifier (8 chars) + padding zeros + number suffix = 26 total
export const TEST_ULIDS = {
  // General purpose test ULIDs (26 chars each)
  ULID_1: '01aaaaaaaaaaaaaaaaaaaaaa01', // 2 + 22 + 2 = 26
  ULID_2: '01aaaaaaaaaaaaaaaaaaaaaa02',
  ULID_3: '01aaaaaaaaaaaaaaaaaaaaaa03',
  ULID_4: '01aaaaaaaaaaaaaaaaaaaaaa04',
  ULID_5: '01aaaaaaaaaaaaaaaaaaaaaa05',
  ULID_6: '01aaaaaaaaaaaaaaaaaaaaaa06',
  ULID_7: '01aaaaaaaaaaaaaaaaaaaaaa07',
  ULID_8: '01aaaaaaaaaaaaaaaaaaaaaa08',
  ULID_9: '01aaaaaaaaaaaaaaaaaaaaaa09',
  ULID_10: '01aaaaaaaaaaaaaaaaaaaaa010',

  // Parser tests (26 chars): 01 + parser00 + 0000000000000 + 01 = 2+8+13+3
  PARSER_1: '01parser000000000000000001',
  PARSER_2: '01parser000000000000000002',
  PARSER_3: '01parser000000000000000003',

  // Storage tests (26 chars)
  STORAGE_1: '01storage00000000000000001',
  STORAGE_2: '01storage00000000000000002',
  STORAGE_3: '01storage00000000000000003',
  STORAGE_DEL: '01storagedel00000000000001',

  // Ready command tests (26 chars)
  READY_1: '01readytest00000000000001a',
  READY_2: '01readytest00000000000002a',
  READY_3: '01readytest00000000000003a',

  // Blocked command tests (26 chars)
  BLOCKED_1: '01blockedtest000000000001a',
  BLOCKED_2: '01blockedtest000000000002a',
  BLOCKED_3: '01blockedtest000000000003a',
  BLOCKED_4: '01blockedtest000000000004a',

  // Stale command tests (26 chars)
  STALE_1: '01staletest0000000000001aa',
  STALE_2: '01staletest0000000000002aa',
  STALE_3: '01staletest0000000000003aa',
  STALE_4: '01staletest0000000000004aa',

  // Workflow tests (26 chars)
  WORKFLOW_1: '01workflow0000000000000001',
  WORKFLOW_2: '01workflow0000000000000002',
  WORKFLOW_3: '01workflow0000000000000003',
  WORKFLOW_4: '01workflow0000000000000004',
  WORKFLOW_5: '01workflow0000000000000005',
  WORKFLOW_6: '01workflow0000000000000006',

  // Label/depends tests (26 chars)
  LABEL_1: '01labeltest0000000000001aa',
  LABEL_2: '01labeltest0000000000002aa',
  LABEL_3: '01labeltest0000000000003aa',
  LABEL_4: '01labeltest0000000000004aa',
  DEPENDS_1: '01dependstest000000000001a',
  DEPENDS_2: '01dependstest000000000002a',
  DEPENDS_3: '01dependstest000000000003a',
  DEPENDS_4: '01dependstest000000000004a',
  DEPENDS_5: '01dependstest000000000005a',
  DEPENDS_6: '01dependstest000000000006a',
  DEPENDS_7: '01dependstest000000000007a',

  // Close/reopen tests (26 chars)
  CLOSE_1: '01closetest0000000000001aa',
  CLOSE_2: '01closetest0000000000002aa',
  CLOSE_3: '01closetest0000000000003aa',
  CLOSE_4: '01closetest0000000000004aa',
  CLOSE_5: '01closetest0000000000005aa',

  // Doctor/sync tests (26 chars)
  DOCTOR_1: '01doctortest000000000001aa',
  DOCTOR_2: '01doctortest000000000002aa',
  DOCTOR_3: '01doctortest000000000003aa',
  DOCTOR_4: '01doctortest000000000004aa',
  DOCTOR_999: '01doctortest0000000000999a',
  SYNC_1: '01synctest00000000000001aa',

  // Attic/import tests (26 chars)
  ATTIC_1: '01attictest0000000000001aa',
  ATTIC_2: '01attictest0000000000002aa',
  IMPORT_1: '01importtest000000000001aa',
  IMPORT_2: '01importtest000000000002aa',
  IMPORT_3: '01importtest000000000003aa',
};

/**
 * Create a test issue ID from a ULID.
 */
export function testId(ulid: string): string {
  return `is-${ulid}`;
}

/**
 * Create a minimal valid issue for testing.
 */
export function createTestIssue(overrides: Partial<Issue> & { id: string; title: string }): Issue {
  return {
    type: 'is',
    version: 1,
    kind: 'task',
    status: 'open',
    priority: 2,
    labels: [],
    dependencies: [],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}
