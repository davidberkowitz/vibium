/* Driver Load Path — the input strip. Milestone 3.

   Five things a driver actually does — speed, steering, brake, throttle, and
   the road's grade — plus the surface under the tyres, because a friction
   limit you cannot change is a limit nobody notices.

   These are DRIVER INPUTS, not accelerations. That distinction is the whole
   point: you do not set 0.6 g of lateral acceleration, you turn a wheel at a
   speed and the car works out what that costs. Brake and throttle are pedal
   demand in g, converted to a longitudinal acceleration the tyres then have
   to find room for.

   The traction gauge is here rather than beside the figure on purpose. It is
   about what the INPUTS are asking for, and it is the one control that turns
   red before anything else does — the moment the demand leaves the friction
   ellipse, the drawing beside it stops being a description of anything real.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var V = global.LoadPathVectors;

  /* Two element helpers, and they are NOT interchangeable. V.el builds SVG
     nodes from an ATTRIBUTE OBJECT; dom() builds HTML nodes from a CLASS
     STRING. Aliasing V.el to `el` here and then calling it with a class string
     made it iterate the string's character indices as attribute names, which
     threw on the first one and killed the whole boot. Keeping the names
     distinct is the fix, and it is why they are named for what they build. */
  function dom(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var SPECS = [
    { id: 'speed',      label: 'Speed',    min: 0,   max: 55,  step: 1,    value: 0,
      unit: 'km/h', format: function (v) { return (v * 3.6).toFixed(0) + ' km/h'; } },
    { id: 'steerAngle', label: 'Steering', min: -0.10, max: 0.10, step: 0.002, value: 0,
      unit: 'rad', format: function (v) {
        var d = v * 180 / Math.PI;
        if (Math.abs(d) < 0.05) return 'straight';
        return Math.abs(d).toFixed(1) + '° ' + (v > 0 ? 'left' : 'right');
      } },
    { id: 'brake',      label: 'Brake',    min: 0, max: 1.1, step: 0.02, value: 0,
      unit: 'g', format: function (v) { return v < 0.005 ? 'off' : v.toFixed(2) + ' g'; } },
    { id: 'throttle',   label: 'Throttle', min: 0, max: 0.45, step: 0.01, value: 0,
      unit: 'g', format: function (v) { return v < 0.005 ? 'off' : v.toFixed(2) + ' g'; } },
    { id: 'gradePercent', label: 'Grade',  min: -20, max: 20, step: 1, value: 0,
      unit: '%', format: function (v) {
        if (v === 0) return 'level';
        return Math.abs(v) + '% ' + (v > 0 ? 'uphill' : 'downhill');
      } },
    /* M7. The odd one out in this list, and knowingly so: every other slider
       is something the driver DOES and this is something the driver IS. It
       sits here anyway because it belongs to the same solve and a reader
       should be able to move it and watch the load path change.

       Note what it is NOT called. Three named presets stood here — a 50th
       percentile male, a 5th percentile female, a 95th percentile male — all
       multiplying the same segment fractions taken from nine male cadavers.
       The number changed and the body never did, so the labels claimed a
       thing the model cannot do. It is a mass now, and it says so.

       It is also deliberately NOT part of a scenario timeline: a maneuver is
       a sequence of driver actions, and who is sitting there does not change
       halfway through a lane change. show() only touches keys it is given, so
       loading a preset leaves this alone. */
    { id: 'bodyMass', label: 'Occupant', min: C.OCCUPANT_MASS.min,
      max: C.OCCUPANT_MASS.max, step: C.OCCUPANT_MASS.step,
      value: C.OCCUPANT_MASS.value, unit: 'kg',
      format: function (v) { return v.toFixed(0) + ' kg'; } }
  ];

  var state = {};
  SPECS.forEach(function (s) { state[s.id] = s.value; });
  state.surface = 'dry';
  state.roadClass = 'B';

  var onChange = null;
  var onUser = null;
  var nodes = {};

  function emit() { if (onChange) onChange(read()); }

  function read() {
    return {
      speed: state.speed,
      steerAngle: state.steerAngle,
      brake: state.brake,
      throttle: state.throttle,
      gradePercent: state.gradePercent,
      bodyMass: state.bodyMass,
      surface: state.surface,
      mu: C.SURFACES[state.surface].mu,
      /* A vibration input and nothing else. It reaches the vibration solver and
         never the force solver; a unit test asserts that changing it does not
         move a single newton. */
      roadClass: state.roadClass,
      /* Pedal demand in g, resolved into one longitudinal acceleration.
         Both at once is a real thing a nervous driver does and the model
         should not pretend otherwise, so they simply sum. */
      ax: (state.throttle - state.brake) * C.G
    };
  }

  function buildSlider(spec, parent) {
    var wrap = dom('div', 'ctl');
    var lab = document.createElement('label');
    lab.className = 'ctl-label';
    lab.setAttribute('for', 'ctl-' + spec.id);
    lab.textContent = spec.label;
    var out = dom('span', 'ctl-val');
    out.id = 'out-' + spec.id;
    lab.appendChild(out);
    wrap.appendChild(lab);

    var input = document.createElement('input');
    input.type = 'range';
    input.id = 'ctl-' + spec.id;
    input.min = spec.min; input.max = spec.max; input.step = spec.step;
    input.value = spec.value;
    input.setAttribute('aria-describedby', 'out-' + spec.id);
    input.addEventListener('input', function () {
      /* A human moving this slider outranks anything driving it. Playback is
         writing to these every frame, so the app is told first and stops the
         clock before the new value is emitted — otherwise the next frame
         overwrites what was just dragged. */
      if (onUser) onUser(spec.id);
      state[spec.id] = parseFloat(input.value);
      out.textContent = spec.format(state[spec.id]);
      emit();
    });
    wrap.appendChild(input);
    parent.appendChild(wrap);

    out.textContent = spec.format(spec.value);
    nodes[spec.id] = { input: input, out: out, spec: spec };
  }

  function buildSurface(parent) {
    var wrap = dom('div', 'ctl ctl-surface');
    var lab = dom('span', 'ctl-label', 'Surface');
    wrap.appendChild(lab);
    var group = dom('div', 'seg');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Road surface');
    Object.keys(C.SURFACES).forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (key === state.surface ? ' on' : '');
      b.textContent = C.SURFACES[key].label.split(' ')[0];
      b.title = C.SURFACES[key].label + ', mu ' + C.SURFACES[key].mu.toFixed(2);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', key === state.surface ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (onUser) onUser('surface');
        state.surface = key;
        [].forEach.call(group.children, function (c) {
          c.classList.remove('on'); c.setAttribute('aria-checked', 'false');
        });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true');
        emit();
      });
      group.appendChild(b);
    });
    wrap.appendChild(group);
    parent.appendChild(wrap);
    nodes.surface = group;
  }

  /* Road roughness, an ISO 8608 class. It sits next to Surface because both are
     properties of the road, but they feed different halves of the app: mu goes
     to the friction ellipse, roughness goes to the vibration channel. */
  function buildRoad(parent) {
    var wrap = dom('div', 'ctl ctl-surface ctl-road');
    wrap.appendChild(dom('span', 'ctl-label', 'Roughness'));
    var group = dom('div', 'seg');
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', 'Road roughness class');
    Object.keys(C.ROAD.CLASSES).forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'seg-btn' + (key === state.roadClass ? ' on' : '');
      b.textContent = key;
      b.title = 'ISO 8608 class ' + key + ' — ' + C.ROAD.CLASSES[key].label;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', key === state.roadClass ? 'true' : 'false');
      b.addEventListener('click', function () {
        if (onUser) onUser('roadClass');
        state.roadClass = key;
        [].forEach.call(group.children, function (c) {
          c.classList.remove('on'); c.setAttribute('aria-checked', 'false');
        });
        b.classList.add('on'); b.setAttribute('aria-checked', 'true');
        emit();
      });
      group.appendChild(b);
    });
    wrap.appendChild(group);
    parent.appendChild(wrap);
    nodes.road = group;
  }

  /* The friction ellipse, live. Both axis maxima are mu*g, so the admissible
     region is a circle; what changes with the surface is its radius. The dot
     is what the inputs are demanding. Outside the ring, the car cannot do it. */
  function buildGauge(parent) {
    var wrap = dom('div', 'ctl ctl-gauge');
    wrap.appendChild(dom('span', 'ctl-label', 'Traction budget'));
    var svg = V.el('svg', { viewBox: '0 0 108 108', class: 'gauge' }, wrap);

    V.el('circle', { cx: 54, cy: 54, r: 42, fill: 'none', stroke: 'var(--line-strong)',
                   'stroke-width': 1.4, class: 'gauge-limit' }, svg);
    V.el('circle', { cx: 54, cy: 54, r: 21, fill: 'none', stroke: 'var(--line)',
                   'stroke-width': 1, 'stroke-dasharray': '3 4' }, svg);
    V.el('line', { x1: 8, y1: 54, x2: 100, y2: 54, stroke: 'var(--line)', 'stroke-width': 1 }, svg);
    V.el('line', { x1: 54, y1: 8, x2: 54, y2: 100, stroke: 'var(--line)', 'stroke-width': 1 }, svg);
    V.text('accel', { x: 54, y: 12, class: 'gauge-tick', fill: 'var(--line-strong)', 'text-anchor': 'middle' }, svg);
    V.text('brake', { x: 54, y: 103, class: 'gauge-tick', fill: 'var(--line-strong)', 'text-anchor': 'middle' }, svg);
    V.text('L', { x: 10, y: 58, class: 'gauge-tick', fill: 'var(--line-strong)' }, svg);
    V.text('R', { x: 94, y: 58, class: 'gauge-tick', fill: 'var(--line-strong)' }, svg);

    var dot = V.el('circle', { cx: 54, cy: 54, r: 4.5, fill: 'var(--act)', class: 'gauge-dot' }, svg);
    var read = dom('span', 'gauge-read');
    wrap.appendChild(read);
    parent.appendChild(wrap);
    nodes.gauge = { svg: svg, dot: dot, read: read };
  }

  /* Called by the app after each solve, so the gauge reports the SOLVED state
     rather than re-deriving it and risking the two disagreeing. */
  function updateGauge(vState, mu) {
    if (!nodes.gauge) return;
    var limit = mu * C.G;
    var ax = vState.demanded.ax, ay = vState.demanded.ay;
    // Screen: up is acceleration, left is a left turn.
    var px = 54 - (ay / limit) * 42;
    var py = 54 - (ax / limit) * 42;
    var u = vState.utilisation;
    var clampR = 60;
    px = Math.max(54 - clampR, Math.min(54 + clampR, px));
    py = Math.max(54 - clampR, Math.min(54 + clampR, py));
    nodes.gauge.dot.setAttribute('cx', px.toFixed(2));
    nodes.gauge.dot.setAttribute('cy', py.toFixed(2));
    nodes.gauge.dot.setAttribute('fill', u > 1 ? 'var(--warn)' : 'var(--act)');
    nodes.gauge.svg.classList.toggle('over', u > 1);
    nodes.gauge.read.textContent = (u * 100).toFixed(0) + '% of ' + mu.toFixed(2) + ' g' +
      (u > 1 ? '  ·  exceeded' : '');
    nodes.gauge.read.classList.toggle('over', u > 1);
  }

  function reset() {
    SPECS.forEach(function (s) {
      state[s.id] = s.value;
      nodes[s.id].input.value = s.value;
      nodes[s.id].out.textContent = s.format(s.value);
    });
    emit();
  }

  /* Move the controls to match values that came from somewhere else, WITHOUT
     emitting. Playback calls this every frame: the sliders are a readout of the
     scenario at that instant, and re-emitting here would loop the app back
     through its own solve twice a frame for no gain. set() is the version that
     does emit, for deep links and presets. */
  function show(values) {
    Object.keys(values || {}).forEach(function (k) {
      if (!nodes[k] || !nodes[k].input) return;
      if (state[k] === values[k]) return;
      state[k] = values[k];
      nodes[k].input.value = values[k];
      nodes[k].out.textContent = nodes[k].spec.format(values[k]);
    });
    if (values && values.surface && values.surface !== state.surface) {
      state.surface = values.surface;
      [].forEach.call(nodes.surface.children, function (c, i) {
        var key = Object.keys(C.SURFACES)[i];
        var on = key === values.surface;
        c.classList.toggle('on', on);
        c.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }
  }

  function set(values) {
    Object.keys(values || {}).forEach(function (k) {
      if (!nodes[k] || !nodes[k].input) return;
      state[k] = values[k];
      nodes[k].input.value = values[k];
      nodes[k].out.textContent = nodes[k].spec.format(values[k]);
    });
    emit();
  }

  function mount(root, handler, userHandler) {
    onChange = handler;
    onUser = userHandler || null;
    root.innerHTML = '';
    var strip = dom('div', 'ctl-strip');
    SPECS.forEach(function (s) { buildSlider(s, strip); });
    buildSurface(strip);
    buildRoad(strip);
    buildGauge(strip);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost ctl-reset';
    btn.textContent = 'Reset';
    btn.addEventListener('click', reset);
    strip.appendChild(btn);

    root.appendChild(strip);
    return { read: read, reset: reset, set: set, show: show,
             updateGauge: updateGauge };
  }

  global.LoadPathControls = { mount: mount, SPECS: SPECS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
