/* Two automatic layouts: a radial tree for the flat view, a force-directed
   cloud for the spatial view. Both leave pinned nodes where the human put them. */
(function (global) {
  'use strict';

  var RING = 190;          // distance between depth rings in the 2D layout
  var SHELL = 210;         // distance between depth shells in the 3D layout

  function leafWeights(map) {
    var weights = new Map();
    function walk(id) {
      var kids = map.children(id);
      if (!kids.length) {
        weights.set(id, 1);
        return 1;
      }
      var total = 0;
      kids.forEach(function (child) { total += walk(child.id); });
      weights.set(id, total);
      return total;
    }
    if (map.rootId) walk(map.rootId);
    return weights;
  }

  /* Radial tree: every node owns an angular slice sized by how many leaves it
     carries, so dense branches get room and thin ones stay tight. */
  function radial(map, opts) {
    if (!map.rootId) return;
    var respectPins = !(opts && opts.force);
    var weights = leafWeights(map);
    var root = map.root();
    if (!root.pinned || !respectPins) {
      root.p2.x = 0;
      root.p2.y = 0;
    }

    function place(id, start, end, depth) {
      var kids = map.children(id);
      if (!kids.length) return;
      var total = weights.get(id) || kids.length;
      var cursor = start;
      // Give the root a full circle; deeper levels fan out inside their slice.
      kids.forEach(function (child) {
        var share = (weights.get(child.id) || 1) / total;
        var span = (end - start) * share;
        var angle = cursor + span / 2;
        if (!child.pinned || !respectPins) {
          var radius = depth === 0 ? RING : RING * 0.82;
          var origin = map.get(id).p2;
          child.p2.x = origin.x + Math.cos(angle) * radius;
          child.p2.y = origin.y + Math.sin(angle) * radius;
        }
        place(child.id, cursor, cursor + span, depth + 1);
        cursor += span;
      });
    }

    place(map.rootId, -Math.PI / 2, Math.PI * 1.5, 0);
  }

  /* Spread the nodes over concentric spheres (one shell per depth) using a
     Fibonacci distribution, which gives the force pass a sane starting point. */
  function seed3d(map, opts) {
    if (!map.rootId) return;
    var respectPins = !(opts && opts.force);
    var byDepth = new Map();
    map.all().forEach(function (node) {
      var d = map.depth(node.id);
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(node);
    });

    byDepth.forEach(function (nodes, depth) {
      if (depth === 0) {
        nodes.forEach(function (node) {
          if (node.pinned && respectPins) return;
          node.p3.x = 0; node.p3.y = 0; node.p3.z = 0;
        });
        return;
      }
      var radius = SHELL * depth;
      var golden = Math.PI * (3 - Math.sqrt(5));
      nodes.forEach(function (node, i) {
        if (node.pinned && respectPins) return;
        var t = nodes.length === 1 ? 0.5 : i / (nodes.length - 1);
        var y = 1 - t * 2;                       // walk the sphere top to bottom
        var ring = Math.sqrt(Math.max(0, 1 - y * y));
        var theta = golden * i;
        node.p3.x = Math.cos(theta) * ring * radius;
        node.p3.y = y * radius;
        node.p3.z = Math.sin(theta) * ring * radius;
        node.v3.x = 0; node.v3.y = 0; node.v3.z = 0;
      });
    });
  }

  /* One step of a small force simulation: every pair pushes apart, every edge
     pulls together, and each node drifts toward its depth shell. */
  function step3d(map, dt) {
    var nodes = map.all();
    if (nodes.length < 2) return 0;
    var step = Math.min(dt || 1 / 60, 1 / 30);
    var repel = 260000;
    var spring = 0.035;
    var rest = 170;
    var damping = 0.86;

    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      for (var j = i + 1; j < nodes.length; j++) {
        var b = nodes[j];
        var dx = a.p3.x - b.p3.x;
        var dy = a.p3.y - b.p3.y;
        var dz = a.p3.z - b.p3.z;
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 1) { d2 = 1; dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); dz = (Math.random() - 0.5); }
        var d = Math.sqrt(d2);
        var f = repel / d2;
        var ux = dx / d, uy = dy / d, uz = dz / d;
        a.v3.x += ux * f * step; a.v3.y += uy * f * step; a.v3.z += uz * f * step;
        b.v3.x -= ux * f * step; b.v3.y -= uy * f * step; b.v3.z -= uz * f * step;
      }
    }

    map.edges().forEach(function (edge) {
      var a = edge.from, b = edge.to;
      var dx = b.p3.x - a.p3.x;
      var dy = b.p3.y - a.p3.y;
      var dz = b.p3.z - a.p3.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      var f = (d - rest) * spring;
      var ux = dx / d, uy = dy / d, uz = dz / d;
      a.v3.x += ux * f; a.v3.y += uy * f; a.v3.z += uz * f;
      b.v3.x -= ux * f; b.v3.y -= uy * f; b.v3.z -= uz * f;
    });

    var motion = 0;
    var root = map.root();
    nodes.forEach(function (node) {
      // The root anchors the map at the origin until someone drags it away.
      if (node === root && !node.pinned) {
        node.p3.x = 0; node.p3.y = 0; node.p3.z = 0;
        node.v3.x = 0; node.v3.y = 0; node.v3.z = 0;
        return;
      }
      // Keep each depth on its own shell so the tree stays readable.
      var target = SHELL * map.depth(node.id);
      var len = Math.sqrt(node.p3.x * node.p3.x + node.p3.y * node.p3.y + node.p3.z * node.p3.z) || 1;
      var pull = (target - len) * 0.02;
      node.v3.x += (node.p3.x / len) * pull;
      node.v3.y += (node.p3.y / len) * pull;
      node.v3.z += (node.p3.z / len) * pull;

      node.v3.x *= damping; node.v3.y *= damping; node.v3.z *= damping;
      if (node.pinned) { node.v3.x = 0; node.v3.y = 0; node.v3.z = 0; return; }
      node.p3.x += node.v3.x; node.p3.y += node.v3.y; node.p3.z += node.v3.z;
      motion += Math.abs(node.v3.x) + Math.abs(node.v3.y) + Math.abs(node.v3.z);
    });

    return motion / nodes.length;
  }

  /* Axis-aligned bounds of the map in either space. */
  function bounds(map, key) {
    var min = { x: Infinity, y: Infinity, z: Infinity };
    var max = { x: -Infinity, y: -Infinity, z: -Infinity };
    map.all().forEach(function (node) {
      var p = node[key];
      min.x = Math.min(min.x, p.x); max.x = Math.max(max.x, p.x);
      min.y = Math.min(min.y, p.y); max.y = Math.max(max.y, p.y);
      var z = p.z || 0;
      min.z = Math.min(min.z, z); max.z = Math.max(max.z, z);
    });
    if (!isFinite(min.x)) return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    return { min: min, max: max };
  }

  global.Layout = {
    RING: RING,
    SHELL: SHELL,
    radial: radial,
    seed3d: seed3d,
    step3d: step3d,
    bounds: bounds
  };
})(typeof window !== 'undefined' ? window : globalThis);
