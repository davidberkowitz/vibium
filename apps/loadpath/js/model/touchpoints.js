/* Driver Load Path — the twelve contact channels.

   Table 1 of the plan, as data rather than prose. Each entry is a place where
   the car and the driver touch, and therefore a place where force crosses
   between them in both directions at once.

   Three fields do real work later:

     axis        which component of the load this channel can carry
     constraint  compression-only (foam, bone), tension-only (webbing), or both
     activeAtRest whether the channel carries any load in the cruise baseline

   The constraint field is the reason the force split in M2 is a quadratic
   program rather than a linear solve. Seat foam can push you but cannot pull
   you; belt webbing can pull you but cannot push you. Drop those signs and a
   solver will happily report the seat back pulling you toward it under braking.

   Geometry lives in view2d, keyed by id, so the plan view can place the same
   twelve contacts differently without duplicating any of this.
*/
(function (global) {
  'use strict';

  var AXES = ['vertical', 'longitudinal', 'lateral', 'torque'];
  var CONSTRAINTS = ['compression', 'tension', 'bidirectional'];
  var REGIMES = ['cruise', 'braking', 'acceleration', 'cornering'];

  var TOUCHPOINTS = [
    { id: 'seat_pan', n: '01', label: 'Seat pan',
      anatomy: 'Ischial tuberosities, posterior thigh',
      carOnDriver: 'Vertical normal force plus surface friction',
      driverOnCar: 'Body weight and vertical inertia into the seat frame',
      axis: 'vertical', constraint: 'compression',
      dominantRegime: 'cruise', activeAtRest: true },

    { id: 'seat_back', n: '02', label: 'Seat back',
      anatomy: 'Thoracolumbar spine, scapulae',
      carOnDriver: 'Fore-aft normal force',
      driverOnCar: 'Thrust into the seat rails under throttle',
      axis: 'longitudinal', constraint: 'compression',
      dominantRegime: 'acceleration', activeAtRest: true },

    { id: 'bolster', n: '03', label: 'Side bolster',
      anatomy: 'Greater trochanter, lateral ribcage',
      carOnDriver: 'Lateral normal force',
      driverOnCar: 'Lateral thrust into the seat, offset from the centreline',
      axis: 'lateral', constraint: 'compression',
      dominantRegime: 'cornering', activeAtRest: false },

    { id: 'lap_belt', n: '04', label: 'Lap belt',
      anatomy: 'Anterior superior iliac spine',
      carOnDriver: 'Webbing tension across the pelvis',
      driverOnCar: 'Load into the floor and B-pillar anchors',
      axis: 'longitudinal', constraint: 'tension',
      dominantRegime: 'braking', activeAtRest: false, gated: 'slack until the body moves' },

    { id: 'shoulder_belt', n: '05', label: 'Shoulder belt',
      anatomy: 'Clavicle, sternum',
      carOnDriver: 'Webbing tension across the torso',
      driverOnCar: 'Load into the upper anchor and retractor',
      axis: 'longitudinal', constraint: 'tension',
      dominantRegime: 'braking', activeAtRest: false, gated: 'slack until the body moves' },

    { id: 'wheel', n: '06', label: 'Steering wheel',
      anatomy: 'Palms, nine and three',
      carOnDriver: 'Self-aligning torque, kickback, rim vibration',
      driverOnCar: 'Steering torque, grip force, arm bracing',
      axis: 'torque', constraint: 'bidirectional',
      dominantRegime: 'cornering', activeAtRest: true },

    { id: 'pedal', n: '07', label: 'Brake / throttle pedal',
      anatomy: 'Right forefoot',
      carOnDriver: 'Pedal reaction through the booster',
      driverOnCar: 'Applied pedal force, a driver input',
      axis: 'longitudinal', constraint: 'compression',
      dominantRegime: 'braking', activeAtRest: false },

    { id: 'footrest', n: '08', label: 'Footrest',
      anatomy: 'Left foot, whole sole',
      carOnDriver: 'Normal reaction',
      driverOnCar: 'Voluntary bracing thrust',
      axis: 'longitudinal', constraint: 'compression',
      dominantRegime: 'cornering', activeAtRest: true },

    { id: 'floor', n: '09', label: 'Floor',
      anatomy: 'Feet at rest',
      carOnDriver: 'Normal reaction',
      driverOnCar: 'Share of static weight',
      axis: 'vertical', constraint: 'compression',
      dominantRegime: 'cruise', activeAtRest: true },

    { id: 'head_restraint', n: '10', label: 'Head restraint',
      anatomy: 'Occiput',
      carOnDriver: 'Fore-aft normal once the gap closes',
      driverOnCar: 'Head inertia into the seat back',
      axis: 'longitudinal', constraint: 'compression',
      dominantRegime: 'acceleration', activeAtRest: false, gated: 'a gap sits behind the head' },

    { id: 'knee_bolster', n: '11', label: 'Knee bolster',
      anatomy: 'Lateral knee, console side',
      carOnDriver: 'Lateral normal force',
      driverOnCar: 'Knee bracing thrust',
      axis: 'lateral', constraint: 'compression',
      dominantRegime: 'cornering', activeAtRest: false },

    { id: 'armrest', n: '12', label: 'Armrest',
      anatomy: 'Elbow, proximal forearm',
      carOnDriver: 'Normal reaction',
      driverOnCar: 'Arm weight and bracing',
      axis: 'vertical', constraint: 'compression',
      dominantRegime: 'cruise', activeAtRest: true }
  ];

  function byId(id) {
    for (var i = 0; i < TOUCHPOINTS.length; i++) {
      if (TOUCHPOINTS[i].id === id) return TOUCHPOINTS[i];
    }
    return null;
  }

  function activeAtRest() {
    return TOUCHPOINTS.filter(function (t) { return t.activeAtRest; });
  }

  function byRegime(regime) {
    return TOUCHPOINTS.filter(function (t) { return t.dominantRegime === regime; });
  }

  global.LoadPathTouchpoints = {
    AXES: AXES,
    CONSTRAINTS: CONSTRAINTS,
    REGIMES: REGIMES,
    ALL: TOUCHPOINTS,
    byId: byId,
    activeAtRest: activeAtRest,
    byRegime: byRegime
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
