/* Driver Load Path — SVG drawing primitives shared by the 2D views.

   Small on purpose. Two ideas carry the whole visual language:

   1. Colour encodes DIRECTION OF ACTION, not magnitude. Red is the car acting
      on the driver. Blue is the driver acting on the car. Every arrow on every
      view obeys that, so the reciprocal pair is readable at a glance.

   2. Arrow length is proportional to force with a floor, so a small force is
      still visible and a large one does not run off the drawing. The scale is
      always stated next to the drawing rather than left implicit.
*/
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    var node = document.createElementNS(NS, name);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(str, attrs, parent) {
    var node = el('text', attrs, parent);
    node.textContent = str;
    return node;
  }

  /* Arrowhead markers, one per direction of action. Defined once per SVG. */
  function defineMarkers(svg) {
    var defs = el('defs', null, svg);
    [['arrow-act', 'var(--act)'], ['arrow-react', 'var(--react)'],
     ['arrow-grav', 'var(--fg-dim)']].forEach(function (pair) {
      var m = el('marker', {
        id: pair[0], viewBox: '0 0 10 10', refX: '9', refY: '5',
        markerWidth: '5.5', markerHeight: '5.5', orient: 'auto-start-reverse'
      }, defs);
      el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: pair[1] }, m);
    });
    return defs;
  }

  /* A force arrow from (x,y) along (dx,dy). kind is 'act', 'react' or 'grav'. */
  function arrow(parent, x, y, dx, dy, kind, opts) {
    opts = opts || {};
    var stroke = kind === 'act' ? 'var(--act)'
               : kind === 'react' ? 'var(--react)' : 'var(--fg-dim)';
    var g = el('g', { class: 'vec vec-' + kind }, parent);
    el('line', {
      x1: x, y1: y, x2: x + dx, y2: y + dy,
      stroke: stroke, 'stroke-width': opts.width || 3.4,
      'stroke-linecap': 'butt', 'marker-end': 'url(#arrow-' + kind + ')'
    }, g);
    if (opts.label) {
      var lx = x + dx + (opts.labelDx || 0);
      var ly = y + dy + (opts.labelDy || 0);
      text(opts.label, {
        x: lx, y: ly, fill: stroke, class: 'vec-label',
        'text-anchor': opts.anchor || 'middle'
      }, g);
    }
    return g;
  }

  /* Map a force magnitude in newtons to an arrow length in user units.
     Square-root so a 10x force is about 3x the arrow: big forces stay on the
     drawing, small ones stay visible. Never silently clamps to zero. */
  function lengthFor(newtons, opts) {
    opts = opts || {};
    var min = opts.min || 16;
    var max = opts.max || 96;
    var ref = opts.ref || 800;           // newtons that map to `max`
    if (!(newtons > 0)) return 0;
    var t = Math.sqrt(newtons / ref);
    return Math.max(min, Math.min(max, max * t));
  }

  /* A leader line from a label anchor to a point, in drafting style: a short
     horizontal run off the text, then a straight leg to a small dot. */
  function leader(parent, fromX, fromY, toX, toY, side) {
    var stubX = side === 'left' ? fromX + 12 : fromX - 12;
    var g = el('g', { class: 'leader' }, parent);
    el('path', {
      d: 'M ' + fromX + ' ' + fromY + ' H ' + stubX + ' L ' + toX + ' ' + toY,
      fill: 'none', stroke: 'var(--line-strong)', 'stroke-width': 1
    }, g);
    el('circle', { cx: toX, cy: toY, r: 2.6, fill: 'var(--line-strong)' }, g);
    return g;
  }

  /* The drafting convention for a vector pointing into the drawing plane:
     a circle with a cross through it. Used for lateral load in side view. */
  function intoPage(parent, cx, cy, r, stroke) {
    var g = el('g', { class: 'into-page' }, parent);
    var d = r * 0.7071;
    el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: stroke, 'stroke-width': 2 }, g);
    el('line', { x1: cx - d, y1: cy - d, x2: cx + d, y2: cy + d, stroke: stroke, 'stroke-width': 2 }, g);
    el('line', { x1: cx + d, y1: cy - d, x2: cx - d, y2: cy + d, stroke: stroke, 'stroke-width': 2 }, g);
    return g;
  }

  global.LoadPathVectors = {
    NS: NS, el: el, text: text,
    defineMarkers: defineMarkers,
    arrow: arrow, lengthFor: lengthFor,
    leader: leader, intoPage: intoPage
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
