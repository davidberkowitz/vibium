/* Driver Load Path — scripted maneuvers, and the lag between cabin and body.
   Milestone 4.

   Two separate things live here, and keeping them apart matters.

   ---------------------------------------------------------------------
   1. SCENARIOS — a maneuver as a timeline of driver inputs

   Every preset is a list of keyframes. Each keyframe pins one or more inputs
   at one instant; sample() interpolates linearly between them and holds the
   end value past the last key. The app then runs the SAME solve it runs for a
   slider drag. Playback is not a second code path — it is the existing code
   path with its inputs coming from a clock instead of a thumb.

   The awkward part, and it is worth stating plainly: speed and pedal demand
   are INDEPENDENT inputs in this model. Nothing integrates one into the
   other. A scenario could therefore ask for 0.8 g of braking while the speed
   sits at 100 km/h forever, and the solver would dutifully draw it.

   Rather than pretend to integrate, the scenarios are authored with the
   arithmetic done by hand and then CHECKED. consistency() takes each stretch
   of the speed profile and asks whether the longitudinal acceleration the
   vehicle solver produces over that same stretch averages out to the slope the
   speed keyframes claim. A unit test runs it over every preset, so an
   incoherent timeline fails the build instead of quietly looking plausible.

   ---------------------------------------------------------------------
   2. LAG — the body does not change direction at the same instant the car does

   The plan's own list of failure modes flagged this: a quasi-static solve
   redraws the whole body the millisecond the input moves, which reads as a
   rigid mannequin snapping between poses. Real occupants arrive late. Seat
   foam compresses, flesh shifts, the torso rocks about the hips, and the
   suspension has its own travel to get through first.

   So the acceleration fed to the OCCUPANT is a first-order lagged version of
   the cabin's:

       a_body(t + dt) = a_body(t) + (a_cabin - a_body(t)) * (1 - e^(-dt/tau))

   Exact exponential discretization, not a Euler step. That matters more than
   it looks: dt comes from requestAnimationFrame and is not constant, and a
   Euler step with dt > tau overshoots and then rings. The exponential form is
   unconditionally stable and degrades to "snap straight to the target" as dt
   grows, which is exactly what you want when someone scrubs the timeline or
   switches tabs for a minute.

   What does NOT lag: the tyres. Corner loads, the friction ellipse and the
   traction gauge all run off the cabin's instantaneous acceleration, because
   the contact patch is rigidly attached to the car. Only the occupant is
   behind.

   The honest limitation: a first-order lag NEVER OVERSHOOTS. A real torso on
   a compliant seat is a second-order system — mass, stiffness, damping — and
   it does overshoot, which is why a hard stop makes you rock forward past
   where you end up and then settle back. This model gives the delay and none
   of the rebound. It is recorded as MODEL.bodyLag in the provenance table.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var G = C.G;

  /* Time constant of the body's response to a change in cabin acceleration.
     Placeholder — see the provenance record. */
  var TAU = 0.25;

  /* Inputs a timeline is allowed to drive. Surface and vehicle choice are
     conditions, not maneuvers, so a scenario sets them once and they stay. */
  var CHANNELS = ['speed', 'steerAngle', 'brake', 'throttle', 'gradePercent'];

  /* --------------------------------------------------------------------
     The presets.

     Speeds are m/s, steering is rad at the road wheel, pedals are demand in g,
     grade is percent. Every speed ramp has been differentiated by hand and the
     matching pedal value written in; consistency() is what keeps that true. */
  var SCENARIOS = [
    {
      id: 'cruise',
      label: 'Steady cruise',
      blurb: 'The baseline. 100 km/h, straight, level, nothing asked of the ' +
             'tyres but rolling. Every contact you see loaded here is loaded ' +
             'purely by gravity — this is what the other three are measured against.',
      duration: 6,
      surface: 'dry',
      keys: [
        { t: 0, speed: 27.8, steerAngle: 0, brake: 0, throttle: 0, gradePercent: 0 },
        { t: 6, speed: 27.8 }
      ]
    },
    {
      id: 'lane_change',
      label: 'Motorway lane change',
      blurb: 'One lane left, then back. Speed never changes, so the whole ' +
             'story is lateral: watch the side bolster hand the load across ' +
             'the body as the steering reverses, and the outer tyres swap sides.',
      duration: 9,
      surface: 'dry',
      keys: [
        { t: 0.0, speed: 27.8, steerAngle: 0, brake: 0, throttle: 0, gradePercent: 0 },
        { t: 1.0, steerAngle: 0 },
        { t: 2.0, steerAngle: 0.030 },
        { t: 3.0, steerAngle: 0.030 },
        { t: 4.0, steerAngle: 0 },
        { t: 5.0, steerAngle: -0.030 },
        { t: 6.0, steerAngle: -0.030 },
        { t: 7.0, steerAngle: 0 },
        { t: 9.0, speed: 27.8, steerAngle: 0 }
      ]
    },
    {
      id: 'threshold_stop',
      label: 'Threshold brake to a stop',
      blurb: 'From 79 km/h to standstill at 0.8 g on dry asphalt. The pedal ' +
             'takes four tenths of a second to reach full effort, which is ' +
             'where the belts take up: bracing runs out first, and only then ' +
             'does webbing start carrying.',
      duration: 6,
      surface: 'dry',
      keys: [
        { t: 0.0, speed: 22.0, steerAngle: 0, brake: 0, throttle: 0, gradePercent: 0 },
        { t: 1.0, speed: 22.0, brake: 0 },
        { t: 1.4, speed: 20.43, brake: 0.80 },
        { t: 4.0, speed: 0, brake: 0.80 },
        { t: 4.4, speed: 0, brake: 0 },
        { t: 6.0, speed: 0, brake: 0 }
      ]
    },
    {
      id: 'hill_start',
      label: 'Hill start, 12% grade',
      blurb: 'Held on the brake facing up a 12% slope, then away. Standing ' +
             'still the seat back is already carrying you, because on a grade ' +
             'gravity is no longer square to the seat — no acceleration ' +
             'required. Then the throttle adds to what the hill was doing.',
      duration: 8,
      surface: 'dry',
      keys: [
        { t: 0.0, speed: 0, steerAngle: 0, brake: 0.30, throttle: 0, gradePercent: 12 },
        { t: 2.0, speed: 0, brake: 0.30, throttle: 0 },
        { t: 2.6, speed: 0, brake: 0, throttle: 0.18 },
        { t: 8.0, speed: 9.61, brake: 0, throttle: 0.18, gradePercent: 12 }
      ]
    }
  ];

  function byId(id) {
    for (var i = 0; i < SCENARIOS.length; i++) {
      if (SCENARIOS[i].id === id) return SCENARIOS[i];
    }
    return null;
  }

  /* Value of one channel at time t. Keyframes only need to mention a channel
     when it changes, so this walks back to the last key that set it and
     forward to the next, and interpolates between those two. A channel never
     set before t holds its first stated value; a channel with no further key
     holds its last. */
  function channelAt(scenario, channel, t) {
    var keys = scenario.keys;
    var prev = null, next = null;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!(channel in k)) continue;
      if (k.t <= t) prev = k;
      else { next = k; break; }
    }
    if (!prev && !next) return 0;
    if (!prev) return next[channel];
    if (!next) return prev[channel];
    var span = next.t - prev.t;
    if (span <= 0) return next[channel];
    var f = (t - prev.t) / span;
    return prev[channel] + (next[channel] - prev[channel]) * f;
  }

  /* Full input object at time t, in the shape the app's solve expects. */
  function sample(scenario, t) {
    var tc = Math.max(0, Math.min(scenario.duration, t));
    var out = {};
    CHANNELS.forEach(function (ch) { out[ch] = channelAt(scenario, ch, tc); });
    out.surface = scenario.surface || 'dry';
    out.mu = C.SURFACES[out.surface].mu;
    out.ax = (out.throttle - out.brake) * G;
    return out;
  }

  /* --------------------------------------------------------------------
     Consistency: does the speed profile match the pedal demand?

     Checked SEGMENT BY SEGMENT, between consecutive keyframes that set speed,
     rather than at sampled instants. That is not a refinement, it is the only
     formulation that works. Speed interpolates linearly, so a speed segment
     asserts a CONSTANT acceleration over its whole span; comparing it against
     the instantaneous pedal value at some midpoint disagrees wildly wherever a
     pedal is ramping or the profile has a corner, and those disagreements are
     artefacts of the sampling rather than faults in the scenario. Comparing a
     segment's mean against the mean acceleration over the same span integrates
     the ramps correctly and puts the corners on the segment boundaries, where
     they belong.

     The acceleration side comes from the VEHICLE SOLVER, not from the raw
     pedal demand, so the friction clamp and the stopped-car rule are exercised
     too. The solver is passed in rather than reached for: this is the model
     layer, and it has no business depending on its own siblings' load order. */
  function speedSegments(scenario) {
    var ts = scenario.keys.filter(function (k) { return 'speed' in k; })
                          .map(function (k) { return k.t; });
    var segs = [];
    for (var i = 1; i < ts.length; i++) segs.push([ts[i - 1], ts[i]]);
    return segs;
  }

  function consistency(scenario, solveVehicle, opts) {
    var n = (opts && opts.samples) || 64;
    var worst = 0, at = 0, wantV = 0, gotV = 0;
    speedSegments(scenario).forEach(function (seg) {
      var t0 = seg[0], t1 = seg[1], span = t1 - t0;
      if (span <= 0) return;
      var impliedBySpeed = (channelAt(scenario, 'speed', t1) -
                            channelAt(scenario, 'speed', t0)) / span;
      // Midpoint rule: never lands on a segment boundary, where ax may jump.
      var sum = 0;
      for (var i = 0; i < n; i++) {
        sum += solveVehicle(sample(scenario, t0 + span * (i + 0.5) / n)).accel.x;
      }
      var fromPedals = sum / n;
      var err = Math.abs(impliedBySpeed - fromPedals);
      if (err > worst) {
        worst = err; at = t0;
        wantV = impliedBySpeed; gotV = fromPedals;
      }
    });
    return { worst: worst, at: at, impliedBySpeed: wantV, fromPedals: gotV };
  }

  /* --------------------------------------------------------------------
     The lag.

     alpha(dt, tau) is the fraction of the remaining gap closed in dt. At
     dt = tau it is 0.632, which is the definition of a time constant and is
     what the unit test asserts. tau <= 0 means no lag at all. */
  function alpha(dt, tau) {
    if (!(tau > 0)) return 1;
    if (!(dt > 0)) return 0;
    return 1 - Math.exp(-dt / tau);
  }

  /* A two-component tracker for the cabin's (ax, ay). Vertical is not lagged
     because M4 has no vertical input — road excitation is M5, and it belongs
     in a frequency-domain channel rather than this one. */
  function makeLag(tau) {
    var cur = { x: 0, y: 0 };
    var t = (tau == null) ? TAU : tau;
    return {
      get tau() { return t; },
      setTau: function (v) { t = v; },
      value: function () { return { x: cur.x, y: cur.y }; },
      /* Jump straight to a state with no transient: used when a scenario is
         loaded or the timeline is scrubbed, where there is no "before". */
      reset: function (target) {
        cur = { x: (target && target.x) || 0, y: (target && target.y) || 0 };
        return this.value();
      },
      step: function (target, dt) {
        var a = alpha(dt, t);
        cur = {
          x: cur.x + (target.x - cur.x) * a,
          y: cur.y + (target.y - cur.y) * a
        };
        return this.value();
      },
      /* How far behind the cabin the body currently is, in m/s^2. Zero once
         settled; the app hides the transient readout below a threshold rather
         than flickering a number that is really just float dust. */
      error: function (target) {
        return Math.hypot(target.x - cur.x, target.y - cur.y);
      }
    };
  }

  global.LoadPathScenarios = {
    TAU: TAU,
    CHANNELS: CHANNELS,
    SCENARIOS: SCENARIOS,
    byId: byId,
    sample: sample,
    channelAt: channelAt,
    consistency: consistency,
    speedSegments: speedSegments,
    alpha: alpha,
    makeLag: makeLag
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
