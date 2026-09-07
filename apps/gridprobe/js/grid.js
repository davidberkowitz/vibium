/* The grid, described once and used twice.

   Every form reduces to a handful of families — parallel lines, concentric
   rings, spokes through the centre. One function turns families into polylines
   to draw; another measures the distance from a point to the nearest line in
   the same families. Both read the same description, so the blind-spot map
   measures the grid you are actually looking at rather than a model of it.

   All coordinates here are IDEAL space, in pixels, relative to the centre the
   grid turns about. Distortion is applied afterwards, on the way to the screen. */
(function (global) {
  'use strict';

  var RAD = Math.PI / 180;

  var FORMS = [
    { id: 'square',     label: 'Square',     note: 'Two families at 90°. The plain reference — every straight line should stay straight.' },
    { id: 'triangular', label: 'Triangular', note: 'Three families at 60°. Half the gap of a square grid at the same pitch, so it finds smaller blind spots.' },
    { id: 'polar',      label: 'Polar',      note: 'Rings plus spokes. Rings are rotation-invariant, so only the spokes turn — radial stretch shows up as ring spacing.' },
    { id: 'moire',      label: 'Moiré',      note: 'Two square grids counter-rotating. Fringes move far faster than the warp that causes them, so tiny distortion becomes obvious.' }
  ];

  function lines(angleDeg, pitch) {
    var a = angleDeg * RAD;
    return { kind: 'lines', nx: Math.cos(a), ny: Math.sin(a), pitch: pitch };
  }

  function rings(pitch) {
    return { kind: 'rings', pitch: pitch };
  }

  function spokes(angleDeg, count) {
    return { kind: 'spokes', angle: angleDeg * RAD, count: Math.max(1, count | 0) };
  }

  /* form + rotation -> the families that make it up */
  function families(form, angleDeg, opts) {
    opts = opts || {};
    var p = opts.pitch || 48;
    switch (form) {
      case 'triangular':
        return [lines(angleDeg, p), lines(angleDeg + 60, p), lines(angleDeg + 120, p)];
      case 'polar':
        return [rings(p), spokes(angleDeg, opts.spokes || 12)];
      case 'moire':
        return [lines(angleDeg, p), lines(angleDeg + 90, p),
                lines(-angleDeg, p), lines(-angleDeg + 90, p)];
      default:
        return [lines(angleDeg, p), lines(angleDeg + 90, p)];
    }
  }

  /* Distance from an ideal-space point to the nearest line of one family. */
  function familyDistance(f, x, y) {
    var t, m, r, k, i, a, d, best;
    if (f.kind === 'lines') {
      t = x * f.nx + y * f.ny;
      m = t - f.pitch * Math.round(t / f.pitch);
      return Math.abs(m);
    }
    if (f.kind === 'rings') {
      r = Math.sqrt(x * x + y * y);
      k = Math.max(1, Math.round(r / f.pitch));   // no ring at the centre
      return Math.abs(r - k * f.pitch);
    }
    // spokes: full diameters, so they repeat every 180°/count
    best = Infinity;
    for (i = 0; i < f.count; i++) {
      a = f.angle + i * Math.PI / f.count;
      d = Math.abs(x * Math.sin(a) - y * Math.cos(a));   // distance to the line through 0
      if (d < best) best = d;
    }
    return best;
  }

  /* Distance to the nearest line of any family — the gap the grid leaves here. */
  function distance(fams, x, y) {
    var best = Infinity, i, d;
    for (i = 0; i < fams.length; i++) {
      d = familyDistance(fams[i], x, y);
      if (d < best) best = d;
    }
    return best;
  }

  /* The largest gap this form leaves anywhere, undistorted, at this pitch — the
     yardstick the blind-spot map measures against. A square grid's worst point
     is a cell centre, half a pitch from all four sides; a triangular grid's is a
     triangle's incentre, a third of a pitch out. Rings cap the polar form at the
     same half pitch, and moiré is two square grids, worst when they coincide. */
  function nominalGap(form, opts) {
    var p = (opts && opts.pitch) || 48;
    return form === 'triangular' ? p / 3 : p / 2;
  }

  /* Polylines to draw, in ideal space. `step` is the target spacing between
     points along a line: small enough that distortion bends it smoothly,
     large enough not to drown the frame in vertices. */
  function polylines(fams, extent, step) {
    var out = [];
    step = Math.max(4, step || 12);
    fams.forEach(function (f) {
      var k, kmax, t, bx, by, dx, dy, n, i, pts, ring, radius, segs, a;
      if (f.kind === 'lines') {
        dx = -f.ny; dy = f.nx;
        kmax = Math.ceil(extent / f.pitch);
        n = Math.max(2, Math.ceil((2 * extent) / step));
        for (k = -kmax; k <= kmax; k++) {
          t = k * f.pitch;
          if (Math.abs(t) > extent) continue;
          bx = f.nx * t; by = f.ny * t;
          pts = new Float64Array((n + 1) * 2);
          for (i = 0; i <= n; i++) {
            var s = -extent + (2 * extent) * i / n;
            pts[i * 2] = bx + dx * s;
            pts[i * 2 + 1] = by + dy * s;
          }
          out.push(pts);
        }
      } else if (f.kind === 'rings') {
        kmax = Math.ceil(extent / f.pitch);
        for (ring = 1; ring <= kmax; ring++) {
          radius = ring * f.pitch;
          segs = Math.max(24, Math.ceil((2 * Math.PI * radius) / step));
          pts = new Float64Array((segs + 1) * 2);
          for (i = 0; i <= segs; i++) {
            a = (2 * Math.PI) * i / segs;
            pts[i * 2] = Math.cos(a) * radius;
            pts[i * 2 + 1] = Math.sin(a) * radius;
          }
          out.push(pts);
        }
      } else {
        n = Math.max(2, Math.ceil((2 * extent) / step));
        for (k = 0; k < f.count; k++) {
          a = f.angle + k * Math.PI / f.count;
          dx = Math.cos(a); dy = Math.sin(a);
          pts = new Float64Array((n + 1) * 2);
          for (i = 0; i <= n; i++) {
            var u = -extent + (2 * extent) * i / n;
            pts[i * 2] = dx * u;
            pts[i * 2 + 1] = dy * u;
          }
          out.push(pts);
        }
      }
    });
    return out;
  }

  global.Grid = {
    FORMS: FORMS,
    families: families,
    distance: distance,
    familyDistance: familyDistance,
    polylines: polylines,
    nominalGap: nominalGap
  };
})(typeof window !== 'undefined' ? window : globalThis);
