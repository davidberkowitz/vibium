/* Driver Load Path — M2. Side elevation at the cruise baseline, with the
   force split solved and every number carrying its source.

   The whole app at this milestone is one static state: a car going straight at
   a steady speed, which for the occupant is indistinguishable from a car parked
   on level ground. Acceleration is zero, so the only thing the contacts have to
   do is hold the driver up against gravity.

   That sounds like the boring case. It is the reference every other case is
   read against, and it is where the counter-intuitive bit lives: the g-load
   here is 1.00, not 0. You always feel your own weight.

   As of M2 the total IS divided across the twelve contacts, by the solver in
   model/contacts.js. At rest the answer is unsurprising and that is the point:
   about sixty percent through the seat pan, nothing at all in the belts,
   nothing lateral. It is the reference every loaded case is read against.

   The provenance drawer ships in the same milestone as the solver, because
   this is the moment the page starts putting authoritative-looking newtons
   next to body parts.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var O = global.LoadPathOccupant;
  var T = global.LoadPathTouchpoints;
  var K = global.LoadPathContacts;
  var Side = global.LoadPathSideView;
  var Assumptions = global.LoadPathAssumptions;

  var CAR = C.VEHICLES.sedan;
  var DRIVER = C.OCCUPANTS.m50;
  var REST = O.vec(0, 0, 0);          // the cruise baseline: no acceleration

  var view = null;
  var selectedId = null;
  var split = null;

  function load(id) {
    var t = split && split.feasible && split.byTouchpoint[id];
    return t ? t.magnitude : 0;
  }

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
    var bal = split && split.feasible ? K.auditBalance(split, state.carOnBody) : null;
    var loaded = split && split.feasible
      ? Object.keys(split.byTouchpoint).filter(function (k) {
          return split.byTouchpoint[k].magnitude > 0.5; }).length
      : 0;
    var rows = [
      ['Apparent g-load', state.gLoad.toFixed(2) + ' g', 'a parked car is 1 g, not 0'],
      ['Car → driver', n1(state.carOnBody.z) + ' N up', 'total across all contacts'],
      ['Driver → car', n1(Math.abs(state.bodyOnCar.z)) + ' N down', 'the exact negative'],
      ['Third-law residual', audit.worst.toExponential(1) + ' N', 'checked, not assumed'],
      ['Contacts carrying load', loaded + ' of 12', 'the rest are idle or slack'],
      ['Split balance residual', bal ? bal.residual.toExponential(1) + ' N' : '—',
       'the split re-sums to the total'],
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
    var maxLoad = 1;
    T.ALL.forEach(function (tp) { maxLoad = Math.max(maxLoad, load(tp.id)); });
    T.ALL.forEach(function (tp) {
      var row = el('div', 'row contact-row' + (load(tp.id) > 0.5 ? ' on' : ' off'));
      row.setAttribute('data-id', tp.id);
      row.setAttribute('tabindex', '0');
      row.appendChild(el('span', 'n', tp.n));
      row.appendChild(el('span', 'k', tp.label));
      row.appendChild(el('span', 'pill ' + tp.constraint, tp.constraint));
      var f = load(tp.id);
      var v = el('span', 'v force', f > 0.5 ? n1(f) + ' N' : '—');
      row.appendChild(v);
      var barWrap = el('span', 'bar');
      var bar = el('i');
      bar.style.width = (f > 0.5 ? (f / maxLoad * 100) : 0).toFixed(1) + '%';
      barWrap.appendChild(bar);
      row.appendChild(barWrap);
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

    var f = load(tp.id);
    var fr = el('div', 'detail-force' + (f > 0.5 ? '' : ' idle'));
    fr.appendChild(el('span', 'fv', f > 0.5 ? n1(f) + ' N' : 'no load'));
    fr.appendChild(el('span', 'fl', f > 0.5
      ? 'right now, in this state'
      : 'nothing crosses this contact in the cruise baseline'));
    box.appendChild(fr);

    if (split && split.feasible) {
      var chans = (split.byTouchpoint[tp.id] || {}).channels || [];
      var caps = split.channels.filter(function (ch) {
        return ch.touchpoint === tp.id && ch.saturated; });
      if (caps.length) {
        box.appendChild(el('p', 'muted',
          'At its bracing limit. A driver can only push so hard here, so any ' +
          'further load goes somewhere else.'));
      }
      if (chans.length > 1) {
        box.appendChild(el('p', 'muted',
          'Modelled as ' + chans.length + ' channels: ' + chans.join(', ') + '.'));
      }
    }

    var meta = el('div', 'meta');
    meta.appendChild(el('span', null, 'axis: ' + tp.axis));
    meta.appendChild(el('span', null, 'dominant in: ' + tp.dominantRegime));
    meta.appendChild(el('span', null, tp.constraint));
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
    split = K.solve(state.carOnBody);

    document.getElementById('readout').textContent =
      CAR.label + ' · ' + DRIVER.label + ' · steady cruise, zero acceleration';

    Assumptions.mount(document.body, document.getElementById('btn-assumptions'));

    view = Side.render(document.getElementById('figure'), state,
                       function (id) { select(id); }, split);
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
