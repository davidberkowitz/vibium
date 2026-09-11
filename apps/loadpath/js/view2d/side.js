/* Driver Load Path — side elevation.

   A seated driver in profile, drawn schematically, with the twelve contact
   channels marked and labelled on drafting-style leaders.

   Deliberately schematic rather than anatomical. The figure is capsules and
   circles because its job is to say WHERE force enters the body, not what a
   person looks like. A more realistic body would invite the viewer to read
   detail the model does not have.

   The posture is a real driving package, not a guess at one: hip (the H-point)
   low and back, knees slightly ABOVE the hips, torso reclined about 25 degrees
   from vertical, hands at the rim. Getting this wrong matters more than it
   looks — every contact marker is placed against this skeleton, so a sloppy
   pose puts the labels on empty space instead of on anatomy.

   Geometry lives here, keyed by touchpoint id; semantics live in
   model/touchpoints.js. The plan view in a later milestone reuses the same
   ids with its own coordinates.

   One channel cannot honestly be drawn as an arrow in this view: the side
   bolster acts along the axis pointing into the page. It gets the drafting
   symbol for that, a crossed circle, rather than an arrow that would imply a
   direction the view cannot show.
*/
(function (global) {
  'use strict';

  var V = global.LoadPathVectors;
  var T = global.LoadPathTouchpoints;
  var el = V.el, text = V.text;

  var W = 760, H = 442;

  /* --- the skeleton every other coordinate is measured against --- */
  var JOINT = {
    hip:      { x: 275, y: 285 },   // H-point
    shoulder: { x: 232, y: 192 },
    head:     { x: 218, y: 152 },
    knee:     { x: 390, y: 268 },
    ankle:    { x: 452, y: 378 },
    toe:      { x: 498, y: 384 },
    elbow:    { x: 292, y: 238 },
    hand:     { x: 410, y: 214 },
    wheel:    { x: 424, y: 208 }
  };
  var GROUND = 406;

  /* Body centre of mass: lower abdomen when seated. The aggregate force pair is
     anchored here rather than at any one contact, because at this milestone the
     per-contact split is not modelled. */
  var COM = { x: 268, y: 263 };

  /* Marker point for each contact. Every one of these sits ON the feature it
     names — on the pan under the thigh, on the webbing, on the rim. */
  var POINTS = {
    head_restraint: { x: 190, y: 156 },
    shoulder_belt:  { x: 228, y: 213 },
    seat_back:      { x: 214, y: 243 },
    bolster:        { x: 258, y: 268 },
    lap_belt:       { x: 288, y: 286 },
    seat_pan:       { x: 330, y: 306 },
    wheel:          { x: 416, y: 190 },
    armrest:        { x: 300, y: 250 },
    knee_bolster:   { x: 390, y: 252 },
    pedal:          { x: 494, y: 348 },
    footrest:       { x: 462, y: 384 },
    floor:          { x: 530, y: GROUND }
  };

  /* Where each label sits, and which gutter it lives in. */
  var LABELS = {
    head_restraint: { side: 'left',  y: 150 },
    shoulder_belt:  { side: 'left',  y: 196 },
    seat_back:      { side: 'left',  y: 240 },
    bolster:        { side: 'left',  y: 284 },
    lap_belt:       { side: 'left',  y: 326 },
    seat_pan:       { side: 'left',  y: 368 },
    wheel:          { side: 'right', y: 176 },
    armrest:        { side: 'right', y: 244 },
    knee_bolster:   { side: 'right', y: 282 },
    pedal:          { side: 'right', y: 328 },
    footrest:       { side: 'right', y: 370 },
    floor:          { side: 'right', y: 408 }
  };

  var LEFT_X = 150, RIGHT_X = 600;

  /* An outlined bar: a thick stroke for the edge, a thinner one over it for the
     fill. Cheaper and more robust than computing a rotated rectangle's corners
     for every piece of seat furniture. */
  function bar(parent, x1, y1, x2, y2, width, cap) {
    var g = el('g', null, parent);
    el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--line-strong)',
                 'stroke-width': width, 'stroke-linecap': cap || 'butt' }, g);
    el('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: 'var(--bg-soft)',
                 'stroke-width': width - 4.4, 'stroke-linecap': cap || 'butt' }, g);
    return g;
  }

  function drawCar(g) {
    el('line', { x1: 168, y1: GROUND, x2: 560, y2: GROUND,
                 stroke: 'var(--line-strong)', 'stroke-width': 1.2 }, g);

    var seat = el('g', { class: 'seat' }, g);
    bar(seat, 290, 322, 290, GROUND - 2, 72);          // pedestal
    bar(seat, 250, 300, 196, 178, 30, 'round');        // back, behind the torso
    bar(seat, 240, 312, 378, 300, 19, 'round');        // pan, visible below the thigh
    bar(seat, 196, 142, 182, 172, 19, 'round');        // head restraint
    bar(seat, 274, 252, 340, 252, 13, 'round');        // armrest

    var ctl = el('g', { class: 'controls', fill: 'none',
                        stroke: 'var(--fg-dim)', 'stroke-linecap': 'round' }, g);
    el('ellipse', { cx: JOINT.wheel.x, cy: JOINT.wheel.y, rx: 9, ry: 52,
                    transform: 'rotate(-20 ' + JOINT.wheel.x + ' ' + JOINT.wheel.y + ')',
                    'stroke-width': 6 }, ctl);
    el('line', { x1: 436, y1: 232, x2: 494, y2: 262, 'stroke-width': 4 }, ctl);  // column
    el('line', { x1: 505, y1: 300, x2: 487, y2: 362, 'stroke-width': 8 }, ctl);  // brake pedal
    el('line', { x1: 450, y1: 396, x2: 480, y2: 366, 'stroke-width': 8 }, ctl);  // footrest
  }

  function drawBody(g) {
    var body = el('g', { class: 'body' }, g);
    var limbs = el('g', { stroke: 'var(--fg)', fill: 'none',
                          'stroke-linecap': 'round' }, body);
    var J = JOINT;
    el('line', { x1: J.hip.x, y1: J.hip.y, x2: J.shoulder.x, y2: J.shoulder.y,
                 'stroke-width': 46 }, limbs);                       // torso
    el('line', { x1: J.hip.x, y1: J.hip.y, x2: J.knee.x, y2: J.knee.y,
                 'stroke-width': 32 }, limbs);                       // thigh
    el('line', { x1: J.knee.x, y1: J.knee.y, x2: J.ankle.x, y2: J.ankle.y,
                 'stroke-width': 26 }, limbs);                       // shank
    el('line', { x1: J.ankle.x, y1: J.ankle.y, x2: J.toe.x, y2: J.toe.y,
                 'stroke-width': 15 }, limbs);                       // foot
    el('line', { x1: J.shoulder.x + 4, y1: J.shoulder.y + 4, x2: J.elbow.x, y2: J.elbow.y,
                 'stroke-width': 21 }, limbs);                       // upper arm
    el('line', { x1: J.elbow.x, y1: J.elbow.y, x2: J.hand.x, y2: J.hand.y,
                 'stroke-width': 17 }, limbs);                       // forearm
    el('circle', { cx: J.hip.x, cy: J.hip.y, r: 22, fill: 'var(--fg)' }, body);
    el('circle', { cx: J.head.x, cy: J.head.y, r: 25, fill: 'var(--fg)' }, body);

    /* Webbing, drawn dashed because at rest it is slack and carrying nothing.
       A solid belt here would claim a load the model says is zero. */
    var belt = el('g', { fill: 'none', stroke: 'var(--react)', 'stroke-width': 4,
                         'stroke-linecap': 'round', 'stroke-dasharray': '7 5',
                         opacity: '.5' }, body);
    el('path', { d: 'M 200 170 Q 220 200 272 282' }, belt);   // shoulder
    el('path', { d: 'M 250 292 Q 272 290 302 283' }, belt);   // lap
  }

  /* The aggregate pair at the cruise baseline.

     Red rises from the centre of mass: the car holding the driver up.
     Grey falls from the same point: gravity, the thing being resisted.
     Blue leaves the seat pan and runs down into the floor pan — the same force
     as the red one, read the other way, continuing along the load path into
     the car's structure.

     Arrows carry only the magnitude. Which direction each colour means is
     stated once in the legend, so the labels stay short enough not to collide
     with the figure. */
  function drawBaselineForces(g, state) {
    var n = Math.abs(state.carOnBody.z);
    var len = V.lengthFor(n, { min: 40, max: 88, ref: 900 });
    var fmt = Math.round(n) + ' N';

    V.arrow(g, COM.x, COM.y - 7, 0, -len, 'act', { label: fmt, labelDy: -9, width: 3.6 });
    V.arrow(g, COM.x, COM.y + 7, 0, 46, 'grav', { label: 'weight', labelDy: 18, width: 2.4 });
    V.arrow(g, 350, 312, 0, 78, 'react', { label: fmt, labelDy: 17, width: 3.6 });

    el('circle', { cx: COM.x, cy: COM.y, r: 3.6, fill: 'var(--act)' }, g);
  }

  /* Marker size carries load. A contact taking 489 N should not look the same
     as one taking nothing, and sizing the dot says so without adding twelve
     more arrows to an already busy drawing. Square-rooted for the same reason
     arrow length is: keeps small loads visible and big ones on the page. */
  function dotRadius(magnitude, maxMagnitude) {
    if (!(magnitude > 0)) return 4;
    var t = Math.sqrt(magnitude / Math.max(maxMagnitude, 1));
    return 4.5 + 7 * t;
  }

  function drawContacts(g, onSelect, split) {
    var layer = el('g', { class: 'contacts' }, g);
    var loads = {}, maxLoad = 0;
    if (split && split.feasible) {
      Object.keys(split.byTouchpoint).forEach(function (k) {
        loads[k] = split.byTouchpoint[k].magnitude;
        if (loads[k] > maxLoad) maxLoad = loads[k];
      });
    }
    T.ALL.forEach(function (tp) {
      var p = POINTS[tp.id];
      var lab = LABELS[tp.id];
      if (!p || !lab) return;

      var load = loads[tp.id] || 0;
      var carrying = load > 0.5;
      var anchorX = lab.side === 'left' ? LEFT_X : RIGHT_X;
      var item = el('g', {
        class: 'contact' + (carrying ? ' is-active' : ' is-idle'),
        'data-id': tp.id, tabindex: '0', role: 'button',
        'aria-label': tp.n + ' ' + tp.label + ', ' +
          (carrying ? 'carrying ' + Math.round(load) + ' newtons' : 'carrying no load')
      }, layer);

      V.leader(item, anchorX, lab.y - 4, p.x, p.y, lab.side);

      if (tp.id === 'bolster') {
        V.intoPage(item, p.x, p.y, carrying ? 11 : 9, 'var(--act)');
      } else {
        el('circle', { cx: p.x, cy: p.y, r: dotRadius(load, maxLoad), class: 'dot' }, item);
      }

      var t = text('', {
        x: anchorX, y: lab.y, class: 'contact-label',
        'text-anchor': lab.side === 'left' ? 'end' : 'start'
      }, item);
      var num = el('tspan', { class: 'contact-n' }, t);
      num.textContent = tp.n + '  ';
      var name = el('tspan', null, t);
      name.textContent = tp.label + (tp.id === 'bolster' ? '  ⊗' : '');
      if (carrying) {
        var f = el('tspan', { class: 'contact-force' }, t);
        f.textContent = '   ' + Math.round(load) + ' N';
      }

      if (onSelect) {
        item.addEventListener('mouseenter', function () { onSelect(tp.id); });
        item.addEventListener('focus', function () { onSelect(tp.id); });
        item.addEventListener('click', function () { onSelect(tp.id); });
        item.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(tp.id); }
        });
      }
    });
    return layer;
  }

  function render(mount, state, onSelect, split) {
    mount.innerHTML = '';
    var svg = el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'side-view', role: 'img',
      'aria-label': 'Side elevation of a seated driver at rest, with twelve ' +
                    'labelled contact points between the body and the car.'
    }, mount);
    V.defineMarkers(svg);

    var scene = el('g', null, svg);
    drawCar(scene);
    drawBody(scene);
    drawBaselineForces(scene, state);
    var contacts = drawContacts(scene, onSelect, split);

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

  global.LoadPathSideView = {
    W: W, H: H, JOINT: JOINT, GROUND: GROUND,
    POINTS: POINTS, LABELS: LABELS, COM: COM, render: render
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
