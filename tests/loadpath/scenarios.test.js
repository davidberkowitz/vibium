/**
 * Driver Load Path — M4 scenario and lag tests.
 *
 * Two gating tests in here.
 *
 * The first is CONSISTENCY. Speed and pedal demand are independent inputs in
 * this model, so a hand-authored timeline can ask for 0.8 g of braking at a
 * constant 100 km/h and the solver will draw it without complaint. Every
 * preset is therefore differentiated and checked against what the vehicle
 * solver actually produces. An incoherent maneuver fails here rather than
 * looking plausible on screen.
 *
 * The second is that the LAG IS A TRANSIENT AND NOTHING ELSE. Whatever the
 * time constant, a settled state has to be bit-identical to the unlagged one,
 * or the lag has stopped being a display nicety and started biasing results.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/vehicle.js');
require('../../apps/loadpath/js/model/occupant.js');
require('../../apps/loadpath/js/model/contacts.js');
require('../../apps/loadpath/js/model/scenarios.js');

const { LoadPathConstants: C, LoadPathVehicle: V, LoadPathOccupant: O,
        LoadPathContacts: K, LoadPathScenarios: S } = globalThis;

const G = C.G;
const SEDAN = C.VEHICLES.sedan;

function solveVehicle(inputs) {
  return V.solve({
    speed: inputs.speed, steerAngle: inputs.steerAngle,
    ax: inputs.ax, mu: inputs.mu, gradePercent: inputs.gradePercent
  }, SEDAN);
}

describe('scenario timelines', () => {
  test('there are four presets and every one is well formed', () => {
    assert.equal(S.SCENARIOS.length, 4);
    S.SCENARIOS.forEach((sc) => {
      assert.ok(sc.id && sc.label && sc.blurb, `${sc.id} is missing prose`);
      assert.ok(sc.duration > 0);
      assert.ok(sc.keys.length >= 2, `${sc.id} needs at least two keyframes`);
      assert.ok(C.SURFACES[sc.surface || 'dry'], `${sc.id} has an unknown surface`);
      // Keyframes must be in ascending time or the interpolator walks past them.
      for (let i = 1; i < sc.keys.length; i++) {
        assert.ok(sc.keys[i].t > sc.keys[i - 1].t, `${sc.id} keys out of order at ${i}`);
      }
      // The first key has to set every channel, or the opening state is a guess.
      S.CHANNELS.forEach((ch) => {
        assert.ok(ch in sc.keys[0], `${sc.id} first key does not set ${ch}`);
      });
    });
  });

  test('sample interpolates linearly and holds outside the range', () => {
    const sc = S.byId('lane_change');
    // Steering goes 0 at t=1 to 0.030 at t=2, so halfway is halfway.
    assert.ok(Math.abs(S.sample(sc, 1.5).steerAngle - 0.015) < 1e-12);
    // Before the start and past the end it holds rather than extrapolating.
    assert.equal(S.sample(sc, -5).steerAngle, S.sample(sc, 0).steerAngle);
    assert.equal(S.sample(sc, 999).steerAngle, S.sample(sc, sc.duration).steerAngle);
  });

  test('sample fills in the derived fields the solver needs', () => {
    const s = S.sample(S.byId('threshold_stop'), 2.0);
    assert.equal(s.surface, 'dry');
    assert.equal(s.mu, C.SURFACES.dry.mu);
    // ax is pedal demand resolved, and here the pedal is hard on the brake.
    assert.ok(Math.abs(s.ax - (s.throttle - s.brake) * G) < 1e-12);
    assert.ok(s.ax < -7, 'threshold stop should be demanding real deceleration');
  });

  test('a channel a keyframe does not mention keeps its last stated value', () => {
    const sc = S.byId('lane_change');
    // Only the first and last keys set speed; everything between holds it.
    for (const t of [0, 2.5, 5, 8.9]) {
      assert.ok(Math.abs(S.sample(sc, t).speed - 27.8) < 1e-9);
    }
  });
});

describe('scenario consistency: does the speed profile match the pedals', () => {
  /* Tolerance is in m/s^2. The speed profile is piecewise linear and sampled
     with a centred difference, so the only error at an interior point is
     rounding in the hand-computed keyframe values; near a corner in the
     profile the centred difference straddles two slopes and is legitimately
     off. 0.35 m/s^2 (about 0.036 g) catches an authoring blunder — a pedal
     left on, a ramp of the wrong length — while tolerating the corners. */
  const TOL = 0.35;

  S.SCENARIOS.forEach((sc) => {
    test(`${sc.id}: pedal demand explains the speed change`, () => {
      const r = S.consistency(sc, solveVehicle, { dt: 0.05 });
      assert.ok(r.worst < TOL,
        `${sc.id} disagrees by ${r.worst.toFixed(3)} m/s^2 at t=${r.at.toFixed(2)}: ` +
        `speed implies ${r.impliedBySpeed.toFixed(3)}, pedals give ${r.fromPedals.toFixed(3)}`);
    });
  });

  test('negative control: an incoherent timeline is caught', () => {
    /* Deliberately wrong — full speed held while standing on the brake. If
       consistency() cannot see this, it cannot see anything. */
    const bad = {
      id: 'bad', label: 'bad', blurb: 'bad', duration: 4, surface: 'dry',
      keys: [
        { t: 0, speed: 30, steerAngle: 0, brake: 0.8, throttle: 0, gradePercent: 0 },
        { t: 4, speed: 30 }
      ]
    };
    const r = S.consistency(bad, solveVehicle, { dt: 0.05 });
    assert.ok(r.worst > 7, `expected a large disagreement, got ${r.worst}`);
  });

  test('no preset ever asks for more grip than its surface has', () => {
    S.SCENARIOS.forEach((sc) => {
      for (let t = 0; t <= sc.duration; t += 0.02) {
        const v = solveVehicle(S.sample(sc, t));
        assert.ok(v.utilisation <= 1.0001,
          `${sc.id} at t=${t.toFixed(2)} wants ${(v.utilisation * 100).toFixed(0)}% of grip`);
      }
    });
  });

  test('no preset ever lifts a wheel', () => {
    S.SCENARIOS.forEach((sc) => {
      for (let t = 0; t <= sc.duration; t += 0.05) {
        const v = solveVehicle(S.sample(sc, t));
        assert.equal(v.corners.wheelsLifted.length, 0,
          `${sc.id} lifts ${v.corners.wheelsLifted.join(',')} at t=${t.toFixed(2)}`);
      }
    });
  });

  test('the lane change actually reverses lateral load', () => {
    const sc = S.byId('lane_change');
    const left = solveVehicle(S.sample(sc, 2.5));
    const right = solveVehicle(S.sample(sc, 5.5));
    assert.ok(left.accel.y > 1.5, 'first phase should be a real left turn');
    assert.ok(right.accel.y < -1.5, 'second phase should be a real right turn');
    // Outer wheels swap sides with the turn. That is the whole point of it.
    assert.ok(left.corners.loads.frontRight > left.corners.loads.frontLeft);
    assert.ok(right.corners.loads.frontLeft > right.corners.loads.frontRight);
  });

  test('the threshold stop engages the belts, and cruise does not', () => {
    const hard = S.sample(S.byId('threshold_stop'), 2.5);
    const easy = S.sample(S.byId('cruise'), 3);
    const bodyForce = (inputs) => {
      const v = solveVehicle(inputs);
      return O.solve({
        bodyMass: C.OCCUPANT_MASS.value,
        accel: O.vec(v.accel.x, v.accel.y, 0),
        gravity: O.gravityForGrade(inputs.gradePercent)
      }).carOnBody;
    };
    assert.equal(K.solve(bodyForce(hard)).slackEngaged, true);
    assert.equal(K.solve(bodyForce(easy)).slackEngaged, false);
  });
});

describe('the stopped-car rule', () => {
  test('a stationary car on the brake is not decelerating', () => {
    const v = solveVehicle({ speed: 0, steerAngle: 0, ax: -0.30 * G, mu: 0.9, gradePercent: 0 });
    assert.equal(v.accel.x, 0);
  });

  test('but throttle from rest still moves it', () => {
    const v = solveVehicle({ speed: 0, steerAngle: 0, ax: 0.18 * G, mu: 0.9, gradePercent: 0 });
    assert.ok(Math.abs(v.accel.x - 0.18 * G) < 1e-9);
  });

  test('and a moving car on the brake still decelerates', () => {
    const v = solveVehicle({ speed: 20, steerAngle: 0, ax: -0.30 * G, mu: 0.9, gradePercent: 0 });
    assert.ok(Math.abs(v.accel.x + 0.30 * G) < 1e-9);
  });

  test('held on a grade, the seat back still carries load', () => {
    /* The rule zeroes the ACCELERATION, not gravity. A driver standing still
       on a 12% slope is still tilted back into the seat, and if this ever
       stops being true the hill-start scenario has lost its point. */
    const inputs = S.sample(S.byId('hill_start'), 1.0);
    const v = solveVehicle(inputs);
    assert.equal(v.accel.x, 0);
    const body = O.solve({
      bodyMass: C.OCCUPANT_MASS.value,
      accel: O.vec(0, 0, 0),
      gravity: O.gravityForGrade(inputs.gradePercent)
    });
    const split = K.solve(body.carOnBody);
    assert.ok(split.byTouchpoint.seat_back.magnitude > 50,
      'a 12% uphill should press the driver into the seat back at a standstill');
  });
});

describe('the body lag', () => {
  test('alpha is the textbook time constant', () => {
    // One time constant closes 63.2% of the gap. That is the definition.
    assert.ok(Math.abs(S.alpha(0.25, 0.25) - (1 - Math.exp(-1))) < 1e-12);
    assert.ok(Math.abs(S.alpha(0.25, 0.25) - 0.6321205588) < 1e-9);
    // Three time constants gets to 95%.
    assert.ok(S.alpha(0.75, 0.25) > 0.95);
  });

  test('alpha is bounded for any dt, which a Euler step would not be', () => {
    for (const dt of [0.001, 0.016, 0.25, 1, 10, 1e6]) {
      const a = S.alpha(dt, 0.25);
      assert.ok(a >= 0 && a <= 1, `alpha out of range at dt=${dt}: ${a}`);
    }
    // A Euler step, dt/tau, would be 4 at dt=1 — a 400% overshoot and then
    // divergence. The exponential form saturates instead.
    assert.ok(S.alpha(1, 0.25) < 1);
    assert.ok(S.alpha(1e6, 0.25) === 1);
  });

  test('tau of zero means no lag at all', () => {
    const l = S.makeLag(0);
    l.step({ x: 5, y: -3 }, 0.016);
    assert.deepEqual(l.value(), { x: 5, y: -3 });
  });

  test('a step response converges to the target and never overshoots', () => {
    const l = S.makeLag(0.25);
    const target = { x: -7.85, y: 0 };
    let prev = 0;
    for (let i = 0; i < 200; i++) {
      const v = l.step(target, 0.016);
      // Monotone approach from below — no ringing, ever. This is also the
      // model's honest limitation, not just a nice property: a real torso
      // DOES overshoot, and a first-order lag structurally cannot.
      assert.ok(v.x <= prev + 1e-12, 'first-order lag must not overshoot');
      assert.ok(v.x >= target.x - 1e-12);
      prev = v.x;
    }
    assert.ok(Math.abs(l.value().x - target.x) < 1e-3);
  });

  test('the lag is a transient: settled states are identical either way', () => {
    /* The gating test. Run the lagged body forward until it settles and solve
       the contact split; solve it again with no lag at all. If those differ,
       the lag is silently biasing every number the app prints. */
    const inputs = S.sample(S.byId('threshold_stop'), 3.0);
    const v = solveVehicle(inputs);
    const want = { x: v.accel.x, y: v.accel.y };

    const l = S.makeLag(0.25);
    for (let i = 0; i < 2000; i++) l.step(want, 0.016);   // 32 s, well settled
    const settled = l.value();

    const bodyOf = (a) => O.solve({
      bodyMass: C.OCCUPANT_MASS.value,
      accel: O.vec(a.x, a.y, 0),
      gravity: O.gravityForGrade(inputs.gradePercent)
    });
    const lagged = K.solve(bodyOf(settled).carOnBody);
    const direct = K.solve(bodyOf(want).carOnBody);

    Object.keys(direct.byTouchpoint).forEach((id) => {
      const d = Math.abs(lagged.byTouchpoint[id].magnitude - direct.byTouchpoint[id].magnitude);
      assert.ok(d < 1e-6, `${id} differs by ${d} N once settled`);
    });
  });

  test('reset snaps with no transient, which is what a scrub needs', () => {
    const l = S.makeLag(0.25);
    l.step({ x: -8, y: 0 }, 0.016);
    l.reset({ x: 3, y: 2 });
    assert.deepEqual(l.value(), { x: 3, y: 2 });
    assert.equal(l.error({ x: 3, y: 2 }), 0);
  });

  test('third law survives the lag', () => {
    /* The lagged body is accelerating differently from the cabin, which is the
       point. What must NOT change is that the force it puts into the car is
       the exact negative of the force the car puts into it — that is Newton,
       not a modelling choice, and it holds mid-transient or not at all. */
    const l = S.makeLag(0.25);
    const want = { x: -7.0, y: 3.0 };
    for (let i = 0; i < 40; i++) {
      const a = l.step(want, 0.016);
      const body = O.solve({
        bodyMass: C.OCCUPANT_MASS.value,
        accel: O.vec(a.x, a.y, 0),
        gravity: O.gravityForGrade(0)
      });
      assert.ok(O.auditThirdLaw(body).worst < 1e-9, `third law broke at step ${i}`);
    }
  });
});

describe('provenance keeps up', () => {
  test('the lag and the stopped-car rule are both declared', () => {
    assert.ok(C.PROVENANCE['MODEL.bodyLag'], 'the lag needs a provenance record');
    assert.equal(C.PROVENANCE['MODEL.bodyLag'].value, S.TAU,
      'the declared time constant must be the one the code uses');
    assert.equal(C.PROVENANCE['MODEL.bodyLag'].status, 'placeholder');
    assert.ok(C.PROVENANCE['MODEL.stoppedCar'], 'the stopped-car rule needs a record');
  });

  test('the lag caveat says the thing that is actually wrong with it', () => {
    // A caveat that does not name the failure mode is decoration.
    assert.match(C.PROVENANCE['MODEL.bodyLag'].caveat, /overshoot/);
  });
});
