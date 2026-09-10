/* Driver Load Path — M1. Side elevation at the cruise baseline.

   The whole app at this milestone is one static state: a car going straight at
   a steady speed, which for the occupant is indistinguishable from a car parked
   on level ground. Acceleration is zero, so the only thing the contacts have to
   do is hold the driver up against gravity.

   That sounds like the boring case. It is the reference every other case is
   read against, and it is where the counter-intuitive bit lives: the g-load
   here is 1.00, not 0. You always feel your own weight.

   What this milestone deliberately does NOT do is divide the total across the
   twelve contacts. That split is statically indeterminate and is milestone 2.
   Rather than show a plausible-looking placeholder, the panel says so.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var O = global.LoadPathOccupant;
  var T = global.LoadPathTouchpoints;
  var Side = global.LoadPathSideView;

  var CAR = C.VEHICLES.sedan;
  var DRIVER = C.OCCUPANTS.m50;
  var REST = O.vec(0, 0, 0);          // the cruise baseline: no acceleration

  var view = null;
  var selectedId = null;

  function n1(x) { return x.toFixed(1); }

  function el(tag, cls, txt) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (txt != null) node.textContent = txt;
    return node;
  }

  function renderState(state) {
    var box = document.getElementById('state-rows');
    box.innerHTML = '';
    var audit = O.auditThirdLaw(state);
    var rows = [
      ['Apparent g-load', state.gLoad.toFixed(2) + ' g', 'a parked car is 1 g, not 0'],
      ['Car → driver', n1(state.carOnBody.z) + ' N up', 'total across all contacts'],
      ['Driver → car', n1(Math.abs(state.bodyOnCar.z)) + ' N down', 'the exact negative'],
      ['Third-law residual', audit.worst.toExponential(1) + ' N', 'checked, not assumed'],
      ['Driver share of mass', (DRIVER.mass / CAR.mass * 100).toFixed(1) + ' %',
       DRIVER.mass + ' kg in a ' + CAR.mass + ' kg car']
    ];
    rows.forEach(function (r) {
      var row = el('div', 'row');
      row.appendChild(el('span', 'k', r[0]));
      row.appendChild(el('span', 'v', r[1]));
      row.appendChild(el('span', 'note', r[2]));
      box.appendChild(row);
    });
  }

  function renderSegments(state) {
    var box = document.getElementById('segment-rows');
    box.innerHTML = '';
    var max = 0;
    state.segments.forEach(function (s) { if (s.magnitude > max) max = s.magnitude; });
    state.segments.forEach(function (s) {
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

  function renderContacts() {
    var box = document.getElementById('contact-rows');
    box.innerHTML = '';
    T.ALL.forEach(function (tp) {
      var row = el('div', 'row contact-row' + (tp.activeAtRest ? ' on' : ' off'));
      row.setAttribute('data-id', tp.id);
      row.setAttribute('tabindex', '0');
      row.appendChild(el('span', 'n', tp.n));
      row.appendChild(el('span', 'k', tp.label));
      row.appendChild(el('span', 'pill ' + tp.constraint, tp.constraint));
      row.appendChild(el('span', 'state', tp.activeAtRest ? 'loaded' : 'idle'));
      row.addEventListener('mouseenter', function () { select(tp.id); });
      row.addEventListener('focus', function () { select(tp.id); });
      row.addEventListener('click', function () { select(tp.id); });
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

    var pair = el('div', 'pair');
    var a = el('div', 'half act');
    a.appendChild(el('span', 'dir', 'car → driver'));
    a.appendChild(el('span', 'what', tp.carOnDriver));
    var b = el('div', 'half react');
    b.appendChild(el('span', 'dir', 'driver → car'));
    b.appendChild(el('span', 'what', tp.driverOnCar));
    pair.appendChild(a); pair.appendChild(b);
    box.appendChild(pair);

    var meta = el('div', 'meta');
    meta.appendChild(el('span', null, 'axis: ' + tp.axis));
    meta.appendChild(el('span', null, 'dominant in: ' + tp.dominantRegime));
    meta.appendChild(el('span', null, tp.activeAtRest ? 'loaded at rest' : 'idle at rest'));
    box.appendChild(meta);
    if (tp.gated) box.appendChild(el('p', 'muted', tp.gated));
  }

  function select(id) {
    selectedId = id;
    if (view) view.highlight(id);
    renderDetail(id);
    var rows = document.querySelectorAll('#contact-rows .contact-row');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('sel', rows[i].getAttribute('data-id') === id);
    }
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

  function boot() {
    var state = O.solve({ bodyMass: DRIVER.mass, accel: REST });

    document.getElementById('readout').textContent =
      CAR.label + ' · ' + DRIVER.label + ' · steady cruise, zero acceleration';

    view = Side.render(document.getElementById('figure'), state, function (id) { select(id); });
    renderState(state);
    renderSegments(state);
    renderContacts();
    renderCaveats();

    /* A contact can be deep-linked: index.html?select=wheel opens with that
       channel selected. Useful for pointing someone at one contact, and it
       makes the selection path checkable from a screenshot. */
    var want = new URLSearchParams(location.search).get('select');
    if (want && T.byId(want)) select(want); else renderDetail(null);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.LoadPathApp = { select: select };
})(typeof globalThis !== 'undefined' ? globalThis : this);
