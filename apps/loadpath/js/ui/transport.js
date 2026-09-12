/* Driver Load Path — the transport bar. Milestone 4.

   Four scripted maneuvers, a playhead, and a switch for the body lag.

   This module owns only the CLOCK and the chrome around it. It does not run an
   animation loop of its own and it never calls the solver. The app has one
   requestAnimationFrame loop that drives both playback and the lag settling,
   and it asks this module where the playhead is. Two loops advancing the same
   scene independently is how you end up with a figure that disagrees with its
   own timeline, so there is one.

   The interaction rule that matters: TOUCH A SLIDER AND PLAYBACK STOPS. A
   running scenario is writing to those sliders every frame, so a user who
   grabs one is fighting the clock and will lose. Taking the wheel ends the
   script instead, and the mode chip says so.
*/
(function (global) {
  'use strict';

  var S = global.LoadPathScenarios;

  function dom(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  var scenario = null;     // null means manual: the sliders are the source
  var head = 0;            // seconds into the scenario
  var playing = false;
  var lagOn = true;
  var nodes = {};
  var handlers = {};

  function duration() { return scenario ? scenario.duration : 0; }

  function paint() {
    var d = duration();
    nodes.play.disabled = !scenario;
    nodes.play.textContent = playing ? '❚❚' : '▶';
    nodes.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    nodes.scrub.disabled = !scenario;
    nodes.scrub.max = d || 1;
    nodes.scrub.value = head;
    nodes.clock.textContent = scenario
      ? head.toFixed(1) + ' / ' + d.toFixed(1) + ' s'
      : 'live';
    nodes.bar.classList.toggle('playing', playing);
    nodes.bar.classList.toggle('manual', !scenario);
    nodes.blurb.textContent = scenario ? scenario.blurb : '';
    nodes.blurb.hidden = !scenario;
    [].forEach.call(nodes.chips.children, function (c) {
      var on = c.getAttribute('data-sid') === (scenario ? scenario.id : '');
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function stop(reason) {
    if (!playing && !scenario && reason !== 'manual') return;
    playing = false;
    if (reason === 'manual') { scenario = null; head = 0; }
    paint();
    if (handlers.onModeChange) handlers.onModeChange(mode());
  }

  function load(id) {
    scenario = S.byId(id);
    head = 0;
    playing = false;
    paint();
    if (handlers.onSeek) handlers.onSeek(inputs(), true);
    if (handlers.onModeChange) handlers.onModeChange(mode());
  }

  function toggle() {
    if (!scenario) return;
    if (!playing && head >= duration() - 1e-6) {
      /* At the end, play means play again from the top rather than sitting
         there doing nothing. Seek first so the lag starts settled at the
         opening state instead of racing in from wherever it ended. */
      head = 0;
      if (handlers.onSeek) handlers.onSeek(inputs(), true);
    }
    playing = !playing;
    paint();
    if (handlers.onModeChange) handlers.onModeChange(mode());
  }

  /* Called by the app's frame loop. Returns true while there is still
     scenario left to run. */
  function advance(dt) {
    if (!playing || !scenario) return false;
    head = Math.min(duration(), head + dt);
    if (head >= duration() - 1e-6) { head = duration(); playing = false; }
    paint();
    return true;
  }

  function inputs() { return scenario ? S.sample(scenario, head) : null; }

  function mode() {
    return { scenario: scenario, head: head, playing: playing, lag: lagOn };
  }

  function mount(root, h) {
    handlers = h || {};
    var bar = dom('div', 'transport');
    nodes.bar = bar;

    var chips = dom('div', 'tp-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Scenario');
    var manual = dom('button', 'tp-chip on', 'Manual');
    manual.type = 'button';
    manual.setAttribute('data-sid', '');
    manual.title = 'Drive the sliders yourself';
    manual.addEventListener('click', function () { stop('manual'); });
    chips.appendChild(manual);
    S.SCENARIOS.forEach(function (sc) {
      var b = dom('button', 'tp-chip', sc.label);
      b.type = 'button';
      b.setAttribute('data-sid', sc.id);
      b.title = sc.blurb;
      b.addEventListener('click', function () { load(sc.id); });
      chips.appendChild(b);
    });
    bar.appendChild(chips);
    nodes.chips = chips;

    var play = dom('button', 'tp-play', '▶');
    play.type = 'button';
    play.disabled = true;
    play.addEventListener('click', toggle);
    bar.appendChild(play);
    nodes.play = play;

    var scrub = document.createElement('input');
    scrub.type = 'range';
    scrub.className = 'tp-scrub';
    scrub.min = 0; scrub.max = 1; scrub.step = 0.02; scrub.value = 0;
    scrub.disabled = true;
    scrub.setAttribute('aria-label', 'Scrub the maneuver');
    scrub.addEventListener('input', function () {
      if (!scenario) return;
      playing = false;
      head = parseFloat(scrub.value);
      paint();
      /* A scrub is a jump, not a motion. Settle the lag at the new state
         rather than letting the body chase a playhead that teleported. */
      if (handlers.onSeek) handlers.onSeek(inputs(), true);
    });
    bar.appendChild(scrub);
    nodes.scrub = scrub;

    var clock = dom('span', 'tp-clock', 'live');
    bar.appendChild(clock);
    nodes.clock = clock;

    var lagWrap = dom('label', 'tp-lag');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = lagOn;
    cb.addEventListener('change', function () {
      lagOn = cb.checked;
      if (handlers.onLagChange) handlers.onLagChange(lagOn);
    });
    lagWrap.appendChild(cb);
    lagWrap.appendChild(dom('span', null, 'Body lag'));
    lagWrap.appendChild(dom('span', 'tp-tau', 'τ ' + S.TAU.toFixed(2) + ' s'));
    lagWrap.title = 'The occupant follows the cabin through a first-order lag. ' +
                    'Transient only — settled states are identical either way.';
    bar.appendChild(lagWrap);

    var blurb = dom('p', 'tp-blurb');
    blurb.hidden = true;

    root.innerHTML = '';
    root.appendChild(bar);
    root.appendChild(blurb);
    nodes.blurb = blurb;
    paint();

    return {
      advance: advance,
      inputs: inputs,
      mode: mode,
      stop: stop,
      load: load,
      isPlaying: function () { return playing; },
      lagEnabled: function () { return lagOn; }
    };
  }

  global.LoadPathTransport = { mount: mount };
})(typeof globalThis !== 'undefined' ? globalThis : this);
