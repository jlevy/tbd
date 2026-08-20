/**
 * Slot computation: the one place a board position is decided.
 *
 * Every distinction the state and actor axes added exists to be visible on a board, and
 * a slot is where those fields turn into a column. The precedence is the design, so it
 * is tested as precedence — pairs of inputs that could each claim the bead, asserting
 * which one wins — rather than one case per slot.
 */

import { describe, it, expect } from 'vitest';

import {
  computeSlot,
  decomposeSlot,
  bandOf,
  SLOTS,
  isSlot,
} from '../src/integrations/core/slots.js';

describe('computeSlot precedence', () => {
  it('lets a terminal resolution outrank everything else', () => {
    // A closed bead is closed regardless of what the open-end fields still say.
    expect(computeSlot({ status: 'closed', resolution: 'canceled', ready: true })).toBe('canceled');
    expect(computeSlot({ status: 'closed', resolution: 'duplicate' })).toBe('duplicate');
    expect(computeSlot({ status: 'closed' })).toBe('done');
  });

  it('reads an absent resolution as done, so old closed beads keep their column', () => {
    expect(computeSlot({ status: 'closed', resolution: null })).toBe('done');
  });

  it('lets a hold outrank an unqualified position', () => {
    expect(computeSlot({ status: 'in_progress', hold: 'paused' })).toBe('paused');
    expect(computeSlot({ status: 'in_progress', hold: 'blocked' })).toBe('blocked');
    expect(computeSlot({ status: 'in_progress' })).toBe('in_progress');
  });

  it('lets a hold outrank a refinement a person applied', () => {
    // Someone moved it to In Review, then it got blocked. The blocker is the more
    // useful thing to show, and it is a fact rather than a judgment.
    expect(computeSlot({ status: 'in_progress', hold: 'blocked', refinement: 'in_review' })).toBe(
      'blocked',
    );
  });

  it('preserves a started-band refinement when nothing outranks it', () => {
    expect(computeSlot({ status: 'in_progress', refinement: 'in_review' })).toBe('in_review');
  });

  it('sends held open work to the backlog rather than to Todo', () => {
    // Deliberately set-down work is not ready to begin, even when its dependencies are
    // met — offering it to an agent looking for work is how a hold gets ignored.
    expect(computeSlot({ status: 'open', hold: 'paused', ready: true })).toBe('backlog');
    expect(computeSlot({ status: 'open', hold: 'blocked', ready: true })).toBe('backlog');
  });

  it('splits the open band by readiness', () => {
    expect(computeSlot({ status: 'open', ready: true })).toBe('todo');
    expect(computeSlot({ status: 'open', ready: false })).toBe('backlog');
  });

  it('preserves Draft for unready work, since tbd cannot compute it', () => {
    expect(computeSlot({ status: 'open', ready: false, refinement: 'draft' })).toBe('draft');
    // But readiness still pulls it out of the band entirely, which is the one move tbd
    // is allowed to make on a column a person chose.
    expect(computeSlot({ status: 'open', ready: true, refinement: 'draft' })).toBe('todo');
  });

  it('lands a bead that is both unready and held in exactly one slot', () => {
    expect(computeSlot({ status: 'open', hold: 'paused', ready: false })).toBe('backlog');
  });

  it('renders the legacy statuses exactly as they render today', () => {
    // `blocked` and `deferred` remain valid five-value-enum members. A repository that
    // never adopted the hold axis must see no change.
    expect(computeSlot({ status: 'blocked' })).toBe('blocked');
    expect(computeSlot({ status: 'deferred' })).toBe('backlog');
    expect(computeSlot({ status: 'deferred', ready: true })).toBe('backlog');
  });
});

describe('bandOf', () => {
  it('groups every slot into exactly one band', () => {
    for (const slot of SLOTS) {
      expect(['open', 'started', 'terminal']).toContain(bandOf(slot));
    }
  });

  it('puts the columns that differ only by refinement in one band', () => {
    // This is what lets a team keep its own column without tbd fighting it: within a
    // band, the merge sees no disagreement.
    expect(bandOf('in_progress')).toBe(bandOf('in_review'));
    expect(bandOf('backlog')).toBe(bandOf('draft'));
  });
});

describe('decomposeSlot', () => {
  it('round-trips every slot that names a computable position', () => {
    for (const slot of ['done', 'paused', 'blocked', 'in_progress', 'todo'] as const) {
      const fields = decomposeSlot(slot);
      const recomputed = computeSlot({
        status: fields.status,
        hold: fields.hold,
        resolution: fields.resolution,
        // `todo` needs readiness to come back; the others do not depend on it.
        ready: slot === 'todo',
        refinement: fields.refinement,
      });
      expect(recomputed).toBe(slot);
    }
  });

  it('sets a refinement rather than a status for the columns tbd cannot compute', () => {
    expect(decomposeSlot('in_review')).toMatchObject({
      status: 'in_progress',
      refinement: 'in_review',
    });
    expect(decomposeSlot('draft')).toMatchObject({ status: 'open', refinement: 'draft' });
  });

  it('narrows an inbound duplicate to canceled, keeping the honest half', () => {
    // A duplicate needs a pointer tbd does not read from the tracker, and the write
    // boundary rejects a duplicate without one. Canceled still says "abandoned, not
    // delivered", which is the part that survives.
    expect(decomposeSlot('duplicate')).toMatchObject({
      status: 'closed',
      resolution: 'canceled',
    });
  });

  it('clears a hold when decomposing an unqualified started slot', () => {
    // Otherwise pulling "In Progress" onto a paused bead would leave it both.
    expect(decomposeSlot('in_progress').hold).toBeNull();
  });
});

describe('isSlot', () => {
  it('accepts every slot and rejects a status that is not one', () => {
    for (const slot of SLOTS) {
      expect(isSlot(slot)).toBe(true);
    }
    expect(isSlot('deferred')).toBe(false);
    expect(isSlot('')).toBe(false);
  });
});
