/* Wiring: input, view state, persistence, and the animation loop. */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'vibium.mindmap.v1';

  var canvas = document.getElementById('canvas');
  var editor = document.getElementById('editor');
  var hint = document.getElementById('hint');
  var help = document.getElementById('help');
  var fileInput = document.getElementById('file-input');

  var renderer = new global.Renderer(canvas);
  var cam2 = new global.Cameras.Camera2D();
  var cam3 = new global.Cameras.Camera3D();

  var app = {
    map: null,
    mode: '2d',
    t: 0,              // 0 = flat view, 1 = spatial view
    tTarget: 0,
    selectedId: null,
    hoverId: null,
    energy: 1,         // how hot the 3D force layout still is
    drag: null,
    editingId: null,
    undo: [],
    lastTime: 0
  };

  /* ---------- persistence ---------- */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.map.toJSON()));
    } catch (err) {
      /* private mode or a full quota — the map still works in memory */
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return global.MindMap.fromJSON(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }

  function snapshot() {
    app.undo.push(JSON.stringify(app.map.toJSON()));
    if (app.undo.length > 60) app.undo.shift();
    document.getElementById('btn-undo').disabled = false;
  }

  function undo() {
    var previous = app.undo.pop();
    if (!previous) return;
    var restored = global.MindMap.fromJSON(JSON.parse(previous));
    if (!restored) return;
    app.map = restored;
    if (!app.map.get(app.selectedId)) app.selectedId = app.map.rootId;
    app.energy = 1;
    document.getElementById('btn-undo').disabled = app.undo.length === 0;
    save();
  }

  /* ---------- map lifecycle ---------- */

  function adopt(map, options) {
    app.map = map;
    app.selectedId = map.rootId;
    app.undo = [];
    document.getElementById('btn-undo').disabled = true;
    if (options && options.layout) {
      global.Layout.radial(app.map, { force: true });
      global.Layout.seed3d(app.map, { force: true });
    }
    app.energy = 1;
    fit();
    save();
  }

  /* ---------- editing ---------- */

  function addChild(parentId, text) {
    var parent = app.map.get(parentId) || app.map.root();
    snapshot();
    var node = app.map.add(text || 'Idea', parent.id);
    if (!node) return null;
    layoutAround(node);
    app.selectedId = node.id;
    app.energy = 1;
    save();
    return node;
  }

  function addSibling(id, text) {
    var node = app.map.get(id);
    if (!node || !node.parentId) return addChild(id, text);
    return addChild(node.parentId, text);
  }

  /* Re-run the radial layout for unpinned nodes so a new node lands somewhere
     sensible without shoving the parts a human has arranged. */
  function layoutAround(node) {
    global.Layout.radial(app.map);
    if (node) {
      var parent = app.map.get(node.parentId);
      if (parent) {
        node.p3.x = parent.p3.x + (Math.random() - 0.5) * 60;
        node.p3.y = parent.p3.y + (Math.random() - 0.5) * 60;
        node.p3.z = parent.p3.z + (Math.random() - 0.5) * 60;
      }
    }
  }

  function removeSelected() {
    if (!app.selectedId || app.selectedId === app.map.rootId) return;
    var node = app.map.get(app.selectedId);
    if (!node) return;
    snapshot();
    var parentId = node.parentId;
    app.map.remove(node.id);
    app.selectedId = parentId || app.map.rootId;
    global.Layout.radial(app.map);
    app.energy = 1;
    save();
  }

  function startEditing(id) {
    var node = app.map.get(id);
    if (!node) return;
    app.editingId = id;
    editor.value = node.text;
    editor.hidden = false;
    positionEditor();
    editor.focus();
    editor.select();
  }

  function positionEditor() {
    if (!app.editingId) return;
    var placement = renderer.placement(app.editingId);
    if (!placement) return;
    editor.style.left = placement.x + 'px';
    editor.style.top = placement.y + 'px';
    editor.style.width = Math.max(110, placement.w + 20) + 'px';
  }

  function stopEditing(commit) {
    if (!app.editingId) return;
    var node = app.map.get(app.editingId);
    if (commit && node) {
      var text = editor.value.trim();
      if (text && text !== node.text) {
        snapshot();
        node.text = text;
        save();
      }
    }
    app.editingId = null;
    editor.hidden = true;
    canvas.focus();
  }

  /* ---------- view ---------- */

  function setMode(mode) {
    app.mode = mode;
    app.tTarget = mode === '3d' ? 1 : 0;
    if (mode === '3d') app.energy = Math.max(app.energy, 0.6);
    document.getElementById('mode-2d').classList.toggle('active', mode === '2d');
    document.getElementById('mode-3d').classList.toggle('active', mode === '3d');
    fit();
  }

  function fit() {
    var w = renderer.width || canvas.clientWidth;
    var h = renderer.height || canvas.clientHeight;
    if (app.mode === '2d') {
      var b = global.Layout.bounds(app.map, 'p2');
      var spanX = Math.max(240, b.max.x - b.min.x + 320);
      var spanY = Math.max(240, b.max.y - b.min.y + 220);
      cam2.x = (b.min.x + b.max.x) / 2;
      cam2.y = (b.min.y + b.max.y) / 2;
      cam2.zoom = Math.max(0.12, Math.min(1.6, Math.min(w / spanX, h / spanY)));
    } else {
      var b3 = global.Layout.bounds(app.map, 'p3');
      var depth = 0;
      app.map.all().forEach(function (n) { depth = Math.max(depth, app.map.depth(n.id)); });
      // Frame the outermost shell, so the view does not jump while the force
      // layout is still settling.
      var radius = global.Layout.SHELL * Math.max(1, depth);
      ['x', 'y', 'z'].forEach(function (axis) {
        radius = Math.max(radius, Math.abs(b3.min[axis]), Math.abs(b3.max[axis]));
      });
      cam3.dist = Math.max(320, radius * 1.15 * cam3.focal / (0.45 * Math.min(w, h)));
    }
  }

  function screenPoint(event) {
    var rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /* ---------- pointer input ---------- */

  canvas.addEventListener('pointerdown', function (event) {
    canvas.setPointerCapture(event.pointerId);
    stopEditing(true);
    var point = screenPoint(event);
    var hit = renderer.pick(point.x, point.y);

    if (hit) {
      app.selectedId = hit.node.id;
      app.drag = {
        kind: 'node',
        id: hit.node.id,
        moved: false,
        shift: event.shiftKey,
        last: point
      };
      snapshot();
    } else {
      app.drag = { kind: app.mode === '3d' ? 'orbit' : 'pan', last: point };
    }
  });

  canvas.addEventListener('pointermove', function (event) {
    var point = screenPoint(event);
    var drag = app.drag;

    if (!drag) {
      var hover = renderer.pick(point.x, point.y);
      app.hoverId = hover ? hover.node.id : null;
      canvas.style.cursor = hover ? 'grab' : (app.mode === '3d' ? 'move' : 'default');
      return;
    }

    var dx = point.x - drag.last.x;
    var dy = point.y - drag.last.y;
    drag.last = point;
    if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true;

    if (drag.kind === 'pan') {
      cam2.x -= dx / cam2.zoom;
      cam2.y -= dy / cam2.zoom;
      return;
    }
    if (drag.kind === 'orbit') {
      cam3.orbit(dx, dy);
      return;
    }

    var node = app.map.get(drag.id);
    if (!node) return;
    node.pinned = true;
    if (app.mode === '3d') {
      // Slide the node across the plane that faces the camera.
      var placement = renderer.placement(node.id);
      var scale = placement ? placement.s : 1;
      var basis = cam3.basis();
      node.p3.x += (basis.right.x * dx + basis.up.x * dy) / scale;
      node.p3.y += (basis.right.y * dx + basis.up.y * dy) / scale;
      node.p3.z += (basis.right.z * dx + basis.up.z * dy) / scale;
      node.v3.x = 0; node.v3.y = 0; node.v3.z = 0;
      app.energy = Math.max(app.energy, 0.5);
    } else {
      node.p2.x += dx / cam2.zoom;
      node.p2.y += dy / cam2.zoom;
    }
    app.hoverId = drag.shift ? pickOther(point, node.id) : null;
  });

  function pickOther(point, excludeId) {
    var hit = renderer.pick(point.x, point.y, excludeId);
    return hit ? hit.node.id : null;
  }

  function endDrag(event) {
    var drag = app.drag;
    app.drag = null;
    if (!drag) return;
    if (drag.kind !== 'node') return;

    if (drag.shift) {
      var target = pickOther(screenPoint(event), drag.id);
      if (target && app.map.reparent(drag.id, target)) {
        global.Layout.radial(app.map);
        app.energy = 1;
      }
    }
    if (!drag.moved) app.undo.pop();     // a plain click should not cost an undo step
    document.getElementById('btn-undo').disabled = app.undo.length === 0;
    app.hoverId = null;
    save();
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('dblclick', function (event) {
    var point = screenPoint(event);
    var hit = renderer.pick(point.x, point.y);
    if (hit) {
      app.selectedId = hit.node.id;
      startEditing(hit.node.id);
      return;
    }
    var node = addChild(app.selectedId || app.map.rootId, 'Idea');
    if (!node) return;
    node.pinned = true;
    if (app.mode === '2d') {
      var world = cam2.unproject(point.x, point.y, renderer.width, renderer.height);
      node.p2.x = world.x;
      node.p2.y = world.y;
    }
    startEditing(node.id);
  });

  canvas.addEventListener('wheel', function (event) {
    event.preventDefault();
    var factor = Math.exp(-event.deltaY * 0.0015);
    if (app.mode === '3d') {
      cam3.dolly(1 / factor);
      return;
    }
    var point = screenPoint(event);
    var before = cam2.unproject(point.x, point.y, renderer.width, renderer.height);
    cam2.zoom = Math.max(0.08, Math.min(4, cam2.zoom * factor));
    var after = cam2.unproject(point.x, point.y, renderer.width, renderer.height);
    cam2.x += before.x - after.x;
    cam2.y += before.y - after.y;
  }, { passive: false });

  /* ---------- keyboard ---------- */

  editor.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') { event.preventDefault(); stopEditing(true); }
    else if (event.key === 'Escape') { event.preventDefault(); stopEditing(false); }
    event.stopPropagation();
  });
  editor.addEventListener('blur', function () { stopEditing(true); });

  function navigate(key) {
    var node = app.map.get(app.selectedId);
    if (!node) return;
    if (key === 'ArrowUp' && node.parentId) {
      app.selectedId = node.parentId;
      return;
    }
    if (key === 'ArrowDown') {
      var kids = app.map.children(node.id);
      if (kids.length) app.selectedId = kids[0].id;
      return;
    }
    var siblings = app.map.siblings(node.id);
    if (siblings.length < 2) return;
    var index = siblings.findIndex(function (s) { return s.id === node.id; });
    var next = key === 'ArrowLeft' ? index - 1 : index + 1;
    next = (next + siblings.length) % siblings.length;
    app.selectedId = siblings[next].id;
  }

  document.addEventListener('keydown', function (event) {
    if (app.editingId) return;
    if (event.target && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;

    var key = event.key;
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    switch (key) {
      case 'Tab':
        event.preventDefault();
        var child = addChild(app.selectedId, 'Idea');
        if (child) startEditing(child.id);
        break;
      case 'Enter':
        event.preventDefault();
        var created = addSibling(app.selectedId, 'Idea');
        if (created) startEditing(created.id);
        break;
      case 'F2':
        event.preventDefault();
        startEditing(app.selectedId);
        break;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        removeSelected();
        break;
      case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
        event.preventDefault();
        navigate(key);
        break;
      case '2': setMode('2d'); break;
      case '3': setMode('3d'); break;
      case 'l': case 'L': relayout(); break;
      case 'f': case 'F': fit(); break;
      case '?': help.hidden = !help.hidden; break;
      case 'Escape': help.hidden = true; break;
      default: break;
    }
  });

  /* ---------- toolbar ---------- */

  function relayout() {
    snapshot();
    app.map.all().forEach(function (node) { node.pinned = false; });
    global.Layout.radial(app.map, { force: true });
    global.Layout.seed3d(app.map, { force: true });
    app.energy = 1;
    fit();
    save();
  }

  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function fileName(extension) {
    var root = app.map.root();
    var base = (root && root.text ? root.text : 'mindmap')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mindmap';
    return base + '.' + extension;
  }

  function exportPng() {
    // Paint the canvas onto an opaque copy so the PNG is not transparent.
    var out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    out.toBlob(function (blob) {
      if (blob) download(blob, fileName('png'));
    });
  }

  function bind(id, handler) {
    document.getElementById(id).addEventListener('click', handler);
  }

  bind('mode-2d', function () { setMode('2d'); });
  bind('mode-3d', function () { setMode('3d'); });
  bind('btn-child', function () {
    var node = addChild(app.selectedId, 'Idea');
    if (node) startEditing(node.id);
  });
  bind('btn-sibling', function () {
    var node = addSibling(app.selectedId, 'Idea');
    if (node) startEditing(node.id);
  });
  bind('btn-rename', function () { startEditing(app.selectedId); });
  bind('btn-delete', removeSelected);
  bind('btn-layout', relayout);
  bind('btn-fit', fit);
  bind('btn-undo', undo);
  bind('btn-help', function () { help.hidden = !help.hidden; });
  bind('btn-new', function () {
    if (!confirm('Start a new map? The current one will be replaced.')) return;
    var map = new global.MindMap();
    map.setRoot('Central idea');
    adopt(map, { layout: true });
  });
  bind('btn-json', function () {
    var blob = new Blob([JSON.stringify(app.map.toJSON(), null, 2)], { type: 'application/json' });
    download(blob, fileName('json'));
  });
  bind('btn-png', exportPng);
  bind('btn-import', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var map = global.MindMap.fromJSON(JSON.parse(String(reader.result)));
        if (!map) throw new Error('not a mind map file');
        adopt(map);
      } catch (err) {
        alert('That file could not be read as a mind map.');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  /* ---------- loop ---------- */

  function tick(now) {
    var dt = app.lastTime ? Math.min(0.05, (now - app.lastTime) / 1000) : 1 / 60;
    app.lastTime = now;

    if (app.t !== app.tTarget) {
      var direction = app.tTarget > app.t ? 1 : -1;
      app.t += direction * dt * 2.2;
      if ((direction > 0 && app.t > app.tTarget) || (direction < 0 && app.t < app.tTarget)) {
        app.t = app.tTarget;
      }
    }

    if (app.t > 0.01 && app.energy > 0.35) {
      app.energy = global.Layout.step3d(app.map, dt);
    }

    renderer.draw({
      map: app.map,
      cam2: cam2,
      cam3: cam3,
      t: app.t,
      selectedId: app.selectedId,
      hoverId: app.hoverId
    });

    positionEditor();
    hint.textContent = app.map.nodes.size + ' nodes · ' +
      (app.mode === '3d' ? 'drag to orbit, wheel to dolly' : 'drag to pan, wheel to zoom') +
      ' · press ? for shortcuts';

    requestAnimationFrame(tick);
  }

  /* ---------- start ---------- */

  function start() {
    renderer.resize();
    var stored = load();
    if (stored) {
      adopt(stored);
    } else {
      adopt(global.MindMap.sample(), { layout: true });
    }
    canvas.tabIndex = 0;
    requestAnimationFrame(tick);
  }

  global.addEventListener('resize', function () {
    renderer.resize();
    fit();
  });

  global.mindmapApp = app;   // handy for debugging and automated checks
  start();
})(typeof window !== 'undefined' ? window : globalThis);
