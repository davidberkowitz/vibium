/* Driver Load Path — M8. The body is second order now.
 *
 * M4 shipped a first-order lag and wrote down what was wrong with it in the
 * same breath: a first-order system approaches its target monotonically and
 * CANNOT overshoot, while a real torso on a compliant seat is a mass on a
 * spring and rocks past where it settles. The model gave the delay and none of
 * the rebound, so a hard stop looked calmer than it feels. That sat as a
 * recorded placeholder for four milestones.
 *
 * What is on trial here:
 *
 *   1. The rebound exists, and is the size the mathematics says — checked
 *      against the closed form, not against a number someone typed.
 *   2. The discretisation is EXACT, the same property alpha() had. A big step
 *      must land where many small steps land, and no step size may make it
 *      diverge. Euler on an oscillator injects energy; a dropped animation
 *      frame must not fling the body through the windscreen.
 *   3. The invariant M4 set still holds: the lag is a TRANSIENT. Every settled
 *      state is identical with it on or off. Overshooting is allowed to change
 *      how you get there and nothing about where you end up.
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/scenarios.js');

const { LoadPathConstants: C, LoadPathScenarios: S } = globalThis;

const TARGET = { x: -7.85, y: 0 };          // a hard stop, about 0.8 g

/* Run a step response and report what it did. Fine steps so the peak is
   resolved rather than stepped over. */
function stepResponse(lag, dt = 0.002, seconds = 6) {
  let t = 0, peak = 0, tPeak = 0, t90 = null, crossings = 0, prevErr = null;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    const v = lag.step(TARGET, dt);
    t += dt;
    const frac = v.x / TARGET.x;                 // 1.0 is exactly arrived
    if (frac > peak) { peak = frac; tPeak = t; }
    if (t90 === null && frac >= 0.9) t90 = t;
    const err = TARGET.x - v.x;
    if (prevErr !== null && Math.sign(err) !== Math.sign(prevErr) && err !== 0) crossings++;
    prevErr = err;
  }
  return { overshoot: peak - 1, tPeak, t90, crossings, final: lag.value() };
}

describe('the rebound exists and is the size the mathematics says', () => {
  test('the default body overshoots — the thing M4 structurally could not do', () => {
    const r = stepResponse(S.makeLag());
    assert.ok(r.overshoot > 0.05,
      `expected a visible rebound, got ${(r.overshoot * 100).toFixed(1)}%`);
    assert.ok(r.crossings >= 1, 'the body must pass through the target, not creep up to it');
  });

  test('the overshoot matches the closed form for every damping ratio', () => {
    /* exp(-pi*z/sqrt(1-z^2)). Checking the simulation against the analytic
       result is the whole point: it tests the discretisation, not a
       remembered number. */
    for (const zeta of [0.2, 0.35, 0.45, 0.6, 0.8]) {
      const r = stepResponse(S.makeLag({ wn: 2 * Math.PI * 2.0, zeta }));
      const want = S.overshootFraction(zeta);
      assert.ok(Math.abs(r.overshoot - want) < 2e-3,
        `zeta ${zeta}: simulated ${r.overshoot.toFixed(4)}, theory ${want.toFixed(4)}`);
    }
  });

  test('the shipped damping gives the rebound the provenance record claims', () => {
    const zeta = C.PROVENANCE['MODEL.bodyDamping'].value;
    const pct = S.overshootFraction(zeta) * 100;
    assert.ok(Math.abs(pct - 20.5) < 0.1,
      `the caveat says 20.5%; the constant gives ${pct.toFixed(1)}%`);
  });

  test('the response lands in the window the plan documents', () => {
    /* "Real occupants respond over 0.1 to 0.3 seconds." Measured, because the
       first-order model it replaced did NOT: tau of 0.25 took 0.58 s to reach
       90%, outside that window in the slow direction, and nobody had checked. */
    const r = stepResponse(S.makeLag());
    assert.ok(r.t90 >= 0.1 && r.t90 <= 0.3, `90% at ${r.t90.toFixed(2)} s`);
    assert.ok(r.tPeak >= 0.1 && r.tPeak <= 0.4, `peak at ${r.tPeak.toFixed(2)} s`);
  });

  test('the first-order model is still there, and still cannot overshoot', () => {
    // Kept as a live comparison, so the difference is demonstrable and not
    // just asserted in a caption.
    const r = stepResponse(S.makeLag(0.25));
    assert.ok(r.overshoot < 1e-9, 'a first-order lag overshooting means it is not first order');
    assert.equal(r.crossings, 0, 'and it must never cross the target');
    assert.ok(r.t90 > 0.5, 'it was also slow: 0.58 s to 90%, which M8 measured and fixed');
  });
});

describe('the discretisation is exact, not integrated', () => {
  test('one big step lands where many small steps land', () => {
    /* The defining property of a zero-order-hold solution: with the input held
       constant, step size does not change the answer. An integrator would
       drift apart here. */
    const coarse = S.makeLag();
    const fine = S.makeLag();
    coarse.step(TARGET, 0.5);
    for (let i = 0; i < 500; i++) fine.step(TARGET, 0.001);
    assert.ok(Math.abs(coarse.value().x - fine.value().x) < 1e-9,
      `coarse ${coarse.value().x} vs fine ${fine.value().x}`);
    assert.ok(Math.abs(coarse.velocity().x - fine.velocity().x) < 1e-9,
      'velocity must agree too, or only half the state is exact');
  });

  test('no step size makes it diverge, which is what Euler would do', () => {
    /* A dropped animation frame hands the loop a huge dt. Euler on an
       oscillator gains energy every step and runs away; the exact form cannot,
       because e^(-zeta*wn*dt) only ever shrinks. */
    for (const dt of [0.001, 0.016, 0.1, 0.5, 1, 10, 1e4]) {
      const l = S.makeLag();
      for (let i = 0; i < 50; i++) l.step(TARGET, dt);
      const v = l.value(), vel = l.velocity();
      assert.ok(Number.isFinite(v.x) && Number.isFinite(vel.x), `NaN at dt=${dt}`);
      assert.ok(Math.abs(v.x) <= Math.abs(TARGET.x) * 1.5,
        `dt=${dt} produced ${v.x}, larger than the step it was chasing`);
    }
  });

  test('a huge step goes straight to the answer, at rest', () => {
    const l = S.makeLag();
    l.step(TARGET, 1e6);
    assert.ok(Math.abs(l.value().x - TARGET.x) < 1e-9);
    assert.ok(Math.hypot(l.velocity().x, l.velocity().y) < 1e-9);
  });

  test('all three damping regimes are finite, including exactly critical', () => {
    // zeta = 1 divides by zero in the underdamped form. The branch exists
    // because a constant is a thing someone will edit later.
    for (const zeta of [0.0, 0.5, 0.999999999, 1, 1.0000001, 2, 5]) {
      const l = S.makeLag({ wn: 2 * Math.PI * 2.0, zeta });
      for (let i = 0; i < 200; i++) l.step(TARGET, 0.016);
      assert.ok(Number.isFinite(l.value().x), `NaN at zeta=${zeta}`);
    }
  });

  test('zero and negative frequency mean no lag rather than a crash', () => {
    for (const wn of [0, -1]) {
      const l = S.makeLag({ wn, zeta: 0.45 });
      l.step(TARGET, 0.016);
      assert.deepEqual(l.value(), { x: TARGET.x, y: 0 });
    }
  });
});

describe('settling needs velocity, and that is a bug fix not a tidy-up', () => {
  test('the body is ON the target mid-flight while still moving fast', () => {
    /* The exact moment a position-only settle test would fire. If the app had
       kept `error < SETTLE` it would reset the state and stop the frame loop
       here, and the rebound would never be drawn. */
    const l = S.makeLag();
    let caught = false;
    for (let i = 0; i < 400; i++) {
      l.step(TARGET, 0.002);
      if (l.error(TARGET) < 0.02) {
        const speed = Math.hypot(l.velocity().x, l.velocity().y);
        if (speed > 1) {
          caught = true;
          assert.equal(l.settled(TARGET, 0.02), false,
            'settled() called this arrived while the body was moving at ' +
            speed.toFixed(1) + ' m/s^3');
        }
      }
    }
    assert.ok(caught, 'the crossing never happened — this test proved nothing');
  });

  test('settled() does eventually say yes', () => {
    const l = S.makeLag();
    for (let i = 0; i < 2000; i++) l.step(TARGET, 0.002);
    assert.ok(l.settled(TARGET, 0.02), 'it has to finish, or the loop never stops');
  });

  test('reset zeroes velocity, because a scrub has no momentum to carry', () => {
    const l = S.makeLag();
    for (let i = 0; i < 40; i++) l.step(TARGET, 0.002);
    assert.ok(Math.abs(l.velocity().x) > 0.1, 'should be moving before the reset');
    l.reset({ x: 3, y: 2 });
    assert.deepEqual(l.value(), { x: 3, y: 2 });
    assert.deepEqual(l.velocity(), { x: 0, y: 0 });
    assert.ok(l.settled({ x: 3, y: 2 }, 1e-9), 'a scrub lands settled, by definition');
  });
});

describe('overshoot changes the route, never the destination', () => {
  test('every settled state is the unlagged one, for any damping', () => {
    for (const zeta of [0.2, 0.45, 0.8, 1.5]) {
      const l = S.makeLag({ wn: 2 * Math.PI * 2.0, zeta });
      for (let i = 0; i < 4000; i++) l.step(TARGET, 0.002);
      assert.ok(Math.abs(l.value().x - TARGET.x) < 1e-6,
        `zeta ${zeta} settled at ${l.value().x}, not ${TARGET.x}`);
      assert.ok(Math.hypot(l.velocity().x, l.velocity().y) < 1e-5);
    }
  });

  test('both axes move independently', () => {
    // x and y are two separate scalar systems; a bug coupling them would show
    // up as the lateral axis responding to a purely longitudinal step.
    const l = S.makeLag();
    for (let i = 0; i < 100; i++) l.step({ x: -7.85, y: 0 }, 0.002);
    assert.equal(l.value().y, 0, 'a fore-aft step moved the lateral axis');
  });
});
