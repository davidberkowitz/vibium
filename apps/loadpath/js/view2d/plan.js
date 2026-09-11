/* Driver Load Path — overhead plan view.

   The side elevation can show vertical and fore-aft load honestly, and cannot
   show lateral load at all: in profile, a sideways force points into the page.
   That is why the bolster gets a crossed circle there rather than an arrow.

   This view is the other half. Seen from above, lateral force has a direction
   again, and the contacts that only matter in a corner — bolster, knee
   bolster, armrest, and the diagonal run of the shoulder belt — finally have
   somewhere to be drawn properly.

   Two things appear here that exist nowhere else in the app:

   1. THE TYRE CONTACT PATCHES, sized by the vertical load each corner carries.
      The vehicle solver has computed these since M0 and nothing has ever shown
      them. Brake and watch the front pair swell; turn and watch the load cross
      to the outside.

   2. THE DRIVER'S OWN OFFSET. A 78 kg driver is about 5% of the car's mass and
      sits well off the centreline, which is the reason the reciprocal force is
      worth drawing at all. In plan view you can see that it is off-centre.

   Screen convention: the car points UP, so the vehicle's x axis (forward) runs
   up the screen and its y axis (left) runs to the screen's LEFT. A left turn
   therefore pushes the driver toward the left of the drawing.
*/
(function (global) {
  'use strict';

  var V = global.LoadPathVectors;
  var T = global.LoadPathTouchpoints;
  var el = V.el, text = V.text;

  /* The drawing is authored around a car at x = 206 and label gutters at 96
     and 318, then the whole scene is shifted right by GUTTER so both gutters
     have room for their longest label. Shifting at render time rather than
     re-numbering forty coordinates keeps the geometry readable and keeps the
     leaders attached to their markers. */
  var W = 560, H = 474, GUTTER = 74;
  var PPM = 70;                         // pixels per metre
  var CX = 206;                         // car centreline on screen
  var NOSE = 74, TAIL = 404;            // car body extent

  var AXLE = { front: 140, rear: 329 }; // wheel centres, y on screen
  var HALF_TRACK = 54;

  /* The driver package, in plan. Left-hand drive, so the driver sits toward
     the screen's left, matching the vehicle's positive y. */
  var D = {
    head:     { x: 174, y: 250 },
    torso:    { x: 174, y: 258 },
    pelvis:   { x: 174, y: 274 },
    kneeL:    { x: 166, y: 220 },
    kneeR:    { x: 183, y: 220 },
    footL:    { x: 168, y: 192 },
    footR:    { x: 185, y: 192 },
    shoulderL:{ x: 158, y: 252 },
    shoulderR:{ x: 190, y: 252 },
    handL:    { x: 161, y: 224 },
    handR:    { x: 188, y: 224 },
    wheel:    { x: 174, y: 222 }
  };
  var COM = { x: 174, y: 264 };

  /* Only the contacts this view can show honestly. The rest live in the side
     elevation; drawing all twelve in both places would be twice the clutter
     for no extra information. */
  var POINTS = {
    bolster:       { x: 152, y: 272 },
    knee_bolster:  { x: 192, y: 220 },
    armrest:       { x: 150, y: 252 },
    shoulder_belt: { x: 180, y: 262 },
    lap_belt:      { x: 174, y: 280 },
    wheel:         { x: 161, y: 224 }
  };
  var LABELS = {
    armrest:       { side: 'left',  y: 246 },
    bolster:       { side: 'left',  y: 286 },
    wheel:         { side: 'left',  y: 206 },
    knee_bolster:  { side: 'right', y: 214 },
    shoulder_belt: { side: 'right', y: 258 },
    lap_belt:      { side: 'right', y: 296 }
  };
  var LEFT_X = 96, RIGHT_X = 318;

  function drawCar(g, state) {
    var car = el('g', { class: 'plan-car' }, g);

    el('rect', { x: CX - 63, y: NOSE, width: 126, height: TAIL - NOSE, rx: 26,
                 fill: 'var(--bg-soft)', stroke: 'var(--line-strong)', 'stroke-width': 1.5 }, car);
    // cabin
    el('rect', { x: CX - 54, y: 176, width: 108, height: 150, rx: 14,
                 fill: 'none', stroke: 'var(--line)', 'stroke-width': 1.2 }, car);
    // centreline, so the driver's offset from it is visible
    el('line', { x1: CX, y1: NOSE + 6, x2: CX, y2: TAIL - 6, stroke: 'var(--line)',
                 'stroke-width': 1, 'stroke-dasharray': '4 6' }, car);

    [['front', AXLE.front], ['rear', AXLE.rear]].forEach(function (a) {
      [-1, 1].forEach(function (sgn) {
        el('rect', { x: CX + sgn * HALF_TRACK - 7, y: a[1] - 15, width: 14, height: 30, rx: 4,
                     fill: 'var(--bg-sunk)', stroke: 'var(--line-strong)', 'stroke-width': 1.2 }, car);
      });
    });
    return car;
  }

  /* Contact patches sized by the vertical load on each corner. This is the
     first time the vehicle solver's per-corner output is visible anywhere. */
  function drawContactPatches(g, state) {
    var loads = state.corners.loads;
    var maxLoad = Math.max(loads.frontLeft, loads.frontRight, loads.rearLeft, loads.rearRight, 1);
    var layer = el('g', { class: 'patches' }, g);
    var spec = [
      ['frontLeft',  CX - HALF_TRACK, AXLE.front],
      ['frontRight', CX + HALF_TRACK, AXLE.front],
      ['rearLeft',   CX - HALF_TRACK, AXLE.rear],
      ['rearRight',  CX + HALF_TRACK, AXLE.rear]
    ];
    spec.forEach(function (s) {
      var load = loads[s[0]];
      var r = 4 + 15 * Math.sqrt(Math.max(load, 0) / maxLoad);
      var lifted = load <= 0;
      el('circle', {
        cx: s[1], cy: s[2], r: lifted ? 4 : r,
        fill: lifted ? 'none' : 'var(--act)',
        'fill-opacity': lifted ? 0 : 0.3,
        stroke: 'var(--act)', 'stroke-width': lifted ? 1.5 : 1.6,
        'stroke-dasharray': lifted ? '3 3' : null
      }, layer);
      text(lifted ? 'lifted' : Math.round(load) + ' N', {
        x: s[1], y: s[2] + 34, class: 'patch-label',
        fill: lifted ? 'var(--warn)' : 'var(--fg-dim)', 'text-anchor': 'middle'
      }, layer);
    });
    return layer;
  }

  function drawDriver(g) {
    var b = el('g', { class: 'plan-body' }, g);
    var limb = el('g', { stroke: 'var(--fg)', fill: 'none', 'stroke-linecap': 'round' }, b);
    el('line', { x1: D.pelvis.x - 5, y1: D.pelvis.y, x2: D.kneeL.x, y2: D.kneeL.y, 'stroke-width': 13 }, limb);
    el('line', { x1: D.pelvis.x + 5, y1: D.pelvis.y, x2: D.kneeR.x, y2: D.kneeR.y, 'stroke-width': 13 }, limb);
    el('line', { x1: D.kneeL.x, y1: D.kneeL.y, x2: D.footL.x, y2: D.footL.y, 'stroke-width': 11 }, limb);
    el('line', { x1: D.kneeR.x, y1: D.kneeR.y, x2: D.footR.x, y2: D.footR.y, 'stroke-width': 11 }, limb);
    el('line', { x1: D.shoulderL.x, y1: D.shoulderL.y, x2: D.handL.x, y2: D.handL.y, 'stroke-width': 10 }, limb);
    el('line', { x1: D.shoulderR.x, y1: D.shoulderR.y, x2: D.handR.x, y2: D.handR.y, 'stroke-width': 10 }, limb);

    el('ellipse', { cx: D.torso.x, cy: D.torso.y, rx: 19, ry: 24, fill: 'var(--fg)' }, b);
    el('ellipse', { cx: D.pelvis.x, cy: D.pelvis.y, rx: 16, ry: 12, fill: 'var(--fg)' }, b);
    el('circle', { cx: D.head.x, cy: D.head.y, r: 12.5, fill: 'var(--fg)' }, b);

    // steering wheel, seen from above as a flattened ellipse
    el('ellipse', { cx: D.wheel.x, cy: D.wheel.y, rx: 25, ry: 11,
                    fill: 'none', stroke: 'var(--fg-dim)', 'stroke-width': 5 }, b);

    var belt = el('g', { fill: 'none', stroke: 'var(--react)', 'stroke-width': 3.5,
                         'stroke-linecap': 'round', opacity: '.55' }, b);
    el('path', { d: 'M 158 244 Q 172 256 186 276', class: 'plan-shoulder-belt' }, belt);
    el('path', { d: 'M 160 278 Q 174 282 190 278', class: 'plan-lap-belt' }, belt);
    return b;
  }

  /* The lateral force on the driver, drawn where it can finally point
     somewhere. Vehicle +y is left, which on this drawing is negative screen x. */
  /* The lateral force, drawn in the clear space behind the driver rather than
     across them: at the centre of mass it ran straight through the contact
     leaders and neither could be read. */
  function drawLateral(g, occState) {
    var fy = occState.carOnBody.y;
    var grp = el('g', { class: 'plan-lateral' }, g);
    /* Below the car body entirely. At y = 366 it ran straight through the
       rear tyre-patch labels, which is the sort of thing only a screenshot
       tells you. */
    var y = 436;
    if (Math.abs(fy) < 1) {
      text('no lateral load', { x: COM.x, y: y + 4, class: 'plan-lat-label',
        fill: 'var(--line-strong)', 'text-anchor': 'middle' }, grp);
      return grp;
    }
    var len = V.lengthFor(Math.abs(fy), { min: 24, max: 76, ref: 900 });
    var dx = fy > 0 ? -len : len;          // vehicle +y is left, screen -x
    V.arrow(grp, COM.x, y, dx, 0, 'act', {
      label: Math.round(Math.abs(fy)) + ' N  ' + (fy > 0 ? 'left' : 'right'),
      labelDy: -10, width: 3.4
    });
    text('lateral, on the driver', { x: COM.x, y: y + 18, class: 'plan-lat-label',
      fill: 'var(--fg-dim)', 'text-anchor': 'middle' }, grp);
    return grp;
  }

  function drawContacts(g, onSelect, split) {
    var layer = el('g', { class: 'contacts' }, g);
    var loads = {}, maxLoad = 1;
    if (split && split.feasible) {
      Object.keys(split.byTouchpoint).forEach(function (k) {
        loads[k] = split.byTouchpoint[k].magnitude;
        if (loads[k] > maxLoad) maxLoad = loads[k];
      });
    }

    Object.keys(POINTS).forEach(function (id) {
      var tp = T.byId(id), p = POINTS[id], lab = LABELS[id];
      if (!tp || !lab) return;
      var load = loads[id] || 0, carrying = load > 0.5;
      var anchorX = lab.side === 'left' ? LEFT_X : RIGHT_X;

      var item = el('g', {
        class: 'contact' + (carrying ? ' is-active' : ' is-idle'),
        'data-id': id, tabindex: '0', role: 'button',
        'aria-label': tp.n + ' ' + tp.label + ', ' +
          (carrying ? 'carrying ' + Math.round(load) + ' newtons' : 'carrying no load')
      }, layer);

      V.leader(item, anchorX, lab.y - 4, p.x, p.y, lab.side);
      var r = carrying ? 4.5 + 6.5 * Math.sqrt(load / maxLoad) : 4;
      el('circle', { cx: p.x, cy: p.y, r: r, class: 'dot' }, item);

      var t = text('', { x: anchorX, y: lab.y, class: 'contact-label',
                         'text-anchor': lab.side === 'left' ? 'end' : 'start' }, item);
      var num = el('tspan', { class: 'contact-n' }, t);
      num.textContent = tp.n + '  ';
      var nm = el('tspan', null, t);
      nm.textContent = tp.label;
      if (carrying) {
        var f = el('tspan', { class: 'contact-force' }, t);
        f.textContent = '  ' + Math.round(load) + ' N';
      }

      if (onSelect) {
        ['mouseenter', 'focus', 'click'].forEach(function (evt) {
          item.addEventListener(evt, function () { onSelect(id); });
        });
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); }
        });
      }
    });
    return layer;
  }

  function drawHeading(g, vState) {
    var r = vState.turnRadius;
    var label = r === Infinity ? 'straight ahead'
              : 'turning ' + (vState.accel.y > 0 ? 'left' : 'right') + ', r = ' + r.toFixed(0) + ' m';
    text(label, { x: CX, y: 46, class: 'plan-heading', fill: 'var(--fg-dim)',
                  'text-anchor': 'middle' }, g);
    text('forward', { x: CX, y: 26, class: 'plan-axis', fill: 'var(--line-strong)',
                      'text-anchor': 'middle' }, g);
    el('path', { d: 'M ' + CX + ' 38 L ' + CX + ' 30', stroke: 'var(--line-strong)',
                 'stroke-width': 1.4, 'marker-end': 'url(#arrow-grav)' }, g);
  }

  function render(mount, vState, occState, split, onSelect) {
    mount.innerHTML = '';
    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'plan-view', role: 'img',
      'aria-label': 'Overhead plan view of the car with tyre contact patches ' +
                    'sized by load, the driver offset from the centreline, and ' +
                    'the contacts that only matter in a corner.'
    }, mount);
    V.defineMarkers(svg);

    var scene = el('g', { transform: 'translate(' + GUTTER + ',0)' }, svg);
    drawCar(scene, vState);
    drawContactPatches(scene, vState);
    drawDriver(scene);
    drawLateral(scene, occState);
    var contacts = drawContacts(scene, onSelect, split);
    drawHeading(scene, vState);

    return {
      svg: svg,
      highlight: function (id) {
        var nodes = contacts.querySelectorAll('.contact');
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].classList.toggle('is-selected', nodes[i].getAttribute('data-id') === id);
        }
      }
    };
  }

  global.LoadPathPlanView = { W: W, H: H, GUTTER: GUTTER, POINTS: POINTS, LABELS: LABELS, render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
