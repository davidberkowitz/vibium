/**
 * Driver Load Path — M5 vibration channel tests.
 *
 * Two gating tests here, and they guard different things.
 *
 * The first is SEPARATION. The plan's failure-mode card says load transfer and
 * whole-body vibration are different mathematics and must not be merged. So the
 * test is not "does it compute" but "is it still separate": the vibration solver
 * must not touch the contact split, and changing the road class must not move a
 * single newton.
 *
 * The second is THE AXIS ASSIGNMENT. This project has already got Wk and Wd
 * backwards once, from a secondary source. The curves are asserted to be
 * unswappable: Wk must dominate at 8 Hz and Wd below 1 Hz, by margins no
 * plausible re-derivation could cross.
 *
 * What these tests do NOT do is validate the weighting curves against ISO's
 * published one-third-octave table. That table was behind an egress block, so
 * only the STRUCTURE is checked here. The provenance record says so, and this
 * comment says so, because a test file that looks thorough is its own way of
 * overclaiming.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/vehicle.js');
require('../../apps/loadpath/js/model/occupant.js');
require('../../apps/loadpath/js/model/contacts.js');
require('../../apps/loadpath/js/model/vibration.js');

const { LoadPathConstants: C, LoadPathOccupant: O, LoadPathContacts: K,
        LoadPathVibration: V } = globalThis;

describe('the weighting curves: structure, since the table was unreachable', () => {
  test('each curve peaks at exactly 1.0', () => {
    let pk = 0, pd = 0;
    for (let i = 0; i <= 3000; i++) {
      const f = 0.1 * Math.pow(1000, i / 3000);
      pk = Math.max(pk, V.Wk(f));
      pd = Math.max(pd, V.Wd(f));
    }
    assert.ok(Math.abs(pk - 1) < 1e-6, `Wk peak ${pk}`);
    assert.ok(Math.abs(pd - 1) < 1e-6, `Wd peak ${pd}`);
  });

  test('Wk peaks in the 4 to 12.5 Hz plateau, where a seated body is most sensitive', () => {
    let best = 0, at = 0;
    for (let i = 0; i <= 3000; i++) {
      const f = 0.1 * Math.pow(1000, i / 3000);
      if (V.Wk(f) > best) { best = V.Wk(f); at = f; }
    }
    assert.ok(at >= 4 && at <= 12.5, `Wk peaks at ${at.toFixed(2)} Hz`);
  });

  test('Wd peaks below 2 Hz', () => {
    let best = 0, at = 0;
    for (let i = 0; i <= 3000; i++) {
      const f = 0.1 * Math.pow(1000, i / 3000);
      if (V.Wd(f) > best) { best = V.Wd(f); at = f; }
    }
    assert.ok(at < 2, `Wd peaks at ${at.toFixed(2)} Hz`);
  });

  test('THE SWAP TEST: Wk and Wd cannot be exchanged without this going red', () => {
    // The documented failure of this project. At 8 Hz the vertical weighting is
    // near full strength and the horizontal one has rolled off by a factor of
    // four; below 1 Hz it is the other way round. No re-derivation of the
    // filters crosses these margins, so a swap is caught unambiguously.
    assert.ok(V.Wk(8) > 0.9, `Wk(8Hz) = ${V.Wk(8)}`);
    assert.ok(V.Wd(8) < 0.35, `Wd(8Hz) = ${V.Wd(8)}`);
    assert.ok(V.Wk(8) / V.Wd(8) > 3, 'Wk must dominate at 8 Hz');

    assert.ok(V.Wd(0.8) > 0.9, `Wd(0.8Hz) = ${V.Wd(0.8)}`);
    assert.ok(V.Wk(0.8) < 0.6, `Wk(0.8Hz) = ${V.Wk(0.8)}`);
    assert.ok(V.Wd(0.8) / V.Wk(0.8) > 1.8, 'Wd must dominate below 1 Hz');
  });

  test('the multiplying factors go on the right axes too', () => {
    // EQ 7's k values are separate from the curves and equally swappable.
    assert.equal(C.ISO2631.kVertical, 1.0);
    assert.equal(C.ISO2631.kHorizontal, 1.4);
    assert.ok(C.ISO2631.kHorizontal > C.ISO2631.kVertical,
      'horizontal is weighted MORE in the total value, not less');
  });

  test('Wk carries a 2x upward step and Wd carries none', () => {
    // The step is what puts the 4-12.5 Hz plateau twice as high as the sub-2 Hz
    // region. Wd has no step at all, so it is flat then falls.
    assert.ok(V.Wk(8) / V.Wk(1) > 1.8 && V.Wk(8) / V.Wk(1) < 2.4,
      `Wk step ratio ${(V.Wk(8) / V.Wk(1)).toFixed(2)}`);
    assert.ok(V.Wd(1) > 0.95, 'Wd is flat at unity at 1 Hz');
    assert.ok(V.WD_PARAMS.f5 === undefined, 'Wd must not define a step');
  });

  test('both curves are band-limited at 0.4 and 100 Hz', () => {
    assert.ok(V.Wk(0.05) < 0.05, 'Wk rolls off below the high-pass corner');
    assert.ok(V.Wd(0.05) < 0.12, 'Wd rolls off below the high-pass corner');
    assert.ok(V.Wk(400) < 0.02, 'Wk rolls off above the low-pass corner');
    assert.ok(V.Wd(400) < 0.02, 'Wd rolls off above the low-pass corner');
  });

  test('Wd falls at about -6 dB per octave above its knee', () => {
    const ratio = V.Wd(8) / V.Wd(4);
    assert.ok(ratio > 0.42 && ratio < 0.58, `octave ratio ${ratio.toFixed(3)}`);
  });
});

describe('the road and the ride path', () => {
  test('ISO 8608 classes step by a factor of four', () => {
    const r = C.ROAD.CLASSES;
    assert.ok(Math.abs(r.B.roughness / r.A.roughness - 4) < 1e-9);
    assert.ok(Math.abs(r.C.roughness / r.B.roughness - 4) < 1e-9);
    assert.ok(Math.abs(r.D.roughness / r.C.roughness - 4) < 1e-9);
    assert.ok(Math.abs(r.E.roughness / r.D.roughness - 4) < 1e-9);
  });

  test('road displacement PSD falls as 1/f^2 and rises with speed', () => {
    const g = (f, v) => V.roadDisplacementPSD(f, 16e-6, v);
    assert.ok(Math.abs(g(2, 20) / g(4, 20) - 4) < 1e-9, 'doubling f quarters the PSD');
    assert.ok(Math.abs(g(2, 40) / g(2, 20) - 2) < 1e-9, 'doubling speed doubles the PSD');
  });

  test('a stationary car has no road input at all', () => {
    const r = V.solve({ speed: 0, roadClass: 'E' });
    assert.equal(r.av, 0);
    assert.equal(r.awz, 0);
    assert.equal(r.comfort.label, 'not uncomfortable');
  });

  test('the quarter car produces a body mode near 1.3 Hz', () => {
    let best = 0, at = 0;
    for (let f = 0.3; f < 3; f += 0.005) {
      const p = V.quarterCarPower(f);
      if (p > best) { best = p; at = f; }
    }
    assert.ok(at > 1.0 && at < 1.6, `body mode at ${at.toFixed(2)} Hz`);
    assert.ok(best > 2, 'the body mode should amplify, not attenuate');
  });

  test('wheel hop lands where the quarter-car constants say it should', () => {
    // (1/2pi)*sqrt((ks + kt)/mu), and it has to land inside Wk's 4-12.5 Hz
    // plateau or the whole reason for modelling it disappears.
    const R = C.RIDE;
    const fHop = Math.sqrt((R.suspensionStiffness + R.tyreStiffness) / R.unsprungMass)
                 / (2 * Math.PI);
    assert.ok(fHop > 9 && fHop < 14, `wheel hop at ${fHop.toFixed(1)} Hz`);
    assert.ok(V.Wk(fHop) > 0.8,
      'wheel hop must sit where the vertical weighting is near full strength');
  });

  test('the wheel-hop resonance is really in the response, not just in the algebra', () => {
    /* Both of this milestone's first attempts at this test were NON-DIAGNOSTIC:
       deleting the unsprung mass left them both green. The thresholds below are
       set from the measured separation between the real model and a gutted one,
       not guessed:

                          hop band share   log-log slope 16-22 Hz
         mu = 40 kg            14.2%              -7.60
         mu -> 0                5.9%              -2.81

       The share test had been written at 5%, which the gutted model clears. The
       slope test compared 10-13 Hz against 16-22 Hz, and slopes steepen with
       frequency whether or not there is a resonance there, so it passed both
       ways. What actually discriminates is how HARD the response falls just
       above the hop frequency — only a resonance produces that. */
    const slope = (a, b) => Math.log(V.quarterCarPower(b) / V.quarterCarPower(a)) /
                            Math.log(b / a);
    const above = slope(16, 22);
    const through = slope(10, 13);
    assert.ok(above < -5,
      `post-resonance slope ${above.toFixed(2)} — too shallow to be a resonance`);
    assert.ok(above - through < -2,
      `slope steepens by only ${(above - through).toFixed(2)} across the hop`);

    const r = V.solve({ speed: 27.8, roadClass: 'C', points: 1200 });
    const hop = r.bands.find((b) => b.key === 'hop');
    assert.ok(hop.share > 0.10,
      `wheel-hop band carries ${(hop.share * 100).toFixed(1)}% — a model with no ` +
      'unsprung mass still shows about 6% here, so anything under 10% means the ' +
      'resonance is gone');
  });
});

describe('the evaluation', () => {
  test('weighting always removes energy, never adds it', () => {
    const r = V.solve({ speed: 27.8, roadClass: 'C' });
    assert.ok(r.awz < r.unweightedZ,
      'the weighted RMS must be below the raw RMS, since the curve peaks at 1.0');
  });

  test('rougher roads and higher speeds both raise the total', () => {
    const order = ['A', 'B', 'C', 'D', 'E'].map(
      (c) => V.solve({ speed: 27.8, roadClass: c }).av);
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i] > order[i - 1], `class ${i} not rougher than ${i - 1}`);
    }
    const slow = V.solve({ speed: 10, roadClass: 'C' }).av;
    const fast = V.solve({ speed: 30, roadClass: 'C' }).av;
    assert.ok(fast > slow);
  });

  test('roughness enters as a square root, because a PSD is a power', () => {
    // Four times the roughness coefficient is twice the RMS. A frequent error
    // is to treat the class step as a factor of four in m/s^2.
    const b = V.solve({ speed: 27.8, roadClass: 'B' }).av;
    const c = V.solve({ speed: 27.8, roadClass: 'C' }).av;
    assert.ok(Math.abs(c / b - 2) < 0.02, `ratio ${(c / b).toFixed(3)}, expected 2`);
  });

  test('EQ 7 combines the axes with the right k factors', () => {
    const r = V.solve({ speed: 27.8, roadClass: 'C' });
    const expected = Math.sqrt(
      1.4 * 1.4 * r.awx * r.awx + 1.4 * 1.4 * r.awy * r.awy + 1.0 * 1.0 * r.awz * r.awz);
    assert.ok(Math.abs(r.av - expected) < 1e-12);
    assert.ok(r.av > r.awz, 'the total value exceeds any single axis');
  });

  test('the horizontal share is reported, because it rests on a guess', () => {
    const r = V.solve({ speed: 27.8, roadClass: 'C' });
    assert.ok(r.horizontalShare > 0 && r.horizontalShare < 1);
    // 1.4x weighting on a 0.35 input ratio still buys the horizontal axes real
    // leverage over the headline. If this ever reads as negligible, the caveat
    // in the drawer has stopped matching the code.
    assert.ok(r.horizontalShare > 0.2,
      `horizontal share ${(r.horizontalShare * 100).toFixed(0)}% — the caveat assumes it matters`);
  });

  test('the comfort bands overlap, and both are reported', () => {
    // ISO's own scale lists 0.5-1.0 and 0.8-1.6, so 0.9 is in two at once.
    const two = V.comfort(0.9);
    assert.ok(two.overlapping, '0.9 m/s^2 should fall in two bands');
    assert.equal(two.bands.length, 2);
    const one = V.comfort(0.1);
    assert.equal(one.overlapping, false);
    assert.equal(one.label, 'not uncomfortable');
  });

  test('the comfort threshold matches the constant the rest of the app uses', () => {
    assert.equal(C.ISO2631.comfortThreshold, 0.315);
    assert.equal(V.comfort(0.314).label, 'not uncomfortable');
    assert.equal(V.comfort(0.316).label, 'a little uncomfortable');
  });

  test('the integration band is the ISO one', () => {
    const r = V.solve({ speed: 27.8, roadClass: 'C' });
    assert.ok(Math.abs(r.rows[0].f - C.ISO2631.bandLowHz) < 1e-9);
    assert.ok(Math.abs(r.rows[r.rows.length - 1].f - C.ISO2631.bandHighHz) < 1e-9);
  });

  test('the answer is converged, not an artefact of the grid', () => {
    // The integrand has two narrow resonant lobes. If 260 points is too coarse
    // the RMS would move when the grid is refined.
    const coarse = V.solve({ speed: 27.8, roadClass: 'C', points: 260 }).av;
    const fine = V.solve({ speed: 27.8, roadClass: 'C', points: 4000 }).av;
    assert.ok(Math.abs(fine - coarse) / fine < 0.01,
      `grid dependence ${(100 * Math.abs(fine - coarse) / fine).toFixed(2)}%`);
  });
});

describe('SEPARATION: vibration must not leak into the force solver', () => {
  test('the vibration solver returns no forces at all', () => {
    const r = V.solve({ speed: 27.8, roadClass: 'E' });
    const json = JSON.stringify(Object.keys(r));
    ['force', 'newton', 'contact', 'split', 'touchpoint'].forEach((word) => {
      assert.ok(!json.toLowerCase().includes(word),
        `vibration result exposes "${word}" — the channels are merging`);
    });
  });

  test('changing the road class moves no contact force by a single newton', () => {
    // The gating test for this milestone. Road roughness is a vibration input
    // and nothing else; if a comfort index ever reaches the arrows, this fails.
    const body = O.solve({
      bodyMass: C.OCCUPANTS.m50.mass,
      accel: O.vec(-4, 2, 0),
      gravity: O.gravityForGrade(0)
    });
    const base = K.solve(body.carOnBody);

    ['A', 'B', 'C', 'D', 'E'].forEach((cls) => {
      V.solve({ speed: 27.8, roadClass: cls });       // run it, discard it
      const after = K.solve(body.carOnBody);
      Object.keys(base.byTouchpoint).forEach((id) => {
        assert.equal(after.byTouchpoint[id].magnitude, base.byTouchpoint[id].magnitude,
          `${id} moved when the road class changed`);
      });
    });
  });

  test('vibration output is in m/s^2 and the split is in N — no shared units', () => {
    const r = V.solve({ speed: 27.8, roadClass: 'C' });
    // A crude but effective guard: a comfort value and a contact force differ by
    // three orders of magnitude, so anything that ever lets them be added shows
    // up immediately as an absurd number rather than a plausible one.
    assert.ok(r.av < 10, 'a comfort value in m/s^2 is a small number');
    const body = O.solve({
      bodyMass: C.OCCUPANTS.m50.mass, accel: O.vec(0, 0, 0),
      gravity: O.gravityForGrade(0)
    });
    assert.ok(K.solve(body.carOnBody).byTouchpoint.seat_pan.magnitude > 100,
      'a contact force in N is a large number');
  });
});

describe('provenance keeps up', () => {
  test('every M5 constant carries a record', () => {
    ['ROAD.classes', 'ISO2631.weightingFilters', 'ISO2631.normalisation',
     'ISO2631.comfortBands', 'RIDE.quarterCar', 'RIDE.seatMode', 'RIDE.validation']
      .forEach((key) => {
        assert.ok(C.PROVENANCE[key], `missing provenance for ${key}`);
      });
  });

  test('the chain says out loud that it was never validated end to end', () => {
    const rec = C.PROVENANCE['RIDE.validation'];
    assert.equal(rec.status, 'placeholder');
    assert.match(rec.caveat, /not about a car|never been compared/);
  });

  test('the weighting record admits the ISO table was not reachable', () => {
    assert.match(C.PROVENANCE['ISO2631.weightingFilters'].caveat, /NOT validated/);
  });
});
