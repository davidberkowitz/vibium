/* Wiring: state, controls, the animation loop, and the debounce that keeps the
   blind-spot measurement off the animation's back.

   The loop only ever advances one number — the grid's angle. Everything else
   changes when you move a control, and only the measurement is expensive, so it
   runs on a timer after the last change rather than every frame. */
(function (global) {
  'use strict';

  var Grid = global.Grid, Distort = global.Distort, Analyze = global.Analyze;

  var DEFAULTS = {
    form: 'square', speed: 6, lineWidth: 1, opacity: 0.55, pitch: 48, spokes: 12,
    color: '#7fe3ff', backdrop: 'dark', k1: 0, k2: 0, ox: 0, oy: 0, threshold: 1.5
  };

  var state = {};
  var angle = 0;
  var running = true;
  var showBlind = false;
  var probe = null;
  var map = null;
  var pending = null;
  var measuring = false;

  var canvas = document.getElementById('canvas');
  var renderer = new global.GridRenderer(canvas);
  var $ = function (id) { return document.getElementById(id); };

  function reset() {
    Object.keys(DEFAULTS).forEach(function (k) { state[k] = DEFAULTS[k]; });
    angle = 0;
    probe = null;
    pushToControls();
    invalidate();
  }

  /* ---- geometry ---------------------------------------------------------- */

  function distortion() {
    var w = renderer.width, h = renderer.height;
    return new Distort({
      k1: state.k1,
      k2: state.k2,
      norm: Math.sqrt(w * w + h * h) / 2,
      cx: w / 2 * (1 + state.ox / 100),
      cy: h / 2 * (1 + state.oy / 100)
    });
  }

  function frameState() {
    return {
      form: state.form,
      angle: angle,
      gridOpts: { pitch: state.pitch, spokes: state.spokes },
      opacity: state.opacity,
      lineWidth: state.lineWidth,
      color: state.color,
      backdrop: state.backdrop,
      distort: distortion(),
      cx: renderer.width / 2,
      cy: renderer.height / 2,
      showBlind: showBlind,
      showCentre: state.k1 !== 0 || state.k2 !== 0 || state.ox !== 0 || state.oy !== 0,
      probe: probe
    };
  }

  /* ---- measurement ------------------------------------------------------- */

  function cellSize() {
    var n = Math.round(Math.sqrt(renderer.width * renderer.height / 40000));
    return Math.max(4, Math.min(10, n));
  }

  /* Anything that changes the geometry drops the old measurement on the floor
     and books a new one. Speed, colour and opacity do not: they cannot move a
     blind spot, so they never pay for a remeasure. */
  function invalidate() {
    map = null;
    if (pending) clearTimeout(pending);
    if (!showBlind && !probe) { paintStats(); return; }
    measuring = true;
    pending = setTimeout(measure, 110);
  }

  function measure() {
    pending = null;
    var fs = frameState();
    var opts = {
      width: renderer.width, height: renderer.height,
      cx: fs.cx, cy: fs.cy, distort: fs.distort,
      form: state.form, gridOpts: fs.gridOpts,
      cell: cellSize(), angles: 48, threshold: state.threshold
    };
    map = showBlind ? Analyze.gapMap(opts) : null;
    if (probe) {
      opts.angle = angle;
      var g = Analyze.gapAt(opts, probe.x, probe.y);
      probe.worst = g ? g.worst : null;
      probe.ratio = g ? g.ratio : null;
      probe.stretch = g ? g.stretch : null;
    }
    measuring = false;
    paintStats();
  }

  function paintStats() {
    var s = $('s-worst'), o = $('s-over'), u = $('s-unmapped'), p = $('s-probe');
    if (measuring) {
      s.textContent = o.textContent = u.textContent = 'measuring…';
    } else if (!map) {
      s.textContent = o.textContent = u.textContent = '—';
    } else {
      s.textContent = '×' + map.max.toFixed(2) + '  (' + (map.max * map.nominal).toFixed(1) + ' px)';
      s.className = map.max > state.threshold ? 'alarm' : '';
      o.textContent = (map.overFraction * 100).toFixed(1) + '% of frame';
      o.className = map.overFraction > 0 ? 'alarm' : '';
      u.textContent = map.unmappedFraction > 0
        ? (map.unmappedFraction * 100).toFixed(1) + '% of frame'
        : 'none';
    }
    if (!probe) p.textContent = 'click the canvas';
    else if (probe.ratio == null) p.textContent = 'no image here';
    else {
      p.textContent = '×' + probe.ratio.toFixed(2) + '  (' + probe.worst.toFixed(1) + ' px)';
      p.className = probe.ratio > state.threshold ? 'alarm' : '';
    }

    var bits = [state.form, (state.speed >= 0 ? '+' : '') + state.speed.toFixed(1) + '°/s',
                angle.toFixed(0) + '°'];
    if (showBlind && map) bits.push('worst ×' + map.max.toFixed(2));
    $('readout').textContent = bits.join('  ·  ');
  }

  /* ---- controls ---------------------------------------------------------- */

  var SLIDERS = [
    ['speed', 'speed', function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '°/s'; }, false],
    ['width', 'lineWidth', function (v) { return v.toFixed(2) + ' px'; }, false],
    ['opacity', 'opacity', function (v) { return Math.round(v * 100) + '%'; }, false],
    ['pitch', 'pitch', function (v) { return v.toFixed(0) + ' px'; }, true],
    ['spokes', 'spokes', function (v) { return v.toFixed(0); }, true],
    ['k1', 'k1', function (v) { return v.toFixed(2); }, true],
    ['k2', 'k2', function (v) { return v.toFixed(2); }, true],
    ['ox', 'ox', function (v) { return (v >= 0 ? '+' : '') + v.toFixed(0) + '%'; }, true],
    ['oy', 'oy', function (v) { return (v >= 0 ? '+' : '') + v.toFixed(0) + '%'; }, true],
    ['threshold', 'threshold', function (v) { return '×' + v.toFixed(2); }, true]
  ];

  function pushToControls() {
    SLIDERS.forEach(function (row) {
      $(row[0]).value = state[row[1]];
      $('v-' + row[0]).textContent = row[2](state[row[1]]);
    });
    $('colour').value = state.color;
    $('backdrop').value = state.backdrop;
    document.querySelectorAll('.form').forEach(function (b) {
      b.classList.toggle('active', b.dataset.form === state.form);
    });
    $('row-spokes').hidden = state.form !== 'polar';
    $('btn-blind').classList.toggle('on', showBlind);
    $('btn-play').textContent = running ? 'Pause' : 'Play';
    var form = Grid.FORMS.filter(function (f) { return f.id === state.form; })[0];
    $('form-note').textContent = form ? form.note : '';
  }

  function bindControls() {
    SLIDERS.forEach(function (row) {
      $(row[0]).addEventListener('input', function (e) {
        state[row[1]] = parseFloat(e.target.value);
        $('v-' + row[0]).textContent = row[2](state[row[1]]);
        if (row[3]) invalidate(); else paintStats();
      });
    });

    $('colour').addEventListener('input', function (e) { state.color = e.target.value; });

    $('backdrop').addEventListener('change', function (e) {
      if (e.target.value === 'image' && !renderer.image) { $('file-input').click(); return; }
      state.backdrop = e.target.value;
    });

    document.querySelectorAll('.form').forEach(function (b) {
      b.addEventListener('click', function () { setForm(b.dataset.form); });
    });

    $('btn-play').addEventListener('click', togglePlay);
    $('btn-blind').addEventListener('click', toggleBlind);
    $('btn-reset').addEventListener('click', reset);
    $('btn-image').addEventListener('click', function () { $('file-input').click(); });
    $('btn-png').addEventListener('click', savePng);
    $('btn-panel').addEventListener('click', togglePanel);

    $('file-input').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) loadImage(e.target.files[0]);
      e.target.value = '';
    });

    ['dragover', 'drop'].forEach(function (type) {
      document.addEventListener(type, function (e) {
        e.preventDefault();
        if (type === 'drop' && e.dataTransfer.files[0]) loadImage(e.dataTransfer.files[0]);
      });
    });

    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      probe = { x: e.clientX - r.left, y: e.clientY - r.top };
      $('s-probe').className = '';
      invalidate();
    });

    document.addEventListener('keydown', onKey);
    global.addEventListener('resize', onResize);
  }

  function setForm(id) {
    state.form = id;
    pushToControls();
    invalidate();
  }

  function togglePlay() { running = !running; pushToControls(); }

  function toggleBlind() {
    showBlind = !showBlind;
    pushToControls();
    invalidate();
  }

  function togglePanel() {
    var p = $('panel');
    p.classList.toggle('hidden');
    $('btn-panel').textContent = p.classList.contains('hidden') ? '›' : '‹';
  }

  function loadImage(file) {
    if (!/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      renderer.image = img;
      state.backdrop = 'image';
      $('backdrop').value = 'image';
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function savePng() {
    canvas.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'gridprobe-' + state.form + '-k1_' + state.k1 + '.png';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }

  function onKey(e) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    var forms = ['square', 'triangular', 'polar', 'moire'];
    var key = e.key;
    if (key >= '1' && key <= '4') { setForm(forms[+key - 1]); return; }
    switch (key) {
      case ' ': e.preventDefault(); togglePlay(); break;
      case 'b': case 'B': toggleBlind(); break;
      case 'h': case 'H': togglePanel(); break;
      case 'r': case 'R': reset(); break;
      case '[': nudge('speed', -1); break;
      case ']': nudge('speed', 1); break;
      case '-': case '_': nudge('pitch', -4); break;
      case '=': case '+': nudge('pitch', 4); break;
      default: return;
    }
  }

  function nudge(name, by) {
    var input = $(name === 'speed' ? 'speed' : 'pitch');
    var v = Math.max(+input.min, Math.min(+input.max, state[name] + by));
    state[name] = v;
    input.value = v;
    input.dispatchEvent(new Event('input'));
  }

  function onResize() {
    renderer.resize();
    invalidate();
  }

  /* ---- loop -------------------------------------------------------------- */

  var last = 0, lastStats = 0;
  function frame(now) {
    var dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (running && state.speed !== 0) {
      angle = (angle + state.speed * dt) % 360;
      if (angle < 0) angle += 360;
      if (now - lastStats > 150) { lastStats = now; paintStats(); }
    }
    renderer.draw(frameState(), map);
    requestAnimationFrame(frame);
  }

  renderer.resize();
  reset();
  bindControls();
  paintStats();
  requestAnimationFrame(frame);
})(typeof window !== 'undefined' ? window : globalThis);
