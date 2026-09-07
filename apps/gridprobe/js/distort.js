/* Radial lens distortion — the thing this app exists to make visible.

   Brown's model: a point sitting at ideal radius ru lands on screen at
       rd = ru · (1 + k1·ru² + k2·ru⁴)
   with radii normalised so ru = 1 at the corner of the frame. k1 < 0 is barrel
   (the periphery crowds inward), k1 > 0 is pincushion (the periphery spreads).

   The map depends only on radius, so everything here is one-dimensional; the 2D
   versions just rescale the offset vector by rd/ru. Two derivatives matter for
   the blind-spot map: how much the map stretches ALONG a radius, and how much it
   stretches AROUND one. A gap in the grid picks up somewhere between the two. */
(function (global) {
  'use strict';

  function Distort(opts) {
    opts = opts || {};
    this.k1 = opts.k1 || 0;
    this.k2 = opts.k2 || 0;
    this.norm = opts.norm || 1;   // pixels per unit radius (half the frame diagonal)
    this.cx = opts.cx || 0;       // optical centre in absolute canvas pixels
    this.cy = opts.cy || 0;
    this._lut = null;
  }

  Distort.prototype.identity = function () {
    return this.k1 === 0 && this.k2 === 0;
  };

  /* ideal radius -> distorted radius, both normalised */
  Distort.prototype.radial = function (ru) {
    var r2 = ru * ru;
    return ru * (1 + this.k1 * r2 + this.k2 * r2 * r2);
  };

  /* d(rd)/d(ru): stretch along the radius */
  Distort.prototype.radialScale = function (ru) {
    var r2 = ru * ru;
    return 1 + 3 * this.k1 * r2 + 5 * this.k2 * r2 * r2;
  };

  /* rd/ru: stretch around the circle */
  Distort.prototype.tangentialScale = function (ru) {
    var r2 = ru * ru;
    return 1 + this.k1 * r2 + this.k2 * r2 * r2;
  };

  /* One number for "how much does a small distance grow here". A gap can point
     any way, so we take the geometric mean of the two — the same factor the map
     applies to area, square-rooted. */
  Distort.prototype.scale = function (ru) {
    var s = this.radialScale(ru) * this.tangentialScale(ru);
    return s > 0 ? Math.sqrt(s) : 0;
  };

  /* Past this ideal radius the map folds back on itself and stops being a map.
     Strong barrel reaches it inside the frame; that region simply has no
     pre-image, and the analysis marks it rather than inventing one. */
  Distort.prototype.monotoneLimit = function () {
    var a = 5 * this.k2, b = 3 * this.k1, roots = [], disc, s;
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) roots.push(-1 / b);
    } else {
      disc = b * b - 4 * a;
      if (disc >= 0) {
        s = Math.sqrt(disc);
        roots.push((-b + s) / (2 * a), (-b - s) / (2 * a));
      }
    }
    var best = Infinity;
    roots.forEach(function (x) { if (x > 1e-9 && x < best) best = x; });
    return best === Infinity ? Infinity : Math.sqrt(best);
  };

  /* Inverse radius by table lookup plus one Newton polish. The table is built
     over the monotone stretch only, so a lookup that runs off the end is an
     honest "nothing maps here" rather than a wrong answer. */
  Distort.prototype.buildLut = function (n) {
    n = n || 2048;
    var lim = Math.min(this.monotoneLimit(), 3);
    var rd = new Float64Array(n + 1);
    for (var i = 0; i <= n; i++) rd[i] = this.radial(lim * i / n);
    this._lut = { n: n, lim: lim, rd: rd, max: rd[n] };
    return this._lut;
  };

  Distort.prototype.inverseRadius = function (r) {
    if (this.identity()) return r;
    if (!(r > 0)) return r === 0 ? 0 : NaN;
    var l = this._lut || this.buildLut();
    if (r > l.max) return NaN;
    var lo = 0, hi = l.n, mid;
    while (hi - lo > 1) {
      mid = (lo + hi) >> 1;
      if (l.rd[mid] <= r) lo = mid; else hi = mid;
    }
    var span = l.rd[hi] - l.rd[lo];
    var t = span > 0 ? (r - l.rd[lo]) / span : 0;
    var ru = l.lim * (lo + t) / l.n;
    var d = this.radialScale(ru);                     // one Newton step
    if (Math.abs(d) > 1e-9) ru -= (this.radial(ru) - r) / d;
    return ru < 0 ? 0 : ru;
  };

  /* Ideal offset from the optical centre (px) -> screen offset (px). */
  Distort.prototype.forward = function (dx, dy, out) {
    out = out || {};
    if (this.identity()) { out.x = dx; out.y = dy; return out; }
    var ru = Math.sqrt(dx * dx + dy * dy) / this.norm;
    if (ru === 0) { out.x = 0; out.y = 0; return out; }
    var f = this.radial(ru) / ru;
    out.x = dx * f;
    out.y = dy * f;
    return out;
  };

  /* Screen offset from the optical centre (px) -> ideal offset (px).
     Returns null where the distortion maps nothing. */
  Distort.prototype.inverse = function (dx, dy) {
    if (this.identity()) return { x: dx, y: dy, ru: Math.sqrt(dx * dx + dy * dy) / this.norm };
    var rd = Math.sqrt(dx * dx + dy * dy) / this.norm;
    if (rd === 0) return { x: 0, y: 0, ru: 0 };
    var ru = this.inverseRadius(rd);
    if (!isFinite(ru)) return null;
    var f = ru / rd;
    return { x: dx * f, y: dy * f, ru: ru };
  };

  /* How far out the ideal grid has to reach to still cover the frame corners —
     never past the fold, where the model stops being a map and lines would
     double back on themselves. */
  Distort.prototype.idealExtent = function (screenRadiusPx) {
    var lim = Math.min(this.monotoneLimit(), 3);
    var rd = screenRadiusPx / this.norm;
    var ru = this.identity() ? rd : this.inverseRadius(rd);
    if (!isFinite(ru)) return lim * this.norm;
    return Math.min(ru * 1.06, lim) * this.norm;
  };

  /* Screen radius of the image circle: past here a lens this strong forms no
     image at all, so the frame corners stay empty. Infinite when nothing folds. */
  Distort.prototype.imageRadius = function () {
    var lim = this.monotoneLimit();
    return isFinite(lim) ? this.radial(lim) * this.norm : Infinity;
  };

  global.Distort = Distort;
})(typeof window !== 'undefined' ? window : globalThis);
