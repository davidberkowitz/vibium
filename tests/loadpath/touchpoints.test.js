/**
 * Driver Load Path — M1 touchpoint register tests.
 * Pure data and logic; the SVG geometry is checked separately in the view test.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/touchpoints.js');

const { LoadPathTouchpoints: T } = globalThis;

describe('touchpoint register', () => {
  test('table 1 of the plan is present in full, twelve contacts', () => {
    assert.strictEqual(T.ALL.length, 12);
  });

  test('ids and numbers are unique, and numbers run 01 to 12 in order', () => {
    const ids = T.ALL.map(t => t.id);
    const ns = T.ALL.map(t => t.n);
    assert.strictEqual(new Set(ids).size, 12, 'duplicate id');
    assert.strictEqual(new Set(ns).size, 12, 'duplicate number');
    assert.deepStrictEqual(ns, ['01','02','03','04','05','06','07','08','09','10','11','12']);
  });

  test('every contact names an anatomy and both directions of force', () => {
    for (const t of T.ALL) {
      assert.ok(t.anatomy && t.anatomy.length > 3, `${t.id} has no anatomy`);
      assert.ok(t.carOnDriver && t.carOnDriver.length > 3, `${t.id} missing car-on-driver`);
      assert.ok(t.driverOnCar && t.driverOnCar.length > 3, `${t.id} missing driver-on-car`);
      assert.notStrictEqual(t.carOnDriver, t.driverOnCar,
        `${t.id} describes both directions identically`);
    }
  });

  test('axis and constraint are drawn from the declared vocabularies', () => {
    for (const t of T.ALL) {
      assert.ok(T.AXES.includes(t.axis), `${t.id} has unknown axis ${t.axis}`);
      assert.ok(T.CONSTRAINTS.includes(t.constraint), `${t.id} has unknown constraint`);
      assert.ok(T.REGIMES.includes(t.dominantRegime), `${t.id} has unknown regime`);
    }
  });

  test('webbing is tension-only and foam is compression-only', () => {
    // The sign constraints are the whole reason M2 is a quadratic program.
    // Getting one backwards would let the solver report foam that pulls.
    assert.strictEqual(T.byId('lap_belt').constraint, 'tension');
    assert.strictEqual(T.byId('shoulder_belt').constraint, 'tension');
    for (const id of ['seat_pan', 'seat_back', 'bolster', 'footrest', 'floor',
                      'head_restraint', 'knee_bolster', 'armrest', 'pedal']) {
      assert.strictEqual(T.byId(id).constraint, 'compression',
        `${id} should be compression-only`);
    }
    assert.strictEqual(T.byId('wheel').constraint, 'bidirectional');
  });

  test('nothing tension-only is loaded at rest', () => {
    // Belts hang slack in a car going straight. If a tension channel ever
    // reports load in the baseline, either the data or the physics is wrong.
    for (const t of T.ALL) {
      if (t.constraint === 'tension') {
        assert.strictEqual(t.activeAtRest, false, `${t.id} cannot be taut at rest`);
      }
    }
  });

  test('a gated contact is never active at rest', () => {
    for (const t of T.ALL) {
      if (t.gated) assert.strictEqual(t.activeAtRest, false, `${t.id} is gated but active`);
    }
  });

  test('the cruise baseline loads six contacts, and they are the plausible ones', () => {
    const active = T.activeAtRest().map(t => t.id).sort();
    assert.deepStrictEqual(active,
      ['armrest', 'floor', 'footrest', 'seat_back', 'seat_pan', 'wheel']);
  });

  test('at least one contact carries vertical load at rest', () => {
    // Something has to hold the driver up. A baseline with no vertical channel
    // would be a body in free fall.
    const verticalAtRest = T.activeAtRest().filter(t => t.axis === 'vertical');
    assert.ok(verticalAtRest.length > 0, 'nothing is holding the driver up');
  });

  test('every driving regime has at least one contact that dominates it', () => {
    for (const r of T.REGIMES) {
      assert.ok(T.byRegime(r).length > 0, `no contact dominates ${r}`);
    }
  });

  test('lateral channels exist and none of them is loaded at rest', () => {
    const lateral = T.ALL.filter(t => t.axis === 'lateral');
    assert.ok(lateral.length >= 2, 'cornering needs somewhere to enter the body');
    for (const t of lateral) {
      assert.strictEqual(t.activeAtRest, false, `${t.id} has no lateral load going straight`);
    }
  });

  test('byId returns null for an unknown id rather than throwing', () => {
    assert.strictEqual(T.byId('ejector_seat'), null);
  });
});
