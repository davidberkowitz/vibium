/* Driver Load Path — the provenance drawer. Milestone 2.

   This ships in the SAME milestone as the contact solver, deliberately.

   The solver is the moment this project starts putting authoritative-looking
   numbers next to body parts. "489 N through your seat pan" is the kind of
   figure someone repeats in a meeting, and most of the numbers behind it are
   tuned placeholders. Retrofitting provenance later never happens; building it
   now means an unsourced number is visibly incomplete rather than invisibly
   wrong.

   The drawer reads PROVENANCE directly, so a constant added without a record
   shows up as a gap on screen — the structure does the remembering instead of
   whoever is editing constants.js.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;

  var ORDER = ['placeholder', 'corroborated', 'design', 'verified'];
  var BLURB = {
    placeholder: 'Standing in until tuned or measured. Treat any number that ' +
                 'depends on these as indicative only.',
    corroborated: 'A secondary source states it and an internal check agrees, ' +
                  'but the primary table was not reachable.',
    design: 'Our choice, not a measurement — a representative value.',
    verified: 'Checked against a source.'
  };

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function unsettledCount() {
    return Object.keys(C.PROVENANCE).filter(function (k) {
      var st = C.PROVENANCE[k].status;
      return st !== 'verified' && st !== 'design';
    }).length;
  }

  function build() {
    var wrap = el('div', 'drawer');
    wrap.id = 'assumptions-drawer';
    wrap.hidden = true;

    var head = el('div', 'drawer-head');
    head.appendChild(el('h2', null, 'Assumptions and provenance'));
    var close = el('button', 'drawer-close', '×');
    close.setAttribute('aria-label', 'Close assumptions');
    head.appendChild(close);
    wrap.appendChild(head);

    wrap.appendChild(el('p', 'drawer-lede',
      'Every constant this model uses, and how far it can be trusted. ' +
      'The force split shown on the figure depends on the placeholders first.'));

    var groups = {};
    Object.keys(C.PROVENANCE).forEach(function (key) {
      var rec = C.PROVENANCE[key];
      (groups[rec.status] || (groups[rec.status] = [])).push({ key: key, rec: rec });
    });

    ORDER.forEach(function (status) {
      var items = groups[status];
      if (!items || !items.length) return;
      var sec = el('section', 'prov-group');
      var h = el('h3');
      h.appendChild(el('span', 'pill ' + status, status));
      h.appendChild(el('span', 'grp-count', items.length + (items.length === 1 ? ' value' : ' values')));
      sec.appendChild(h);
      sec.appendChild(el('p', 'grp-blurb', BLURB[status] || ''));

      items.forEach(function (it) {
        var row = el('div', 'prov');
        row.appendChild(el('div', 'prov-key', it.key));
        if (it.rec.value != null) {
          row.appendChild(el('div', 'prov-val',
            it.rec.value + (it.rec.unit ? ' ' + it.rec.unit : '')));
        } else if (it.rec.unit) {
          row.appendChild(el('div', 'prov-val', it.rec.unit));
        }
        row.appendChild(el('div', 'prov-src', it.rec.source));
        if (it.rec.caveat) {
          row.appendChild(el('div', 'prov-caveat', it.rec.caveat.replace(/\s+/g, ' ')));
        }
        sec.appendChild(row);
      });
      wrap.appendChild(sec);
    });

    var foot = el('div', 'drawer-foot');
    foot.appendChild(el('p', null,
      'Not modelled at all: seat-surface friction, the body as a linkage rather ' +
      'than a point mass, and the time any of this takes to happen. Each is ' +
      'listed above with what its absence does to the numbers.'));
    wrap.appendChild(foot);

    close.addEventListener('click', function () { hide(); });
    return wrap;
  }

  var node = null, opener = null, lastFocus = null;

  function show() {
    if (!node) return;
    lastFocus = document.activeElement;
    node.hidden = false;
    document.body.classList.add('drawer-open');
    if (opener) opener.setAttribute('aria-expanded', 'true');
    var c = node.querySelector('.drawer-close');
    if (c) c.focus();
  }
  function hide() {
    if (!node) return;
    node.hidden = true;
    document.body.classList.remove('drawer-open');
    if (opener) opener.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function toggle() { node && node.hidden ? show() : hide(); }

  /* Mount the drawer and wire the toolbar button that opens it. */
  function mount(mountPoint, button) {
    node = build();
    mountPoint.appendChild(node);
    opener = button;
    var n = unsettledCount();
    button.textContent = 'Assumptions' + (n ? '  ' + n + ' unsettled' : '');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', toggle);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && node && !node.hidden) { e.preventDefault(); hide(); }
    });
    return { show: show, hide: hide, toggle: toggle, unsettled: n };
  }

  global.LoadPathAssumptions = { mount: mount, unsettledCount: unsettledCount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
