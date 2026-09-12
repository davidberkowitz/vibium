/* Driver Load Path — M5. Two views, live inputs, scripted maneuvers, and a
   separate vibration channel.

   Up to now the app showed one frozen state. This is where it becomes a
   simulation: you set what a driver does, and every number and every arrow on
   both drawings follows from the same solve.

   The chain, once per input change:

     controls  ->  driver inputs (speed, steering, pedals, grade, surface)
     vehicle   ->  EQ 1-4: what the cabin's acceleration actually is, clamped
                   to the friction ellipse if the inputs demanded more
     occupant  ->  EQ 5-6: what force the body therefore needs, in total
     contacts  ->  the split across the twelve places it can enter
     views     ->  side elevation and plan, sharing one answer

   Nothing is recomputed anywhere else. The panel does not re-derive the
   g-load, the gauge does not re-derive the friction utilisation. Two places
   computing the same number is two places to disagree.

   The one thing the app refuses to do is draw a state the car cannot reach.
   Past the friction limit it keeps showing the clamped, achievable state and
   says plainly that the demand was more than the tyres have.

   M4 adds time. A scenario is a timeline of those same driver inputs, so
   playback feeds the chain above from a clock instead of from a thumb — it is
   not a second code path. The one insertion is between vehicle and occupant:
   the body's acceleration is a first-order lagged copy of the cabin's, so the
   figure arrives late the way a real occupant does. The tyres are not lagged;
   they are bolted to the car.

   M5 adds a channel that is deliberately NOT part of any of that. Whole-body
   vibration is a weighted RMS over a frequency band, not a balance at an
   instant, so it takes the speed and the road roughness and nothing else, and
   returns m/s^2 that never touch a force arrow. The plan called that separation
   out as a failure mode before either half existed; the test that enforces it
   asserts that changing the road class moves no contact force by a single
   newton.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var V = global.LoadPathVehicle;
  var O = global.LoadPathOccupant;
  var K = global.LoadPathContacts;
  var T = global.LoadPathTouchpoints;
  var Side = global.LoadPathSideView;
  var Plan = global.LoadPathPlanView;
  var Controls = global.LoadPathControls;
  var Assumptions = global.LoadPathAssumptions;
  var S = global.LoadPathScenarios;
  var Transport = global.LoadPathTransport;
  var Vib = global.LoadPathVibration;
  var Spectrum = global.LoadPathSpectrum;
  var Scene3D = global.LoadPathScene3D;
  var Anat = global.LoadPathAnatomy;

  var CAR = C.VEHICLES.sedan;
  var DRIVER = C.OCCUPANTS.m50;

  var sideView = null, planView = null, controls = null, transport = null;
  var selectedId = null;
  var cur = { inputs: null, vehicle: null, occupant: null, split: null, lagErr: 0 };

  /* M4 playback state. One clock, one rAF loop, one lag tracker — see frame(). */
  var lag = S.makeLag(S.TAU);
  var target = null;          // the inputs we are heading toward
  var rafId = null;
  var lastT = 0;

  /* Below this the body is close enough to the cabin that the difference is
     not a physical statement, just arithmetic left over. Pin and stop the
     loop: an idle page should burn no frames, and a settled screenshot should
     be bit-identical to the same state reached by slider alone. */
  var SETTLE = 0.02;          // m/s^2

  /* M6 camera. Default is a three-quarter view from the driver's front-left:
     far enough round to read as 3D, close enough to zero yaw that the shape
     still resembles the side elevation the reader already knows. */
  var cam = { yaw: -1.02, pitch: 0.30, mode: '2d' };

  function n1(x) { return x.toFixed(1); }
  function load(id) {
    var t = cur.split && cur.split.feasible && cur.split.byTouchpoint[id];
    return t ? t.magnitude : 0;
  }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* ---------------- the one solve ---------------- */
  function solveAll(inputs, bodyAccel) {
    var vehicle = V.solve({
      speed: inputs.speed, steerAngle: inputs.steerAngle,
      ax: inputs.ax, mu: inputs.mu, gradePercent: inputs.gradePercent
    }, CAR);
    /* The tyres get the cabin's acceleration; the occupant gets the lagged
       one. During a transient those genuinely differ, and the drawings are
       supposed to show that rather than average it away: the corner loads have
       already moved while the body is still arriving. */
    var a = bodyAccel || vehicle.accel;
    var occupant = O.solve({
      bodyMass: DRIVER.mass,
      accel: O.vec(a.x, a.y, 0),
      gravity: O.gravityForGrade(inputs.gradePercent)
    });
    var split = K.solve(occupant.carOnBody);

    /* The vibration channel. It takes the SPEED and the ROAD CLASS and nothing
       else — not the acceleration, not the lagged body state, and certainly not
       the contact split. It is computed here only so there is one solve per
       frame; its result never re-enters the chain above it. */
    var vibration = Vib.solve({ speed: inputs.speed, roadClass: inputs.roadClass });

    return { inputs: inputs, vehicle: vehicle, occupant: occupant,
             split: split, vibration: vibration };
  }

  /* ---------------- panel ---------------- */
  function renderState() {
    var box = document.getElementById('state-rows');
    box.innerHTML = '';
    var s = cur.occupant, v = cur.vehicle;
    var audit = O.auditThirdLaw(s);
    var bal = cur.split.feasible ? K.auditBalance(cur.split, s.carOnBody) : null;
    var loaded = cur.split.feasible
      ? Object.keys(cur.split.byTouchpoint).filter(function (k) {
          return cur.split.byTouchpoint[k].magnitude > 0.5; }).length
      : 0;
    var r = v.turnRadius;

    var rows = [
      ['Apparent g-load', s.gLoad.toFixed(2) + ' g', 'you always feel 1 g at rest'],
      ['Longitudinal', (v.accel.x / C.G).toFixed(2) + ' g', v.accel.x < -0.01 ? 'braking' : (v.accel.x > 0.01 ? 'accelerating' : 'steady')],
      ['Lateral', (v.accel.y / C.G).toFixed(2) + ' g', v.accel.y > 0.01 ? 'turning left' : (v.accel.y < -0.01 ? 'turning right' : 'straight')],
      ['Turn radius', r === Infinity ? '—' : r.toFixed(0) + ' m', 'from speed and steering'],
      ['Body vs cabin', cur.lagErr > 0 ? (cur.lagErr / C.G).toFixed(2) + ' g behind' : 'settled',
       cur.lagErr > 0 ? 'the occupant is still arriving' : 'body and cabin agree'],
      ['Traction used', (v.utilisation * 100).toFixed(0) + ' %', v.tractionExceeded ? 'DEMAND EXCEEDS GRIP' : 'within the friction ellipse'],
      ['Car → driver', n1(O.magnitude(s.carOnBody)) + ' N', 'total across all contacts'],
      ['Contacts carrying load', loaded + ' of 12', 'the rest are idle or slack'],
      ['Belts', cur.split.slackEngaged ? 'engaged' : 'slack', 'webbing takes up only when bracing runs out'],
      ['Third-law residual', audit.worst.toExponential(1) + ' N', 'checked, not assumed'],
      ['Split balance residual', bal ? bal.residual.toExponential(1) + ' N' : '—', 'the split re-sums to the total']
    ];
    rows.forEach(function (x) {
      var cls = 'row';
      if (x[0] === 'Traction used' && v.tractionExceeded) cls += ' warn';
      if (x[0] === 'Body vs cabin' && cur.lagErr > 0) cls += ' transient';
      var row = el('div', cls);
      row.appendChild(el('span', 'k', x[0]));
      row.appendChild(el('span', 'v', x[1]));
      row.appendChild(el('span', 'note', x[2]));
      box.appendChild(row);
    });

    var banner = document.getElementById('limit-banner');
    banner.hidden = !v.tractionExceeded;
    if (v.tractionExceeded) {
      banner.textContent = 'These inputs ask for ' + (v.utilisation * 100).toFixed(0) +
        '% of the available grip. The car cannot do it, so both drawings show the ' +
        'clamped state the tyres can actually deliver — not what you asked for.';
    }
  }

  /* The ride panel. Units are m/s^2 throughout and it is kept visually apart
     from the force rows, because the single most likely misreading of this
     screen is treating a comfort number as another force. */
  function renderVibration() {
    var box = document.getElementById('vib-rows');
    var v = cur.vibration;
    box.innerHTML = '';
    var rows = [
      ['Vertical, a_wz', v.awz.toFixed(3) + ' m/s²', 'Wk weighted'],
      ['Horizontal each, a_w', v.awx.toFixed(3) + ' m/s²', 'Wd weighted'],
      ['Total value, a_v', v.av.toFixed(3) + ' m/s²', 'equation 7'],
      ['Horizontal share', (v.horizontalShare * 100).toFixed(0) + ' %',
       'of a_v\u00b2, on a guessed ratio'],
      ['Road', 'class ' + v.roadClass, v.roadLabel.toLowerCase()]
    ];
    rows.forEach(function (x) {
      var row = el('div', 'row vib-row' + (x[0].indexOf('Total') === 0 ? ' vib-total' : ''));
      row.appendChild(el('span', 'k', x[0]));
      row.appendChild(el('span', 'v', x[1]));
      row.appendChild(el('span', 'note', x[2]));
      box.appendChild(row);
    });

    var bands = document.getElementById('vib-bands');
    bands.innerHTML = '';
    var c = v.comfort;
    var verdict = el('div', 'vib-verdict ' + c.level);
    verdict.appendChild(el('span', 'vv-label', c.label));
    if (c.overlapping) {
      /* ISO's own bands overlap, so a value can sit in two at once. Saying both
         is not hedging — it is reporting the standard's stated precision. */
      verdict.appendChild(el('span', 'vv-also', 'also: ' + c.also));
    }
    bands.appendChild(verdict);

    if (v.av > 0) {
      var split = el('div', 'vib-split');
      v.bands.forEach(function (b) {
        var r = el('div', 'vb');
        r.appendChild(el('span', 'vb-k', b.label));
        r.appendChild(el('span', 'vb-v', (b.share * 100).toFixed(0) + '%'));
        var bar = el('span', 'bar'); var i = el('i');
        i.style.width = (b.share * 100).toFixed(1) + '%';
        bar.appendChild(i); r.appendChild(bar);
        split.appendChild(r);
      });
      bands.appendChild(split);
      bands.appendChild(el('p', 'muted',
        'Share of the weighted vertical energy. Where it sits is why the number ' +
        'is what it is.'));
    } else {
      bands.appendChild(el('p', 'muted',
        'Stationary: no road passes under the tyres, so there is no road input ' +
        'at all. Idle and driveline vibration are not modelled.'));
    }
  }

  function renderContacts() {
    var box = document.getElementById('contact-rows');
    box.innerHTML = '';
    var maxLoad = 1;
    T.ALL.forEach(function (tp) { maxLoad = Math.max(maxLoad, load(tp.id)); });
    T.ALL.forEach(function (tp) {
      var f = load(tp.id);
      var row = el('div', 'row contact-row' + (f > 0.5 ? ' on' : ' off'));
      row.setAttribute('data-id', tp.id);
      row.setAttribute('tabindex', '0');
      row.appendChild(el('span', 'n', tp.n));
      row.appendChild(el('span', 'k', tp.label));
      row.appendChild(el('span', 'v force', f > 0.5 ? n1(f) + ' N' : '—'));
      var barWrap = el('span', 'bar');
      var bar = el('i');
      bar.style.width = (f > 0.5 ? (f / maxLoad * 100) : 0).toFixed(1) + '%';
      barWrap.appendChild(bar);
      row.appendChild(barWrap);
      ['mouseenter', 'focus', 'click'].forEach(function (evt) {
        row.addEventListener(evt, function () { select(tp.id); });
      });
      box.appendChild(row);
    });
  }

  function renderDetail(id) {
    var box = document.getElementById('detail');
    var tp = id ? T.byId(id) : null;
    box.innerHTML = '';
    if (!tp) {
      box.appendChild(el('p', 'muted',
        'Hover or select a contact to see what crosses it, in both directions.'));
      return;
    }
    var h = el('h3');
    h.appendChild(el('span', 'n', tp.n));
    h.appendChild(document.createTextNode(' ' + tp.label));
    box.appendChild(h);
    box.appendChild(el('p', 'anat', tp.anatomy));

    var f = load(tp.id);
    var fr = el('div', 'detail-force' + (f > 0.5 ? '' : ' idle'));
    fr.appendChild(el('span', 'fv', f > 0.5 ? n1(f) + ' N' : 'no load'));
    fr.appendChild(el('span', 'fl', f > 0.5 ? 'in this state' : 'nothing crosses this contact right now'));
    box.appendChild(fr);

    var pair = el('div', 'pair');
    var a = el('div', 'half act');
    a.appendChild(el('span', 'dir', 'car → driver'));
    a.appendChild(el('span', 'what', tp.carOnDriver));
    var b = el('div', 'half react');
    b.appendChild(el('span', 'dir', 'driver → car'));
    b.appendChild(el('span', 'what', tp.driverOnCar));
    pair.appendChild(a); pair.appendChild(b);
    box.appendChild(pair);

    if (cur.split && cur.split.feasible) {
      var sat = cur.split.channels.filter(function (ch) {
        return ch.touchpoint === tp.id && ch.saturated; });
      if (sat.length) {
        box.appendChild(el('p', 'muted',
          'At its bracing limit. A driver can only push so hard here, so any ' +
          'further load goes somewhere else.'));
      }
    }

    var meta = el('div', 'meta');
    meta.appendChild(el('span', null, 'axis: ' + tp.axis));
    meta.appendChild(el('span', null, 'dominant in: ' + tp.dominantRegime));
    meta.appendChild(el('span', null, tp.constraint));
    box.appendChild(meta);
    if (tp.gated) box.appendChild(el('p', 'muted', tp.gated));
  }

  function renderSegments() {
    var box = document.getElementById('segment-rows');
    box.innerHTML = '';
    var max = 0;
    cur.occupant.segments.forEach(function (s) { if (s.magnitude > max) max = s.magnitude; });
    cur.occupant.segments.forEach(function (s) {
      var row = el('div', 'row seg');
      row.appendChild(el('span', 'k', s.label));
      row.appendChild(el('span', 'v', n1(s.mass) + ' kg'));
      row.appendChild(el('span', 'v', n1(s.magnitude) + ' N'));
      var barWrap = el('span', 'bar');
      var bar = el('i');
      bar.style.width = (s.magnitude / max * 100).toFixed(1) + '%';
      barWrap.appendChild(bar);
      row.appendChild(barWrap);
      box.appendChild(row);
    });
  }

  function renderCaveats() {
    var box = document.getElementById('caveats');
    box.innerHTML = '';
    Object.keys(C.PROVENANCE).forEach(function (key) {
      var rec = C.PROVENANCE[key];
      if (rec.status === 'verified' || rec.status === 'design') return;
      var row = el('div', 'caveat');
      row.appendChild(el('span', 'pill ' + rec.status, rec.status));
      row.appendChild(el('span', 'ck', key));
      if (rec.caveat) row.appendChild(el('span', 'cv', rec.caveat.replace(/\s+/g, ' ')));
      box.appendChild(row);
    });
  }

  function select(id) {
    selectedId = id;
    if (sideView) sideView.highlight(id);
    if (planView) planView.highlight(id);
    if (cam.mode === '3d') draw3D();
    renderDetail(id);
    var rows = document.querySelectorAll('#contact-rows .contact-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('sel', rows[i].getAttribute('data-id') === id);
    }
  }

  /* ---------------- redraw ---------------- */
  function draw(inputs, bodyAccel, lagErr) {
    cur = solveAll(inputs, bodyAccel);
    cur.lagErr = lagErr || 0;

    document.getElementById('readout').textContent =
      CAR.label + ' · ' + DRIVER.label + ' · ' + C.SURFACES[inputs.surface].label.toLowerCase();

    sideView = Side.render(document.getElementById('figure'), cur.occupant,
                           function (id) { select(id); }, cur.split);
    planView = Plan.render(document.getElementById('figure-plan'), cur.vehicle,
                           cur.occupant, cur.split, function (id) { select(id); });

    Spectrum.render(document.getElementById('spectrum'), cur.vibration);
    if (cam.mode === '3d') draw3D();

    renderState();
    renderVibration();
    renderContacts();
    renderSegments();
    if (controls) controls.updateGauge(cur.vehicle, inputs.mu);
    if (selectedId) select(selectedId); else renderDetail(null);
  }

  function draw3D() {
    var out = Scene3D.render(document.getElementById('scene3d'), {
      yaw: cam.yaw, pitch: cam.pitch,
      occupant: cur.occupant, split: cur.split, vehicle: cur.vehicle,
      selected: selectedId,
      onPick: function (id) { select(id); }
    });
    /* The narrow-screen readout, from the same return value the scene drew
       from. Two renderings of one fact, never two facts. */
    var el = document.getElementById('scene3d-readout');
    if (!el) return;
    if (!out || !(out.magnitude > 0)) { el.textContent = ''; return; }
    el.innerHTML = '<b>' + out.magnitude.toFixed(0) + ' N</b> \u00b7 ' + out.axes +
      '<span>side elevation sees it, and misses <b>' +
      out.missSideDeg.toFixed(0) + '\u00b0</b></span>' +
      '<span>plan sees it, and misses <b>' +
      out.missPlanDeg.toFixed(0) + '\u00b0</b></span>';
  }

  /* Orbit. Pointer events so a trackpad drag, a mouse and a touch screen all
     work without three separate handlers. */
  function mountOrbit() {
    var host = document.getElementById('scene3d');
    var dragging = false, lastX = 0, lastY = 0;
    host.addEventListener('pointerdown', function (ev) {
      if (ev.target.classList.contains('sc-contact')) return;   // let picks pick
      dragging = true; lastX = ev.clientX; lastY = ev.clientY;
      host.setPointerCapture(ev.pointerId);
    });
    host.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      cam.yaw += (ev.clientX - lastX) * 0.01;
      /* Pitch is clamped short of straight down. Past vertical the scene turns
         inside out and the axis tripod starts lying about which way is up. */
      cam.pitch = Math.max(-0.2, Math.min(1.25, cam.pitch + (ev.clientY - lastY) * 0.006));
      lastX = ev.clientX; lastY = ev.clientY;
      draw3D();
    });
    ['pointerup', 'pointercancel'].forEach(function (e) {
      host.addEventListener(e, function () { dragging = false; });
    });
  }

  function mountViewSwitch() {
    var note = document.getElementById('vs-note');
    var pane = document.getElementById('pane-3d');
    var figs = document.querySelector('.figures');
    [].forEach.call(document.querySelectorAll('.vs-btn'), function (b) {
      b.addEventListener('click', function () {
        cam.mode = b.getAttribute('data-view');
        [].forEach.call(document.querySelectorAll('.vs-btn'), function (o) {
          o.classList.toggle('on', o === b);
        });
        var is3d = cam.mode === '3d';
        pane.hidden = !is3d;
        figs.hidden = is3d;
        note.textContent = is3d
          ? 'one resultant, and what each 2D drawing misses of it'
          : 'the side elevation and the plan, as built';
        if (is3d) draw3D();
      });
    });
  }

  /* ---------------- the frame loop ----------------

     One loop serves both jobs, because both are the same job: something is
     changing and the drawing has to keep up. Playback moves the inputs; the
     lag moves the body toward whatever the inputs produced. Either can be the
     only thing running.

     It shuts itself off. When nothing is playing and the body has caught the
     cabin, the last frame pins the lag exactly on target, draws once more, and
     stops requesting frames. That is not just politeness about battery: it is
     what makes a settled M4 state identical to the M3 state it replaces, which
     is the difference between "the lag is a transient" and "the lag quietly
     biases every number on screen".  */
  function frame(now) {
    rafId = null;
    var dt = lastT ? Math.min(0.25, (now - lastT) / 1000) : 0;
    lastT = now;

    if (transport && transport.isPlaying()) {
      transport.advance(dt);
      target = transport.inputs();
      controls.show(target);
    }

    var vehicle = V.solve({
      speed: target.speed, steerAngle: target.steerAngle,
      ax: target.ax, mu: target.mu, gradePercent: target.gradePercent
    }, CAR);
    var want = { x: vehicle.accel.x, y: vehicle.accel.y };

    if (transport && transport.lagEnabled()) lag.step(want, dt);
    else lag.reset(want);

    var err = lag.error(want);
    var settled = err < SETTLE;
    if (settled) lag.reset(want);
    draw(target, lag.value(), settled ? 0 : err);

    var running = (transport && transport.isPlaying()) || !settled;
    if (running) rafId = requestAnimationFrame(frame);
    else lastT = 0;
  }

  function wake() {
    if (rafId == null) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }

  /* Controls emit here. The loop does the solving, so this only records where
     we are headed and makes sure something is turning. */
  function setTarget(inputs) { target = inputs; wake(); }

  /* Snap to a state with no transient — page load, a scrub, a scenario
     change. There is no "previous" for the body to be arriving from. */
  function seek(inputs) {
    target = inputs;
    /* The controls are the readout of wherever we just jumped to. Without
       this a scrubbed or freshly loaded scenario draws the right figure over
       a set of sliders still showing the last thing the user touched, which
       reads as a bug even though the solve is correct. */
    if (controls) controls.show(inputs);
    var vehicle = V.solve({
      speed: inputs.speed, steerAngle: inputs.steerAngle,
      ax: inputs.ax, mu: inputs.mu, gradePercent: inputs.gradePercent
    }, CAR);
    lag.reset({ x: vehicle.accel.x, y: vehicle.accel.y });
    draw(inputs, lag.value(), 0);
  }

  function boot() {
    Assumptions.mount(document.body, document.getElementById('btn-assumptions'));
    controls = Controls.mount(
      document.getElementById('controls'),
      setTarget,
      /* A human touched a control. Whatever was scripting those sliders is
         over — the scenario chip drops back to Manual and the clock stops. */
      function () { if (transport) transport.stop('manual'); }
    );
    transport = Transport.mount(document.getElementById('transport'), {
      onSeek: function (inputs) { seek(inputs); },
      onModeChange: function () { wake(); },
      onLagChange: function () { wake(); }
    });
    mountViewSwitch();
    mountOrbit();
    renderCaveats();
    seek(controls.read());

    var want = new URLSearchParams(location.search);
    var sel = want.get('select');
    if (sel && T.byId(sel)) select(sel);

    /* A scenario can be deep-linked for sharing or for a screenshot:
       ?speed=25&steerAngle=0.045&brake=0.4 */
    var preset = {};
    ['speed', 'steerAngle', 'brake', 'throttle', 'gradePercent'].forEach(function (k) {
      if (want.has(k)) preset[k] = parseFloat(want.get(k));
    });
    if (Object.keys(preset).length) controls.set(preset);

    /* ?play=lane_change loads and starts a maneuver straight from a link,
       which is also how the headless screenshot pass drives it. */
    var play = want.get('play');
    if (play && S.byId(play)) transport.load(play);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  global.LoadPathApp = {
    select: select,
    apply: setTarget,
    seek: seek,
    current: function () { return cur; },
    transport: function () { return transport; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
