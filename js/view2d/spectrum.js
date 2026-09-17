/* Driver Load Path — the vibration spectrum. Milestone 5.

   A chart, not a drawing, and that distinction is the whole reason this file
   exists separately from side.js and plan.js.

   Everything else in this app is drawn in NEWTONS and coloured by DIRECTION OF
   ACTION: red is the car acting on the driver, blue is the driver acting back.
   Those two colours are reserved and mean one thing each. This chart is in
   (m/s^2)^2 per Hz, it has no direction at all, and if it borrowed either
   colour it would silently claim to be the same kind of quantity as an arrow.
   So the vibration channel gets its own hue and keeps it everywhere it appears.

   Why a chart earns its place here at all: the entire point of M5 is that
   vibration is a different mathematics from load transfer — a distribution over
   frequency rather than a balance at an instant. A single comfort number hides
   exactly the thing that makes it different. The two lobes are legible on
   sight: the body on its suspension near 1.3 Hz, and you on the seat cushion
   near 4.5 Hz, with a wheel-hop shoulder around 12 Hz.

   Plotting choices, and what each costs:

   - LOG frequency axis. The band spans 0.4 to 80 Hz and the structure is all in
     the bottom decade; a linear axis would compress everything interesting into
     the leftmost 5% of the width.

   - LINEAR magnitude, normalised to the weighted peak. A log magnitude axis
     would span the six-odd decades this PSD covers and flatten the lobes into a
     gentle slope, which destroys the one thing the chart is for. The cost is
     real and is stated on the chart: the axis shows RELATIVE energy, so you can
     read where the energy is and not how much there is. How much is the panel's
     job, in m/s^2, next to its comfort band.

   - The unweighted trace is the SAME quantity one stage earlier, not a second
     category, so it is the same hue a step lighter and dashed rather than a new
     colour. Identity never rests on colour alone: both traces are directly
     labelled and the dash pattern differs.
*/
(function (global) {
  'use strict';

  var V = global.LoadPathVectors;
  var C = global.LoadPathConstants;

  var W = 1120, H = 272;
  var PAD = { l: 46, r: 186, t: 32, b: 34 };

  /* Named bands, drawn as background regions so the two lobes can be read
     against what causes them rather than left as anonymous bumps. */
  var REGIONS = [
    { lo: 0.4, hi: 2,  label: 'body on suspension' },
    { lo: 3,   hi: 6,  label: 'you on the seat' },
    { lo: 8,   hi: 20, label: 'wheel hop' }
  ];

  var TICKS = [0.4, 1, 2, 4, 8, 16, 31.5, 63, 80];

  function render(host, vib) {
    host.innerHTML = '';
    var lo = C.ISO2631.bandLowHz, hi = C.ISO2631.bandHighHz;
    var plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;

    var svg = V.el('svg', {
      viewBox: '0 0 ' + W + ' ' + H, class: 'spectrum',
      role: 'img',
      'aria-label': 'Weighted and unweighted vertical acceleration spectrum at the seat'
    }, host);

    var logLo = Math.log(lo), logHi = Math.log(hi);
    function x(f) { return PAD.l + (Math.log(f) - logLo) / (logHi - logLo) * plotW; }

    var rows = vib.rows;
    /* Normalised to the WEIGHTED peak, not to the larger of the two. The first
       version scaled both traces to a shared maximum, and since the unweighted
       body-mode peak is about four times the weighted one, the trace that
       actually matters got squashed into the bottom third of the plot — the
       chart ended up mostly showing the curve it was meant to contrast against.
       The unweighted trace now runs off the top instead, which is the correct
       thing to lose: it is context, and where it exceeds the frame is precisely
       where the weighting is discarding the most. */
    var peak = 0;
    rows.forEach(function (r) { peak = Math.max(peak, r.wZ); });
    if (!(peak > 0)) peak = 1;
    function y(v) { return PAD.t + plotH - (v / peak) * plotH; }

    /* A real clip path, not a clamp. Clamping the y coordinate to the frame top
       made the over-range part of the unweighted trace draw as a flat line
       along the ceiling — which reads as a plateau in the data and is not one.
       Anything that looks like a measurement has to be a measurement, so the
       trace is clipped and genuinely disappears instead. */
    var defs = V.el('defs', null, svg);
    V.el('rect', { x: PAD.l, y: PAD.t, width: plotW, height: plotH },
         V.el('clipPath', { id: 'spec-clip' }, defs));

    /* ---- named regions, behind everything ---- */
    REGIONS.forEach(function (reg) {
      var x0 = x(Math.max(lo, reg.lo)), x1 = x(Math.min(hi, reg.hi));
      V.el('rect', { x: x0, y: PAD.t, width: x1 - x0, height: plotH,
                     class: 'spec-region' }, svg);
      /* Above the frame, not inside it. Inside, they sat exactly where the two
         lobes peak and the dashed trace crossed straight through the words. */
      V.text(reg.label, { x: (x0 + x1) / 2, y: PAD.t - 9,
                          class: 'spec-region-label', 'text-anchor': 'middle' }, svg);
      V.el('line', { x1: x0, y1: PAD.t - 5, x2: x1, y2: PAD.t - 5,
                     class: 'spec-region-rule' }, svg);
    });

    /* ---- axes, recessive ---- */
    V.el('line', { x1: PAD.l, y1: PAD.t + plotH, x2: PAD.l + plotW, y2: PAD.t + plotH,
                   class: 'spec-axis' }, svg);
    TICKS.forEach(function (f) {
      var px = x(f);
      V.el('line', { x1: px, y1: PAD.t, x2: px, y2: PAD.t + plotH, class: 'spec-grid' }, svg);
      V.text(f < 1 ? f.toFixed(1) : String(f),
             { x: px, y: PAD.t + plotH + 14, class: 'spec-tick', 'text-anchor': 'middle' }, svg);
    });
    V.text('Hz', { x: PAD.l + plotW + 6, y: PAD.t + plotH + 14, class: 'spec-tick' }, svg);
    V.text('relative energy', { x: 12, y: PAD.t + plotH / 2, class: 'spec-tick',
                                'text-anchor': 'middle',
                                transform: 'rotate(-90 12 ' + (PAD.t + plotH / 2) + ')' }, svg);

    /* ---- the two traces ---- */
    function path(key) {
      var d = '';
      rows.forEach(function (r, i) {
        d += (i ? 'L' : 'M') + x(r.f).toFixed(2) + ' ' + y(r[key]).toFixed(2) + ' ';
      });
      return d;
    }
    V.el('path', { d: path('rawZ'), class: 'spec-raw', fill: 'none',
                   'clip-path': 'url(#spec-clip)' }, svg);
    V.el('path', { d: path('wZ') + 'L' + x(hi).toFixed(2) + ' ' + (PAD.t + plotH) +
                      ' L' + x(lo).toFixed(2) + ' ' + (PAD.t + plotH) + ' Z',
                   class: 'spec-fill' }, svg);
    V.el('path', { d: path('wZ'), class: 'spec-weighted', fill: 'none' }, svg);

    /* ---- direct labels, so identity never rests on colour ---- */
    var lastW = rows[rows.length - 1], mid = rows[Math.round(rows.length * 0.55)];
    var wLabelAt = rows.reduce(function (a, b) { return b.wZ > a.wZ ? b : a; }, rows[0]);
    V.text('weighted', { x: PAD.l + plotW + 8, y: PAD.t + 30,
                         class: 'spec-label weighted' }, svg);
    V.text('what a body feels', { x: PAD.l + plotW + 8, y: PAD.t + 44,
                                  class: 'spec-sub' }, svg);
    V.text('unweighted', { x: PAD.l + plotW + 8, y: PAD.t + 72,
                           class: 'spec-label raw' }, svg);
    V.text('what the seat does', { x: PAD.l + plotW + 8, y: PAD.t + 86,
                                   class: 'spec-sub' }, svg);
    V.text('(runs off the top)', { x: PAD.l + plotW + 8, y: PAD.t + 100,
                                   class: 'spec-sub' }, svg);
    V.el('line', { x1: PAD.l + plotW + 8, y1: PAD.t + 52, x2: PAD.l + plotW + 34,
                   y2: PAD.t + 52, class: 'spec-weighted' }, svg);
    V.el('line', { x1: PAD.l + plotW + 8, y1: PAD.t + 108, x2: PAD.l + plotW + 34,
                   y2: PAD.t + 108, class: 'spec-raw' }, svg);

    /* peak marker on the weighted trace */
    V.el('circle', { cx: x(wLabelAt.f), cy: y(wLabelAt.wZ), r: 4,
                     class: 'spec-peak' }, svg);

    /* ---- crosshair readout ---- */
    var hair = V.el('line', { x1: 0, y1: PAD.t, x2: 0, y2: PAD.t + plotH,
                              class: 'spec-hair', visibility: 'hidden' }, svg);
    var tip = V.text('', { x: 0, y: PAD.t + 12, class: 'spec-tip', visibility: 'hidden' }, svg);
    var hit = V.el('rect', { x: PAD.l, y: PAD.t, width: plotW, height: plotH,
                             fill: 'transparent', class: 'spec-hit' }, svg);

    function at(px) {
      var frac = (px - PAD.l) / plotW;
      var f = Math.exp(logLo + frac * (logHi - logLo));
      return rows.reduce(function (a, b) {
        return Math.abs(b.f - f) < Math.abs(a.f - f) ? b : a; }, rows[0]);
    }
    hit.addEventListener('mousemove', function (ev) {
      var box = svg.getBoundingClientRect();
      var px = (ev.clientX - box.left) / box.width * W;
      var r = at(px);
      var sx = x(r.f);
      hair.setAttribute('x1', sx); hair.setAttribute('x2', sx);
      hair.setAttribute('visibility', 'visible');
      tip.textContent = r.f.toFixed(1) + ' Hz  ·  Wk ' + r.wk.toFixed(2) +
                        '  ·  ' + (r.wZ / peak * 100).toFixed(0) + '% of peak';
      tip.setAttribute('x', Math.min(sx + 8, PAD.l + plotW - 190));
      tip.setAttribute('visibility', 'visible');
    });
    hit.addEventListener('mouseleave', function () {
      hair.setAttribute('visibility', 'hidden');
      tip.setAttribute('visibility', 'hidden');
    });

    return { svg: svg };
  }

  global.LoadPathSpectrum = { render: render };
})(typeof globalThis !== 'undefined' ? globalThis : this);
