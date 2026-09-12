/* Driver Load Path — the vibration channel. Milestone 5. Equation 7.

   THIS IS NOT PART OF THE FORCE SOLVER, AND THAT IS THE POINT.

   The plan's own list of failure modes says it plainly: load transfer is a
   time-domain quasi-static balance, and whole-body vibration is a
   frequency-domain weighted RMS over an exposure window. They are different
   mathematics with different units, and merging them produces something that
   satisfies neither. So this module shares the vehicle's speed and the road
   surface and NOTHING ELSE. It returns m/s^2 RMS and a comfort band. It never
   returns a newton, it never touches the contact split, and no number it
   produces is averaged into a force arrow.

   ---------------------------------------------------------------------
   The chain, and how much of each link is actually standardised

     road class  ->  ISO 8608 displacement PSD          [standard]
     speed       ->  spatial to temporal frequency      [exact]
     twice diff. ->  acceleration PSD at the wheel      [exact]
     quarter car ->  body mode and wheel hop            [PLACEHOLDER]
     seat        ->  occupant on the cushion            [PLACEHOLDER]
     ISO 2631-1  ->  Wk / Wd frequency weighting        [corroborated]
     integrate   ->  band-limited weighted RMS          [exact]
     ISO 2631-1  ->  comfort reaction band              [verified]

   Four of those six are exact or standard. One is a placeholder block, and it
   is the one that sets the answer's magnitude. That is stated here, recorded in
   the provenance registry, and printed in the drawer, because a comfort index
   carrying an ISO label is exactly the kind of number people quote.

   ---------------------------------------------------------------------
   ISO 8608 road roughness

   Displacement PSD as a function of spatial frequency n in cycles per metre:

       Gd(n) = Gd(n0) * (n/n0)^-w,   n0 = 0.1 cyc/m,  w = 2

   Gd(n0) is the roughness coefficient, and the classes step by a factor of 4:
   A = 1, B = 4, C = 16, D = 64, E = 256, all times 1e-6 m^3.

   At road speed v a wavelength passes at temporal frequency f = v*n, and a PSD
   transforms with the Jacobian, so Gd(f) = Gd(n)/v. Substituting:

       Gd(f) = Gd(n0) * n0^2 * v / f^2

   Acceleration is displacement differentiated twice, which in a PSD is a factor
   of omega^4:

       Ga(f) = (2*pi*f)^4 * Gd(f) = (2*pi)^4 * Gd(n0) * n0^2 * v * f^2

   Worth staring at: for w = 2 the wheel's ACCELERATION PSD rises as f^2 and
   never stops. Nothing in the road model bounds it. What bounds the answer is
   the suspension rolling off and the human weighting cutting out above 80 Hz —
   which is why the integration band is not a detail you can skip.

   ---------------------------------------------------------------------
   The ISO 2631-1 weightings, and the one thing this project already got wrong

   Wk applies to the VERTICAL z axis with multiplying factor k = 1.0.
   Wd applies to the HORIZONTAL x and y axes with k = 1.4.

   Building M0 found a secondary source that states this backwards, and the
   plan carries the correction. So the assignment is spelled out here, in the
   constants file, and in a unit test that asserts Wk and Wd cannot be swapped
   without the build going red.

   Each weighting is a cascade of four sections, evaluated as a complex transfer
   function at each frequency rather than as a digital filter — this module
   integrates a spectrum, it does not filter a time series, so there is no need
   to leave the s plane and no bilinear-transform warping to argue about.

       band-limiting   a 2nd-order high-pass at f1 and low-pass at f2
       a-v transition  f3, f4, Q4      the -6 dB/octave knee
       upward step     f5, Q5, f6, Q6  present in Wk only

   GAIN NORMALISATION. Each curve is scaled so its PEAK magnitude is exactly
   1.0. That is a real property of the published curves — both Wk and Wd top out
   at unity — and normalising to it removes any dependence on the standard's
   internal gain constants, which were not reachable from here. It is also
   self-checking: a test asserts the peak is 1.0 and that it falls in the right
   frequency band for each curve.
*/
(function (global) {
  'use strict';

  var C = global.LoadPathConstants;

  var TWO_PI = 2 * Math.PI;

  /* ---------------- complex arithmetic, just enough of it ---------------- */
  function cx(re, im) { return { re: re, im: im }; }
  function cmul(a, b) {
    return cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }
  function cdiv(a, b) {
    var d = b.re * b.re + b.im * b.im;
    return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
  }
  function cabs(a) { return Math.hypot(a.re, a.im); }

  /* ---------------- the four filter sections ----------------

     Written with s = j*omega, so s^2 = -omega^2 is real and negative. Each
     section is in the normalised form the standard uses, with unity gain in
     its own passband; the cascade is then normalised to peak 1.0. */

  /* Second-order high-pass, corner f0, quality Q. s^2 / (s^2 + (w0/Q)s + w0^2) */
  function highPass(f, f0, Q) {
    var w = TWO_PI * f, w0 = TWO_PI * f0;
    var num = cx(-w * w, 0);
    var den = cx(w0 * w0 - w * w, (w0 / Q) * w);
    return cdiv(num, den);
  }

  /* Second-order low-pass, corner f0, quality Q. w0^2 / (s^2 + (w0/Q)s + w0^2) */
  function lowPass(f, f0, Q) {
    var w = TWO_PI * f, w0 = TWO_PI * f0;
    var num = cx(w0 * w0, 0);
    var den = cx(w0 * w0 - w * w, (w0 / Q) * w);
    return cdiv(num, den);
  }

  /* Acceleration-velocity transition: (1 + s/w3) / (1 + s/(Q4 w4) + (s/w4)^2).
     Unity at DC, -6 dB/octave above the knee. */
  function avTransition(f, f3, f4, Q4) {
    var w = TWO_PI * f, w3 = TWO_PI * f3, w4 = TWO_PI * f4;
    var num = cx(1, w / w3);
    var den = cx(1 - (w * w) / (w4 * w4), w / (Q4 * w4));
    return cdiv(num, den);
  }

  /* Upward step: ((s/w5)^2 + s/(Q5 w5) + 1) / ((s/w6)^2 + s/(Q6 w6) + 1).
     Unity below f5, and (f6/f5)^2 above f6 — for Wk's 2.37 and 3.35 Hz that is
     a factor of very nearly 2, which is exactly the doubling that puts the
     4-12.5 Hz plateau twice as high as the sub-2 Hz region. */
  function upwardStep(f, f5, Q5, f6, Q6) {
    var w = TWO_PI * f, w5 = TWO_PI * f5, w6 = TWO_PI * f6;
    var num = cx(1 - (w * w) / (w5 * w5), w / (Q5 * w5));
    var den = cx(1 - (w * w) / (w6 * w6), w / (Q6 * w6));
    return cdiv(num, den);
  }

  /* ---------------- the two weightings ---------------- */
  var WK_PARAMS = { f1: 0.4, Q1: 0.7071, f2: 100, Q2: 0.7071,
                    f3: 12.5, f4: 12.5, Q4: 0.63,
                    f5: 2.37, Q5: 0.91, f6: 3.35, Q6: 0.91 };
  var WD_PARAMS = { f1: 0.4, Q1: 0.7071, f2: 100, Q2: 0.7071,
                    f3: 2.0, f4: 2.0, Q4: 0.63 };

  function rawWeight(f, p) {
    if (!(f > 0)) return 0;
    var h = cmul(highPass(f, p.f1, p.Q1), lowPass(f, p.f2, p.Q2));
    h = cmul(h, avTransition(f, p.f3, p.f4, p.Q4));
    if (p.f5) h = cmul(h, upwardStep(f, p.f5, p.Q5, p.f6, p.Q6));
    return cabs(h);
  }

  /* Peak of each raw cascade, found once and cached, so the published curves'
     unity peak is reproduced without needing the standard's gain constants. */
  function findPeak(p) {
    var best = 0;
    for (var i = 0; i <= 4000; i++) {
      var f = 0.05 * Math.pow(2000 / 0.05, i / 4000);   // 0.05 Hz to 100 Hz, log
      var m = rawWeight(f, p);
      if (m > best) best = m;
    }
    return best;
  }
  var WK_PEAK = findPeak(WK_PARAMS);
  var WD_PEAK = findPeak(WD_PARAMS);

  /* Wk: the VERTICAL weighting, z axis, multiplying factor 1.0. */
  function Wk(f) { return rawWeight(f, WK_PARAMS) / WK_PEAK; }
  /* Wd: the HORIZONTAL weighting, x and y axes, multiplying factor 1.4. */
  function Wd(f) { return rawWeight(f, WD_PARAMS) / WD_PEAK; }

  /* ---------------- road, suspension, seat ---------------- */

  /* Road DISPLACEMENT PSD at the tyre contact, m^2 per Hz, from ISO 8608:
         Gd(f) = Gd(n0) * n0^2 * v / f^2
     The quarter car is a displacement-in, displacement-out transfer function,
     so the double differentiation to acceleration happens AFTER it rather than
     here. Doing it in the other order gives the same answer for a linear
     system, but this way each stage's units are the ones its formula is
     written for. */
  function roadDisplacementPSD(f, roughness, speed) {
    if (!(speed > 0) || !(f > 0)) return 0;
    var n0 = C.ROAD.referenceSpatialFrequency;     // 0.1 cyc/m
    return roughness * n0 * n0 * speed / (f * f);
  }

  /* Acceleration PSD at the wheel, kept for the unweighted reference trace and
     for tests: displacement PSD times omega^4. */
  function wheelAccelPSD(f, roughness, speed) {
    return Math.pow(TWO_PI * f, 4) * roadDisplacementPSD(f, roughness, speed);
  }

  /* Base-excitation transmissibility of a damped single-degree-of-freedom
     system, as a POWER ratio:

         |T(r)|^2 = (1 + (2*zeta*r)^2) / ((1 - r^2)^2 + (2*zeta*r)^2)

     The numerator's damping term is what makes a real suspension roll off at
     -20 dB/decade rather than -40: the damper keeps transmitting after the
     spring has stopped. Dropping it is the classic way to get a ride model that
     is far too quiet at high frequency. */
  function transmissibilityPower(f, fn, zeta) {
    var r = f / fn;
    var num = 1 + Math.pow(2 * zeta * r, 2);
    var den = Math.pow(1 - r * r, 2) + Math.pow(2 * zeta * r, 2);
    return num / den;
  }

  /* Quarter car: road displacement to sprung-mass displacement, as a power
     ratio. Two degrees of freedom, so two modes come out of the algebra rather
     than being put in by hand — the body on its suspension near 1.3 Hz, and
     WHEEL HOP near 12 Hz where the unsprung mass bounces on the tyre.

     With s = j*omega:

         A  = ms*s^2 + cs*s + ks
         Cq = mu*s^2 + cs*s + ks + kt
         H  = kt*(cs*s + ks) / (A*Cq - (cs*s + ks)^2)

     Wheel hop is the reason this replaced a pair of hand-picked resonances. It
     sits inside Wk's full-strength plateau, so a model without an unsprung mass
     does not merely miss a bump in the curve — it under-reports the part of the
     spectrum the human weighting cares most about. */
  function quarterCarPower(f) {
    var R = C.RIDE;
    var w = TWO_PI * f;
    var ms = R.sprungMass, mu = R.unsprungMass;
    var ks = R.suspensionStiffness, cs = R.suspensionDamping, kt = R.tyreStiffness;

    var A = cx(ks - ms * w * w, cs * w);
    var Cq = cx(ks + kt - mu * w * w, cs * w);
    var K = cx(ks, cs * w);                       // cs*s + ks

    var num = cmul(cx(kt, 0), K);
    var den = cx(cmul(A, Cq).re - cmul(K, K).re,
                 cmul(A, Cq).im - cmul(K, K).im);
    var h = cabs(cdiv(num, den));
    return h * h;
  }

  /* Wheel to occupant, as a power ratio: the quarter car in series with the
     occupant on the seat cushion. */
  function seatPathPower(f, axis) {
    var R = C.RIDE;
    var seat = axis === 'z'
      ? transmissibilityPower(f, R.seatModeHz, R.seatModeZeta)
      : transmissibilityPower(f, R.seatModeHorizontalHz, R.seatModeZeta);
    return quarterCarPower(f) * seat;
  }

  /* ---------------- the spectrum, and the RMS over it ----------------

     Log-spaced frequency grid across the ISO band, trapezoid in linear f. Log
     spacing matters: the interesting structure is the two resonances at about
     1 and 4.5 Hz, and a linear grid fine enough to resolve them would waste
     most of its points above 40 Hz where nothing happens. */
  function spectrum(opts) {
    var speed = opts.speed || 0;
    var roughness = opts.roughness;
    var lo = C.ISO2631.bandLowHz, hi = C.ISO2631.bandHighHz;
    var n = opts.points || 260;
    var out = [];
    for (var i = 0; i < n; i++) {
      var f = lo * Math.pow(hi / lo, i / (n - 1));
      var road = roadDisplacementPSD(f, roughness, speed);
      var w4 = Math.pow(TWO_PI * f, 4);

      var rawZ = road * seatPathPower(f, 'z') * w4;
      var rawH = road * C.RIDE.horizontalRoadRatio * C.RIDE.horizontalRoadRatio *
                 seatPathPower(f, 'x') * w4;

      var wk = Wk(f), wd = Wd(f);
      out.push({
        f: f,
        rawZ: rawZ, rawX: rawH, rawY: rawH,
        wZ: rawZ * wk * wk,
        wX: rawH * wd * wd,
        wY: rawH * wd * wd,
        wk: wk, wd: wd
      });
    }
    return out;
  }

  function integrate(rows, key) {
    var sum = 0;
    for (var i = 1; i < rows.length; i++) {
      sum += 0.5 * (rows[i][key] + rows[i - 1][key]) * (rows[i].f - rows[i - 1].f);
    }
    return sum;
  }

  /* ---------------- the comfort scale ----------------

     ISO 2631-1's comfort reactions are APPROXIMATE INDICATIONS and the bands
     deliberately OVERLAP — 0.5 to 1.0 and 0.8 to 1.6 are both listed, so a
     value of 0.9 is legitimately in two of them at once. Collapsing that into
     one crisp label throws away the standard's own statement about how sure it
     is. So this returns the band a value falls in AND whether it also sits in
     the next one up, and the panel says so. */
  var BANDS = [
    { lo: 0,    hi: 0.315, label: 'not uncomfortable',       level: 'ok' },
    { lo: 0.315, hi: 0.63, label: 'a little uncomfortable',  level: 'ok' },
    { lo: 0.5,  hi: 1.0,   label: 'fairly uncomfortable',    level: 'warn' },
    { lo: 0.8,  hi: 1.6,   label: 'uncomfortable',           level: 'warn' },
    { lo: 1.25, hi: 2.5,   label: 'very uncomfortable',      level: 'bad' },
    { lo: 2.0,  hi: Infinity, label: 'extremely uncomfortable', level: 'bad' }
  ];

  function comfort(av) {
    var hits = BANDS.filter(function (b) { return av >= b.lo && av < b.hi; });
    if (!hits.length) hits = [BANDS[0]];
    return {
      label: hits[0].label,
      level: hits[0].level,
      also: hits.length > 1 ? hits[1].label : null,
      overlapping: hits.length > 1,
      bands: hits.map(function (b) { return b.label; })
    };
  }

  /* ---------------- the one entry point ----------------

     inputs: { speed (m/s), roadClass ('A'..'E') }
     returns RMS per axis, the ISO total value, the comfort band, the dominant
     frequency, and the spectrum rows for plotting. Units are m/s^2 throughout
     and there is not a newton anywhere in it. */
  function solve(inputs) {
    var cls = C.ROAD.CLASSES[inputs.roadClass] || C.ROAD.CLASSES.B;
    var rows = spectrum({ speed: inputs.speed, roughness: cls.roughness,
                          points: inputs.points });

    var awz = Math.sqrt(integrate(rows, 'wZ'));
    var awx = Math.sqrt(integrate(rows, 'wX'));
    var awy = Math.sqrt(integrate(rows, 'wY'));
    var unweightedZ = Math.sqrt(integrate(rows, 'rawZ'));

    /* EQ 7 — the ISO 2631-1 vibration total value. The multiplying factors are
       part of the equation, not of the weighting curves: k = 1.4 on the two
       horizontal axes and 1.0 on the vertical. */
    var kh = C.ISO2631.kHorizontal, kv = C.ISO2631.kVertical;
    var av = Math.sqrt(kh * kh * awx * awx + kh * kh * awy * awy + kv * kv * awz * awz);

    /* WHERE the weighted vertical energy is, by band. This replaced a single
       "dominant frequency" readout, which was actively misleading: the tallest
       point of the spectrum is the body mode near 1.3 Hz, while almost half the
       energy is in the seat mode around 4.5 Hz, because that lobe is far wider.
       The tallest bin and the band that matters are not the same question, and
       the second one is the one worth answering. */
    var totalZ = integrate(rows, 'wZ');
    function bandShare(lo, hi) {
      var sum = 0;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i].f >= lo && rows[i].f <= hi) {
          sum += 0.5 * (rows[i].wZ + rows[i - 1].wZ) * (rows[i].f - rows[i - 1].f);
        }
      }
      return totalZ > 0 ? sum / totalZ : 0;
    }
    var bands = [
      { key: 'body',  label: 'Body on suspension', lo: 0.4, hi: 2,  share: bandShare(0.4, 2) },
      { key: 'seat',  label: 'You on the seat',    lo: 3,   hi: 6,  share: bandShare(3, 6) },
      { key: 'hop',   label: 'Wheel hop',          lo: 8,   hi: 20, share: bandShare(8, 20) }
    ];
    var peak = rows[0], peakVal = -1;
    rows.forEach(function (r) { if (r.wZ > peakVal) { peakVal = r.wZ; peak = r; } });

    return {
      roadClass: inputs.roadClass, roadLabel: cls.label, roughness: cls.roughness,
      speed: inputs.speed,
      awx: awx, awy: awy, awz: awz,
      unweightedZ: unweightedZ,
      av: av,
      comfort: comfort(av),
      dominantHz: peak.f,
      bands: bands,
      dominantBand: bands.slice().sort(function (a, b) { return b.share - a.share; })[0],
      /* Share of the total value's ENERGY, not its amplitude. The first version
         divided an amplitude by an amplitude, which for orthogonal components
         does not decompose into parts that sum to one — it read 64% where the
         vertical axis was also carrying most of the answer. Squared terms do
         sum, so this is the share that means what a reader will assume. */
      horizontalShare: av > 0
        ? (2 * kh * kh * awx * awx) / (av * av) : 0,
      rows: rows
    };
  }

  global.LoadPathVibration = {
    Wk: Wk, Wd: Wd,
    WK_PARAMS: WK_PARAMS, WD_PARAMS: WD_PARAMS,
    roadDisplacementPSD: roadDisplacementPSD,
    wheelAccelPSD: wheelAccelPSD,
    quarterCarPower: quarterCarPower,
    transmissibilityPower: transmissibilityPower,
    seatPathPower: seatPathPower,
    spectrum: spectrum,
    integrate: integrate,
    comfort: comfort,
    BANDS: BANDS,
    solve: solve
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
