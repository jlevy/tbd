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
  migrateBaseSlot,
  slotsAgree,
  SLOTS,
  isSlot,
} from '../src/integrations/core/slots.js';
import {
  slotFromLinear,
  slotToLinear,
  PAUSED_LABEL,
  BLOCKED_LABEL,
} from '../src/integrations/linear/mapping.js';

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

describe('base migration', () => {
  it('reports every legacy status as a coarse slot in the right band', () => {
    const expected: Record<string, string> = {
      open: 'open',
      in_progress: 'started',
      blocked: 'started',
      deferred: 'open',
      closed: 'terminal',
    };
    for (const [status, band] of Object.entries(expected)) {
      const migrated = migrateBaseSlot(status as never);
      expect(bandOf(migrated.slot)).toBe(band);
      // Always coarse: a status simply cannot carry the finer distinction.
      expect(migrated.coarse).toBe(true);
    }
  });

  it('treats a within-band difference as agreement while the base is coarse', () => {
    // THE upgrade property. A base holding `open` never recorded whether the work was
    // ready, so a local `todo` against a remote `backlog` is a distinction the base
    // cannot arbitrate. Flowing it in either direction would invent a change, and on a
    // repository with hundreds of mirrored issues that is a state write to every one.
    expect(slotsAgree('todo', 'backlog', true)).toBe(true);
    expect(slotsAgree('draft', 'todo', true)).toBe(true);
    expect(slotsAgree('in_progress', 'in_review', true)).toBe(true);
    expect(slotsAgree('done', 'canceled', true)).toBe(true);
  });

  it('still sees a cross-band difference through a coarse base', () => {
    // Silence within a band must not become blindness across bands.
    expect(slotsAgree('todo', 'in_progress', true)).toBe(false);
    expect(slotsAgree('in_progress', 'done', true)).toBe(false);
  });

  it('compares exactly once the base records a real slot', () => {
    expect(slotsAgree('todo', 'backlog', false)).toBe(false);
    expect(slotsAgree('in_progress', 'in_review', false)).toBe(false);
    expect(slotsAgree('paused', 'paused', false)).toBe(true);
  });
});

describe('slot mapping to and from Linear', () => {
  it('reads the started columns apart by name, which the type cannot do', () => {
    expect(slotFromLinear('started', 'In Progress', [])).toBe('in_progress');
    expect(slotFromLinear('started', 'Paused', [])).toBe('paused');
    expect(slotFromLinear('started', 'Blocked', [])).toBe('blocked');
    expect(slotFromLinear('started', 'In Review', [])).toBe('in_review');
  });

  it('prefers a carrier label over a name, since tbd wrote the label', () => {
    expect(slotFromLinear('started', 'In Review', [PAUSED_LABEL])).toBe('paused');
  });

  it("treats a team's own started column as plain started work", () => {
    // Agreement-wise it is just started; its exact state id is preserved elsewhere so
    // an outbound write does not drag it out of the team's column.
    expect(slotFromLinear('started', 'In QA', [])).toBe('in_progress');
  });

  it('separates the terminal types instead of collapsing them', () => {
    expect(slotFromLinear('completed', 'Done', [])).toBe('done');
    expect(slotFromLinear('canceled', 'Canceled', [])).toBe('canceled');
    expect(slotFromLinear('duplicate', 'Duplicate', [])).toBe('duplicate');
  });

  it('splits the open band by column name', () => {
    expect(slotFromLinear('unstarted', 'Todo', [])).toBe('todo');
    expect(slotFromLinear('backlog', 'Backlog', [])).toBe('backlog');
    expect(slotFromLinear('backlog', 'Draft', [])).toBe('draft');
  });

  it('fails soft on an unknown state type rather than aborting a sync', () => {
    expect(slotFromLinear('someFutureType', 'Whatever', [])).toBe('backlog');
  });

  it('round-trips every slot through the outbound mapping', () => {
    for (const slot of SLOTS) {
      const target = slotToLinear(slot);
      expect(slotFromLinear(target.stateType, target.stateName, target.labels)).toBe(slot);
    }
  });

  it('offers a carrier label only where a team may lack the column', () => {
    // Paused and Blocked can be absent, so they need a fallback. Done, Canceled and
    // Duplicate are default types in every team and need none.
    expect(slotToLinear('paused').labels).toEqual([PAUSED_LABEL]);
    expect(slotToLinear('blocked').labels).toEqual([BLOCKED_LABEL]);
    expect(slotToLinear('done').labels).toEqual([]);
    expect(slotToLinear('canceled').labels).toEqual([]);
  });
});
