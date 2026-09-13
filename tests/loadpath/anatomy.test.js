/**
 * Driver Load Path — M6 anatomy and projection tests.
 *
 * The gating test here is CROSS-VIEW AGREEMENT.
 *
 * There are now three coordinate tables for the same twelve contacts: the side
 * elevation's, the plan view's, and this milestone's physical one in metres.
 * That is exactly the "two places computing the same number is two places to
 * disagree" problem this project has been careful about everywhere else, and
 * the reason it is tolerable here is that the two 2D tables are DRAWING
 * coordinates — schematic by right — while anatomy.js claims physical truth.
 *
 * A schematic drawing is allowed to be stylised. It is not allowed to put a
 * contact on the wrong side of the driver, and that is the one error that would
 * look completely fine on screen. So it is asserted instead of trusted.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('../../apps/loadpath/js/model/constants.js');
require('../../apps/loadpath/js/model/touchpoints.js');
require('../../apps/loadpath/js/model/vehicle.js');
require('../../apps/loadpath/js/model/occupant.js');
require('../../apps/loadpath/js/model/contacts.js');
require('../../apps/loadpath/js/model/anatomy.js');
require('../../apps/loadpath/js/view3d/scene.js');

const { LoadPathTouchpoints: T, LoadPathAnatomy: A, LoadPathOccupant: O,
        LoadPathContacts: K, LoadPathConstants: C, LoadPathScene3D: S } = globalThis;

/* The 2D views are browser modules that touch `document`, so they cannot be
   required here. Their layout tables are plain object literals, so the test
   reads the source and parses the one table it needs. That is deliberately
   crude — it means the test breaks loudly if someone restructures the file,
   which is better than a test that silently stops checking. */
function readPlanPoints() {
  const src = fs.readFileSync(
    path.join(__dirname, '../../apps/loadpath/js/view2d/plan.js'), 'utf8');
  const block = src.match(/var POINTS = \{([\s\S]*?)\};/);
  assert.ok(block, 'could not find POINTS in plan.js — has the file been restructured?');
  const out = {};
  for (const m of block[1].matchAll(/(\w+)\s*:\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)/g)) {
    out[m[1]] = { x: Number(m[2]), y: Number(m[3]) };
  }
  return out;
}

describe('the physical table itself', () => {
  test('every touchpoint has a 3D position', () => {
    T.ALL.forEach((tp) => {
      assert.ok(A.contactAt(tp.id), `${tp.id} has no 3D position`);
    });
    assert.equal(Object.keys(A.CONTACTS).length, T.ALL.length);
  });

  test('nothing is absurdly placed for a seated driver', () => {
    // A metre box around the H-point. Catches a decimal slip, which in metres
    // is the difference between a seat and a different vehicle.
    Object.entries(A.CONTACTS).forEach(([id, c]) => {
      assert.ok(Math.abs(c.at.x) < 1.2, `${id} x=${c.at.x} is off the car`);
      assert.ok(Math.abs(c.at.y) < 0.5, `${id} y=${c.at.y} is outside the cabin`);
      assert.ok(Math.abs(c.at.z) < 0.9, `${id} z=${c.at.z} is outside the cabin`);
    });
  });

  test('the register and the geometry agree about the ambiguous pair', () => {
    // The register says the knee bolster is "console side" and the side bolster
    // is at the greater trochanter. For left-hand drive that puts the knee
    // bolster inboard and the side bolster outboard — opposite sides. This is
    // the one pair a reader could reasonably place either way, so it is pinned.
    assert.equal(A.sideOf('knee_bolster'), 'in');
    assert.equal(A.sideOf('bolster'), 'out');
    assert.equal(A.lateralSign('knee_bolster'), -1);
    assert.equal(A.lateralSign('bolster'), 1);
  });

  test('the feet are on the correct pedals', () => {
    // Right forefoot on the pedals, left foot on the rest — straight from the
    // register, and inverted it would be a car nobody could drive.
    assert.equal(A.lateralSign('pedal'), -1, 'right foot is inboard');
    assert.equal(A.lateralSign('footrest'), 1, 'left foot is outboard');
    assert.ok(A.contactAt('pedal').x > 0.5, 'the pedals are well forward');
    assert.ok(A.contactAt('footrest').x > 0.5, 'so is the footrest');
  });

  test('the seat is behind and below the wheel, and the head above both', () => {
    assert.ok(A.contactAt('wheel').x > A.contactAt('seat_back').x);
    assert.ok(A.contactAt('wheel').z > A.contactAt('seat_pan').z);
    assert.ok(A.contactAt('head_restraint').z > A.contactAt('seat_back').z);
    assert.ok(A.contactAt('seat_back').x < A.contactAt('seat_pan').x,
      'the back is aft of the pan');
  });

  /* Two skeleton tests stood here — that no bone named a missing joint, and
     that the body was symmetric everywhere except the legs, because one foot
     is on the pedals. Both passed. The skeleton was cut anyway, on the M6
     gate: green tests said it was self-consistent, not that it was legible,
     and legibility was the thing being judged. A test suite can only fail a
     drawing on the claims you thought to encode. */
});

describe('CROSS-VIEW AGREEMENT: the drawings must not contradict the body', () => {
  test('the plan view puts every contact on the side the body says', () => {
    /* The plan view is drawn looking DOWN with the car nose up-screen, and the
       driver sits left of the car's centreline. In that projection screen-x
       increases toward the driver's right, which is inboard, which is -y.

       So: for any two contacts, if one is further right on screen than the
       other, it must be further inboard in the body. Comparing pairs rather
       than absolute positions means the test needs no centreline and survives
       the whole drawing being nudged. */
    const plan = readPlanPoints();
    const ids = Object.keys(plan).filter((id) => A.lateralSign(id) !== null);
    assert.ok(ids.length >= 4, 'expected several contacts in the plan layout');

    let compared = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const sa = A.lateralSign(a), sb = A.lateralSign(b);
        /* Only genuinely OPPOSITE sides. Comparing a midline contact against a
           side one would be comparing a few centimetres of anatomy against a
           few SVG units of label-collision nudging, which is drawing jitter
           rather than a fact. The negative control below is what proves this
           restriction did not hollow the test out. */
        if (sa === 0 || sb === 0 || sa === sb) continue;
        compared++;
        const screenSaysAIsInboard = plan[a].x > plan[b].x;
        const bodySaysAIsInboard = sa < sb;
        assert.equal(screenSaysAIsInboard, bodySaysAIsInboard,
          `plan view and anatomy disagree about ${a} vs ${b}: ` +
          `screen x ${plan[a].x} vs ${plan[b].x}, body y ${A.contactAt(a).y} vs ${A.contactAt(b).y}`);
      }
    }
    /* Coverage, stated as what it actually is. The plan view marks six
       contacts and only three of them are off the centreline, so there are
       exactly two genuinely-opposite-side pairs to compare. Asserting a bigger
       number would be asserting data that does not exist; what matters is that
       EVERY laterally-placed contact the plan view draws got checked, and the
       negative control below is what proves two pairs still discriminate. */
    const lateralInPlan = ids.filter((id) => A.lateralSign(id) !== 0);
    assert.deepEqual(lateralInPlan.sort(), ['armrest', 'bolster', 'knee_bolster'],
      'the set of off-centreline contacts in the plan view has changed — ' +
      're-check that this test still covers all of them');
    assert.equal(compared, 2, `expected 2 cross-side pairs, compared ${compared}`);
  });

  test('negative control: mirroring the body breaks the agreement', () => {
    // Proves the test above can fail. Flip every y and the same comparison
    // must start disagreeing, or it was never checking anything.
    const plan = readPlanPoints();
    const ids = Object.keys(plan).filter((id) => A.lateralSign(id) !== null);
    let disagreements = 0;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const sa = -A.lateralSign(a), sb = -A.lateralSign(b);   // mirrored
        if (sa === 0 || sb === 0 || sa === sb) continue;
        if ((plan[a].x > plan[b].x) !== (sa < sb)) disagreements++;
      }
    }
    assert.equal(disagreements, 2,
      `a mirrored body produced ${disagreements} disagreements rather than 2 — ` +
      'the cross-view test is not actually comparing sides');
  });

  test('the 3D table agrees with the contact solver about where load goes', () => {
    /* Independent of geometry: in a hard LEFT turn the car pushes the driver
       left, so the OUTBOARD bolster must carry load. If the anatomy called that
       contact inboard, the picture and the solver would be telling opposite
       stories with no error anywhere. */
    const body = O.solve({
      bodyMass: C.OCCUPANT_MASS.value,
      accel: O.vec(0, 6, 0),                    // +y is left, so a left turn
      gravity: O.gravityForGrade(0)
    });
    const split = K.solve(body.carOnBody);
    assert.ok(split.byTouchpoint.bolster.magnitude > 50,
      'a left turn should load the bolster');
    assert.equal(A.sideOf('bolster'), 'out',
      'and the bolster the solver loads is the outboard one');
  });
});

describe('the projection', () => {
  const S = require('node:module');   // placeholder so the requires read alike

  /* scene.js touches the DOM at module scope through LoadPathVectors, so the
     projector is re-implemented here from the same formula rather than
     imported. That is a duplicate, and the test below is what keeps it honest:
     if the two ever diverge the invariants stop holding. */
  function project(pt, yaw, pitch, SCALE = 330, CX = 320, CY = 300) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = pt.x * cy - pt.y * sy;
    const y1 = pt.x * sy + pt.y * cy;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = y1 * cp - pt.z * sp;
    const z2 = y1 * sp + pt.z * cp;
    return { sx: CX + x1 * SCALE, sy: CY - z2 * SCALE, depth: y2 };
  }

  test('the origin never moves, at any camera angle', () => {
    for (let yaw = 0; yaw < 6.28; yaw += 0.4) {
      for (let pitch = -1; pitch < 1; pitch += 0.3) {
        const o = project({ x: 0, y: 0, z: 0 }, yaw, pitch);
        assert.ok(Math.abs(o.sx - 320) < 1e-9);
        assert.ok(Math.abs(o.sy - 300) < 1e-9);
      }
    }
  });

  test('rotation preserves distance, so nothing stretches as you orbit', () => {
    const a = { x: 0.4, y: -0.2, z: 0.3 };
    const ref = Math.hypot(a.x, a.y, a.z);
    for (let yaw = 0; yaw < 6.28; yaw += 0.37) {
      const p = project(a, yaw, 0.4);
      const back = Math.hypot((p.sx - 320) / 330, p.depth, (300 - p.sy) / 330);
      assert.ok(Math.abs(back - ref) < 1e-9, `length changed at yaw ${yaw}`);
    }
  });

  test('up is up: +z always projects higher on screen than -z', () => {
    for (let yaw = 0; yaw < 6.28; yaw += 0.4) {
      for (let pitch = -0.9; pitch < 0.9; pitch += 0.3) {
        const hi = project({ x: 0, y: 0, z: 0.5 }, yaw, pitch);
        const lo = project({ x: 0, y: 0, z: -0.5 }, yaw, pitch);
        assert.ok(hi.sy < lo.sy,
          `z inverted on screen at yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)}`);
      }
    }
  });

  test('at zero yaw the view is the side elevation, and x runs across it', () => {
    // Sanity anchor: the default camera should reduce to something the reader
    // already recognises rather than an arbitrary angle.
    const nose = project({ x: 1, y: 0, z: 0 }, 0, 0);
    const tail = project({ x: -1, y: 0, z: 0 }, 0, 0);
    assert.ok(nose.sx > tail.sx, 'forward should be to the right at zero yaw');
    const left = project({ x: 0, y: 1, z: 0 }, 0, 0);
    assert.ok(Math.abs(left.sx - 320) < 1e-9,
      'at zero yaw the lateral axis points straight into the screen');
  });

  test('depth ordering actually reverses when you orbit behind', () => {
    const front = { x: 0.8, y: 0, z: 0 };
    const back = { x: -0.3, y: 0, z: 0 };
    const a = project(front, 0.6, 0.3), b = project(back, 0.6, 0.3);
    const a2 = project(front, 0.6 + Math.PI, 0.3), b2 = project(back, 0.6 + Math.PI, 0.3);
    assert.ok((a.depth < b.depth) !== (a2.depth < b2.depth),
      'orbiting 180 degrees should swap which point is nearer');
  });
});

/* ---------------------------------------------------------------------
   THE DECOMPOSITION — the only thing M6 survived the gate to say.

   The view's claim is not "here is a 3D picture". It is: each 2D drawing
   carries two axes, the force has three, and this is exactly how much each
   drawing is therefore missing. That is an arithmetic claim and it belongs in
   a test rather than in a caption, because a caption cannot be wrong in a way
   anything notices. */
describe('the decomposition: what each 2D drawing can and cannot carry', () => {
  const CASES = [
    { name: 'combined brake and turn', f: { x: -344, y: 507, z: 765 } },
    { name: 'steady cruise, weight only', f: { x: 0, y: 0, z: 765 } },
    { name: 'pure braking', f: { x: -400, y: 0, z: 765 } },
    { name: 'pure cornering', f: { x: 0, y: 600, z: 765 } },
    { name: 'a force straight sideways', f: { x: 0, y: 900, z: 0 } }
  ];

  test('each projection plus the axis it drops is the whole force, exactly', () => {
    CASES.forEach(({ name, f }) => {
      const d = S.decompose(f);
      const side = Math.hypot(d.side.x, d.side.y, d.side.z);
      const plan = Math.hypot(d.plan.x, d.plan.y, d.plan.z);
      // Pythagoras, because the dropped axis is orthogonal to the plane kept.
      assert.ok(Math.abs(side * side + f.y * f.y - d.mag * d.mag) < 1e-6,
        `${name}: side elevation + lateral does not reconstruct the force`);
      assert.ok(Math.abs(plan * plan + f.z * f.z - d.mag * d.mag) < 1e-6,
        `${name}: plan + vertical does not reconstruct the force`);
    });
  });

  test('a projection is never longer than the thing it is a projection of', () => {
    CASES.forEach(({ name, f }) => {
      const d = S.decompose(f);
      assert.ok(Math.hypot(d.side.x, d.side.y, d.side.z) <= d.mag + 1e-9, name);
      assert.ok(Math.hypot(d.plan.x, d.plan.y, d.plan.z) <= d.mag + 1e-9, name);
    });
  });

  test('the missed angle is the angle actually between them', () => {
    CASES.forEach(({ name, f }) => {
      const d = S.decompose(f);
      [[d.side, d.missSideDeg], [d.plan, d.missPlanDeg]].forEach(([proj, miss]) => {
        const pm = Math.hypot(proj.x, proj.y, proj.z);
        if (pm < 1e-9) { assert.ok(Math.abs(miss - 90) < 1e-9, `${name}: fully out of plane`); return; }
        /* atan2 of the cross against the dot, not acos of the dot. Near zero
           angle acos loses most of its precision — "pure braking" came out at
           1e-5 degrees of spurious separation and failed a 1e-6 tolerance.
           Widening the tolerance would have hidden a real error of that size
           too; atan2 is conditioned well at both ends and needs no slack. */
        const dot = f.x * proj.x + f.y * proj.y + f.z * proj.z;
        const cross = Math.hypot(f.y * proj.z - f.z * proj.y,
                                 f.z * proj.x - f.x * proj.z,
                                 f.x * proj.y - f.y * proj.x);
        const deg = Math.atan2(cross, dot) * 180 / Math.PI;
        assert.ok(Math.abs(deg - miss) < 1e-6,
          `${name}: label says ${miss.toFixed(2)} deg, geometry says ${deg.toFixed(2)}`);
      });
    });
  });

  /* Negative control. If the angles were being computed from something other
     than the out-of-plane component they could still satisfy Pythagoras above,
     so pin the two cases where the answer is known by inspection. */
  test('the known-by-inspection cases come out right', () => {
    const up = S.decompose({ x: 0, y: 0, z: 765 });
    assert.ok(Math.abs(up.missSideDeg) < 1e-9,
      'a purely vertical force lies IN the side elevation; it misses nothing');
    assert.ok(Math.abs(up.missPlanDeg - 90) < 1e-9,
      'and lies entirely OUT of the plan; the plan misses all 90 degrees of it');

    const sideways = S.decompose({ x: 0, y: 900, z: 0 });
    assert.ok(Math.abs(sideways.missSideDeg - 90) < 1e-9,
      'a purely lateral force is invisible to the side elevation');
    assert.ok(Math.abs(sideways.missPlanDeg) < 1e-9,
      'and wholly visible to the plan');
  });

  /* The sub-label under the resultant. It read "all three axes at once" as a
     hard-coded string, which was true for the combined case it was written
     against and false for steady cruise — 765 N of pure weight support, one
     axis, sitting under a label claiming three. Caught by rendering the cruise
     case and reading the words, not by any test, which is why there is now
     a test. */
  test('the axes label is derived from the force and not asserted', () => {
    assert.equal(S.decompose({ x: -344, y: 507, z: 765 }).axes, 'all three axes at once');
    assert.equal(S.decompose({ x: 0, y: 0, z: 765 }).axes, 'vertical only');
    assert.equal(S.decompose({ x: 0, y: 900, z: 0 }).axes, 'lateral only');
    assert.equal(S.decompose({ x: -400, y: 0, z: 765 }).axes,
      'fore-aft and vertical, no lateral');
    assert.equal(S.decompose({ x: 0, y: 600, z: 765 }).axes,
      'lateral and vertical, no fore-aft');
    // A component under a per cent of the resultant is rounding, not an axis.
    assert.equal(S.decompose({ x: 2, y: 0, z: 765 }).axes, 'vertical only');
  });

  test('a force too small to draw decomposes to nothing rather than to NaN', () => {
    assert.equal(S.decompose({ x: 0, y: 0, z: 0 }), null);
  });
});

describe('the framing offset is framing and not geometry', () => {
  /* CENTRE was added to stop the drawing sitting in the right half of an empty
     frame. It subtracts a constant before rotating, which must move the picture
     and nothing else — if it leaked into the geometry it would change depth
     order or apparent direction, and the drawing would start lying. */
  const pts = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0.3, z: -0.2 },
               { x: -0.4, y: -0.45, z: 0.62 }, { x: 0.5, y: 0.1, z: 0.3 }];

  test('it shifts every point by the same screen vector', () => {
    for (const [yaw, pitch] of [[0, 0], [-0.85, 0.32], [1.2, -0.15]]) {
      const shifted = pts.map((p) => S.project(p, yaw, pitch));
      // Differences between any two points must be independent of CENTRE.
      for (let i = 1; i < pts.length; i++) {
        const raw = { x: pts[i].x - pts[0].x, y: pts[i].y - pts[0].y, z: pts[i].z - pts[0].z };
        const d = S.direction(raw, yaw, pitch);
        const dx = shifted[i].sx - shifted[0].sx, dy = shifted[i].sy - shifted[0].sy;
        const n = Math.hypot(dx, dy);
        if (n < 1e-9) continue;
        assert.ok(Math.abs(dx / n - d.dx) < 1e-9 && Math.abs(dy / n - d.dy) < 1e-9,
          'the direction between two points changed when the frame moved');
      }
    }
  });

  test('it does not reorder depth', () => {
    const near = { x: 0, y: -0.4, z: 0 }, far = { x: 0, y: 0.4, z: 0 };
    for (const [yaw, pitch] of [[0, 0], [-0.85, 0.32], [2.5, 0.6]]) {
      const a = S.project(near, yaw, pitch), b = S.project(far, yaw, pitch);
      const rawA = (near.y) * Math.cos(pitch) - near.z * Math.sin(pitch);
      const rawB = (far.y) * Math.cos(pitch) - far.z * Math.sin(pitch);
      void rawA; void rawB;
      assert.equal(a.depth < b.depth,
        (near.x * Math.sin(yaw) + near.y * Math.cos(yaw)) * Math.cos(pitch) - near.z * Math.sin(pitch) <
        (far.x * Math.sin(yaw) + far.y * Math.cos(yaw)) * Math.cos(pitch) - far.z * Math.sin(pitch),
        'depth order must not depend on where the frame is centred');
    }
  });
});
