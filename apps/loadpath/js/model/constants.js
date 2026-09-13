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

  /* Occupant mass, as a RANGE rather than as named people.

     This used to be three presets: "50th percentile male", "5th percentile
     female", "95th percentile male". Every one of them multiplied the same
     SEGMENTS table, which comes from Dempster's sample of nine male cadavers.
     Changing the total mass does not change the proportions, so the "female"
     preset was a scaled male wearing a label that claimed otherwise — and the
     label is the part a reader believes. The plan flagged this at M0 and set a
     precondition: source sex-specific fractions, or relabel and stop implying
     a body type. Sourcing was attempted at M7 and failed — de Leva (1996),
     which carries both sexes, is behind hosts this environment cannot reach,
     and reconstructing its numbers from memory is exactly the mistake M5
     taught. So the fallback branch: mass is a number, and the app now says
     only what it can support.

     The range is deliberately wider than any percentile table, because it is
     no longer pretending to index one. */
  var OCCUPANT_MASS = { min: 40, max: 130, step: 1, value: 78 };

  /* ---- M5: the vibration channel ----
     Separate constants from the force model on purpose. Nothing here has units
     of newtons and nothing here feeds the contact solver. */

  /* ISO 8608 road roughness classes. Gd(n0) in m^3, stepping by a factor of 4.
     Paved roads in service are essentially always A through D. */
  var ROAD = {
    referenceSpatialFrequency: 0.1,      // n0, cycles per metre
    wavinessExponent: 2,                 // w
    CLASSES: {
      A: { label: 'New motorway',      roughness: 1e-6 },
      B: { label: 'Good asphalt',      roughness: 4e-6 },
      C: { label: 'Worn asphalt',      roughness: 16e-6 },
      D: { label: 'Poor surface',      roughness: 64e-6 },
      E: { label: 'Broken / unpaved',  roughness: 256e-6 }
    }
  };

  /* ISO 2631-1 evaluation parameters. The axis assignment of Wk and Wd lives
     in vibration.js where the filters are; what lives here is the part of
     EQ 7 that is arithmetic rather than filtering. */
  var ISO2631 = {
    kVertical: 1.0,        // multiplying factor on the z axis
    kHorizontal: 1.4,      // multiplying factor on the x and y axes
    bandLowHz: 0.4,
    bandHighHz: 80,
    comfortThreshold: 0.315   // m/s^2, the top of "not uncomfortable"
  };

  /* The ride path from road to occupant. This is the weak link in the chain. */
  var RIDE = {
    /* Quarter car, per corner. Textbook mid-size-sedan values, chosen for the
       two modes they produce rather than picked as frequencies directly:
         body on suspension   (1/2pi)*sqrt(ks/ms)        ~= 1.26 Hz
         wheel hop            (1/2pi)*sqrt((ks+kt)/mu)   ~= 11.9 Hz */
    sprungMass: 350,             // kg per corner
    unsprungMass: 40,            // kg per corner
    suspensionStiffness: 22000,  // N/m
    suspensionDamping: 1500,     // N.s/m
    tyreStiffness: 200000,       // N/m

    /* Occupant on the seat cushion, in series with the quarter car. */
    seatModeHz: 4.5,             // vertical
    seatModeZeta: 0.38,
    seatModeHorizontalHz: 2.0,   // fore-aft and lateral
    horizontalRoadRatio: 0.35    // horizontal seat input as a fraction of vertical
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
    'OCCUPANT_MASS.value': { value: 78, unit: 'kg', status: 'design',
      source: 'Default occupant mass, a round mid-range adult figure.',
      caveat: 'A mass, and only a mass. It indexes no population and names no ' +
              'body type. Three named presets stood here until M7, each one ' +
              'claiming a sex and a size; all three multiplied the same ' +
              'segment fractions, which come from one sample of nine male ' +
              'cadavers, so only the total ever changed. Sourcing fractions ' +
              'for more than one body was attempted and the sources were ' +
              'unreachable from this environment, so the labels went rather ' +
              'than the numbers acquiring a meaning they had not earned.' },
    'OCCUPANT_MASS.range': { value: '40 to 130', unit: 'kg', status: 'design',
      source: 'A span wide enough to cross the bracing threshold in both ' +
              'directions for ordinary maneuvers, which is the one place mass ' +
              'changes the answer qualitatively rather than by a scale factor.' },
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
    'MODEL.bodyLag': {
      value: 0.25, unit: 's', status: 'placeholder',
      source: 'First-order time constant for the occupant\'s acceleration ' +
              'following the cabin\'s. Stands for the whole compliant chain — ' +
              'suspension travel, seat foam, soft tissue and postural response.',
      caveat: 'Not measured, and structurally wrong in one specific way: a ' +
              'first-order lag can never overshoot, while a real torso on a ' +
              'compliant seat is second-order and does. You get the delay and ' +
              'none of the rebound, so a hard stop looks calmer than it feels. ' +
              'It changes only the TRANSIENT; every settled state is identical ' +
              'with the lag on or off.'
    },
    'MODEL.stoppedCar': {
      status: 'design',
      source: 'Brake demand is suppressed at zero speed, because a car already ' +
              'stopped cannot decelerate further.',
      caveat: 'The converse is not modelled: a car held on a grade really is ' +
              'spending longitudinal friction to stay put, and this model shows ' +
              'that as zero traction used. The occupant side is still right — ' +
              'gravity tilts with the cabin — but the tyre numbers on a held ' +
              'hill start understate what the brakes are doing.'
    },
    'ROAD.classes': {
      unit: 'm^3', status: 'corroborated',
      source: 'ISO 8608 road roughness classes by the displacement PSD coefficient ' +
              'Gd(n0) at n0 = 0.1 cycles/m, with waviness exponent w = 2. Class ' +
              'geometric means step by a factor of four: A = 1, B = 4, C = 16, ' +
              'D = 64, E = 256, all times 1e-6 m^3.',
      caveat: 'Confirmed by two differently worded searches; the standard itself ' +
              'was not reachable. One secondary table found during search gave ' +
              'class C and D bounds that do not fit the same table\'s own ' +
              'geometric series, so treat any single secondary source here with ' +
              'suspicion. The class is also a wide band, not a number: a real ' +
              'road anywhere inside class B varies by 4x in roughness.'
    },
    'ISO2631.weightingFilters': {
      status: 'corroborated',
      source: 'ISO 2631-1 Wk and Wd as a cascade of a 2nd-order high-pass at ' +
              '0.4 Hz, a 2nd-order low-pass at 100 Hz, an acceleration-velocity ' +
              'transition, and for Wk an upward step. Wk: f3 = f4 = 12.5 Hz, ' +
              'Q4 = 0.63, f5 = 2.37 Hz, f6 = 3.35 Hz, Q5 = Q6 = 0.91. ' +
              'Wd: f3 = f4 = 2.0 Hz, Q4 = 0.63, no step.',
      caveat: 'Taken from one third-party implementation of the standard, not ' +
              'from the standard. The published one-third-octave weighting table ' +
              'that would settle it was behind an egress block, so the curves ' +
              'here are NOT validated against ISO\'s own numbers — only against ' +
              'their structure (peak of 1.0 in the right band, the 2x step, the ' +
              '-6 dB/octave knee, and Wk/Wd not being swapped). An earlier ' +
              'recalled value for the Wk step, 2.5 and 0.25 Hz, was wrong; that ' +
              'is why nothing here is from memory.'
    },
    'ISO2631.normalisation': {
      status: 'design',
      source: 'Each weighting curve is scaled so its peak magnitude is exactly 1.0.',
      caveat: 'A convention, chosen because it is a real property of the published ' +
              'curves and removes any dependence on the standard\'s internal gain ' +
              'constants, which were not reachable. If the standard normalises ' +
              'differently, every weighted RMS on screen is off by one constant ' +
              'factor — the SHAPE of the spectrum would still be right.'
    },
    'ISO2631.comfortBands': {
      unit: 'm/s^2', status: 'verified',
      source: 'ISO 2631-1 comfort reactions to vibration environments: below ' +
              '0.315 not uncomfortable; 0.315 to 0.63 a little uncomfortable; ' +
              '0.5 to 1.0 fairly uncomfortable; 0.8 to 1.6 uncomfortable; 1.25 ' +
              'to 2.5 very uncomfortable; above 2.0 extremely uncomfortable.',
      caveat: 'The standard calls these approximate indications and the bands ' +
              'OVERLAP by design, so a single value can sit in two at once. The ' +
              'app reports both rather than picking one, because collapsing the ' +
              'overlap discards the standard\'s own statement of how sure it is.'
    },
    'RIDE.quarterCar': {
      status: 'placeholder',
      source: 'Road to seat mount as a two-degree-of-freedom quarter car: sprung ' +
              '350 kg, unsprung 40 kg, suspension 22 kN/m and 1500 N.s/m, tyre ' +
              '200 kN/m. Produces a body mode near 1.26 Hz and wheel hop near ' +
              '11.9 Hz, both in the usual ranges for a mid-size passenger car.',
      caveat: 'Representative textbook values, not a measured vehicle. The first ' +
              'version had no unsprung mass and therefore no wheel hop at all. ' +
              'Adding it was the right fix — a missing degree of freedom, not a ' +
              'number to tune — but it is worth recording how much it actually ' +
              'mattered: the 8-20 Hz band carries about 14% of the weighted ' +
              'vertical energy and the total value moved by roughly 13%. The ' +
              'suspension isolates the body well at 12 Hz, so wheel hop shows at ' +
              'the seat as a shoulder rather than the peak. The expectation ' +
              'before measuring was that it would matter more than that.'
    },
    'RIDE.seatMode': {
      unit: 'Hz', status: 'placeholder',
      source: 'Occupant on the seat cushion as one base-excited mode: 4.5 Hz ' +
              'vertical, 2.0 Hz horizontal, damping ratio 0.38.',
      caveat: 'The 4-6 Hz seated vertical resonance band is sourced; this exact ' +
              'frequency, the horizontal figure and the damping are not. Real ' +
              'apparent mass also falls with vibration amplitude, which this does ' +
              'not model, so it is least right where the road is worst.'
    },
    'RIDE.horizontalRoadRatio': {
      status: 'placeholder',
      source: 'Horizontal seat input taken as 0.35 of the vertical road input.',
      caveat: 'A guess, and an unusually consequential one: EQ 7 multiplies both ' +
              'horizontal axes by 1.4 against 1.0 for vertical, so this ratio has ' +
              'leverage over the total value out of all proportion to the ' +
              'confidence behind it. The app therefore reports the per-axis RMS ' +
              'and the horizontal share alongside the total, so a reader can see ' +
              'how much of the headline rests on this number.'
    },
    'RIDE.validation': {
      status: 'placeholder',
      source: 'The end-to-end vibration chain has NOT been checked against any ' +
              'measured vehicle.',
      caveat: 'Every stage is individually defensible and the assembly has never ' +
              'been compared to a real measurement, because the papers that would ' +
              'supply one were unreachable from this environment. The comfort ' +
              'band is therefore a statement about this model, not about a car. ' +
              'Tuning the placeholders until the output matched a remembered ' +
              'figure was considered and rejected: it would have destroyed the ' +
              'only useful thing about the number, which is that nothing was bent ' +
              'to make it land anywhere in particular.'
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
    OCCUPANT_MASS: OCCUPANT_MASS,
    ROAD: ROAD,
    ISO2631: ISO2631,
    RIDE: RIDE,
    PROVENANCE: PROVENANCE
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
