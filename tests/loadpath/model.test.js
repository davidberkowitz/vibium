/**
 * Driver Load Path — M0 model core tests.
 * Pure logic from apps/loadpath, no browser and no build needed.
 *
 * The gating test for this milestone is the Newton's third law audit. If the
 * force the car puts into the body and the force the body puts into the car are
 * not exact negatives, nothing built on top of this model means anything.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/vehicle.js');
require('../../apps/loadpath/js/model/occupant.js');

const { LoadPathConstants: C, LoadPathVehicle: V, LoadPathOccupant: O } = globalThis;

const G = C.G;
const SEDAN = C.VEHICLES.sedan;
const DRIVER = C.OCCUPANTS.m50.mass;
const TOL = 1e-9;

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

describe('constants and provenance', () => {
  test('segment mass fractions sum to exactly one body', () => {
    const sum = C.SEGMENTS.reduce((s, x) => s + x.fraction * x.count, 0);
    assert.ok(close(sum, 1.0, 1e-12), `fractions sum to ${sum}, not 1`);
  });

  test('every segment fraction is positive and under half a body', () => {
    for (const s of C.SEGMENTS) {
      assert.ok(s.fraction > 0, `${s.key} is not positive`);
      assert.ok(s.fraction <= 0.5, `${s.key} exceeds half the body mass`);
      assert.ok(s.count === 1 || s.count === 2, `${s.key} has odd count ${s.count}`);
    }
  });

  test('the anthropometry carries its caveat, not just its source', () => {
    const rec = C.PROVENANCE['SEGMENTS.fraction'];
    assert.ok(rec, 'segment fractions have no provenance record');
    assert.match(rec.status, /verified|corroborated/);
    assert.ok(rec.caveat && rec.caveat.length > 0,
      'the Dempster sample limitation must travel with the numbers');
  });

  test('no constant reaches the model without a provenance record', () => {
    const missing = [];
    for (const [group, entries] of [['VEHICLES', C.VEHICLES],
                                    ['SURFACES', C.SURFACES],
                                    ['OCCUPANTS', C.OCCUPANTS]]) {
      for (const [name, obj] of Object.entries(entries)) {
        for (const [field, value] of Object.entries(obj)) {
          if (typeof value !== 'number') continue;
          const key = `${group}.${name}.${field}`;
          if (!C.PROVENANCE[key]) missing.push(key);
        }
      }
    }
    assert.deepStrictEqual(missing, [], `constants with no source: ${missing.join(', ')}`);
  });

  test('provenance values agree with the constants they describe', () => {
    assert.strictEqual(C.PROVENANCE['VEHICLES.sedan.mass'].value, SEDAN.mass);
    assert.strictEqual(C.PROVENANCE['SURFACES.dry.mu'].value, C.SURFACES.dry.mu);
    assert.strictEqual(C.PROVENANCE['OCCUPANTS.m50.mass'].value, DRIVER);
  });
});

describe('vehicle: cornering (EQ 1)', () => {
  test('a standstill generates no lateral acceleration however hard you steer', () => {
    const ay = V.lateralAccelFromSteering({
      speed: 0, steerAngle: 0.5, wheelbase: SEDAN.wheelbase,
      understeerGradient: SEDAN.understeerGradient
    });
    assert.strictEqual(ay, 0);
  });

  test('straight wheel generates no lateral acceleration at any speed', () => {
    const ay = V.lateralAccelFromSteering({
      speed: 40, steerAngle: 0, wheelbase: SEDAN.wheelbase,
      understeerGradient: SEDAN.understeerGradient
    });
    assert.strictEqual(ay, 0);
  });

  test('a left steer input gives a left (positive) lateral acceleration', () => {
    const ay = V.lateralAccelFromSteering({
      speed: 25, steerAngle: 0.04, wheelbase: SEDAN.wheelbase,
      understeerGradient: SEDAN.understeerGradient
    });
    assert.ok(ay > 0, `expected positive ay, got ${ay}`);
  });

  test('steering is antisymmetric: mirror the input, mirror the result', () => {
    const args = { speed: 25, wheelbase: SEDAN.wheelbase,
                   understeerGradient: SEDAN.understeerGradient };
    const left = V.lateralAccelFromSteering({ ...args, steerAngle: 0.04 });
    const right = V.lateralAccelFromSteering({ ...args, steerAngle: -0.04 });
    assert.ok(close(left, -right), `${left} vs ${right}`);
  });

  test('with no understeer gradient it reduces to the neutral-steer identity', () => {
    // K = 0 makes the bicycle model exact: delta = L/R and ay = v^2/R,
    // so ay must equal delta * v^2 / L.
    const v = 30, delta = 0.03, L = SEDAN.wheelbase;
    const ay = V.lateralAccelFromSteering({
      speed: v, steerAngle: delta, wheelbase: L, understeerGradient: 0
    });
    assert.ok(close(ay, delta * v * v / L), `${ay}`);
  });

  test('understeer means the same steering angle yields less turn', () => {
    const args = { speed: 30, steerAngle: 0.03, wheelbase: SEDAN.wheelbase };
    const neutral = V.lateralAccelFromSteering({ ...args, understeerGradient: 0 });
    const under = V.lateralAccelFromSteering({ ...args, understeerGradient: 0.0035 });
    assert.ok(under < neutral, `understeer ${under} should be below neutral ${neutral}`);
  });

  test('turn radius and lateral acceleration are consistent', () => {
    const v = 25;
    const ay = V.lateralAccelFromSteering({
      speed: v, steerAngle: 0.04, wheelbase: SEDAN.wheelbase,
      understeerGradient: SEDAN.understeerGradient
    });
    const R = V.turnRadius(v, ay);
    assert.ok(close(ay, v * v / R, 1e-9), `ay ${ay} vs v^2/R ${v * v / R}`);
  });

  test('going straight is an infinite radius, not a divide by zero', () => {
    assert.strictEqual(V.turnRadius(30, 0), Infinity);
  });
});

describe('vehicle: load transfer (EQ 2, EQ 3)', () => {
  test('braking moves load onto the front axle', () => {
    const r = V.cornerLoads({
      mass: SEDAN.mass, ax: -8, ay: 0, cgHeight: SEDAN.cgHeight,
      wheelbase: SEDAN.wheelbase, track: SEDAN.track,
      frontWeightFraction: SEDAN.frontWeightFraction
    });
    const staticFront = SEDAN.mass * G * SEDAN.frontWeightFraction;
    assert.ok(r.frontAxle > staticFront, 'front axle should gain load under braking');
    assert.ok(r.rearAxle < SEDAN.mass * G * (1 - SEDAN.frontWeightFraction));
  });

  test('throttle moves load onto the rear axle', () => {
    const r = V.cornerLoads({
      mass: SEDAN.mass, ax: 3.5, ay: 0, cgHeight: SEDAN.cgHeight,
      wheelbase: SEDAN.wheelbase, track: SEDAN.track,
      frontWeightFraction: SEDAN.frontWeightFraction
    });
    assert.ok(r.rearAxle > SEDAN.mass * G * (1 - SEDAN.frontWeightFraction));
  });

  test('a left turn loads the right-hand (outer) wheels', () => {
    const r = V.cornerLoads({
      mass: SEDAN.mass, ax: 0, ay: 6, cgHeight: SEDAN.cgHeight,
      wheelbase: SEDAN.wheelbase, track: SEDAN.track,
      frontWeightFraction: SEDAN.frontWeightFraction
    });
    assert.ok(r.loads.frontRight > r.loads.frontLeft);
    assert.ok(r.loads.rearRight > r.loads.rearLeft);
  });

  test('load transfer redistributes weight, it never creates or destroys it', () => {
    const weight = SEDAN.mass * G;
    for (const [ax, ay] of [[0, 0], [-8, 0], [3.5, 0], [0, 6], [-5, 5], [2, -7]]) {
      const r = V.cornerLoads({
        mass: SEDAN.mass, ax, ay, cgHeight: SEDAN.cgHeight,
        wheelbase: SEDAN.wheelbase, track: SEDAN.track,
        frontWeightFraction: SEDAN.frontWeightFraction
      });
      assert.ok(close(r.total, weight, 1e-8),
        `ax=${ax} ay=${ay}: corners total ${r.total}, weight ${weight}`);
    }
  });

  test('at rest the corners carry the static distribution', () => {
    const r = V.cornerLoads({
      mass: SEDAN.mass, ax: 0, ay: 0, cgHeight: SEDAN.cgHeight,
      wheelbase: SEDAN.wheelbase, track: SEDAN.track,
      frontWeightFraction: SEDAN.frontWeightFraction
    });
    const weight = SEDAN.mass * G;
    assert.ok(close(r.loads.frontLeft, r.loads.frontRight));
    assert.ok(close(r.frontAxle, weight * SEDAN.frontWeightFraction, 1e-8));
    assert.deepStrictEqual(r.wheelsLifted, []);
  });

  test('enough lateral acceleration lifts an inside wheel', () => {
    // Well beyond any real tyre, but the geometry must still report it rather
    // than quietly returning a negative tyre load.
    const r = V.cornerLoads({
      mass: SEDAN.mass, ax: 0, ay: 25, cgHeight: SEDAN.cgHeight,
      wheelbase: SEDAN.wheelbase, track: SEDAN.track,
      frontWeightFraction: SEDAN.frontWeightFraction
    });
    assert.ok(r.wheelsLifted.length > 0, 'expected a lifted wheel');
    assert.ok(r.wheelsLifted.every(k => k.endsWith('Left')), r.wheelsLifted.join(','));
  });

  test('EQ 2 and EQ 3 match their closed forms', () => {
    const dLong = V.longitudinalLoadTransfer({
      mass: SEDAN.mass, ax: -8, cgHeight: SEDAN.cgHeight, wheelbase: SEDAN.wheelbase
    });
    assert.ok(close(dLong, SEDAN.mass * -8 * SEDAN.cgHeight / SEDAN.wheelbase));
    const dLat = V.lateralLoadTransfer({
      mass: SEDAN.mass, ay: 6, cgHeight: SEDAN.cgHeight, track: SEDAN.track
    });
    assert.ok(close(dLat, SEDAN.mass * 6 * SEDAN.cgHeight / SEDAN.track));
  });
});

describe('vehicle: friction ellipse (EQ 4)', () => {
  const mu = C.SURFACES.dry.mu;

  test('the limit is mu*g in any single direction', () => {
    assert.ok(close(V.frictionUtilisation({ ax: -mu * G, ay: 0, mu }), 1));
    assert.ok(close(V.frictionUtilisation({ ax: 0, ay: mu * G, mu }), 1));
  });

  test('full braking AND full cornering together is refused', () => {
    // The error this test exists to prevent: checking each axis independently.
    // Each of these passes its own limit exactly; together they must not.
    const u = V.frictionUtilisation({ ax: -mu * G, ay: mu * G, mu });
    assert.ok(u > 1, `combined state reported utilisation ${u}, should exceed 1`);
    assert.ok(close(u, Math.SQRT2, 1e-12), `expected sqrt(2), got ${u}`);
  });

  test('a state inside the ellipse is returned untouched', () => {
    const r = V.clampToEllipse({ ax: -2, ay: 1, mu });
    assert.strictEqual(r.clamped, false);
    assert.strictEqual(r.ax, -2);
    assert.strictEqual(r.ay, 1);
  });

  test('clamping preserves direction and lands exactly on the limit', () => {
    const r = V.clampToEllipse({ ax: -mu * G, ay: mu * G, mu });
    assert.strictEqual(r.clamped, true);
    assert.ok(close(r.ax / r.ay, -1, 1e-12), 'direction changed while clamping');
    assert.ok(close(V.frictionUtilisation({ ax: r.ax, ay: r.ay, mu }), 1, 1e-12));
  });

  test('a wet road shrinks the budget', () => {
    const dry = V.frictionUtilisation({ ax: -6, ay: 0, mu: C.SURFACES.dry.mu });
    const wet = V.frictionUtilisation({ ax: -6, ay: 0, mu: C.SURFACES.wet.mu });
    assert.ok(wet > dry, 'the same braking should use more of a wet road');
  });

  test('solve() flags traction exceeded rather than extrapolating', () => {
    const s = V.solve({ speed: 45, steerAngle: 0.12, ax: -8, mu: C.SURFACES.wet.mu }, SEDAN);
    assert.strictEqual(s.tractionExceeded, true);
    assert.ok(close(V.frictionUtilisation({ ax: s.accel.x, ay: s.accel.y, mu: C.SURFACES.wet.mu }), 1, 1e-12),
      'the reported state should sit on the ellipse, not beyond it');
  });
});

describe('occupant: required force (EQ 5)', () => {
  test('sitting still, the car holds you up with exactly your own weight', () => {
    const s = O.solve({ bodyMass: DRIVER, accel: O.vec(0, 0, 0) });
    assert.ok(close(s.carOnBody.x, 0, TOL));
    assert.ok(close(s.carOnBody.y, 0, TOL));
    assert.ok(close(s.carOnBody.z, DRIVER * G, 1e-9));
    assert.ok(close(s.gLoad, 1.0, 1e-12), 'a parked car is 1 g, not 0');
  });

  test('braking pushes the body backwards relative to travel', () => {
    const s = O.solve({ bodyMass: DRIVER, accel: O.vec(-8, 0, 0) });
    assert.ok(s.carOnBody.x < 0, 'the restraints must pull you rearward under braking');
    assert.ok(close(s.carOnBody.x, DRIVER * -8, 1e-9));
  });

  test('a left turn needs a leftward force on the body', () => {
    const s = O.solve({ bodyMass: DRIVER, accel: O.vec(0, 6, 0) });
    assert.ok(s.carOnBody.y > 0);
    assert.ok(close(s.carOnBody.y, DRIVER * 6, 1e-9));
  });

  test('segment masses expand to fourteen physical parts and re-sum to the body', () => {
    const segs = O.segmentMasses(DRIVER);
    assert.strictEqual(segs.length, 14);
    const sum = segs.reduce((s, x) => s + x.mass, 0);
    assert.ok(close(sum, DRIVER, 1e-9), `segments sum to ${sum}, body is ${DRIVER}`);
  });

  test('paired segments are named left and right, never duplicated', () => {
    const keys = O.segmentMasses(DRIVER).map(s => s.key);
    assert.strictEqual(new Set(keys).size, keys.length, 'duplicate segment keys');
    assert.ok(keys.includes('thigh_left') && keys.includes('thigh_right'));
    assert.ok(keys.includes('trunk'), 'the trunk should not be split into a pair');
  });

  test('g-load scales with the resultant, not with any single axis', () => {
    const s = O.solve({ bodyMass: DRIVER, accel: O.vec(0, G, 0) });
    // 1 g lateral on top of 1 g of gravity is sqrt(2) g, not 2 g.
    assert.ok(close(s.gLoad, Math.SQRT2, 1e-12), `got ${s.gLoad}`);
  });

  test('a heavier occupant needs proportionally more force', () => {
    const a = O.vec(-8, 3, 0);
    const light = O.solve({ bodyMass: 49, accel: a });
    const heavy = O.solve({ bodyMass: 98, accel: a });
    assert.ok(close(O.magnitude(heavy.carOnBody), 2 * O.magnitude(light.carOnBody), 1e-9));
  });
});

describe("occupant: Newton's third law audit (EQ 6) — the gate for M0", () => {
  const CASES = [
    ['parked',            O.vec(0, 0, 0)],
    ['gentle throttle',   O.vec(2.0, 0, 0)],
    ['hard braking',      O.vec(-8.5, 0, 0)],
    ['left corner',       O.vec(0, 5.9, 0)],
    ['right corner',      O.vec(0, -5.9, 0)],
    ['trail braking',     O.vec(-5.0, 4.5, 0)],
    ['power out of a bend', O.vec(2.5, -4.0, 0)],
    ['crest, unloaded',   O.vec(0, 0, -3.0)],
    ['compression',       O.vec(0, 0, 4.0)],
    ['everything at once', O.vec(-4.0, 3.5, -2.0)]
  ];

  for (const [name, accel] of CASES) {
    test(`${name}: segment forces sum to the whole-body requirement`, () => {
      const s = O.solve({ bodyMass: DRIVER, accel });
      const audit = O.auditThirdLaw(s);
      assert.ok(audit.sumResidual < 1e-9,
        `${name}: segments miss the total by ${audit.sumResidual} N`);
    });

    test(`${name}: driver-on-car is the exact negative of car-on-driver`, () => {
      const s = O.solve({ bodyMass: DRIVER, accel });
      const audit = O.auditThirdLaw(s);
      assert.ok(audit.pairResidual < 1e-9,
        `${name}: the action/reaction pair misses by ${audit.pairResidual} N`);
    });
  }

  test('the audit holds across every occupant preset', () => {
    for (const key of Object.keys(C.OCCUPANTS)) {
      const s = O.solve({ bodyMass: C.OCCUPANTS[key].mass, accel: O.vec(-6, 4, -1) });
      assert.ok(O.auditThirdLaw(s).worst < 1e-9, `${key} failed the audit`);
    }
  });

  test('the audit is capable of failing', () => {
    // A test that only ever passes proves nothing. Corrupt the state and the
    // audit must notice.
    const s = O.solve({ bodyMass: DRIVER, accel: O.vec(-6, 4, 0) });
    s.segments[0].carOnBody.x += 50;
    s.carOnBody = s.segments.reduce((acc, seg) => O.add(acc, seg.carOnBody), O.vec(0, 0, 0));
    assert.ok(O.auditThirdLaw(s).sumResidual > 49, 'the audit missed a 50 N error');
  });
});

describe('end to end: vehicle into occupant', () => {
  test('a cornering vehicle state drives a consistent occupant state', () => {
    const v = V.solve({ speed: 25, steerAngle: 0.05, ax: -2, mu: C.SURFACES.dry.mu }, SEDAN);
    const o = O.solve({ bodyMass: DRIVER, accel: v.accel });
    assert.strictEqual(v.tractionExceeded, false);
    assert.ok(o.carOnBody.y > 0, 'a left turn should push the driver left');
    assert.ok(o.carOnBody.x < 0, 'light braking should pull the driver rearward');
    assert.ok(O.auditThirdLaw(o).worst < 1e-9);
  });

  test('the occupant is a non-trivial share of the vehicle mass', () => {
    // 78 kg in a 1600 kg car is about 4.9%, offset from the centreline. The plan
    // calls this out as the reason the reciprocal force is worth drawing.
    const share = DRIVER / SEDAN.mass;
    assert.ok(share > 0.04 && share < 0.07, `driver is ${(share * 100).toFixed(1)}% of the car`);
  });
});
