/* Driver Load Path — constants, and where every one of them came from.

   Two exports that must stay in step:

     CONSTANTS   plain numbers, for arithmetic
     PROVENANCE  one record per number: source, status, and any caveat

   The split exists so the math stays readable while the provenance stays
   mandatory. The assumptions drawer in M2 renders PROVENANCE directly, which
   means a number added to CONSTANTS without a matching record shows up as a
   visible gap rather than a silent one. There is a unit test that fails if the
   two ever drift apart.

   Frame: ISO 8855. x forward, y to the driver's LEFT, z up.
     ax > 0  accelerating (throttle)        ax < 0  braking
     ay > 0  accelerating leftward, a LEFT turn; outer wheels are on the right
     az      vertical road input, gravity handled separately as g

   Status values, from strongest to weakest:
     verified    checked against a source this session
     corroborated  a secondary source states it and an internal check agrees,
                   but the primary table was not reachable
     design      our choice, not a measurement — a representative value
     placeholder  a number standing in until it is tuned against real data
*/
(function (global) {
  'use strict';

  var G = 9.80665;

  var SEGMENTS = [
    { key: 'head_neck', label: 'Head and neck', fraction: 0.0810, count: 1 },
    { key: 'trunk',     label: 'Trunk',         fraction: 0.4970, count: 1 },
    { key: 'upper_arm', label: 'Upper arm',     fraction: 0.0280, count: 2 },
    { key: 'forearm',   label: 'Forearm',       fraction: 0.0160, count: 2 },
    { key: 'hand',      label: 'Hand',          fraction: 0.0060, count: 2 },
    { key: 'thigh',     label: 'Thigh',         fraction: 0.1000, count: 2 },
    { key: 'shank',     label: 'Shank',         fraction: 0.0465, count: 2 },
    { key: 'foot',      label: 'Foot',          fraction: 0.0145, count: 2 }
  ];

  var VEHICLES = {
    sedan: {
      label: 'Mid-size sedan',
      mass: 1600,                 // kg, kerb plus one occupant
      wheelbase: 2.70,            // m
      track: 1.55,                // m
      cgHeight: 0.55,             // m above ground
      frontWeightFraction: 0.60,  // static, front-drive sedan
      understeerGradient: 0.0035  // rad per (m/s^2), about 2 deg/g
    }
  };

  var SURFACES = {
    dry:  { label: 'Dry asphalt', mu: 0.90 },
    wet:  { label: 'Wet asphalt', mu: 0.60 },
    snow: { label: 'Packed snow', mu: 0.25 }
  };

  var OCCUPANTS = {
    m50: { label: '50th percentile male',   mass: 78 },
    f05: { label: '5th percentile female',  mass: 49 },
    m95: { label: '95th percentile male',   mass: 101 }
  };

  var PROVENANCE = {
    G: {
      value: G, unit: 'm/s^2', status: 'verified',
      source: 'CGPM standard gravity, exact by definition.'
    },
    'SEGMENTS.fraction': {
      unit: 'fraction of total body mass', status: 'corroborated',
      source: 'Dempster (1955), Space requirements for the seated operator; the ' +
              'fractions reproduced in Winter, Biomechanics and Motor Control of ' +
              'Human Movement.',
      caveat: 'The primary table was not reachable from this environment. Search ' +
              'corroborates these exact values as Dempster’s and they sum to ' +
              '1.000 exactly, which the tests assert. Note the sample: nine male ' +
              'white cadavers. These fractions are NOT validated for women, for ' +
              'non-white populations, or for living tissue, and the simulation ' +
              'must not imply otherwise.'
    },
    'VEHICLES.sedan.mass': { value: 1600, unit: 'kg', status: 'design',
      source: 'Representative mid-size sedan kerb mass plus one occupant.' },
    'VEHICLES.sedan.wheelbase': { value: 2.70, unit: 'm', status: 'design',
      source: 'Representative mid-size sedan.' },
    'VEHICLES.sedan.track': { value: 1.55, unit: 'm', status: 'design',
      source: 'Representative mid-size sedan.' },
    'VEHICLES.sedan.cgHeight': { value: 0.55, unit: 'm', status: 'design',
      source: 'Representative sedan centre-of-gravity height; user adjustable.' },
    'VEHICLES.sedan.frontWeightFraction': { value: 0.60, unit: 'fraction', status: 'design',
      source: 'Typical front-drive sedan static distribution.' },
    'VEHICLES.sedan.understeerGradient': { value: 0.0035, unit: 'rad/(m/s^2)', status: 'design',
      source: 'About 2 deg/g, a mild understeer typical of a road car.' },
    'SURFACES.dry.mu': { value: 0.90, unit: 'dimensionless', status: 'design',
      source: 'Passenger tyre on dry asphalt, representative peak.' },
    'SURFACES.wet.mu': { value: 0.60, unit: 'dimensionless', status: 'design',
      source: 'Passenger tyre on wet asphalt, representative peak.' },
    'SURFACES.snow.mu': { value: 0.25, unit: 'dimensionless', status: 'design',
      source: 'Passenger tyre on packed snow, representative peak.' },
    'OCCUPANTS.m50.mass': { value: 78, unit: 'kg', status: 'design',
      source: 'Nominal 50th percentile adult male occupant mass.',
      caveat: 'Not yet checked against a percentile table; treat as a round number.' },
    'OCCUPANTS.f05.mass': { value: 49, unit: 'kg', status: 'design',
      source: 'Nominal 5th percentile adult female occupant mass.',
      caveat: 'Not yet checked against a percentile table; treat as a round number.' },
    'OCCUPANTS.m95.mass': { value: 101, unit: 'kg', status: 'design',
      source: 'Nominal 95th percentile adult male occupant mass.',
      caveat: 'Not yet checked against a percentile table; treat as a round number.' },
    'MODEL.lateralTransferSplit': {
      unit: 'fraction', status: 'placeholder',
      source: 'Lateral load transfer is split between axles in proportion to static ' +
              'weight distribution.',
      caveat: 'The real split follows roll stiffness distribution, not weight ' +
              'distribution. This is a deliberate simplification and it is the ' +
              'reason per-corner loads should be read as indicative.'
    },
    'MODEL.contactStiffness': {
      unit: 'N/m', status: 'placeholder',
      source: 'Effective PATH stiffness for each contact channel, standing for the ' +
              'whole series chain from car structure through trim into the body ' +
              'segment. Tuned so the rest-state distribution matches published ' +
              'seated-pressure findings, roughly 60% through the seat pan.',
      caveat: 'These are not measured component stiffnesses and must not be quoted ' +
              'as such. Only their RATIOS shape the force split; the absolute values ' +
              'are arbitrary. Replacing them with real measured values would change ' +
              'every per-contact number on screen.'
    },
    'MODEL.bracingCaps': {
      unit: 'N', status: 'placeholder',
      source: 'Ceiling on how hard a driver drives each voluntary bracing channel: ' +
              'steering rim 120 N, footrest 250 N, knee bolster 250 N, armrest 60 N, ' +
              'brake pedal 400 N. Structural channels (foam, floor, webbing) have none.',
      caveat: 'These are TYPICAL voluntary effort, not maximum capacity — a driver in ' +
              'a panic stop is braking and steering, not performing a maximal leg ' +
              'press. They set the deceleration at which the belts engage, so they ' +
              'move the single most visible result in the model. Unvalidated.'
    },
    'MODEL.slackRule': {
      status: 'design',
      source: 'Belts and the head restraint carry load only when the gap-free ' +
              'channels cannot supply the required force on their own.',
      caveat: 'This model is quasi-static and does not track body displacement, so ' +
              'it cannot compute slack take-up properly. The rule gets the two ends ' +
              'right (nothing in the belt going straight, belt engaged in hard ' +
              'braking) but the transition is a step, not the gradual take-up a real ' +
              'belt has.'
    },
    'MODEL.seatFriction': {
      status: 'placeholder',
      source: 'Friction at the seat surface is NOT modelled. Only surface normals carry load.',
      caveat: 'Friction is bounded by the normal force it accompanies, which is a cone ' +
              'constraint rather than a simple limit, and it would need a different ' +
              'solver. Its absence pushes fore-aft and lateral load onto the bolster, ' +
              'belt and bracing channels, which therefore read high.'
    },
    'MODEL.occupantAsPoint': {
      status: 'design',
      source: 'The force split treats the occupant as a single point mass.',
      caveat: 'A real body is a linkage: where load goes depends on limb geometry, not ' +
              'only on contact stiffness. This is why the stiffnesses had to be tuned ' +
              'to a known answer rather than measured — they are absorbing the ' +
              'kinematics the point-mass model throws away.'
    },
    'MODEL.corneringModel': {
      status: 'design',
      source: 'Steady-state bicycle model with a constant understeer gradient.',
      caveat: 'Ignores tyre slip, so it flatters large steering angles. Callers ' +
              'must check frictionUtilisation and refuse to display a state above 1.'
    }
  };

  global.LoadPathConstants = {
    G: G,
    SEGMENTS: SEGMENTS,
    VEHICLES: VEHICLES,
    SURFACES: SURFACES,
    OCCUPANTS: OCCUPANTS,
    PROVENANCE: PROVENANCE
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
