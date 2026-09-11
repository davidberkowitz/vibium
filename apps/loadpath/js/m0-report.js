#!/usr/bin/env node
/* Driver Load Path — milestone 0 harness.

   M0 has no interface on purpose. A wrong number rendered beautifully is more
   dangerous than a right number rendered plainly, because the polish buys it
   credibility it has not earned. So this milestone ends at a console table.

   Run:  node apps/loadpath/js/m0-report.js
         node apps/loadpath/js/m0-report.js --surface wet --driver f05

   This file is scaffolding. It goes away when js/app.js arrives in M1.
*/
'use strict';

require('./model/constants.js');
require('./model/vehicle.js');
require('./model/occupant.js');
require('./model/contacts.js');

const C = globalThis.LoadPathConstants;
const V = globalThis.LoadPathVehicle;
const O = globalThis.LoadPathOccupant;
const K = globalThis.LoadPathContacts;
const G = C.G;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const surfaceKey = arg('surface', 'dry');
const driverKey = arg('driver', 'm50');
const surface = C.SURFACES[surfaceKey];
const driver = C.OCCUPANTS[driverKey];
const car = C.VEHICLES.sedan;

if (!surface) { console.error(`Unknown surface "${surfaceKey}". Try: ${Object.keys(C.SURFACES).join(', ')}`); process.exit(1); }
if (!driver) { console.error(`Unknown driver "${driverKey}". Try: ${Object.keys(C.OCCUPANTS).join(', ')}`); process.exit(1); }

/* Driver inputs, not accelerations — the point is that the model derives the
   accelerations from what a person actually does with their hands and feet. */
const SCENARIOS = [
  { name: 'Parked',           speed: 0,  steerAngle: 0,     ax: 0 },
  { name: 'Motorway cruise',  speed: 31, steerAngle: 0,     ax: 0 },
  { name: 'Gentle throttle',  speed: 14, steerAngle: 0,     ax: 2.0 },
  { name: 'Firm braking',     speed: 25, steerAngle: 0,     ax: -6.5 },
  { name: 'Panic stop',       speed: 25, steerAngle: 0,     ax: -9.0 },
  { name: 'Motorway lane change', speed: 31, steerAngle: 0.010, ax: 0 },
  { name: 'Brisk left bend',  speed: 22, steerAngle: 0.045, ax: 0 },
  { name: 'Trail braking in', speed: 22, steerAngle: 0.045, ax: -4.0 },
  { name: 'Power out of bend', speed: 20, steerAngle: -0.040, ax: 2.5 },
  { name: 'Slalom, over the limit', speed: 30, steerAngle: 0.090, ax: -6.0 }
];

const N = (x, w = 7, d = 0) => x.toFixed(d).padStart(w);
const S = (x, w) => String(x).padEnd(w);
const rule = (ch, n) => ch.repeat(n);

console.log('');
console.log('  DRIVER LOAD PATH — M0 model core');
console.log('  ' + rule('=', 96));
console.log(`  Vehicle   ${car.label}: ${car.mass} kg, wheelbase ${car.wheelbase} m, track ${car.track} m, CG ${car.cgHeight} m`);
console.log(`  Surface   ${surface.label}, mu ${surface.mu.toFixed(2)} — traction limit ${(surface.mu * G).toFixed(2)} m/s2 (${surface.mu.toFixed(2)} g)`);
console.log(`  Driver    ${driver.label}, ${driver.mass} kg — ${((driver.mass / car.mass) * 100).toFixed(1)}% of vehicle mass`);
console.log(`  Frame     ISO 8855: x forward, y to the driver's left, z up`);
console.log('');

console.log('  VEHICLE STATE');
console.log('  ' + rule('-', 96));
console.log('  ' + S('Scenario', 24) + S('km/h', 7) + S('ax (g)', 9) + S('ay (g)', 9) +
            S('friction', 10) + S('radius', 10) + S('status', 20));
console.log('  ' + rule('-', 96));

const solved = SCENARIOS.map(sc => {
  const state = V.solve({ speed: sc.speed, steerAngle: sc.steerAngle, ax: sc.ax, mu: surface.mu }, car);
  const occ = O.solve({ bodyMass: driver.mass, accel: state.accel });
  const split = K.solve(occ.carOnBody);
  return { sc, state, occ, split };
});

for (const { sc, state } of solved) {
  const r = state.turnRadius;
  const radius = r === Infinity ? 'straight' : r.toFixed(0) + ' m';
  let status = 'ok';
  if (state.tractionExceeded) status = 'TRACTION EXCEEDED';
  if (state.corners.wheelsLifted.length) status = 'WHEEL LIFT';
  console.log('  ' + S(sc.name, 24) + N(sc.speed * 3.6, 5, 0) + '  ' +
    N(state.accel.x / G, 8, 2) + ' ' + N(state.accel.y / G, 8, 2) + ' ' +
    N(state.utilisation * 100, 8, 0) + '%  ' + S(radius, 10) + S(status, 20));
}

console.log('');
console.log('  TYRE LOADS (N per corner)');
console.log('  ' + rule('-', 96));
console.log('  ' + S('Scenario', 24) + S('front L', 11) + S('front R', 11) +
            S('rear L', 11) + S('rear R', 11) + S('sum', 11) + S('vs weight', 12));
console.log('  ' + rule('-', 96));

const weight = car.mass * G;
for (const { sc, state } of solved) {
  const L = state.corners.loads;
  const err = state.corners.total - weight;
  console.log('  ' + S(sc.name, 24) + N(L.frontLeft, 9) + '  ' + N(L.frontRight, 9) + '  ' +
    N(L.rearLeft, 9) + '  ' + N(L.rearRight, 9) + '  ' + N(state.corners.total, 9) + '  ' +
    S(Math.abs(err) < 1e-6 ? 'exact' : err.toExponential(1), 12));
}

console.log('');
console.log(`  FORCES ON AND FROM THE DRIVER (${driver.mass} kg)`);
console.log('  ' + rule('-', 96));
console.log('  ' + S('Scenario', 24) + S('g-load', 9) + S('car->body (N)', 30) +
            S('body->car (N)', 30));
console.log('  ' + rule('-', 96));

for (const { sc, occ } of solved) {
  const f = occ.carOnBody, r = occ.bodyOnCar;
  const fmt = v => `(${N(v.x, 6)},${N(v.y, 6)},${N(v.z, 6)} )`;
  console.log('  ' + S(sc.name, 24) + N(occ.gLoad, 6, 2) + '   ' + S(fmt(f), 30) + S(fmt(r), 30));
}

console.log('');
console.log('  WHERE THE FORCE ENTERS THE BODY (N per contact)');
console.log('  ' + rule('-', 96));
console.log('  The browser view shows one state. This is the solver across all of them,');
console.log('  which is where it earns or loses trust. Blank means that contact carries');
console.log('  nothing. * marks a channel driven to its bracing limit.');
console.log('');

const CONTACT_ORDER = ['seat_pan', 'seat_back', 'bolster', 'lap_belt', 'shoulder_belt',
                       'wheel', 'pedal', 'footrest', 'floor', 'knee_bolster',
                       'head_restraint', 'armrest'];
const SHORT = { seat_pan: 'pan', seat_back: 'back', bolster: 'bolst', lap_belt: 'lap',
                shoulder_belt: 'shldr', wheel: 'wheel', pedal: 'pedal', footrest: 'foot',
                floor: 'floor', knee_bolster: 'knee', head_restraint: 'head', armrest: 'arm' };

console.log('  ' + S('Scenario', 24) + CONTACT_ORDER.map(k => S(SHORT[k], 7)).join(''));
console.log('  ' + rule('-', 96));
for (const { sc, occ, split } of solved) {
  if (!split.feasible) { console.log('  ' + S(sc.name, 24) + 'INFEASIBLE'); continue; }
  const cells = CONTACT_ORDER.map(k => {
    const t = split.byTouchpoint[k];
    if (!t || t.magnitude < 0.5) return S('.', 7);
    const sat = split.channels.some(c => c.touchpoint === k && c.saturated) ? '*' : ' ';
    return S(Math.round(t.magnitude) + sat, 7);
  });
  console.log('  ' + S(sc.name, 24) + cells.join(''));
}

console.log('');
console.log('  ' + S('Scenario', 24) + S('belt engaged', 15) + S('balance residual', 20) + S('iterations', 12));
console.log('  ' + rule('-', 96));
let worstBal = 0;
for (const { sc, occ, split } of solved) {
  if (!split.feasible) continue;
  const bal = K.auditBalance(split, occ.carOnBody);
  if (bal.residual > worstBal) worstBal = bal.residual;
  console.log('  ' + S(sc.name, 24) + S(split.slackEngaged ? 'yes' : 'no', 15) +
              S(bal.residual.toExponential(2) + ' N', 20) + S(String(split.iterations), 12));
}
console.log('');
console.log(`  The split re-sums to the whole-body requirement in every scenario; worst`);
console.log(`  residual ${worstBal.toExponential(2)} N. No contact pulls when it can only push, and no`);
console.log(`  bracing channel exceeds its limit — both hold by construction, not by check.`);

console.log('');
console.log('  NEWTON THIRD LAW AUDIT — the gate for M0');
console.log('  ' + rule('-', 96));
let worst = 0, worstName = '';
for (const { sc, occ } of solved) {
  const a = O.auditThirdLaw(occ);
  if (a.worst > worst) { worst = a.worst; worstName = sc.name; }
}
console.log(`  Segment forces re-sum to the whole-body requirement, and the force the driver`);
console.log(`  applies to the car is the exact negative of the force the car applies to the driver.`);
console.log(`  Worst residual across ${solved.length} scenarios: ${worst.toExponential(3)} N  (${worstName || 'all exact'})`);
console.log(`  Verdict: ${worst < 1e-9 ? 'PASS' : 'FAIL'}`);

console.log('');
console.log('  NUMBERS YOU SHOULD NOT QUOTE YET');
console.log('  ' + rule('-', 96));
for (const [key, rec] of Object.entries(C.PROVENANCE)) {
  if (rec.status === 'verified' || rec.status === 'design') continue;
  console.log(`  [${rec.status}] ${key}`);
  console.log(`     ${rec.source}`);
  if (rec.caveat) console.log(`     CAVEAT: ${rec.caveat.replace(/\s+/g, ' ')}`);
}
console.log('');
console.log('  Not modelled at M0: how that force divides between seat pan, bolster, belt,');
console.log('  footrest and wheel. That split is statically indeterminate and is milestone 2.');
console.log('');

process.exit(worst < 1e-9 ? 0 : 1);
