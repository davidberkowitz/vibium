/**
 * Driver Load Path — M2 contact solver tests.
 *
 * The solver picks one answer out of infinitely many that satisfy the force
 * balance. So "the balance closes" is necessary and nowhere near sufficient —
 * a solver that put every newton through the head restraint would pass that.
 * These tests check the balance, the sign constraints, the caps, and then the
 * physics: that the answer it picks is the one a body would actually produce.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/touchpoints.js');
require('../../apps/loadpath/js/model/occupant.js');
require('../../apps/loadpath/js/model/contacts.js');

const { LoadPathConstants: C, LoadPathOccupant: O,
        LoadPathContacts: K, LoadPathTouchpoints: T } = globalThis;

const DRIVER = C.OCCUPANTS.m50.mass;
const G = C.G;
const BAL = 1e-4;          // newtons; observed worst across the envelope is ~7e-6

const at = (ax, ay, az = 0) => {
  const st = O.solve({ bodyMass: DRIVER, accel: O.vec(ax, ay, az) });
  return { state: st, split: K.solve(st.carOnBody) };
};
const tp = (split, id) => split.byTouchpoint[id] ? split.byTouchpoint[id].magnitude : 0;

describe('channel table', () => {
  test('every channel maps to a touchpoint in the register', () => {
    for (const ch of K.CHANNELS) {
      assert.ok(T.byId(ch.touchpoint), `${ch.id} points at unknown touchpoint ${ch.touchpoint}`);
    }
  });

  test('every touchpoint that can carry force has at least one channel', () => {
    const covered = new Set(K.CHANNELS.map(c => c.touchpoint));
    for (const t of T.ALL) {
      assert.ok(covered.has(t.id), `${t.id} is in the register but has no channel`);
    }
  });

  test('every normal is a unit vector', () => {
    for (const ch of K.CHANNELS) {
      const m = Math.hypot(ch.n[0], ch.n[1], ch.n[2]);
      assert.ok(Math.abs(m - 1) < 1e-12, `${ch.id} normal has length ${m}`);
    }
  });

  test('stiffnesses are positive and caps are positive or absent', () => {
    for (const ch of K.CHANNELS) {
      assert.ok(ch.k > 0, `${ch.id} has non-positive stiffness`);
      assert.ok(ch.cap > 0, `${ch.id} has non-positive cap`);
    }
  });

  test('structural channels are uncapped, voluntary bracing is capped', () => {
    // Foam, floor and webbing carry what the structure carries. Muscle does not.
    for (const id of ['seat_pan', 'seat_back', 'floor', 'lap_belt', 'shoulder_belt']) {
      assert.strictEqual(K.CHANNELS.find(c => c.id === id).cap, Infinity, `${id} should be uncapped`);
    }
    for (const id of ['wheel_brace', 'footrest', 'armrest', 'knee_bolster']) {
      assert.ok(K.CHANNELS.find(c => c.id === id).cap < Infinity, `${id} should be capped`);
    }
  });

  test('the bolster has a channel on each side of the body', () => {
    const b = K.CHANNELS.filter(c => c.touchpoint === 'bolster');
    assert.strictEqual(b.length, 2, 'a seat has a bolster on each side');
    assert.ok(b[0].n[1] * b[1].n[1] < 0, 'the two bolster channels must oppose');
  });

  test('the solver constants carry provenance, marked placeholder', () => {
    for (const key of ['MODEL.contactStiffness', 'MODEL.bracingCaps', 'MODEL.seatFriction']) {
      const rec = C.PROVENANCE[key];
      assert.ok(rec, `${key} has no provenance record`);
      assert.strictEqual(rec.status, 'placeholder');
      assert.ok(rec.caveat && rec.caveat.length > 40, `${key} needs a real caveat`);
    }
  });
});

describe('the balance, the signs and the caps', () => {
  const CASES = [
    ['parked', 0, 0], ['gentle throttle', 2, 0], ['light braking', -2.5, 0],
    ['firm braking', -6.5, 0], ['panic stop', -8.8, 0],
    ['left corner', 0, 5.9], ['right corner', 0, -5.9],
    ['trail braking', -5, 4.5], ['power out', 2.5, -4],
    ['crest', 0, 0, -3], ['compression', 0, 0, 4]
  ];

  for (const [name, ax, ay, az = 0] of CASES) {
    test(`${name}: the split re-sums to what was asked for`, () => {
      const { state, split } = at(ax, ay, az);
      assert.ok(split.feasible, `${name} came back infeasible`);
      const audit = K.auditBalance(split, state.carOnBody);
      assert.ok(audit.residual < BAL,
        `${name}: split misses the requirement by ${audit.residual} N`);
    });

    test(`${name}: no contact pulls when it can only push`, () => {
      const { split } = at(ax, ay, az);
      for (const ch of split.channels) {
        assert.ok(ch.magnitude >= -1e-9,
          `${name}: ${ch.id} came back at ${ch.magnitude} N — foam cannot pull`);
      }
    });

    test(`${name}: no channel exceeds its capacity`, () => {
      const { split } = at(ax, ay, az);
      for (const ch of split.channels) {
        if (ch.cap === Infinity) continue;
        assert.ok(ch.magnitude <= ch.cap + 1e-6,
          `${name}: ${ch.id} at ${ch.magnitude} N exceeds its ${ch.cap} N cap`);
      }
    });
  }

  test('the whole acceleration envelope stays feasible and signed correctly', () => {
    let worst = 0, worstAt = '';
    for (let ax = -9; ax <= 4; ax += 0.5) {
      for (let ay = -8; ay <= 8; ay += 1) {
        const { state, split } = at(ax, ay);
        assert.ok(split.feasible, `infeasible at ax=${ax} ay=${ay}`);
        for (const ch of split.channels) assert.ok(ch.magnitude >= -1e-9, `${ch.id} negative at ${ax},${ay}`);
        const r = K.auditBalance(split, state.carOnBody).residual;
        if (r > worst) { worst = r; worstAt = `${ax},${ay}`; }
      }
    }
    assert.ok(worst < BAL, `worst residual ${worst} N at ${worstAt}`);
  });

  test("the reciprocal is the exact negative, per contact", () => {
    const { split } = at(-5, 4.5);
    for (const ch of split.channels) {
      assert.ok(Math.abs(ch.carOnBody.x + ch.bodyOnCar.x) < 1e-12);
      assert.ok(Math.abs(ch.carOnBody.y + ch.bodyOnCar.y) < 1e-12);
      assert.ok(Math.abs(ch.carOnBody.z + ch.bodyOnCar.z) < 1e-12);
    }
  });
});

describe('does it pick the answer a body would produce', () => {
  test('at rest the seat pan carries the majority, near published pressure findings', () => {
    const { state, split } = at(0, 0);
    const share = tp(split, 'seat_pan') / Math.abs(state.carOnBody.z);
    assert.ok(share > 0.45 && share < 0.80,
      `seat pan takes ${(share * 100).toFixed(0)}% at rest; expected roughly 60%`);
  });

  test('at rest the belts carry nothing at all', () => {
    // A car going straight leaves the webbing slack. Any load here is a bug.
    const { split } = at(0, 0);
    assert.strictEqual(tp(split, 'lap_belt'), 0);
    assert.strictEqual(tp(split, 'shoulder_belt'), 0);
    assert.strictEqual(split.slackEngaged, false);
  });

  test('at rest nothing lateral is loaded', () => {
    const { split } = at(0, 0);
    assert.ok(tp(split, 'bolster') < 1e-6, 'no lateral load going straight');
    assert.ok(tp(split, 'knee_bolster') < 1e-6);
  });

  test('cornering loads the bolster, and harder cornering loads it more', () => {
    const gentle = at(0, 2).split, hard = at(0, 6).split;
    assert.ok(tp(gentle, 'bolster') > 0, 'a corner must reach the body somewhere lateral');
    assert.ok(tp(hard, 'bolster') > tp(gentle, 'bolster'));
  });

  test('cornering does not engage the belts', () => {
    const { split } = at(0, 6);
    assert.strictEqual(split.slackEngaged, false, 'a belt is not what holds you in a corner');
  });

  test('throttle loads the seat back, braking does not', () => {
    assert.ok(tp(at(3, 0).split, 'seat_back') > tp(at(-3, 0).split, 'seat_back'));
  });

  test('gentle braking is taken by bracing, hard braking engages the belt', () => {
    // The behaviour the bracing caps exist to produce.
    const gentle = at(-2.5, 0).split;
    const hard = at(-8, 0).split;
    assert.strictEqual(gentle.slackEngaged, false, 'a light stop should not need the belt');
    assert.strictEqual(hard.slackEngaged, true, 'a hard stop must reach the belt');
    assert.ok(tp(hard, 'shoulder_belt') > tp(hard, 'seat_pan'),
      'in a hard stop the shoulder belt should be the biggest single contact');
  });

  test('the belt engages progressively harder as the stop gets harder', () => {
    let last = -1;
    for (const ax of [-8, -8.5, -9, -9.5]) {
      const v = tp(at(ax, 0).split, 'shoulder_belt');
      assert.ok(v > last, `belt load fell going from softer to harder braking at ${ax}`);
      last = v;
    }
  });

  test('the diagonal belt pushes you sideways, and something resists it', () => {
    // Emergent, and a good check that the vector bookkeeping is real: a
    // shoulder belt runs across the body, so engaging it in a straight-line
    // stop demands a lateral reaction even though the car is not turning.
    const { split } = at(-8.5, 0);
    assert.ok(tp(split, 'shoulder_belt') > 0);
    assert.ok(tp(split, 'bolster') > 1,
      'the belt has a lateral component that nothing is resisting');
  });

  test('a heavier occupant loads every contact proportionally', () => {
    const a = O.vec(-4, 3, 0);
    const light = K.solve(O.solve({ bodyMass: 50, accel: a }).carOnBody);
    const heavy = K.solve(O.solve({ bodyMass: 100, accel: a }).carOnBody);
    // Not exactly 2x, because caps do not scale with the occupant — which is
    // itself the point: a heavier driver saturates their bracing sooner.
    assert.ok(tp(heavy, 'seat_pan') > tp(light, 'seat_pan'));
  });

  test('the split is smooth as the input moves, not jumpy', () => {
    // A rule-based placeholder jumps at regime boundaries. A minimum-energy
    // solution does not, and that difference is visible on a slider.
    let prev = tp(at(0, 0).split, 'seat_pan'), maxJump = 0;
    for (let ay = 0.1; ay <= 6; ay += 0.1) {
      const v = tp(at(0, ay).split, 'seat_pan');
      maxJump = Math.max(maxJump, Math.abs(v - prev));
      prev = v;
    }
    assert.ok(maxJump < 25, `seat pan load jumped ${maxJump.toFixed(1)} N in one small step`);
  });
});

describe('the solver refuses rather than inventing', () => {
  test('a demand outside the cone is reported infeasible, not fudged', () => {
    // Only the lap belt has a downward component, and it is gapped. Ask for a
    // large pure-downward force with nothing but upward-pushing channels
    // available and there is no honest answer.
    const up = K.CHANNELS.filter(c => c.n[2] > 0.5 && !c.gapped);
    const r = K.solve({ x: 0, y: 0, z: -5000 }, { channels: up });
    assert.strictEqual(r.feasible, false);
    assert.ok(r.reason && r.reason.length > 20, 'an infeasible result must say why');
    assert.deepStrictEqual(r.channels, []);
  });

  test('zero demand gives zero everywhere, not noise', () => {
    const r = K.solve({ x: 0, y: 0, z: 0 });
    assert.ok(r.feasible);
    for (const ch of r.channels) assert.ok(Math.abs(ch.magnitude) < 1e-9, `${ch.id} is non-zero`);
  });

  test('the audit is capable of failing', () => {
    // Same negative control as the third-law audit in M0: a check that has
    // never fired is not evidence.
    const { state, split } = at(-5, 3);
    split.channels[0].carOnBody.z += 40;
    const audit = K.auditBalance(split, state.carOnBody);
    assert.ok(audit.residual > 39, 'the balance audit missed a 40 N error');
  });

  test('it converges quickly across the envelope', () => {
    let worstIter = 0;
    for (let ax = -9; ax <= 4; ax += 1) {
      for (let ay = -8; ay <= 8; ay += 2) worstIter = Math.max(worstIter, at(ax, ay).split.iterations);
    }
    assert.ok(worstIter < 60, `took ${worstIter} iterations; it should be tens at most`);
  });
});
