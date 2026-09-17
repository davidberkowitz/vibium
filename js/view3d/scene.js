/* Driver Load Path — the 3D view. Milestone 6, the gated one.

   ---------------------------------------------------------------------
   TWO DEPARTURES FROM WHAT THE PLAN SPECIFIED, BOTH DELIBERATE

   The plan said: "procedural low-poly seated figure in three.js", and set a
   go/no-go gate warning that procedural humans usually look wrong, that a body
   that looks wrong will undermine numbers that are right, and that cutting the
   view is a real outcome rather than a failure.

   That gate is correct about the risk and this file takes a different bet
   rather than the one it warned about.

   1. NO THREE.JS. The whole app has no dependencies, no build step, and runs
      from file:// — a property the README now promises out loud. Adding a
      library for a view that the gate says might be cut would spend that on
      the least certain milestone in the project. What is actually needed here
      is: rotate points, project them, sort by depth. That is about a hundred
      lines, it reuses the SVG language the other two views already speak, and
      it keeps the promise.

   2. NO FIGURE — and this one is the gate's verdict, reached the hard way.

      The first build did have a figure: a stick skeleton, nineteen joints,
      seated driving posture, one foot on the pedals. The reasoning was that
      the gate's failure mode is a procedural human MESH, and that a diagram
      in the same drafting language as the other two views could not fail the
      same way because it was not attempting a person.

      That was wrong. Rendered at six camera angles it read as an ambiguous
      zigzag at all of them. Beside the side elevation — which is legible in
      one glance — it was worse, not better, and a viewer squinting at the body
      is a viewer not reading the vector. The skeleton passed both of its unit
      tests the whole time, which is the lesson worth keeping: the tests could
      only say it was self-consistent, and legibility was what was on trial.

      So the figure is cut and the view keeps everything that is not a body:
      the twelve contacts at their real positions, the cabin planes that locate
      them, and the force. What is left is a drafting diagram, which is what
      this app draws.

   ---------------------------------------------------------------------
   WHAT THIS VIEW IS FOR, since "we already have two views" is a fair question

   The side elevation carries x and z. The plan carries x and y. Between them
   they cover all three axes — but never at once, and that is the gap.

   In a COMBINED maneuver, braking while turning, the force the car puts into
   the driver has all three components at the same time. The side elevation
   draws its x and z and cannot show that it also points sideways. The plan
   draws its x and y and cannot show that it also points down. Neither drawing
   shows the true direction of the resultant, and there is no way to fix that
   in two dimensions — it is what the ⊗ symbol in the side view has been
   admitting since M1.

   This view draws that one vector honestly — and, because a picture of a
   vector is not checkable, draws alongside it exactly what each 2D view DOES
   see of it, at the same scale, with the angle each one is missing. That is
   the whole case for it, and the difference between showing the gap and merely
   asserting it in a caption.

   ---------------------------------------------------------------------
   The projection

   Orthographic, not perspective. A perspective camera makes near things bigger,
   which in a drawing whose arrows are already sized by force would be a second
   thing changing length for a reason that is not force. Orthographic keeps
   arrow length meaning exactly one thing.

   Rotation is yaw then pitch, applied to the ISO frame, then the result is
   mapped to SVG with y flipped because screen y grows downward and world z
   grows up. Depth sorting is painter's algorithm on the camera-space depth of
   each element's centroid — correct enough for a scene of planes and markers
   that do not interpenetrate.
*/
(function (global) {
  'use strict';

  var V = global.LoadPathVectors;
  var A = global.LoadPathAnatomy;
  var T = global.LoadPathTouchpoints;

  var W = 880, H = 500;
  var SCALE = 310;          // SVG units per metre
  /* The drawing lives in the left two-thirds; the right third is a reserved
     legend column. Labels were first placed at the projected tips, which put
     them straight across the arms and the torso — the scene is dense in the
     middle by construction and there is nowhere in it for text to go. */
  var LEGEND_X = 604;
  var CX = 322, CY = H / 2 + 44;

  /* The scene's own centre, subtracted before projecting. The world origin is
     the H-POINT, which is not the middle of anything — the body runs forward
     of it and the pedals are a metre away — so projecting about the origin
     left the whole drawing shoved into the right half of the frame with an
     empty left half. This is framing, not geometry: it moves the picture, not
     the model, and every coordinate reported anywhere is still H-point based. */
  var CENTRE = { x: 0.46, y: 0, z: 0.06 };

  /* ---------------- the maths, such as it is ---------------- */

  /* World -> camera. Yaw about the world z axis, then pitch about the camera's
     own x axis. Returns { sx, sy, depth } where depth grows away from the eye. */
  function project(pt, yaw, pitch) {
    var px = pt.x - CENTRE.x, py = pt.y - CENTRE.y, pz = pt.z - CENTRE.z;
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = px * cy - py * sy;
    var y1 = px * sy + py * cy;
    var z1 = pz;

    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y2 = y1 * cp - z1 * sp;
    var z2 = y1 * sp + z1 * cp;

    return {
      sx: CX + x1 * SCALE,
      sy: CY - z2 * SCALE,      // screen y grows down, world z grows up
      depth: y2                  // larger is further from the eye
    };
  }

  /* Screen-space direction of a world vector: the rotation with no translation
     and no framing offset. Unit length, so callers pick the pixels. */
  function direction(v, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw);
    var x1 = v.x * cy - v.y * sy;
    var y1 = v.x * sy + v.y * cy;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var z2 = y1 * sp + v.z * cp;
    var n = Math.hypot(x1, z2) || 1;
    return { dx: x1 / n, dy: -z2 / n };
  }

  /* The decomposition, as a function rather than as lines inside the draw call,
     because it makes a claim that wants testing: that what each 2D drawing can
     carry, plus the component it cannot, is the whole force and nothing else.

       side  = (Fx, 0, Fz)   everything the side elevation can hold
       plan  = (Fx, Fy, 0)   everything the plan can hold
       miss  = asin(|discarded| / |F|), the lean out of that drawing's plane

     Right angles all the way down, so |side|^2 + Fy^2 === |F|^2 exactly. */
  /* Which axes are actually carrying, in words. The sub-label under the
     resultant used to read "all three axes at once" unconditionally, and in
     steady cruise — where the force is 765 N of pure weight support — that was
     simply a false statement sitting next to a true number. A label that does
     not come from the data is a caption pretending to be a readout. One per
     cent of the resultant is the threshold: below that an axis is rounding. */
  function liveAxes(f, mag) {
    var cut = Math.max(1, mag * 0.01), names = [];
    if (Math.abs(f.x) > cut) names.push('fore-aft');
    if (Math.abs(f.y) > cut) names.push('lateral');
    if (Math.abs(f.z) > cut) names.push('vertical');
    if (names.length === 3) return 'all three axes at once';
    if (names.length === 2) return names[0] + ' and ' + names[1] + ', no ' +
      ['fore-aft', 'lateral', 'vertical'].filter(function (n) {
        return names.indexOf(n) < 0; })[0];
    if (names.length === 1) return names[0] + ' only';
    return 'no load';
  }

  function decompose(f) {
    var mag = Math.hypot(f.x, f.y, f.z);
    if (!(mag > 0)) return null;
    return {
      axes: liveAxes(f, mag),
      mag: mag,
      side: { x: f.x, y: 0, z: f.z },
      plan: { x: f.x, y: f.y, z: 0 },
      missSideDeg: Math.asin(Math.min(1, Math.abs(f.y) / mag)) * 180 / Math.PI,
      missPlanDeg: Math.asin(Math.min(1, Math.abs(f.z) / mag)) * 180 / Math.PI
    };
  }

  function centroid(pts) {
    var s = { x: 0, y: 0, z: 0 };
    pts.forEach(function (p) { s.x += p.x; s.y += p.y; s.z += p.z; });
    return { x: s.x / pts.length, y: s.y / pts.length, z: s.z / pts.length };
  }

  /* ---------------- the drawing ---------------- */

  function render(host, state) {
    host.innerHTML = '';
    var out = {};
    var yaw = state.yaw, pitch = state.pitch;
    var occupant = state.occupant, split = state.split, vehicle = state.vehicle;

    var svg = V.el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'scene3d',
      role: 'img',
      'aria-label': 'Three-dimensional view of the twelve contacts and the ' +
                    'resultant force on the driver'
    }, host);
    V.defineMarkers(svg);

    var P = function (pt) { return project(pt, yaw, pitch); };

    /* Everything goes into one list with a depth, then gets drawn back to
       front. Mixing panels, bones and markers in one sort is what stops the
       seat back drawing over the head when you orbit behind the car. */
    var items = [];

    /* ---- ground grid, always furthest back ---- */
    var grid = [];
    for (var gx = -0.4; gx <= 1.2001; gx += 0.2) {
      grid.push([{ x: gx, y: -0.45, z: -0.34 }, { x: gx, y: 0.45, z: -0.34 }]);
    }
    for (var gy = -0.4; gy <= 0.4001; gy += 0.2) {
      grid.push([{ x: -0.4, y: gy, z: -0.34 }, { x: 1.2, y: gy, z: -0.34 }]);
    }
    grid.forEach(function (seg) {
      var a = P(seg[0]), b = P(seg[1]);
      items.push({ depth: 1e6, draw: function (g) {
        V.el('line', { x1: a.sx, y1: a.sy, x2: b.sx, y2: b.sy, class: 'sc-grid' }, g);
      } });
    });

    /* ---- cabin panels ---- */
    A.PANELS.forEach(function (panel) {
      var pts = panel.quad.map(P);
      items.push({
        depth: P(centroid(panel.quad)).depth,
        draw: function (g) {
          V.el('polygon', {
            points: pts.map(function (q) { return q.sx.toFixed(1) + ',' + q.sy.toFixed(1); }).join(' '),
            class: 'sc-panel'
          }, g);
        }
      });
    });

    /* ---- steering wheel as a polygon ring ---- */
    (function () {
      var w = A.WHEEL, tilt = w.tiltDeg * Math.PI / 180;
      var ring = [];
      for (var i = 0; i < w.segments; i++) {
        var th = i / w.segments * Math.PI * 2;
        var ry = Math.cos(th) * w.radius;
        var rz = Math.sin(th) * w.radius;
        ring.push({
          x: w.centre.x + rz * Math.sin(tilt),
          y: w.centre.y + ry,
          z: w.centre.z + rz * Math.cos(tilt)
        });
      }
      var proj = ring.map(P);
      items.push({
        depth: P(w.centre).depth,
        draw: function (g) {
          V.el('polygon', {
            points: proj.map(function (q) { return q.sx.toFixed(1) + ',' + q.sy.toFixed(1); }).join(' '),
            class: 'sc-wheel'
          }, g);
        }
      });
    })();

    /* ---- the twelve contacts, sized by the load actually crossing them ---- */
    var maxLoad = 1;
    T.ALL.forEach(function (tp) {
      var f = split && split.feasible && split.byTouchpoint[tp.id];
      if (f && f.magnitude > maxLoad) maxLoad = f.magnitude;
    });

    T.ALL.forEach(function (tp) {
      var at = A.contactAt(tp.id);
      if (!at) return;
      var f = split && split.feasible && split.byTouchpoint[tp.id]
        ? split.byTouchpoint[tp.id].magnitude : 0;
      var live = f > 0.5;
      var r = live ? 4 + 7 * Math.sqrt(f / maxLoad) : 3;
      var q = P(at);
      var sel = state.selected === tp.id;
      items.push({
        depth: q.depth - 0.01,     // markers sit just in front of what they mark
        draw: function (g) {
          var node = V.el('circle', {
            cx: q.sx, cy: q.sy, r: r,
            class: 'sc-contact' + (live ? '' : ' idle') + (sel ? ' sel' : ''),
            'data-id': tp.id, tabindex: '0'
          }, g);
          if (sel) {
            V.el('circle', { cx: q.sx, cy: q.sy, r: r + 5, class: 'sc-ring' }, g);
          }
          node.addEventListener('mouseenter', function () { state.onPick(tp.id); });
          node.addEventListener('click', function () { state.onPick(tp.id); });
          node.addEventListener('focus', function () { state.onPick(tp.id); });
        }
      });
    });

    /* ---- THE POINT OF THE VIEW: the resultant, and what each 2D view
            sees of it ----

       Draft one drew the resultant alone and it was not checkable. At 976 N
       with 765 N of that merely holding the body up, the arrow points very
       nearly straight up whatever the car is doing; a viewer could not tell
       the combined case from the cruise case by looking at it. The claim that
       neither 2D drawing can show this direction was being ASSERTED by the
       caption and not SHOWN by the picture, which is the exact failure the
       gate was written to catch.

       So the same vector is drawn three times, from one origin, at one scale:
       whole; with y zeroed, which is everything the side elevation can carry;
       and with z zeroed, which is everything the plan can carry. Same scale
       matters — the projections come out visibly shorter, and how much shorter
       is how much that drawing is missing. The thin line from each projected
       tip to the true tip is the discarded component, drawn. The angle on each
       label is the lean out of that drawing's plane, asin of the component it
       cannot hold, which is the size of the omission in degrees.

       That is the argument the caption was making, made by the drawing. */
    (function () {
      var f = occupant.carOnBody;
      var d = decompose(f);
      if (!d || !(d.mag > 1)) return;
      var mag = d.mag;
      var len = 0.22 + 0.34 * Math.sqrt(Math.min(1, mag / 1400));
      var per = len / mag;                    // metres of arrow per newton
      function tipOf(v) {
        return { x: A.COM.x + v.x * per, y: A.COM.y + v.y * per, z: A.COM.z + v.z * per };
      }
      var oP = P(A.COM);
      var bFull = P(tipOf(f));
      var bSide = P(tipOf(d.side));
      var bPlan = P(tipOf(d.plan));
      var missSide = d.missSideDeg, missPlan = d.missPlanDeg;
      out.magnitude = mag;
      out.axes = d.axes;
      out.missSideDeg = missSide;
      out.missPlanDeg = missPlan;

      items.push({
        depth: -1e6,               // always in front; it is the subject
        draw: function (g) {
          [[bSide, 'side elevation sees', missSide, 236],
           [bPlan, 'plan sees', missPlan, 306]].forEach(function (pr) {
            var tip = pr[0], ly = pr[3];
            V.el('line', { x1: tip.sx, y1: tip.sy, x2: bFull.sx, y2: bFull.sy,
                           class: 'sc-drop' }, g);
            V.el('line', { x1: oP.sx, y1: oP.sy, x2: tip.sx, y2: tip.sy,
                           class: 'sc-proj', 'marker-end': 'url(#arrow-act)' }, g);
            /* leader out to the legend column, so the label never sits on the body */
            var lg = V.el('g', { class: 'sc-legend' }, g);
            V.el('line', { x1: tip.sx, y1: tip.sy, x2: LEGEND_X - 8, y2: ly - 4,
                           class: 'sc-leader' }, lg);
            V.text(pr[1], { x: LEGEND_X, y: ly, class: 'sc-proj-label' }, lg);
            V.text('misses ' + pr[2].toFixed(0) + '\u00b0 of it',
                   { x: LEGEND_X, y: ly + 14, class: 'sc-proj-label dim' }, lg);
          });
          V.el('line', { x1: oP.sx, y1: oP.sy, x2: bFull.sx, y2: bFull.sy,
                         class: 'sc-resultant', 'marker-end': 'url(#arrow-act)' }, g);
          V.el('circle', { cx: oP.sx, cy: oP.sy, r: 3.5, class: 'sc-com' }, g);
          var lg2 = V.el('g', { class: 'sc-legend' }, g);
          V.el('line', { x1: bFull.sx, y1: bFull.sy, x2: LEGEND_X - 8, y2: 178,
                         class: 'sc-leader' }, lg2);
          V.text(mag.toFixed(0) + ' N', { x: LEGEND_X, y: 182,
                                          class: 'sc-resultant-label' }, lg2);
          V.text(d.axes, { x: LEGEND_X, y: 198, class: 'sc-resultant-sub' }, lg2);
        }
      });
    })();

    items.sort(function (p, q) { return q.depth - p.depth; });
    var root = V.el('g', null, svg);
    items.forEach(function (it) { it.draw(root); });

    /* ---- axis tripod, fixed corner, so the frame is never in doubt ----

       Drawn from screen DELTAS, not from two projected points. The first
       version subtracted CX/CY from a pair of project() results, which worked
       only while project() mapped the world origin to the frame centre. Adding
       the framing offset broke that silently: the tripod collapsed into the
       corner with its lines a few pixels long and z invisible, and the tests
       did not catch it because they exercise the projector, not the legend.
       Deltas have no origin to get wrong. */
    var tri = V.el('g', { transform: 'translate(62,' + (H - 64) + ')' }, svg);
    [['x', { x: 1, y: 0, z: 0 }], ['y', { x: 0, y: 1, z: 0 }],
     ['z', { x: 0, y: 0, z: 1 }]].forEach(function (ax) {
      var d = direction(ax[1], yaw, pitch), L = 34;
      V.el('line', { x1: 0, y1: 0, x2: d.dx * L, y2: d.dy * L, class: 'sc-axis' }, tri);
      V.text(ax[0], { x: d.dx * (L + 9), y: d.dy * (L + 9) + 3.5,
                      'text-anchor': 'middle', class: 'sc-axis-label' }, tri);
    });
    V.text('x fwd \u00b7 y left \u00b7 z up', { x: -4, y: 30, class: 'sc-axis-note' }, tri);

    out.svg = svg;
    return out;
  }

  global.LoadPathScene3D = { render: render, project: project, direction: direction,
    decompose: decompose, liveAxes: liveAxes, CENTRE: CENTRE, W: W, H: H };
})(typeof globalThis !== 'undefined' ? globalThis : this);
