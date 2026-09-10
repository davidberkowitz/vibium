/* Driver Load Path — occupant solver. Equations 5 and 6 of the plan.

   The vehicle solver says how the cabin is accelerating. This says what the car
   must therefore do to the body, and what the body does back.

   The whole thing rests on one line of Newton. A body segment of mass m riding
   along with the cabin has acceleration a. The forces on it are gravity and
   whatever the car touches it with:

       F_contact + m*g = m*a        so        F_contact = m*(a - g)

   with g = (0, 0, -9.80665). Sit still and that gives F = (0, 0, +m*9.81):
   the car pushes you UP with your own weight, which is the sanity check to
   keep in your head while reading the rest.

   And then the half that most driving diagrams leave out — the force the
   driver applies to the car is the exact negative:

       F_driver_on_car = -F_car_on_driver

   That is not a modelling choice, it is Newton's third law, and it is asserted
   as a unit test rather than trusted.

   What this milestone does NOT do: divide that force between the seat pan,
   bolster, belt, footrest and wheel. That split is statically indeterminate and
   is milestone 2. Everything here is aggregate and per-segment only.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;
  var G = C.G;

  function vec(x, y, z) { return { x: x, y: y, z: z }; }
  function add(a, b) { return vec(a.x + b.x, a.y + b.y, a.z + b.z); }
  function scale(a, k) { return vec(a.x * k, a.y * k, a.z * k); }
  function negate(a) { return scale(a, -1); }
  function magnitude(a) { return Math.hypot(a.x, a.y, a.z); }

  /* Expand the fraction table into one entry per physical segment, so a pair of
     thighs becomes two thighs rather than one double-mass thigh. */
  function segmentMasses(bodyMass) {
    var out = [];
    C.SEGMENTS.forEach(function (s) {
      for (var i = 0; i < s.count; i++) {
        out.push({
          key: s.count > 1 ? s.key + (i === 0 ? '_left' : '_right') : s.key,
          label: s.count > 1 ? s.label + (i === 0 ? ' (left)' : ' (right)') : s.label,
          fraction: s.fraction,
          mass: bodyMass * s.fraction
        });
      }
    });
    return out;
  }

  /* EQ 5. The force the car's contacts must supply to a mass riding at accel a. */
  function requiredForce(mass, accel) {
    return vec(mass * accel.x, mass * accel.y, mass * (accel.z + G));
  }

  /* Apparent g-load felt by the occupant: the magnitude of (a - g) in units of
     g. Sitting still this is 1.0, not 0 — you feel your own weight. */
  function gLoad(accel) {
    return Math.hypot(accel.x, accel.y, accel.z + G) / G;
  }

  /* Full occupant state for a cabin acceleration.

     opts: { bodyMass (kg), accel ({x,y,z} m/s^2) } */
  function solve(opts) {
    var accel = opts.accel;
    var segments = segmentMasses(opts.bodyMass).map(function (s) {
      var f = requiredForce(s.mass, accel);
      return {
        key: s.key, label: s.label, mass: s.mass,
        carOnBody: f,
        magnitude: magnitude(f)
      };
    });

    var total = segments.reduce(function (acc, s) { return add(acc, s.carOnBody); },
                                vec(0, 0, 0));

    return {
      bodyMass: opts.bodyMass,
      accel: accel,
      segments: segments,
      carOnBody: total,
      bodyOnCar: negate(total),
      gLoad: gLoad(accel)
    };
  }

  /* EQ 6, as an audit rather than an assumption.

     Two independent things are checked:
       sum of per-segment forces  ==  m_total * (a - g)
       force on the car           ==  -force on the body

     Returns the worst residual in newtons. The tests require it near zero. */
  function auditThirdLaw(state) {
    var expected = requiredForce(state.bodyMass, state.accel);
    var sumResidual = magnitude(add(state.carOnBody, negate(expected)));
    var pairResidual = magnitude(add(state.carOnBody, state.bodyOnCar));
    return {
      expected: expected,
      sumResidual: sumResidual,
      pairResidual: pairResidual,
      worst: Math.max(sumResidual, pairResidual)
    };
  }

  global.LoadPathOccupant = {
    vec: vec, add: add, scale: scale, negate: negate, magnitude: magnitude,
    segmentMasses: segmentMasses,
    requiredForce: requiredForce,
    gLoad: gLoad,
    solve: solve,
    auditThirdLaw: auditThirdLaw
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
