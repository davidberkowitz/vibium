/* Driver Load Path — the contact force solver. Milestone 2.

   THE PROBLEM

   The occupant solver says what force the car must apply to the driver in
   total. It does not say how that total divides between the seat pan, the
   bolster, the belt, the footrest and the wheel. There are more unknowns than
   equations: three equations of force balance, a dozen or more places the load
   could come from. The system is STATICALLY INDETERMINATE.

   Nothing errors when you ignore this. Your code happily returns *a*
   distribution — whichever one an arbitrary code path happened to pick. You
   have to notice on your own that the problem has no unique answer, and then
   choose the principle that picks one.

   THE PRINCIPLE

   Stop treating the contacts as rigid. Each is a spring of stiffness k acting
   along one direction n. Nature then distributes the load so that the stored
   elastic energy is least — the principle of minimum complementary energy.
   That is not a heuristic; it is what an elastic structure actually does.

       minimise   sum over j of  lambda_j^2 / (2 k_j)
       subject to sum over j of  lambda_j n_j  =  F_required
       and        lambda_j >= 0                            for every j

   THE SIGN CONSTRAINTS ARE THE WHOLE DIFFICULTY

   Seat foam can push you but cannot pull you. Belt webbing can pull you but
   cannot push you. That is what lambda_j >= 0 encodes, and it is what turns a
   one-line linear solve into a quadratic program. Drop it and the solver will
   report the seat back pulling you toward it under braking, which foam cannot
   do and which no amount of testing the force balance would catch, because the
   balance is still satisfied.

   HOW IT IS SOLVED

   Not with a general QP library. Substituting lambda_j = sqrt(k_j) z_j turns
   the objective into a plain minimum-norm problem, and the Karush-Kuhn-Tucker
   conditions of that problem collapse to something small and exact:

       z = max(0, A^T y)      for some y in R^3

   So the dozen-plus unknowns are a function of just THREE. Substituting back
   into the constraint leaves an unconstrained convex minimisation in y:

       phi(y) = 0.5 * ||max(0, A^T y)||^2  -  b . y
       grad phi = A max(0, A^T y) - b

   Three variables, a convex piecewise-quadratic, solved by Newton's method in
   a handful of iterations. The generalised Hessian is the 3x3 sum of the outer
   products of the currently active columns.

   Every lambda is non-negative and within its cap BY CONSTRUCTION — those are
   not checked afterwards, they cannot be violated. The force balance is what
   the iteration drives to zero, and across a sweep of the whole acceleration
   envelope it closes to better than 1e-5 N on a load of order 1000 N. Not
   machine precision: where two channels sit exactly at their caps the active
   set can chatter and the iteration stalls a few parts per billion out. That
   is six orders of magnitude below the model's own percent-level uncertainty,
   so it is left alone rather than chased.

   SLACK

   Belts and the head restraint have a gap: they carry nothing until the body
   has moved far enough to take it up. This model is quasi-static and does not
   track that displacement, so engagement is decided structurally instead. The
   solve runs first with the gap-free channels only. If they can supply the
   required force, the gapped channels stay out — which is why the belts
   correctly carry zero in a car going straight. Only when the rigid paths
   cannot supply it do the gapped channels come in. Physically: slack takes up
   when, and only when, the direct path has run out.

   WHAT THIS DOES NOT MODEL, stated because the numbers look authoritative:
   friction at the seat surface (a cone constraint, not a simple bound), the
   body as a linkage rather than a point, and the time it takes any of this to
   happen. See PROVENANCE in constants.js.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;

  function unit(v) {
    var m = Math.hypot(v[0], v[1], v[2]);
    return m === 0 ? [0, 0, 0] : [v[0] / m, v[1] / m, v[2] / m];
  }

  /* One channel is one direction a single touchpoint can push or pull along.
     Most touchpoints have exactly one. A bolster has two, because a seat has a
     surface on each side of you and only one of them can be in contact at a
     time. The steering wheel has two, because your arms both hold you up and
     let you brace against the rim.

     `cap` is how hard that channel can actually be driven, and it is what
     separates structure from muscle. Foam, floor and webbing have no cap: they
     carry whatever the structure carries. Bracing does — a driver pressing on
     the rim or the dead pedal has a limit, and crucially the limit is TYPICAL
     voluntary effort, not maximum capacity: someone in a panic stop is not
     performing a maximal leg press against the footrest, they are busy
     braking and steering. Without these caps the solver braces its way out of
     any deceleration and concludes the belts never carry anything, which is
     both wrong and comfortable-sounding. They are placeholders, and the plan's
     failure-modes section is where their weakness is recorded.

     `k` is an EFFECTIVE PATH stiffness, not a measured component stiffness: it
     stands for the whole series chain from the car's structure through the
     trim and into the body segment. They are tuned so the rest-state
     distribution matches published seated-pressure findings, and they are
     recorded as placeholders in PROVENANCE. Their RATIO is what shapes the
     answer; their absolute values do not. */
  var CHANNELS = [
    { id: 'seat_pan',        touchpoint: 'seat_pan',       n: [0, 0, 1],          k: 45000 },
    { id: 'seat_back',       touchpoint: 'seat_back',      n: [0.906, 0, 0.423],  k: 12000 },
    { id: 'bolster_inboard', touchpoint: 'bolster',        n: [0, 1, 0],          k: 10000 },
    { id: 'bolster_outboard',touchpoint: 'bolster',        n: [0, -1, 0],         k: 10000 },
    { id: 'lap_belt',        touchpoint: 'lap_belt',       n: [-0.94, 0, -0.34],  k: 120000, gapped: true },
    { id: 'shoulder_belt',   touchpoint: 'shoulder_belt',  n: [-0.90, 0.17, 0.40],k: 100000, gapped: true },
    { id: 'wheel_support',   touchpoint: 'wheel',          n: [0, 0, 1],          k: 3000,  cap: 120 },
    { id: 'wheel_brace',     touchpoint: 'wheel',          n: [-1, 0, 0],         k: 9000,  cap: 120 },
    { id: 'pedal',           touchpoint: 'pedal',          n: [-0.42, 0, 0.91],   k: 6000,  cap: 400 },
    { id: 'footrest',        touchpoint: 'footrest',       n: [-0.55, 0, 0.84],   k: 7000,  cap: 250 },
    { id: 'floor',           touchpoint: 'floor',          n: [0, 0, 1],          k: 5000 },
    { id: 'head_restraint',  touchpoint: 'head_restraint', n: [1, 0, 0],          k: 20000, gapped: true },
    { id: 'knee_bolster',    touchpoint: 'knee_bolster',   n: [0, 1, 0],          k: 14000, cap: 250 },
    { id: 'armrest',         touchpoint: 'armrest',        n: [0, 0, 1],          k: 6000,  cap: 60 }
  ].map(function (c) {
    c.n = unit(c.n);
    c.rootK = Math.sqrt(c.k);
    if (c.cap == null) c.cap = Infinity;
    return c;
  });

  /* --- small dense linear algebra, 3x3 only --- */
  function solve3(H, g) {
    var a = H[0][0], b = H[0][1], c = H[0][2],
        d = H[1][0], e = H[1][1], f = H[1][2],
        p = H[2][0], q = H[2][1], r = H[2][2];
    var det = a * (e * r - f * q) - b * (d * r - f * p) + c * (d * q - e * p);
    if (!isFinite(det) || Math.abs(det) < 1e-14) return null;
    var i00 = (e * r - f * q) / det, i01 = (c * q - b * r) / det, i02 = (b * f - c * e) / det;
    var i10 = (f * p - d * r) / det, i11 = (a * r - c * p) / det, i12 = (c * d - a * f) / det;
    var i20 = (d * q - e * p) / det, i21 = (b * p - a * q) / det, i22 = (a * e - b * d) / det;
    return [
      i00 * g[0] + i01 * g[1] + i02 * g[2],
      i10 * g[0] + i11 * g[1] + i12 * g[2],
      i20 * g[0] + i21 * g[1] + i22 * g[2]
    ];
  }

  /* Core: minimise phi(y) = 0.5||max(0, A^T y)||^2 - b.y over y in R^3.
     Returns the non-negative channel magnitudes, or null if the available
     channels cannot supply b at all. */
  function solveSet(channels, b, opts) {
    opts = opts || {};
    var tol = opts.tol || 1e-13;
    var maxIter = opts.maxIter || 200;
    var m = channels.length;
    var A = channels.map(function (c) {
      return [c.rootK * c.n[0], c.rootK * c.n[1], c.rootK * c.n[2]];
    });
    /* Caps expressed in the scaled variable: lambda = rootK * z, so a cap on
       force is a cap on z of cap / rootK. */
    var capZ = channels.map(function (c) {
      return c.cap === Infinity ? Infinity : c.cap / c.rootK;
    });
    var scale = Math.max(1, Math.hypot(b[0], b[1], b[2]));

    var z = new Array(m).fill(0);
    var iterations = 0;

    /* Warm start from the UNCONSTRAINED least-norm solution's dual,
       y0 = (A A^T)^-1 b. Starting at the origin instead leaves every channel
       inactive, which makes the generalised Hessian empty and the first Newton
       step meaningless — the iteration stalls before it begins. This seed
       activates a sensible set immediately and is the answer outright whenever
       no sign constraint binds. */
    var AAt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var jj = 0; jj < m; jj++) {
      for (var r1 = 0; r1 < 3; r1++) {
        for (var c1 = 0; c1 < 3; c1++) AAt[r1][c1] += A[jj][r1] * A[jj][c1];
      }
    }
    var reg = 1e-9 * (AAt[0][0] + AAt[1][1] + AAt[2][2] + 1);
    AAt[0][0] += reg; AAt[1][1] += reg; AAt[2][2] += reg;
    var y = solve3(AAt, b) || [0, 0, 0];

    /* With both a floor and a ceiling the stationarity condition becomes
       z = clamp(A^T y, 0, cap) rather than max(0, A^T y). Only the channels
       strictly BETWEEN their limits enter the Hessian: a channel pinned at
       zero or pinned at its cap does not respond to a small change in y. */
    function activationsAndGrad(yy) {
      var g = [-b[0], -b[1], -b[2]];
      var act = [];
      for (var j = 0; j < m; j++) {
        var t = A[j][0] * yy[0] + A[j][1] * yy[1] + A[j][2] * yy[2];
        var zj = t < 0 ? 0 : (t > capZ[j] ? capZ[j] : t);
        z[j] = zj;
        if (t > 0 && t < capZ[j]) act.push(j);
        g[0] += A[j][0] * zj; g[1] += A[j][1] * zj; g[2] += A[j][2] * zj;
      }
      return { grad: g, active: act };
    }

    function phi(yy) {
      var s = 0;
      for (var j = 0; j < m; j++) {
        var t = A[j][0] * yy[0] + A[j][1] * yy[1] + A[j][2] * yy[2];
        if (t <= 0) continue;
        if (t < capZ[j]) s += t * t;                       // free: quadratic
        else s += capZ[j] * (2 * t - capZ[j]);             // saturated: linear
      }
      return 0.5 * s - (b[0] * yy[0] + b[1] * yy[1] + b[2] * yy[2]);
    }

    for (; iterations < maxIter; iterations++) {
      var st = activationsAndGrad(y);
      var gn = Math.hypot(st.grad[0], st.grad[1], st.grad[2]);
      if (gn <= tol * scale) break;

      // Generalised Hessian: outer products of the active columns, regularised.
      var H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (var ai = 0; ai < st.active.length; ai++) {
        var col = A[st.active[ai]];
        for (var r0 = 0; r0 < 3; r0++) {
          for (var c0 = 0; c0 < 3; c0++) H[r0][c0] += col[r0] * col[c0];
        }
      }
      var eps = 1e-8 * (H[0][0] + H[1][1] + H[2][2] + 1);
      H[0][0] += eps; H[1][1] += eps; H[2][2] += eps;

      var step = solve3(H, st.grad);
      if (!step) { step = [st.grad[0] / eps, st.grad[1] / eps, st.grad[2] / eps]; }

      /* Armijo backtracking. A plain "must decrease" test fails when phi is
         near zero, and a plain Newton step overshoots exactly where the active
         set changes mid-step, which is most of the interesting cases. */
      var dir = [-step[0], -step[1], -step[2]];
      var dd = st.grad[0] * dir[0] + st.grad[1] * dir[1] + st.grad[2] * dir[2];
      if (!(dd < 0)) { dir = [-st.grad[0], -st.grad[1], -st.grad[2]]; dd = -gn * gn; }
      var f0 = phi(y), t0 = 1, ok = false;
      for (var ls = 0; ls < 60; ls++) {
        var cand = [y[0] + t0 * dir[0], y[1] + t0 * dir[1], y[2] + t0 * dir[2]];
        if (phi(cand) <= f0 + 1e-4 * t0 * dd) { y = cand; ok = true; break; }
        t0 *= 0.5;
      }
      if (!ok) break;

      /* Stall detection. When two channels sit exactly at their caps the
         generalised Hessian loses rank in that direction and the active set
         can chatter: the step flips a channel between free and saturated and
         makes no progress. Without this the loop burns every iteration it is
         allowed for no gain. The residual it stalls at is around 1e-6 N,
         which is nothing next to this model's percent-level uncertainty. */
      if (t0 * Math.hypot(dir[0], dir[1], dir[2]) < 1e-15 * Math.max(1, Math.hypot(y[0], y[1], y[2]))) break;
    }

    var fin = activationsAndGrad(y);
    var residual = Math.hypot(fin.grad[0], fin.grad[1], fin.grad[2]);
    if (!(residual <= 1e-6 * scale)) return null;   // the cone cannot reach b

    return {
      lambda: channels.map(function (c, j) { return c.rootK * z[j]; }),
      saturated: channels.filter(function (c, j) {
        return capZ[j] !== Infinity && z[j] >= capZ[j] - 1e-12;
      }).map(function (c) { return c.id; }),
      residual: residual,
      iterations: iterations
    };
  }

  /* Public entry.

     required: {x,y,z} the total force the car must apply to the driver.
     Returns the split, aggregated per touchpoint, plus the reciprocal. */
  function solve(required, opts) {
    opts = opts || {};
    var b = [required.x, required.y, required.z];
    var all = opts.channels || CHANNELS;

    var direct = all.filter(function (c) { return !c.gapped; });
    var used = direct;
    var res = solveSet(direct, b, opts);
    var slackEngaged = false;

    if (!res) {                       // the rigid paths cannot do it alone
      used = all;
      res = solveSet(all, b, opts);
      slackEngaged = !!res;
    }

    if (!res) {
      return {
        feasible: false, slackEngaged: false, channels: [], byTouchpoint: {},
        residual: Infinity, iterations: 0,
        reason: 'No combination of the available contacts can supply this force. ' +
                'Every contact can only push or pull one way, and the demand lies ' +
                'outside the cone they span.'
      };
    }

    var total = res.lambda.reduce(function (s, v) { return s + v; }, 0);
    var channels = used.map(function (c, j) {
      var lam = res.lambda[j];
      return {
        id: c.id, touchpoint: c.touchpoint, gapped: !!c.gapped,
        magnitude: lam,
        cap: c.cap,
        saturated: c.cap !== Infinity && lam >= c.cap - 1e-6,
        share: total > 0 ? lam / total : 0,
        carOnBody: { x: lam * c.n[0], y: lam * c.n[1], z: lam * c.n[2] },
        bodyOnCar: { x: -lam * c.n[0], y: -lam * c.n[1], z: -lam * c.n[2] }
      };
    });

    var byTouchpoint = {};
    channels.forEach(function (ch) {
      var t = byTouchpoint[ch.touchpoint] || (byTouchpoint[ch.touchpoint] = {
        touchpoint: ch.touchpoint, magnitude: 0, share: 0,
        carOnBody: { x: 0, y: 0, z: 0 }, channels: []
      });
      t.magnitude += ch.magnitude;
      t.share += ch.share;
      t.carOnBody.x += ch.carOnBody.x;
      t.carOnBody.y += ch.carOnBody.y;
      t.carOnBody.z += ch.carOnBody.z;
      t.channels.push(ch.id);
    });

    return {
      feasible: true, slackEngaged: slackEngaged,
      saturated: res.saturated,
      channels: channels, byTouchpoint: byTouchpoint,
      residual: res.residual, iterations: res.iterations
    };
  }

  /* Independent audit: re-sum the split and compare with what was asked for.
     Kept separate from solve() on purpose — a solver that checks itself with
     its own arithmetic proves nothing. */
  function auditBalance(split, required) {
    var s = { x: 0, y: 0, z: 0 };
    split.channels.forEach(function (ch) {
      s.x += ch.carOnBody.x; s.y += ch.carOnBody.y; s.z += ch.carOnBody.z;
    });
    return {
      summed: s,
      residual: Math.hypot(s.x - required.x, s.y - required.y, s.z - required.z),
      negativeChannels: split.channels.filter(function (ch) { return ch.magnitude < -1e-9; })
    };
  }

  /* ---------------------------------------------------------------------
     THE BRACING THRESHOLD — M7.

     The caps above are ABSOLUTE newtons, not fractions of body mass, and that
     is deliberate: a heavier person does not come with proportionally stronger
     arms. A hand on a wheel rim can push about so hard whoever it belongs to.

     The consequence went undrawn for seven milestones because body mass was
     hard-coded. Demand scales exactly with mass — twice the body, twice the
     newtons — but the BUDGET to brace against it does not scale at all. So for
     any given maneuver there is a mass at which the braced channels saturate,
     the driver runs out of arm and leg, and the webbing takes up. Below it a
     driver holds themselves; above it the car holds them. Same maneuver, same
     car, different answer, and the changeover is sharp.

     This finds that mass by bisection on the solver's own slackEngaged flag.
     It is a property of the maneuver, not of the occupant: the occupant is the
     thing being compared against it.

     Returns null when the whole range is on one side — a gentle cruise never
     engages the belts at any mass, and there is no threshold to report rather
     than a made-up one at the end of the range. */
  function bracingThreshold(opts) {
    var lo = opts.min, hi = opts.max;
    var engagedAt = function (m) {
      return solve(opts.requiredForMass(m)).slackEngaged === true;
    };
    if (engagedAt(lo)) return { mass: lo, atFloor: true };
    if (!engagedAt(hi)) return null;
    /* 24 halvings takes a 90 kg span below a gram; 40 is the cheap safety
       margin on a solve that costs microseconds. */
    for (var i = 0; i < 40 && hi - lo > 1e-4; i++) {
      var mid = (lo + hi) / 2;
      if (engagedAt(mid)) hi = mid; else lo = mid;
    }
    return { mass: hi, atFloor: false };
  }

  global.LoadPathContacts = {
    CHANNELS: CHANNELS, solve: solve, auditBalance: auditBalance, solveSet: solveSet,
    bracingThreshold: bracingThreshold
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
