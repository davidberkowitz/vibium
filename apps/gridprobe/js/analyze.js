/* The blind-spot map.

   A rotating grid never stops sweeping, so given long enough every point gets
   touched. That makes "was it ever covered?" a useless question. The useful one
   is the WORST MOMENT: over one full turn, how wide does the gap around this
   point get? That is how big a thing can sit there and, for at least an
   instant, be missed completely.

   Two facts make this cheap and exact rather than sampled and speckled.

   1. Rotating the grid by θ and looking at a fixed point is the same as holding
      the grid still and moving the point by −θ. So the set of gaps a point sees
      over a full turn depends only on how far it sits from the centre of
      rotation — a one-dimensional profile, not a per-pixel simulation. (Moiré
      is the exception: its two grids turn opposite ways, so the profile also
      sweeps the point's bearing.)

   2. Distortion stretches a small distance by a factor that depends on which
      way it points: radially by 1 + 3k1r² + 5k2r⁴, around the circle by
      1 + k1r² + k2r⁴. A rotating grid presents its gaps in every orientation,
      so the worst case takes the LARGER of the two. Averaging them — the
      obvious move — quietly understates the blind spot.

   Multiply the two and divide by the gap an undistorted grid of the same pitch
   would leave, and you get a ratio. ×1 means "no worse than a clean grid". ×2
   means the distortion has opened the mesh to twice its nominal coarseness
   right there. Barrel crowds the periphery and scores under 1; pincushion
   spreads it and scores over. */
(function (global) {
  'use strict';

  var Grid = global.Grid;

  var DEFAULTS = { cell: 6, radii: 256 };

  /* profile[i] = the widest gap seen at ideal radius i·step during a full turn.

     Two passes. The first walks each radius round a full turn and keeps the
     worst gap. That raw curve is banded: it climbs to the nominal gap by half a
     pitch out, then ripples, because whether a circle of a given radius happens
     to thread through cell centres is arithmetic, not optics. The bands are
     real but they belong to the grid, not to the lens under test, and left in
     they paint rings across the map that read as lens artefacts.

     So the second pass widens the curve by a max over ± one nominal gap. That
     is not a smoothing fudge: anything big enough to be worth catching spans a
     band of radii rather than sitting on one exact circle, so it meets the
     worst gap anywhere in that band. Widening also absorbs what the angular
     sampling missed, which can only ever be a maximum it stepped over. */
  function sweepProfile(form, gridOpts, maxRadius, steps) {
    steps = steps || DEFAULTS.radii;
    var pitch = gridOpts.pitch;
    var nominal = Grid.nominalGap(form, gridOpts);
    var bearings = form === 'moire' ? 6 : 1;   // see note 1 above
    var raw = new Float64Array(steps + 1);
    var step = maxRadius / steps;
    var sets = [], i, j, b, rho, worst, n;

    for (i = 0; i <= steps; i++) {
      rho = i * step;
      // enough angles that the point never skips a fraction of a cell
      n = Math.max(90, Math.min(1440, Math.ceil((2 * Math.PI * rho) / (pitch / 12))));
      if (sets.length !== n) {
        sets = [];
        for (j = 0; j < n; j++) sets.push(Grid.families(form, 360 * j / n, gridOpts));
      }
      worst = 0;
      for (b = 0; b < bearings; b++) {
        var phi = Math.PI * b / bearings;
        var px = Math.cos(phi) * rho, py = Math.sin(phi) * rho;
        for (j = 0; j < n; j++) {
          var d = Grid.distance(sets[j], px, py);
          if (d > worst) worst = d;
        }
      }
      raw[i] = worst;
    }

    var half = Math.max(1, Math.round(nominal / step));
    var values = new Float64Array(steps + 1);
    for (i = 0; i <= steps; i++) {
      var lo = Math.max(0, i - half), hi = Math.min(steps, i + half);
      worst = 0;
      for (j = lo; j <= hi; j++) if (raw[j] > worst) worst = raw[j];
      values[i] = worst;
    }

    return { step: step, values: values, raw: raw, steps: steps, nominal: nominal };
  }

  function sampleProfile(profile, rho) {
    var t = rho / profile.step;
    if (!(t > 0)) return profile.values[0];
    if (t >= profile.steps) return profile.values[profile.steps];
    var i = t | 0;
    var f = t - i;
    return profile.values[i] * (1 - f) + profile.values[i + 1] * f;
  }

  /* The worst direction a gap can point in, at ideal radius ru. */
  function worstStretch(dist, ru) {
    return Math.max(Math.abs(dist.radialScale(ru)), Math.abs(dist.tangentialScale(ru)));
  }

  /* opts: width, height, cx/cy (the centre the grid turns about), distort, form,
     gridOpts, and optionally cell, threshold. */
  function gapMap(opts) {
    var w = opts.width, h = opts.height;
    var cellSize = opts.cell || DEFAULTS.cell;
    var cols = Math.max(1, Math.ceil(w / cellSize));
    var rows = Math.max(1, Math.ceil(h / cellSize));
    var dist = opts.distort;
    var nominal = Grid.nominalGap(opts.form, opts.gridOpts);
    var limit = opts.threshold || 1.5;

    var reach = dist.idealExtent(Math.sqrt(w * w + h * h) / 2
      + Math.abs(opts.cx - dist.cx) + Math.abs(opts.cy - dist.cy));
    var profile = sweepProfile(opts.form, opts.gridOpts, reach, opts.radii);

    var ratio = new Float32Array(cols * rows);
    var max = 0, maxAt = null, over = 0, unmapped = 0;

    for (var ry = 0; ry < rows; ry++) {
      for (var rx = 0; rx < cols; rx++) {
        var sx = (rx + 0.5) * cellSize;
        var sy = (ry + 0.5) * cellSize;
        var idx = ry * cols + rx;
        var r = gap(opts, dist, profile, sx, sy);
        if (r == null) { ratio[idx] = NaN; unmapped++; continue; }
        r.ratio = r.worst / nominal;
        ratio[idx] = r.ratio;
        if (r.ratio > max) { max = r.ratio; maxAt = { x: sx, y: sy }; }
        if (r.ratio > limit) over++;
      }
    }

    return {
      cols: cols, rows: rows, cell: cellSize, ratio: ratio,
      nominal: nominal, threshold: limit, profile: profile,
      max: max, maxAt: maxAt,
      overFraction: over / (cols * rows),
      unmappedFraction: unmapped / (cols * rows)
    };
  }

  function gap(opts, dist, profile, sx, sy) {
    var ideal = dist.inverse(sx - dist.cx, sy - dist.cy);
    if (!ideal) return null;                       // the lens forms no image here
    var gx = dist.cx + ideal.x - opts.cx;          // ideal offset from the rotation centre
    var gy = dist.cy + ideal.y - opts.cy;
    var rho = Math.sqrt(gx * gx + gy * gy);
    var stretch = worstStretch(dist, ideal.ru);
    return { worst: sampleProfile(profile, rho) * stretch, stretch: stretch, rho: rho };
  }

  /* The same measurement for one point — what the pinned probe reports. */
  function gapAt(opts, sx, sy) {
    var dist = opts.distort;
    var nominal = Grid.nominalGap(opts.form, opts.gridOpts);
    var reach = dist.idealExtent(Math.sqrt(opts.width * opts.width + opts.height * opts.height) / 2
      + Math.abs(opts.cx - dist.cx) + Math.abs(opts.cy - dist.cy));
    var profile = opts.profile || sweepProfile(opts.form, opts.gridOpts, reach, opts.radii);
    var g = gap(opts, dist, profile, sx, sy);
    if (!g) return null;
    g.ratio = g.worst / nominal;
    return g;
  }

  global.Analyze = {
    gapMap: gapMap,
    gapAt: gapAt,
    sweepProfile: sweepProfile,
    sampleProfile: sampleProfile,
    worstStretch: worstStretch,
    DEFAULTS: DEFAULTS
  };
})(typeof window !== 'undefined' ? window : globalThis);
