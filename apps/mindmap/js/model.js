/* Mind map data model: a tree of nodes, each carrying a 2D and a 3D position. */
(function (global) {
  'use strict';

  var PALETTE = [
    '#58a6ff', '#f778ba', '#7ee787', '#ffa657',
    '#d2a8ff', '#79c0ff', '#ffd580', '#56d4c4'
  ];

  var seq = 0;
  function uid() {
    seq += 1;
    return 'n' + seq.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function Node(text, parentId) {
    this.id = uid();
    this.text = text;
    this.parentId = parentId || null;
    this.color = PALETTE[0];
    this.p2 = { x: 0, y: 0 };            // flat layout position
    this.p3 = { x: 0, y: 0, z: 0 };      // spatial layout position
    this.v3 = { x: 0, y: 0, z: 0 };      // velocity used by the 3D force layout
    this.pinned = false;                 // true once a human has placed it
  }

  function MindMap() {
    this.nodes = new Map();
    this.rootId = null;
  }

  MindMap.prototype.get = function (id) {
    return this.nodes.get(id) || null;
  };

  MindMap.prototype.all = function () {
    return Array.from(this.nodes.values());
  };

  MindMap.prototype.root = function () {
    return this.get(this.rootId);
  };

  MindMap.prototype.setRoot = function (text) {
    var node = new Node(text, null);
    node.color = '#c9d4e2';
    this.nodes.clear();
    this.nodes.set(node.id, node);
    this.rootId = node.id;
    return node;
  };

  MindMap.prototype.add = function (text, parentId) {
    var parent = this.get(parentId);
    if (!parent) return null;
    var node = new Node(text, parentId);
    // Branch colour: the root's children pick a new hue, everyone else inherits.
    if (parentId === this.rootId) {
      node.color = PALETTE[this.children(parentId).length % PALETTE.length];
    } else {
      node.color = parent.color;
    }
    node.p2 = { x: parent.p2.x + 40, y: parent.p2.y + 40 };
    node.p3 = { x: parent.p3.x + 20, y: parent.p3.y + 20, z: parent.p3.z + 20 };
    this.nodes.set(node.id, node);
    return node;
  };

  MindMap.prototype.children = function (id) {
    var out = [];
    this.nodes.forEach(function (n) {
      if (n.parentId === id) out.push(n);
    });
    return out;
  };

  MindMap.prototype.siblings = function (id) {
    var node = this.get(id);
    if (!node || !node.parentId) return [];
    return this.children(node.parentId);
  };

  MindMap.prototype.depth = function (id) {
    var d = 0;
    var node = this.get(id);
    while (node && node.parentId) {
      node = this.get(node.parentId);
      d += 1;
    }
    return d;
  };

  /* The node and everything hanging off it, parents before children. */
  MindMap.prototype.branch = function (id) {
    var out = [];
    var self = this;
    var queue = [id];
    while (queue.length) {
      var current = queue.shift();
      var node = this.get(current);
      if (!node) continue;
      out.push(node);
      self.children(current).forEach(function (child) { queue.push(child.id); });
    }
    return out;
  };

  MindMap.prototype.remove = function (id) {
    if (id === this.rootId) return false;
    var self = this;
    this.branch(id).forEach(function (n) { self.nodes.delete(n.id); });
    return true;
  };

  MindMap.prototype.isAncestor = function (ancestorId, id) {
    var node = this.get(id);
    while (node && node.parentId) {
      if (node.parentId === ancestorId) return true;
      node = this.get(node.parentId);
    }
    return false;
  };

  MindMap.prototype.reparent = function (id, newParentId) {
    if (id === this.rootId || id === newParentId) return false;
    var node = this.get(id);
    var parent = this.get(newParentId);
    if (!node || !parent) return false;
    if (this.isAncestor(id, newParentId)) return false;   // would build a cycle
    node.parentId = newParentId;
    var branchColor = newParentId === this.rootId
      ? PALETTE[(this.children(newParentId).length - 1) % PALETTE.length]
      : parent.color;
    this.branch(id).forEach(function (n) { n.color = branchColor; });
    return true;
  };

  MindMap.prototype.edges = function () {
    var out = [];
    var self = this;
    this.nodes.forEach(function (n) {
      if (!n.parentId) return;
      var parent = self.get(n.parentId);
      if (parent) out.push({ from: parent, to: n });
    });
    return out;
  };

  MindMap.prototype.toJSON = function () {
    return {
      format: 'vibium-mindmap',
      version: 1,
      rootId: this.rootId,
      nodes: this.all().map(function (n) {
        return {
          id: n.id,
          text: n.text,
          parentId: n.parentId,
          color: n.color,
          p2: { x: n.p2.x, y: n.p2.y },
          p3: { x: n.p3.x, y: n.p3.y, z: n.p3.z },
          pinned: n.pinned
        };
      })
    };
  };

  MindMap.fromJSON = function (data) {
    if (!data || !Array.isArray(data.nodes) || !data.nodes.length) return null;
    var map = new MindMap();
    data.nodes.forEach(function (raw) {
      var node = new Node(String(raw.text == null ? '' : raw.text), raw.parentId || null);
      node.id = String(raw.id);
      node.color = raw.color || PALETTE[0];
      if (raw.p2) node.p2 = { x: +raw.p2.x || 0, y: +raw.p2.y || 0 };
      if (raw.p3) node.p3 = { x: +raw.p3.x || 0, y: +raw.p3.y || 0, z: +raw.p3.z || 0 };
      node.pinned = !!raw.pinned;
      map.nodes.set(node.id, node);
    });
    map.rootId = map.nodes.has(data.rootId) ? data.rootId : data.nodes[0].id;
    // Drop parent links that point at nodes which did not survive the load.
    map.nodes.forEach(function (n) {
      if (n.parentId && !map.nodes.has(n.parentId)) n.parentId = null;
      if (n.id !== map.rootId && !n.parentId) n.parentId = map.rootId;
    });
    return map;
  };

  MindMap.sample = function () {
    var map = new MindMap();
    var root = map.setRoot('Mind Map');
    var branches = {
      'Capture': ['Ideas', 'Questions', 'Links'],
      'Structure': ['Group', 'Rank', 'Prune'],
      'Explore': ['2D layout', '3D space'],
      'Share': ['Export JSON', 'Export PNG']
    };
    Object.keys(branches).forEach(function (name) {
      var branch = map.add(name, root.id);
      branches[name].forEach(function (leaf) { map.add(leaf, branch.id); });
    });
    return map;
  };

  global.MindMap = MindMap;
  global.MindMap.PALETTE = PALETTE;
})(typeof window !== 'undefined' ? window : globalThis);
