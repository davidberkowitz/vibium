/* Driver Load Path — M3. Two views, five live inputs.

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

  var CAR = C.VEHICLES.sedan;
  var DRIVER = C.OCCUPANTS.m50;

  var sideView = null, planView = null, controls = null;
  var selectedId = null;
  var cur = { inputs: null, vehicle: null, occupant: null, split: null };

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
  function solveAll(inputs) {
    var vehicle = V.solve({
      speed: inputs.speed, steerAngle: inputs.steerAngle,
      ax: inputs.ax, mu: inputs.mu, gradePercent: inputs.gradePercent
    }, CAR);
    var occupant = O.solve({
      bodyMass: DRIVER.mass,
      accel: O.vec(vehicle.accel.x, vehicle.accel.y, 0),
      gravity: O.gravityForGrade(inputs.gradePercent)
    });
    var split = K.solve(occupant.carOnBody);
    return { inputs: inputs, vehicle: vehicle, occupant: occupant, split: split };
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
      ['Traction used', (v.utilisation * 100).toFixed(0) + ' %', v.tractionExceeded ? 'DEMAND EXCEEDS GRIP' : 'within the friction ellipse'],
      ['Car → driver', n1(O.magnitude(s.carOnBody)) + ' N', 'total across all contacts'],
      ['Contacts carrying load', loaded + ' of 12', 'the rest are idle or slack'],
      ['Belts', cur.split.slackEngaged ? 'engaged' : 'slack', 'webbing takes up only when bracing runs out'],
      ['Third-law residual', audit.worst.toExponential(1) + ' N', 'checked, not assumed'],
      ['Split balance residual', bal ? bal.residual.toExponential(1) + ' N' : '—', 'the split re-sums to the total']
    ];
    rows.forEach(function (x) {
      var row = el('div', 'row' + (x[0] === 'Traction used' && v.tractionExceeded ? ' warn' : ''));
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
    renderDetail(id);
    var rows = document.querySelectorAll('#contact-rows .contact-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('sel', rows[i].getAttribute('data-id') === id);
    }
  }

  /* ---------------- redraw ---------------- */
  function apply(inputs) {
    cur = solveAll(inputs);

    document.getElementById('readout').textContent =
      CAR.label + ' · ' + DRIVER.label + ' · ' + C.SURFACES[inputs.surface].label.toLowerCase();

    sideView = Side.render(document.getElementById('figure'), cur.occupant,
                           function (id) { select(id); }, cur.split);
    planView = Plan.render(document.getElementById('figure-plan'), cur.vehicle,
                           cur.occupant, cur.split, function (id) { select(id); });

    renderState();
    renderContacts();
    renderSegments();
    if (controls) controls.updateGauge(cur.vehicle, inputs.mu);
    if (selectedId) select(selectedId); else renderDetail(null);
  }

  function boot() {
    Assumptions.mount(document.body, document.getElementById('btn-assumptions'));
    controls = Controls.mount(document.getElementById('controls'), apply);
    renderCaveats();
    apply(controls.read());

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  global.LoadPathApp = { select: select, apply: apply, current: function () { return cur; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
