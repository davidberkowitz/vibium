/* Driver Load Path — M7. Occupant mass as an input.
 *
 * Two things are on trial here and they are different in kind.
 *
 * The first is ARITHMETIC: what does changing mass actually do? The tempting
 * answer, and the one this milestone nearly asserted before measuring, is
 * "everything scales". It is half right, and the wrong half is the interesting
 * one. Demand scales exactly — twice the body, twice the newtons. The SPLIT
 * does not, because the bracing caps in contacts.js are absolute newtons and
 * not fractions of body mass: a heavier person does not arrive with
 * proportionally stronger arms. So there is a mass where the braced channels
 * saturate, the driver runs out, and the webbing takes up. That threshold is
 * the thing M7 exists to show.
 *
 * The second is HONESTY, and it is enforced rather than intended. Three presets
 * used to name a sex and a percentile while multiplying one sample of nine male
 * cadavers. The labels are gone. A test keeps them gone, because the next
 * person to add a nice-sounding preset will not have read the provenance record.
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/touchpoints.js');
require('../../apps/loadpath/js/model/vehicle.js');
require('../../apps/loadpath/js/model/occupant.js');
require('../../apps/loadpath/js/model/contacts.js');

const { LoadPathConstants: C, LoadPathVehicle: V,
        LoadPathOccupant: O, LoadPathContacts: K } = globalThis;

const APP = path.join(__dirname, '../../apps/loadpath');

/* One maneuver, reused: braking while turning, the case that puts load into
   every channel at once. */
function accelFor({ brake = 0.45, steer = 0.05, speed = 25 } = {}) {
  return V.solve({ speed, steerAngle: steer, ax: -brake * C.G,
                   mu: C.SURFACES.dry.mu, gradePercent: 0 }, C.VEHICLES.sedan).accel;
}
function splitAt(mass, a) {
  return K.solve(O.solve({ bodyMass: mass, accel: O.vec(a.x, a.y, 0),
                           gravity: O.gravityForGrade(0) }).carOnBody);
}
function load(split, id) {
  return split.byTouchpoint[id] ? split.byTouchpoint[id].magnitude : 0;
}
function thresholdFor(a) {
  return K.bracingThreshold({
    min: C.OCCUPANT_MASS.min, max: C.OCCUPANT_MASS.max,
    requiredForMass: (m) => O.solve({ bodyMass: m, accel: O.vec(a.x, a.y, 0),
                                      gravity: O.gravityForGrade(0) }).carOnBody
  });
}

describe('what mass does to the DEMAND: exactly linear', () => {
  test('newtons per kilogram is the same at every mass', () => {
    const a = accelFor();
    const perKg = [];
    for (let m = C.OCCUPANT_MASS.min; m <= C.OCCUPANT_MASS.max; m += 5) {
      const f = O.solve({ bodyMass: m, accel: O.vec(a.x, a.y, 0),
                          gravity: O.gravityForGrade(0) }).carOnBody;
      perKg.push(Math.hypot(f.x, f.y, f.z) / m);
    }
    const spread = Math.max(...perKg) - Math.min(...perKg);
    assert.ok(spread < 1e-9,
      `total demand should scale exactly with mass; per-kg spread was ${spread}`);
  });
});

describe('what mass does to the SPLIT: not linear, and that is the point', () => {
  test('there is a bracing threshold, and it is sharp', () => {
    const a = accelFor();
    const t = thresholdFor(a);
    assert.ok(t && !t.atFloor, 'the combined maneuver should have a threshold in range');

    const below = splitAt(t.mass - 1, a);
    const above = splitAt(t.mass + 1, a);
    assert.equal(below.slackEngaged, false, 'a kilo below, the belts are slack');
    assert.equal(above.slackEngaged, true, 'a kilo above, they are engaged');
    // Sharp, not gradual: the shoulder belt goes from carrying nothing to
    // carrying hundreds of newtons across two kilograms.
    assert.ok(load(below, 'shoulder_belt') < 1,
      'below the threshold the shoulder belt carries nothing');
    assert.ok(load(above, 'shoulder_belt') > 200,
      'above it the belt takes a large share immediately');
  });

  test('crossing it moves load from muscle to structure', () => {
    const a = accelFor();
    const t = thresholdFor(a);
    const below = splitAt(t.mass - 1, a);
    const above = splitAt(t.mass + 1, a);
    // The braced channels do not merely stop growing, they give way: once the
    // webbing carries the body the legs no longer have to.
    assert.ok(load(above, 'footrest') < load(below, 'footrest'),
      'the footrest unloads when the belt takes over');
    assert.ok(load(above, 'pedal') < load(below, 'pedal'),
      'so does the pedal');
    // ...while the total is larger, because the occupant is heavier.
    const sum = (s) => s.channels.reduce((n, ch) => n + ch.magnitude, 0);
    assert.ok(sum(above) > sum(below), 'the total still grew with mass');
  });

  /* Sweeping a continuous input at 0.1 kg is the first time anything has asked
     the contact solver the same question nine hundred times in a row, and it
     turned up something worth writing down.

     The split re-sums everywhere, comfortably inside the 1e-5 N the plan
     claims. But convergence is NOT uniform: about 4% of masses land near 1e-6
     rather than the 1e-12 that is typical. Thirty-nine of those forty samples
     have two or more channels sitting exactly at their caps, which is the
     stall contacts.js documents and predicts — rank loss in the generalised
     Hessian, the active set chattering, the loop giving up at about 1e-6 N.

     One is not. At the light end the solver exits after a SINGLE iteration
     with nothing saturated at all, and it produces the worst residual of the
     whole sweep. The comment in contacts.js does not cover that case. It is
     six micronewtons on a load of five hundred, so it is recorded rather than
     chased — but the code's stated cause is not the whole story, and saying so
     is cheaper than someone later trusting it.

     So this asserts two things: the published bound holds everywhere, and the
     stall stays RARE. A loose bound alone would pass just as happily if the
     solver degraded across the board. */
  test('the split re-sums everywhere, and the known stall stays rare', () => {
    const a = accelFor();
    let n = 0, coarse = 0, worst = 0, worstAt = 0;
    for (let m = C.OCCUPANT_MASS.min; m <= C.OCCUPANT_MASS.max; m += 0.1) {
      const s = splitAt(m, a);
      assert.ok(s.feasible, `${m} kg was infeasible`);
      n++;
      if (s.residual > worst) { worst = s.residual; worstAt = m; }
      if (s.residual > 1e-9) coarse++;
    }
    assert.ok(worst < 1e-5,
      `worst residual ${worst.toExponential(2)} N at ${worstAt} kg exceeds the ` +
      '1e-5 N the plan claims across the envelope');
    assert.ok(coarse / n < 0.10,
      `${(100 * coarse / n).toFixed(1)}% of masses converged only to ~1e-6; ` +
      'that was 4.4% when M7 measured it, and a jump means the solver has ' +
      'degraded generally rather than stalling at the cap-degenerate points');
  });

  test('above the threshold, belt load rises monotonically with mass', () => {
    const a = accelFor();
    const t = thresholdFor(a);
    let last = -Infinity;
    for (let m = Math.ceil(t.mass) + 1; m <= C.OCCUPANT_MASS.max; m += 1) {
      const f = load(splitAt(m, a), 'shoulder_belt');
      assert.ok(f >= last - 1e-9, `belt load fell between ${m - 1} and ${m} kg`);
      last = f;
    }
  });
});

describe('the threshold is a property of the maneuver, not of the occupant', () => {
  test('a harder maneuver runs the driver out sooner', () => {
    const soft = thresholdFor(accelFor({ brake: 0.40, steer: 0.05 }));
    const hard = thresholdFor(accelFor({ brake: 0.55, steer: 0.05 }));
    assert.ok(soft && hard, 'both should have thresholds in range');
    assert.ok(hard.mass < soft.mass,
      'braking harder should exhaust the bracing budget at a lower mass');
  });

  test('a gentle cruise has no threshold at all, and says so', () => {
    assert.equal(thresholdFor(accelFor({ brake: 0, steer: 0, speed: 25 })), null,
      'nothing should be invented at the end of the range');
  });

  test('a violent stop belts the lightest occupant there is', () => {
    const t = thresholdFor(accelFor({ brake: 0.9, steer: 0 }));
    assert.ok(t && t.atFloor, 'a 0.9 g stop should engage the belts at any mass');
  });

  /* Negative control for the whole mechanism. The threshold exists ONLY
     because the caps are absolute. Make them proportional to body mass — the
     physically wrong assumption this milestone is built on rejecting — and the
     threshold must vanish, because then everything scales together. */
  test('the threshold comes from absolute caps, not from somewhere else', () => {
    const a = accelFor();
    const real = K.CHANNELS.map((c) => c.cap);
    const REF = 78;
    try {
      let engagedAnywhere = false;
      for (let m = C.OCCUPANT_MASS.min; m <= C.OCCUPANT_MASS.max; m += 2) {
        K.CHANNELS.forEach((c, i) => {
          c.cap = Number.isFinite(real[i]) ? real[i] * (m / REF) : real[i];
        });
        if (splitAt(m, a).slackEngaged) engagedAnywhere = true;
      }
      assert.equal(engagedAnywhere, false,
        'with caps proportional to mass the belts should never engage — ' +
        'if they still do, the threshold is not caused by what M7 claims');
    } finally {
      K.CHANNELS.forEach((c, i) => { c.cap = real[i]; });
    }
    // and the real caps must be back, or every later test is running on a lie
    assert.equal(K.CHANNELS[0].cap, real[0]);
  });
});

describe('a scenario must not silently swap the occupant', () => {
  /* Found by looking at a screenshot, not by a test: the slider read 110 kg and
     the header read 78, because loading a preset replaced the whole input
     object and a scenario timeline carries only the channels a driver
     operates. The solve was using 78 too, so every force on screen belonged to
     a different occupant than the control claimed.

     app.js stamps the occupant back on at both entry points. This asserts the
     invariant that fix exists to hold: a timeline never carries bodyMass, so
     anything merging it must supply it — and the four presets must stay that
     way, because the day one of them starts carrying a mass it will silently
     override the user's slider. */
  const S = (() => {
    require('../../apps/loadpath/js/model/scenarios.js');
    return globalThis.LoadPathScenarios;
  })();

  test('no preset timeline carries an occupant mass', () => {
    const presets = S.PRESETS || S.SCENARIOS || S.ALL;
    assert.ok(presets, 'could not find the preset list to check');
    const list = Array.isArray(presets) ? presets : Object.values(presets);
    assert.ok(list.length >= 4, `expected the four presets, saw ${list.length}`);
    for (const p of list) {
      const json = JSON.stringify(p);
      assert.ok(!/bodyMass|occupant/i.test(json),
        `preset ${p.id || p.name} carries an occupant; it would override the slider`);
    }
  });

  test('sampling a preset yields inputs with no bodyMass, so the app must add it', () => {
    const presets = S.PRESETS || S.SCENARIOS || S.ALL;
    const list = Array.isArray(presets) ? presets : Object.values(presets);
    const sample = S.sample || S.at || S.inputsAt;
    if (typeof sample !== 'function') return;   // shape differs; the check above still holds
    for (const p of list) {
      const got = sample(p, 0);
      assert.equal(got.bodyMass, undefined,
        'if a timeline starts producing bodyMass, app.js must stop stamping it');
    }
  });
});

describe('the occupant control does not claim a body type', () => {
  /* The M0 finding, finally enforced. Dempster's fractions come from nine male
     cadavers; changing the total mass does not change the proportions. Any
     user-facing string that names a sex or a percentile for the occupant is
     therefore claiming something the model cannot support. */
  const FILES = ['js/model/constants.js', 'js/ui/controls.js', 'js/app.js',
                 'js/m0-report.js', 'index.html'];
  // Matches a claim, not a discussion of one: the provenance record and the
  // code comments explain WHY these words are gone and must stay readable.
  const CLAIM = /(\d+(st|nd|rd|th)\s+percentile|percentile\s+(male|female))/i;

  /* Comments are stripped before scanning, and that is the whole design of this
     test rather than a convenience. The first version matched line by line and
     immediately flagged three lines of the very comments that explain WHY the
     labels were retired — a guard that punishes documenting the fix is worse
     than no guard. What must never come back is a string a READER can see. So
     the target is code and markup with the prose removed: explain the history
     at any length, just do not ship the claim. */
  function stripComments(text, isHtml) {
    let t = text.replace(/\/\*[\s\S]*?\*\//g, ' ');
    if (isHtml) t = t.replace(/<!--[\s\S]*?-->/g, ' ');
    return t.split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  }

  test('no source file offers a percentile or a sex as an occupant label', () => {
    const offenders = [];
    for (const rel of FILES) {
      const raw = fs.readFileSync(path.join(APP, rel), 'utf8');
      stripComments(raw, rel.endsWith('.html')).split('\n').forEach((line, i) => {
        if (CLAIM.test(line)) offenders.push(`${rel}:${i + 1}  ${line.trim()}`);
      });
    }
    assert.deepEqual(offenders, [],
      'an occupant label is claiming a percentile or a sex again:\n' + offenders.join('\n'));
  });

  test('stripping comments does not disarm the guard', () => {
    // Negative control on the stripper itself: a live label survives it, and
    // is therefore still caught.
    const code = "/* explains 5th percentile female history */\nlabel: '5th percentile female',";
    const left = stripComments(code, false);
    assert.ok(!/history/.test(left), 'the comment should be gone');
    assert.ok(CLAIM.test(left), 'the live label must still be caught');
  });

  test('the guard can actually fail', () => {
    // Negative control: the regex has to catch the exact string that was there.
    assert.ok(CLAIM.test("f05: { label: '5th percentile female', mass: 49 }"));
    assert.ok(CLAIM.test('50th percentile male'));
    assert.ok(!CLAIM.test("{ label: '78 kg', mass: 78 }"));
  });

  test('the mass range is wide enough to be worth dragging', () => {
    const a = accelFor();
    const t = thresholdFor(a);
    assert.ok(t.mass > C.OCCUPANT_MASS.min + 5 && t.mass < C.OCCUPANT_MASS.max - 5,
      'the slider should cross the threshold with room on both sides, or the ' +
      'one thing mass changes qualitatively sits at the end of the range');
  });
});
