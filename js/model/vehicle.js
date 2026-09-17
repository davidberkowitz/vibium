/* Driver Load Path — vehicle solver. Equations 1 to 4 of the plan.

   Quasi-static rigid body. Given driver inputs it answers one question: what is
   the acceleration vector of the cabin, and how is tyre load distributed while
   that is happening.

   Frame is ISO 8855 (x forward, y left, z up), so a positive lateral
   acceleration is a LEFT turn and the loaded, outer wheels are on the RIGHT.

   Two things in here are deliberately conservative rather than clever:

   1. The friction ellipse is a JOINT constraint on the resultant, not two
      independent per-axis checks. Braking at the limit and cornering at the
      limit cannot happen at once, because one tyre has one friction budget.
   2. Above the ellipse the solver does not extrapolate. It reports
      utilisation > 1 and offers a clamped state; the caller is expected to
      change what it displays rather than keep drawing arrows.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var G = C.G;

  /* EQ 1. Steady-state cornering, bicycle model with understeer gradient K.

       delta = L/R + K*ay      and      ay = v^2 / R

     Eliminating R gives ay = delta * v^2 / (L + K * v^2), which is also well
     behaved at a standstill: v = 0 yields exactly 0 rather than a division by
     zero. Accurate well below the limit, optimistic near it — see EQ 4. */
  function lateralAccelFromSteering(opts) {
    var v = opts.speed;                       // m/s
    var delta = opts.steerAngle;              // rad, road-wheel angle, + is left
    var L = opts.wheelbase;                   // m
    var K = opts.understeerGradient || 0;     // rad/(m/s^2)
    var denom = L + K * v * v;
    if (denom === 0) return 0;
    return (delta * v * v) / denom;
  }

  /* Turn radius implied by a cornering state. Infinite when going straight. */
  function turnRadius(speed, lateralAccel) {
    if (lateralAccel === 0) return Infinity;
    return (speed * speed) / Math.abs(lateralAccel);
  }

  /* EQ 2. Longitudinal load transfer, front axle to rear under throttle.
     Positive ax (accelerating) unloads the front by this amount. */
  function longitudinalLoadTransfer(opts) {
    return (opts.mass * opts.ax * opts.cgHeight) / opts.wheelbase;
  }

  /* EQ 3. Lateral load transfer, inner wheels to outer.
     This is the load ADDED to the outer side and SUBTRACTED from the inner,
     not half of it — moments taken about the outer contact patch. */
  function lateralLoadTransfer(opts) {
    return (opts.mass * opts.ay * opts.cgHeight) / opts.track;
  }

  /* EQ 4. Friction ellipse. Both axis maxima are mu*g, so the constraint
     collapses to: the magnitude of the horizontal acceleration vector may not
     exceed mu*g. Returned as a ratio so 1.0 is exactly at the limit. */
  function frictionUtilisation(opts) {
    var limit = opts.mu * G;
    if (limit === 0) return Infinity;
    return Math.hypot(opts.ax, opts.ay) / limit;
  }

  /* Scale a demanded acceleration back onto the ellipse, preserving direction.
     Returns the input untouched when it is already inside. */
  function clampToEllipse(opts) {
    var u = frictionUtilisation(opts);
    if (!(u > 1)) return { ax: opts.ax, ay: opts.ay, clamped: false, utilisation: u };
    return { ax: opts.ax / u, ay: opts.ay / u, clamped: true, utilisation: u };
  }

  /* Per-corner vertical tyre loads, in newtons.

     Lateral transfer is split between axles in proportion to STATIC weight
     distribution. The real split follows roll stiffness distribution. This is
     recorded as a placeholder in PROVENANCE and is why corner loads should be
     read as indicative rather than quoted. */
  function cornerLoads(opts) {
    var m = opts.mass, ff = opts.frontWeightFraction;
    var theta = Math.atan((opts.gradePercent || 0) / 100);

    /* On a grade two things change and both matter. The weight pressing into
       the road is reduced by cos(theta), and gravity gains a component along
       the car's own x axis which transfers load exactly as acceleration does.
       An uphill unloads the front axle for the same reason throttle does. */
    var weight = m * G * Math.cos(theta);
    var dLong = longitudinalLoadTransfer({
      mass: m, ax: opts.ax + G * Math.sin(theta),
      cgHeight: opts.cgHeight, wheelbase: opts.wheelbase
    });
    var dLat = lateralLoadTransfer(opts);

    var frontAxle = weight * ff - dLong;
    var rearAxle = weight * (1 - ff) + dLong;

    var dLatFront = dLat * ff;
    var dLatRear = dLat * (1 - ff);

    // ay > 0 is a left turn, so load moves to the right-hand wheels.
    var loads = {
      frontLeft:  frontAxle / 2 - dLatFront,
      frontRight: frontAxle / 2 + dLatFront,
      rearLeft:   rearAxle / 2 - dLatRear,
      rearRight:  rearAxle / 2 + dLatRear
    };

    var lifted = Object.keys(loads).filter(function (k) { return loads[k] <= 0; });

    return {
      loads: loads,
      frontAxle: frontAxle,
      rearAxle: rearAxle,
      longitudinalTransfer: dLong,
      lateralTransfer: dLat,
      wheelsLifted: lifted,
      total: loads.frontLeft + loads.frontRight + loads.rearLeft + loads.rearRight
    };
  }

  /* Full vehicle state from driver inputs.

     inputs: { speed (m/s), steerAngle (rad), ax (m/s^2), mu }
     params: a VEHICLES entry

     ax is taken as the demanded longitudinal acceleration (negative to brake).
     ay is derived from steering. The pair is then checked against the ellipse. */
  function solve(inputs, params) {
    var ay = lateralAccelFromSteering({
      speed: inputs.speed,
      steerAngle: inputs.steerAngle,
      wheelbase: params.wheelbase,
      understeerGradient: params.understeerGradient
    });
    var ax = inputs.ax || 0;
    var mu = inputs.mu;

    /* A stopped car cannot decelerate. ax here is pedal DEMAND, and a driver
       holding the brake at a standstill — at a light, or on a hill start — is
       demanding a deceleration the car has no speed left to give. Without this
       the model draws a stationary occupant being thrown forward at 0.3 g.

       Only braking is suppressed. Throttle from rest is exactly how a car
       leaves a standstill, so it passes through. Note also what this does NOT
       claim: the longitudinal friction a real car spends holding itself on a
       slope is not modelled. See MODEL.stoppedCar. */
    if ((inputs.speed || 0) <= 0 && ax < 0) ax = 0;

    var utilisation = frictionUtilisation({ ax: ax, ay: ay, mu: mu });
    var clamped = clampToEllipse({ ax: ax, ay: ay, mu: mu });

    var corners = cornerLoads({
      mass: params.mass,
      ax: clamped.ax,
      ay: clamped.ay,
      gradePercent: inputs.gradePercent || 0,
      cgHeight: params.cgHeight,
      wheelbase: params.wheelbase,
      track: params.track,
      frontWeightFraction: params.frontWeightFraction
    });

    return {
      demanded: { ax: ax, ay: ay },
      gradePercent: inputs.gradePercent || 0,
      accel: { x: clamped.ax, y: clamped.ay, z: 0 },
      utilisation: utilisation,
      tractionExceeded: utilisation > 1,
      turnRadius: turnRadius(inputs.speed, clamped.ay),
      corners: corners
    };
  }

  global.LoadPathVehicle = {
    lateralAccelFromSteering: lateralAccelFromSteering,
    turnRadius: turnRadius,
    longitudinalLoadTransfer: longitudinalLoadTransfer,
    lateralLoadTransfer: lateralLoadTransfer,
    frictionUtilisation: frictionUtilisation,
    clampToEllipse: clampToEllipse,
    cornerLoads: cornerLoads,
    solve: solve
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
