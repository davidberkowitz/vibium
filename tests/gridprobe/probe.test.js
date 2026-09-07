/**
 * Grid Probe Tests: distortion model, grid geometry, blind-spot measurement.
 * Pure logic from apps/gridprobe — no browser needed.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

require('../../apps/gridprobe/js/distort.js');
require('../../apps/gridprobe/js/grid.js');
require('../../apps/gridprobe/js/analyze.js');

const { Distort, Grid, Analyze } = globalThis;

const W = 1440, H = 900;
const NORM = Math.hypot(W, H) / 2;

function lens(k1, k2) {
  return new Distort({ k1, k2: k2 || 0, norm: NORM, cx: W / 2, cy: H / 2 });
}

function mapFor(k1, form = 'square', extra = {}) {
  const d = lens(k1);
  return Analyze.gapMap(Object.assign({
    width: W, height: H, cx: W / 2, cy: H / 2, distort: d,
    form, gridOpts: { pitch: 48, spokes: 12 }, cell: 12, radii: 128
  }, extra));
}

describe('Distortion model', () => {
  test('no distortion is the identity map', () => {
    const d = lens(0);
    assert.ok(d.identity());
    assert.equal(d.inverseRadius(0.43), 0.43);
    assert.deepEqual(d.forward(120, -60), { x: 120, y: -60 });
  });

  test('inverse undoes forward across the frame', () => {
    for (const [k1, k2] of [[0.3, 0], [0.15, 0.08], [-0.12, 0.03], [0.5, -0.2]]) {
      const d = lens(k1, k2);
      for (const ru of [0.05, 0.25, 0.5, 0.75, 1.0]) {
        const back = d.inverseRadius(d.radial(ru));
        assert.ok(Math.abs(back - ru) < 1e-6,
          `k1=${k1} k2=${k2} ru=${ru} round-tripped to ${back}`);
      }
    }
  });

  test('pincushion spreads the periphery, barrel crowds it', () => {
    assert.ok(lens(0.3).radial(1) > 1, 'pincushion pushes the corner out');
    assert.ok(lens(-0.3).radial(0.8) < 0.8, 'barrel pulls the corner in');
    assert.equal(lens(0.3).radial(0), 0, 'the optical centre never moves');
  });

  test('strong barrel folds, and the fold bounds the image circle', () => {
    const d = lens(-0.5);
    const limit = d.monotoneLimit();
    assert.ok(isFinite(limit) && limit > 0);
    assert.ok(Number.isNaN(d.inverseRadius(d.imageRadius() / NORM + 0.05)),
      'nothing maps beyond the image circle');
    assert.ok(d.idealExtent(NORM) <= limit * NORM + 1e-9,
      'the drawn grid never runs past the fold');
    assert.ok(isFinite(lens(0.3).monotoneLimit()) === false,
      'pincushion never folds');
  });

  test('the two stretches differ, which is why the worst case takes the larger', () => {
    const d = lens(0.3);
    assert.ok(d.radialScale(0.8) > d.tangentialScale(0.8));
    assert.ok(Analyze.worstStretch(d, 0.8) === d.radialScale(0.8));
    assert.equal(Analyze.worstStretch(lens(0), 0.8), 1);
  });
});

describe('Grid forms', () => {
  test('a point on a line is zero from the grid, a cell centre is the nominal gap', () => {
    const fams = Grid.families('square', 0, { pitch: 60 });
    assert.equal(Grid.distance(fams, 0, 0), 0);
    assert.equal(Grid.distance(fams, 120, 60), 0);
    assert.ok(Math.abs(Grid.distance(fams, 30, 30) - 30) < 1e-9);
  });

  test('no form leaves a gap wider than its nominal', () => {
    for (const form of ['square', 'triangular', 'polar', 'moire']) {
      const opts = { pitch: 60, spokes: 12 };
      const nominal = Grid.nominalGap(form, opts);
      const fams = Grid.families(form, 17, opts);
      let worst = 0;
      for (let x = -400; x <= 400; x += 3) {
        for (let y = -400; y <= 400; y += 3) {
          worst = Math.max(worst, Grid.distance(fams, x, y));
        }
      }
      assert.ok(worst <= nominal + 1e-6, `${form}: found ${worst} against nominal ${nominal}`);
    }
  });

  test('a triangular grid is tighter than a square one at the same pitch', () => {
    assert.ok(Grid.nominalGap('triangular', { pitch: 60 }) < Grid.nominalGap('square', { pitch: 60 }));
  });

  test('rotation turns the grid rather than reshaping it', () => {
    const opts = { pitch: 50 };
    const a = Grid.families('square', 0, opts);
    const b = Grid.families('square', 37, opts);
    const t = 37 * Math.PI / 180;
    const x = 133, y = -71;
    const rx = x * Math.cos(t) + y * Math.sin(t);      // the point, turned back
    const ry = -x * Math.sin(t) + y * Math.cos(t);
    assert.ok(Math.abs(Grid.distance(b, x, y) - Grid.distance(a, rx, ry)) < 1e-9);
  });

  test('polylines cover the requested extent and follow the pitch', () => {
    const paths = Grid.polylines(Grid.families('square', 0, { pitch: 100 }), 200, 1e9);
    assert.equal(paths.length, 10);     // 5 offsets per family, two families
    paths.forEach((p) => assert.ok(p.length >= 6));
  });
});

describe('Blind-spot measurement', () => {
  test('the sweep profile saturates at the form nominal', () => {
    for (const form of ['square', 'triangular', 'polar', 'moire']) {
      const opts = { pitch: 48, spokes: 12 };
      const p = Analyze.sweepProfile(form, opts, 700, 128);
      const nominal = Grid.nominalGap(form, opts);
      assert.equal(p.raw[0], 0, `${form}: the centre of rotation sits on a crossing`);
      assert.ok(p.values[0] < 0.8 * nominal, `${form}: the middle stays the tightest spot`);
      assert.ok(p.values[p.steps] <= nominal + 1e-9, `${form}: never wider than nominal`);
      assert.ok(p.values[p.steps] > nominal * 0.9, `${form}: reaches nominal out at the rim`);
    }
  });

  test('the raw sweep is banded, and widening irons the bands out', () => {
    const p = Analyze.sweepProfile('square', { pitch: 48 }, 700, 256);
    const dip = (v) => {
      let worst = 0;
      for (let i = 1; i <= p.steps; i++) worst = Math.max(worst, (v[i - 1] - v[i]) / p.nominal);
      return worst;
    };
    // whether a circle threads through cell centres is arithmetic, not optics
    assert.ok(dip(p.raw) > 0.1, `expected real banding, saw ${dip(p.raw)}`);
    assert.ok(dip(p.values) < 0.05, `bands survived widening: ${dip(p.values)}`);
    assert.ok(p.values[p.steps] > 0.98 * p.nominal, 'and the rim still reaches nominal');
  });

  test('an undistorted grid scores ×1 and raises no alarm', () => {
    const m = mapFor(0);
    assert.ok(m.max <= 1.001, `max was ${m.max}`);
    assert.ok(m.max > 0.95, 'and it does reach 1 somewhere');
    assert.equal(m.overFraction, 0);
    assert.equal(m.unmappedFraction, 0);
  });

  test('pincushion opens blind spots; barrel does not', () => {
    const pin = mapFor(0.35);
    const barrel = mapFor(-0.2);
    assert.ok(pin.max > 1.5, `pincushion should blow past nominal, got ${pin.max}`);
    assert.ok(pin.overFraction > 0.02, 'and over a real slice of the frame');
    assert.ok(barrel.max <= 1.001, `barrel only crowds, got ${barrel.max}`);
    assert.ok(barrel.unmappedFraction > 0, 'but it leaves corners with no image');
  });

  test('the worst spot is out at the rim, not in the middle', () => {
    const m = mapFor(0.35);
    const centre = Math.hypot(m.maxAt.x - W / 2, m.maxAt.y - H / 2);
    assert.ok(centre > 0.6 * Math.hypot(W, H) / 2, `worst spot was ${centre}px out`);
  });

  test('worse distortion is monotonically worse', () => {
    const scores = [0, 0.1, 0.2, 0.3, 0.4].map((k) => mapFor(k).max);
    for (let i = 1; i < scores.length; i++) {
      assert.ok(scores[i] > scores[i - 1], `×${scores[i]} did not beat ×${scores[i - 1]}`);
    }
  });

  test('a finer pitch finds smaller blind spots but scores the same ratio', () => {
    const coarse = mapFor(0.3, 'square');
    const fine = mapFor(0.3, 'square', { gridOpts: { pitch: 16 } });
    assert.ok(Math.abs(coarse.max - fine.max) < 0.05, 'the ratio is about the lens, not the pitch');
    assert.ok(fine.max * fine.nominal < coarse.max * coarse.nominal / 2,
      'but the gap it leaves in pixels is far smaller');
  });

  test('moving the optical centre moves the blind spots with it', () => {
    const d = new Distort({ k1: 0.35, norm: NORM, cx: W / 2 - 260, cy: H / 2 });
    const m = Analyze.gapMap({
      width: W, height: H, cx: W / 2, cy: H / 2, distort: d,
      form: 'square', gridOpts: { pitch: 48 }, cell: 12, radii: 128
    });
    assert.ok(m.maxAt.x > W / 2, 'the far side of the shifted centre takes the worst of it');
  });

  test('the pinned probe agrees with the map underneath it', () => {
    const d = lens(0.35);
    const opts = {
      width: W, height: H, cx: W / 2, cy: H / 2, distort: d,
      form: 'square', gridOpts: { pitch: 48 }, cell: 12, radii: 128
    };
    const m = Analyze.gapMap(opts);
    const x = 90, y = 90;
    const cell = m.ratio[Math.floor(y / m.cell) * m.cols + Math.floor(x / m.cell)];
    const probe = Analyze.gapAt(opts, x, y);
    assert.ok(Math.abs(probe.ratio - cell) < 0.05, `probe ×${probe.ratio} vs map ×${cell}`);
    assert.equal(Analyze.gapAt(Object.assign({}, opts, { distort: lens(-0.5) }), 4, 4), null,
      'and it says so where the lens forms no image');
  });
});
