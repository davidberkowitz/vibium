/* Canvas renderer.

   One path draws everything: the backdrop, the grid (every vertex pushed
   through the distortion on its way to the screen), the blind-spot field, and
   the two markers. The grid is the only thing that moves. */
(function (global) {
  'use strict';

  var Grid = global.Grid;

  var BACKDROPS = {
    dark:    '#0b0e13',
    light:   '#f2f4f7',
    grey:    '#7d838c'
  };

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.field = document.createElement('canvas');   // blind-spot field, one pixel per cell
    this.image = null;                               // dropped backdrop image
  }

  Renderer.prototype.resize = function () {
    var rect = this.canvas.getBoundingClientRect();
    var dpr = global.devicePixelRatio || 1;
    this.dpr = dpr;
    this.width = Math.max(1, Math.round(rect.width));
    this.height = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Renderer.prototype.backdrop = function (kind) {
    var ctx = this.ctx, w = this.width, h = this.height, x, y, i, j;
    if (kind === 'image' && this.image) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      var s = Math.max(w / this.image.width, h / this.image.height);
      var iw = this.image.width * s, ih = this.image.height * s;
      ctx.drawImage(this.image, (w - iw) / 2, (h - ih) / 2, iw, ih);
      return;
    }
    if (kind === 'checker') {
      var c = 16;
      ctx.fillStyle = '#20252d';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2b313b';
      for (j = 0, y = 0; y < h; y += c, j++) {
        for (i = 0, x = 0; x < w; x += c, i++) {
          if ((i + j) % 2 === 0) ctx.fillRect(x, y, c, c);
        }
      }
      return;
    }
    ctx.fillStyle = BACKDROPS[kind] || BACKDROPS.dark;
    ctx.fillRect(0, 0, w, h);
  };

  /* The grid. Ideal-space points are offset to the optical centre, bent, and
     put back — so the distortion sliders warp exactly what you see. */
  Renderer.prototype.grid = function (state) {
    var ctx = this.ctx;
    var dist = state.distort;
    var extent = dist.idealExtent(Math.sqrt(this.width * this.width + this.height * this.height) / 2
      + Math.max(Math.abs(state.cx - dist.cx), Math.abs(state.cy - dist.cy)));
    var step = dist.identity() ? 1e9 : 10;
    var fams = Grid.families(state.form, state.angle, state.gridOpts);
    var paths = Grid.polylines(fams, extent, step);
    var offx = state.cx - dist.cx, offy = state.cy - dist.cy;
    var out = { x: 0, y: 0 };
    var i, k, n, px, py;

    ctx.save();
    var circle = dist.imageRadius();
    if (isFinite(circle)) {                 // don't draw where the lens forms nothing
      ctx.beginPath();
      ctx.arc(dist.cx, dist.cy, circle, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.globalAlpha = state.opacity;
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.lineWidth;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (i = 0; i < paths.length; i++) {
      var pts = paths[i];
      n = pts.length / 2;
      for (k = 0; k < n; k++) {
        dist.forward(pts[k * 2] + offx, pts[k * 2 + 1] + offy, out);
        px = dist.cx + out.x;
        py = dist.cy + out.y;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  /* Ratio -> colour, as a continuous ramp through stops: cool and solid where
     the mesh is tighter than nominal, all but invisible where it matches, hot
     where it has opened up. Grey where the lens forms no image at all. A hard
     step anywhere in here would read as a feature of the lens rather than of
     the colour scale, so every stop blends. */
  var STOPS = [
    [0.00,  56, 140, 210, 0.42],
    [0.70,  70, 160, 220, 0.16],
    [1.00, 150, 190, 210, 0.03],
    [1.25, 245, 200,  90, 0.28],
    [1.75, 250, 140,  50, 0.55],
    [2.50, 255,  60,  40, 0.85]
  ];

  function ramp(r, rgba, o) {
    var i, a, b, t;
    if (!(r === r)) {                       // NaN: nothing maps here
      rgba[o] = 90; rgba[o + 1] = 96; rgba[o + 2] = 108; rgba[o + 3] = 150;
      return;
    }
    if (r <= STOPS[0][0]) { a = b = STOPS[0]; t = 0; }
    else if (r >= STOPS[STOPS.length - 1][0]) { a = b = STOPS[STOPS.length - 1]; t = 0; }
    else {
      for (i = 1; i < STOPS.length && STOPS[i][0] < r; i++) { /* find the span */ }
      a = STOPS[i - 1]; b = STOPS[i];
      t = (r - a[0]) / (b[0] - a[0]);
    }
    rgba[o]     = Math.round(a[1] + (b[1] - a[1]) * t);
    rgba[o + 1] = Math.round(a[2] + (b[2] - a[2]) * t);
    rgba[o + 2] = Math.round(a[3] + (b[3] - a[3]) * t);
    rgba[o + 3] = Math.round(255 * (a[4] + (b[4] - a[4]) * t));
  }

  Renderer.prototype.fieldCanvas = function (map) {
    var f = this.field;
    f.width = map.cols;
    f.height = map.rows;
    var fctx = f.getContext('2d');
    var img = fctx.createImageData(map.cols, map.rows);
    var data = img.data;
    for (var i = 0; i < map.cols * map.rows; i++) ramp(map.ratio[i], data, i * 4);
    fctx.putImageData(img, 0, 0);
    return f;
  };

  Renderer.prototype.blindSpots = function (map) {
    var ctx = this.ctx;
    var f = this.fieldCanvas(map);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(f, 0, 0, this.width, this.height);
    ctx.restore();
  };

  Renderer.prototype.markers = function (state, map) {
    var ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;

    if (state.showCentre) {
      ctx.strokeStyle = 'rgba(120,200,255,.75)';
      cross(ctx, state.distort.cx, state.distort.cy, 9);
      ctx.beginPath();
      ctx.arc(state.distort.cx, state.distort.cy, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (map && map.maxAt && state.showBlind && map.max > map.threshold) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.arc(map.maxAt.x, map.maxAt.y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = '600 11px ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif';
      var label = 'worst ×' + map.max.toFixed(2);
      var lx = Math.min(map.maxAt.x + 21, this.width - ctx.measureText(label).width - 8);
      var ly = Math.min(Math.max(map.maxAt.y + 4, 14), this.height - 8);
      ctx.fillText(label, Math.max(8, lx), ly);
    }

    if (state.probe) {
      ctx.strokeStyle = 'rgba(255,215,120,.95)';
      cross(ctx, state.probe.x, state.probe.y, 7);
      if (state.probe.worst != null) {
        ctx.beginPath();
        ctx.arc(state.probe.x, state.probe.y, state.probe.worst, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  function cross(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
    ctx.stroke();
  }

  Renderer.prototype.draw = function (state, map) {
    this.backdrop(state.backdrop);
    this.grid(state);
    if (state.showBlind && map) this.blindSpots(map);
    this.markers(state, map);
  };

  global.GridRenderer = Renderer;
  global.GridRenderer.BACKDROPS = BACKDROPS;
})(typeof window !== 'undefined' ? window : globalThis);
