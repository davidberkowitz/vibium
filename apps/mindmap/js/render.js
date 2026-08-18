/* Canvas renderer. One draw path serves both views: every node is projected
   through the blended camera, then cards are painted far-to-near. */
(function (global) {
  'use strict';

  var BASE_FONT = 14;
  var PAD_X = 13;
  var HEIGHT = 30;
  var MAX_W = 210;

  function Renderer(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.frame = [];        // what was drawn last, in draw order — used for hit tests
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

  Renderer.prototype.font = function (size, bold) {
    return (bold ? '600 ' : '500 ') + size + 'px ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif';
  };

  Renderer.prototype.cardWidth = function (node, bold) {
    var ctx = this.ctx;
    ctx.font = this.font(BASE_FONT, bold);
    var w = Math.ceil(ctx.measureText(node.text || ' ').width) + 1 + PAD_X * 2;
    return Math.max(58, Math.min(MAX_W, w));
  };

  function fit(ctx, text, max) {
    if (ctx.measureText(text).width <= max + 1) return text;
    var cut = text;
    while (cut.length > 1 && ctx.measureText(cut + '…').width > max) {
      cut = cut.slice(0, -1);
    }
    return cut + '…';
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }

  Renderer.prototype.draw = function (state) {
    var ctx = this.ctx;
    var w = this.width;
    var h = this.height;
    var t = state.t;

    ctx.clearRect(0, 0, w, h);
    this.drawBackground(state);

    // Project everything once, then reuse the result for edges, cards and picking.
    var self = this;
    var placed = new Map();
    var list = [];
    state.map.all().forEach(function (node) {
      var p = global.Cameras.blend(state.cam2, state.cam3, node, t, w, h);
      var item = {
        node: node,
        x: p.x,
        y: p.y,
        s: p.s,
        fog: p.fog,
        depth: p.depth,
        behind: p.behind,
        w: self.cardWidth(node, node.id === state.map.rootId) * p.s,
        h: HEIGHT * p.s
      };
      placed.set(node.id, item);
      if (!p.behind) list.push(item);
    });

    list.sort(function (a, b) { return b.depth - a.depth; });

    // Edges first so cards always sit on top of their connections.
    ctx.lineCap = 'round';
    state.map.edges().forEach(function (edge) {
      var a = placed.get(edge.from.id);
      var b = placed.get(edge.to.id);
      if (!a || !b || a.behind || b.behind) return;
      var fog = Math.min(a.fog, b.fog);
      ctx.strokeStyle = hexToRgba(edge.to.color, 0.45 * fog);
      ctx.lineWidth = Math.max(0.6, 1.8 * Math.min(a.s, b.s));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      // Flat view gets a gentle curve; it straightens out as the map lifts into 3D.
      var bend = (1 - t) * 0.22;
      var mx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
      var my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    list.forEach(function (item) {
      self.drawCard(item, state);
    });

    this.frame = list;
  };

  Renderer.prototype.drawCard = function (item, state) {
    var ctx = this.ctx;
    var node = item.node;
    var selected = node.id === state.selectedId;
    var hovered = node.id === state.hoverId;
    var isRoot = node.id === state.map.rootId;
    var x = item.x - item.w / 2;
    var y = item.y - item.h / 2;
    var fog = item.fog;
    var radius = (isRoot ? 14 : 9) * item.s;

    if (selected) {
      ctx.save();
      ctx.shadowColor = hexToRgba(node.color, 0.55 * fog);
      ctx.shadowBlur = 22 * item.s;
      roundRect(ctx, x, y, item.w, item.h, radius);
      ctx.fillStyle = hexToRgba(node.color, 0.18 * fog);
      ctx.fill();
      ctx.restore();
    }

    roundRect(ctx, x, y, item.w, item.h, radius);
    ctx.fillStyle = isRoot
      ? hexToRgba(node.color, 0.20 * fog)
      : 'rgba(22, 28, 37, ' + (0.92 * fog + 0.05) + ')';
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, (selected ? 2.2 : hovered ? 1.8 : 1.3) * item.s);
    ctx.strokeStyle = hexToRgba(node.color, (selected ? 1 : hovered ? 0.85 : 0.6) * fog);
    ctx.stroke();

    var fontSize = BASE_FONT * item.s;
    if (fontSize < 4) return;   // too small to read — skip the text entirely
    ctx.font = this.font(fontSize.toFixed(1), isRoot);
    ctx.fillStyle = 'rgba(230, 237, 243, ' + Math.max(0.25, fog) + ')';
    ctx.fillText(fit(ctx, node.text, item.w - PAD_X * 2 * item.s), item.x, item.y + 0.5);
  };

  /* A grid in the flat view, orbit rings in the spatial one; each fades as the
     other takes over. */
  Renderer.prototype.drawBackground = function (state) {
    var ctx = this.ctx;
    var w = this.width, h = this.height, t = state.t;

    if (t < 1) {
      var step = 56 * state.cam2.zoom;
      if (step > 8) {
        var ox = ((-state.cam2.x * state.cam2.zoom + w / 2) % step + step) % step;
        var oy = ((-state.cam2.y * state.cam2.zoom + h / 2) % step + step) % step;
        ctx.strokeStyle = 'rgba(88, 166, 255, ' + (0.05 * (1 - t)) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var gx = ox; gx < w; gx += step) { ctx.moveTo(gx, 0); ctx.lineTo(gx, h); }
        for (var gy = oy; gy < h; gy += step) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
        ctx.stroke();
      }
    }

    if (t > 0) {
      var depth = 0;
      state.map.all().forEach(function (n) { depth = Math.max(depth, state.map.depth(n.id)); });
      var radius = global.Layout.SHELL * Math.max(1, depth);
      ctx.strokeStyle = 'rgba(125, 160, 200, ' + (0.10 * t) + ')';
      ctx.lineWidth = 1;
      [['x', 'y'], ['x', 'z'], ['y', 'z']].forEach(function (plane) {
        ctx.beginPath();
        for (var i = 0; i <= 72; i++) {
          var a = (i / 72) * Math.PI * 2;
          var p = { x: 0, y: 0, z: 0 };
          p[plane[0]] = Math.cos(a) * radius;
          p[plane[1]] = Math.sin(a) * radius;
          var s = state.cam3.project(p, w, h);
          if (s.behind) { ctx.moveTo(s.x, s.y); continue; }
          if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      });
    }
  };

  /* Topmost card under the cursor, honouring the painter's order. Passing
     excludeId skips that node and keeps looking underneath it, which is what a
     card being dragged over a drop target needs. */
  Renderer.prototype.pick = function (sx, sy, excludeId) {
    for (var i = this.frame.length - 1; i >= 0; i--) {
      var item = this.frame[i];
      if (excludeId && item.node.id === excludeId) continue;
      if (Math.abs(sx - item.x) <= item.w / 2 && Math.abs(sy - item.y) <= item.h / 2) {
        return item;
      }
    }
    return null;
  };

  Renderer.prototype.placement = function (id) {
    for (var i = 0; i < this.frame.length; i++) {
      if (this.frame[i].node.id === id) return this.frame[i];
    }
    return null;
  };

  global.Renderer = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
