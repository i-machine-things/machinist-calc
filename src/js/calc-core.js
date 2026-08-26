/*
 * MachinistCalc core calculation engine.
 * Pure functions only — no DOM access — so this file can be loaded
 * both as a plain <script> in the renderer (attaches to window.MC.calc)
 * and required directly from Node for unit tests (tests/run.js).
 */
(function (root, factory) {
  var calc = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = calc;
  }
  if (root) {
    root.MC = root.MC || {};
    root.MC.calc = calc;
  }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : null), function () {
  'use strict';

  var calc = {};

  /** Round to N decimal places (default 4), guarding against float noise. */
  function round(value, decimals) {
    var factor = Math.pow(10, decimals == null ? 4 : decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
  calc.round = round;

  // ---------------------------------------------------------------------
  // Drill size reference data (decimal inches)
  // Standard: ASME B94.11M / Machinery's Handbook number & letter drill
  // size tables — the conventional US machine-shop numbering, not itself
  // an ISO/ANSI dimensional-tolerance standard.
  // ---------------------------------------------------------------------

  var NUMBER_DRILLS = [
    ['#80', 0.0135], ['#79', 0.0145], ['#78', 0.0160], ['#77', 0.0180], ['#76', 0.0200],
    ['#75', 0.0210], ['#74', 0.0225], ['#73', 0.0240], ['#72', 0.0250], ['#71', 0.0260],
    ['#70', 0.0280], ['#69', 0.0292], ['#68', 0.0310], ['#67', 0.0320], ['#66', 0.0330],
    ['#65', 0.0350], ['#64', 0.0360], ['#63', 0.0370], ['#62', 0.0380], ['#61', 0.0390],
    ['#60', 0.0400], ['#59', 0.0410], ['#58', 0.0420], ['#57', 0.0430], ['#56', 0.0465],
    ['#55', 0.0520], ['#54', 0.0550], ['#53', 0.0595], ['#52', 0.0635], ['#51', 0.0670],
    ['#50', 0.0700], ['#49', 0.0730], ['#48', 0.0760], ['#47', 0.0785], ['#46', 0.0810],
    ['#45', 0.0820], ['#44', 0.0860], ['#43', 0.0890], ['#42', 0.0935], ['#41', 0.0960],
    ['#40', 0.0980], ['#39', 0.0995], ['#38', 0.1015], ['#37', 0.1040], ['#36', 0.1065],
    ['#35', 0.1100], ['#34', 0.1110], ['#33', 0.1130], ['#32', 0.1160], ['#31', 0.1200],
    ['#30', 0.1285], ['#29', 0.1360], ['#28', 0.1405], ['#27', 0.1440], ['#26', 0.1470],
    ['#25', 0.1495], ['#24', 0.1520], ['#23', 0.1540], ['#22', 0.1570], ['#21', 0.1590],
    ['#20', 0.1610], ['#19', 0.1660], ['#18', 0.1695], ['#17', 0.1730], ['#16', 0.1770],
    ['#15', 0.1800], ['#14', 0.1820], ['#13', 0.1850], ['#12', 0.1890], ['#11', 0.1910],
    ['#10', 0.1935], ['#9', 0.1960], ['#8', 0.1990], ['#7', 0.2010], ['#6', 0.2040],
    ['#5', 0.2055], ['#4', 0.2090], ['#3', 0.2130], ['#2', 0.2210], ['#1', 0.2280]
  ];

  var LETTER_DRILLS = [
    ['A', 0.2340], ['B', 0.2380], ['C', 0.2420], ['D', 0.2460], ['E', 0.2500],
    ['F', 0.2570], ['G', 0.2610], ['H', 0.2660], ['I', 0.2720], ['J', 0.2770],
    ['K', 0.2810], ['L', 0.2900], ['M', 0.2950], ['N', 0.3020], ['O', 0.3160],
    ['P', 0.3230], ['Q', 0.3320], ['R', 0.3390], ['S', 0.3480], ['T', 0.3580],
    ['U', 0.3680], ['V', 0.3770], ['W', 0.3860], ['X', 0.3970], ['Y', 0.4040],
    ['Z', 0.4130]
  ];

  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

  /** Generate fractional-inch drill sizes in `1/denom` increments up to `maxInches`. */
  function fractionalDrills(maxInches, denom) {
    maxInches = maxInches || 2;
    denom = denom || 64;
    var out = [];
    for (var n = 1; n <= maxInches * denom; n++) {
      var d = denom;
      var g = gcd(n, d);
      var num = n / g, den = d / g;
      out.push([num + '/' + den + '"', n / denom]);
    }
    return out;
  }
  calc.fractionalDrills = fractionalDrills;

  function buildDrillTable() {
    var all = []
      .concat(NUMBER_DRILLS.map(function (e) { return { name: e[0], decimal: e[1] }; }))
      .concat(LETTER_DRILLS.map(function (e) { return { name: e[0], decimal: e[1] }; }))
      .concat(fractionalDrills(1, 64).map(function (e) { return { name: e[0], decimal: e[1] }; }));
    all.sort(function (a, b) { return a.decimal - b.decimal; });
    return all;
  }
  var DRILL_TABLE = buildDrillTable();
  /** Combined number (#80-#1), letter (A-Z), and fractional (1/64ths) drill table, sorted ascending by decimal inch size. */
  calc.drillTable = DRILL_TABLE;

  /** Find the standard (number/letter/fractional) drill closest to a target decimal-inch diameter. */
  function nearestDrill(decimalIn) {
    var best = null, bestDiff = Infinity;
    for (var i = 0; i < DRILL_TABLE.length; i++) {
      var diff = Math.abs(DRILL_TABLE[i].decimal - decimalIn);
      if (diff < bestDiff) { bestDiff = diff; best = DRILL_TABLE[i]; }
    }
    return best;
  }
  calc.nearestDrill = nearestDrill;

  // ---------------------------------------------------------------------
  // Tap drill sizing
  // ---------------------------------------------------------------------

  /**
   * Tap drill diameter for a UN-form (Unified inch) internal thread.
   * Standard: ASME B1.1 (Unified Inch Screw Threads, UN/UNR form).
   * Formula: drill = majorDia - (0.974 / TPI) * (percentThread / 75),
   * where 0.974/TPI is the ASME B1.1 constant for the ~75% thread
   * engagement conventionally used for general-purpose tapping; scaled
   * linearly for other target engagement percentages.
   */
  calc.tapDrillImperial = function (opts) {
    var majorDia = opts.majorDia, tpi = opts.tpi;
    var percentThread = opts.percentThread == null ? 75 : opts.percentThread;
    var decrement = (0.974 / tpi) * (percentThread / 75);
    var drill = majorDia - decrement;
    return {
      drillDecimal: round(drill, 4),
      nearestDrill: nearestDrill(drill),
      percentThread: percentThread
    };
  };

  /**
   * Tap drill diameter for an ISO metric M-profile internal thread.
   * Standard: ISO 68-1 (basic profile) / ISO 965-1 (tolerance system).
   * Formula: drill = majorDia - pitch * 1.08253 * (percentThread / 100),
   * where 1.08253 is the ISO 68-1 basic-profile depth coefficient for a
   * 60° metric thread at 100% engagement.
   */
  calc.tapDrillMetric = function (opts) {
    var majorDia = opts.majorDia, pitch = opts.pitch;
    var percentThread = opts.percentThread == null ? 75 : opts.percentThread;
    var decrement = pitch * 1.08253 * (percentThread / 100);
    var drillMm = majorDia - decrement;
    return {
      drillMm: round(drillMm, 3),
      drillIn: round(drillMm / 25.4, 4),
      nearestDrill: nearestDrill(drillMm / 25.4),
      percentThread: percentThread
    };
  };

  // ---------------------------------------------------------------------
  // Common thread reference tables
  // Standard: ASME B1.1 (UNC/UNF major diameters & TPI) and
  // ISO 261 / ISO 262 (metric coarse & fine pitch series).
  // ---------------------------------------------------------------------

  calc.unifiedThreadSizes = [
    { name: '#0-80', majorDia: 0.0600, tpi: 80 },
    { name: '#1-64', majorDia: 0.0730, tpi: 64 },
    { name: '#1-72', majorDia: 0.0730, tpi: 72 },
    { name: '#2-56', majorDia: 0.0860, tpi: 56 },
    { name: '#2-64', majorDia: 0.0860, tpi: 64 },
    { name: '#3-48', majorDia: 0.0990, tpi: 48 },
    { name: '#3-56', majorDia: 0.0990, tpi: 56 },
    { name: '#4-40', majorDia: 0.1120, tpi: 40 },
    { name: '#4-48', majorDia: 0.1120, tpi: 48 },
    { name: '#5-40', majorDia: 0.1250, tpi: 40 },
    { name: '#5-44', majorDia: 0.1250, tpi: 44 },
    { name: '#6-32', majorDia: 0.1380, tpi: 32 },
    { name: '#6-40', majorDia: 0.1380, tpi: 40 },
    { name: '#8-32', majorDia: 0.1640, tpi: 32 },
    { name: '#8-36', majorDia: 0.1640, tpi: 36 },
    { name: '#10-24', majorDia: 0.1900, tpi: 24 },
    { name: '#10-32', majorDia: 0.1900, tpi: 32 },
    { name: '#12-24', majorDia: 0.2160, tpi: 24 },
    { name: '#12-28', majorDia: 0.2160, tpi: 28 },
    { name: '1/4-20', majorDia: 0.2500, tpi: 20 },
    { name: '1/4-28', majorDia: 0.2500, tpi: 28 },
    { name: '5/16-18', majorDia: 0.3125, tpi: 18 },
    { name: '5/16-24', majorDia: 0.3125, tpi: 24 },
    { name: '3/8-16', majorDia: 0.3750, tpi: 16 },
    { name: '3/8-24', majorDia: 0.3750, tpi: 24 },
    { name: '7/16-14', majorDia: 0.4375, tpi: 14 },
    { name: '7/16-20', majorDia: 0.4375, tpi: 20 },
    { name: '1/2-13', majorDia: 0.5000, tpi: 13 },
    { name: '1/2-20', majorDia: 0.5000, tpi: 20 },
    { name: '9/16-12', majorDia: 0.5625, tpi: 12 },
    { name: '9/16-18', majorDia: 0.5625, tpi: 18 },
    { name: '5/8-11', majorDia: 0.6250, tpi: 11 },
    { name: '5/8-18', majorDia: 0.6250, tpi: 18 },
    { name: '3/4-10', majorDia: 0.7500, tpi: 10 },
    { name: '3/4-16', majorDia: 0.7500, tpi: 16 },
    { name: '7/8-9', majorDia: 0.8750, tpi: 9 },
    { name: '7/8-14', majorDia: 0.8750, tpi: 14 },
    { name: '1-8', majorDia: 1.0000, tpi: 8 },
    { name: '1-12', majorDia: 1.0000, tpi: 12 }
  ];

  calc.metricThreadSizes = [
    { name: 'M1.6x0.35', majorDia: 1.6, pitch: 0.35 },
    { name: 'M2x0.4', majorDia: 2, pitch: 0.4 },
    { name: 'M2.5x0.45', majorDia: 2.5, pitch: 0.45 },
    { name: 'M3x0.5', majorDia: 3, pitch: 0.5 },
    { name: 'M3.5x0.6', majorDia: 3.5, pitch: 0.6 },
    { name: 'M4x0.7', majorDia: 4, pitch: 0.7 },
    { name: 'M5x0.8', majorDia: 5, pitch: 0.8 },
    { name: 'M6x1.0', majorDia: 6, pitch: 1.0 },
    { name: 'M7x1.0', majorDia: 7, pitch: 1.0 },
    { name: 'M8x1.25', majorDia: 8, pitch: 1.25 },
    { name: 'M8x1.0', majorDia: 8, pitch: 1.0 },
    { name: 'M10x1.5', majorDia: 10, pitch: 1.5 },
    { name: 'M10x1.25', majorDia: 10, pitch: 1.25 },
    { name: 'M12x1.75', majorDia: 12, pitch: 1.75 },
    { name: 'M12x1.25', majorDia: 12, pitch: 1.25 },
    { name: 'M14x2.0', majorDia: 14, pitch: 2.0 },
    { name: 'M14x1.5', majorDia: 14, pitch: 1.5 },
    { name: 'M16x2.0', majorDia: 16, pitch: 2.0 },
    { name: 'M18x2.5', majorDia: 18, pitch: 2.5 },
    { name: 'M20x2.5', majorDia: 20, pitch: 2.5 },
    { name: 'M22x2.5', majorDia: 22, pitch: 2.5 },
    { name: 'M24x3.0', majorDia: 24, pitch: 3.0 },
    { name: 'M27x3.0', majorDia: 27, pitch: 3.0 },
    { name: 'M30x3.5', majorDia: 30, pitch: 3.5 }
  ];

  // ---------------------------------------------------------------------
  // Thread geometry (basic/theoretical profile)
  // ---------------------------------------------------------------------

  /**
   * Basic (theoretical, zero-tolerance) diameters for a Unified inch
   * screw thread, external and internal.
   * Standard: ASME B1.1 (Unified Inch Screw Threads).
   * Constants (multiples of pitch P = 1/TPI):
   *   H (basic triangle height) = 0.866025404 * P
   *   pitch diameter            = D - 0.649519 * P   (= D - 2*(3/8)H)
   *   external minor diameter   = D - 1.082532 * P   (= D - 2*(5/8)H)
   *   internal major diameter (basic, minimum) = D — by definition, the
   *     basic profile of internal and external threads shares the same
   *     nominal major diameter; actual 2A/2B tolerance classes apply an
   *     allowance on top of this, which this basic-profile calculator
   *     does not model.
   * Tensile stress area per ASME B1.1 Appendix: As = (pi/4)*(D - 0.9743*P)^2.
   * These are basic-profile values, not a specific 2A/2B tolerance class.
   */
  calc.unifiedThreadGeometry = function (opts) {
    var D = opts.majorDia, tpi = opts.tpi;
    var P = 1 / tpi;
    var H = 0.866025404 * P;
    var pitchDia = D - 0.649519 * P;
    var extMinorDia = D - 1.082532 * P;
    var intMajorDiaMin = D;
    var tensileStressArea = Math.PI / 4 * Math.pow(D - 0.9743 * P, 2);
    return {
      pitch: round(P, 5),
      threadHeight: round(H, 5),
      external: {
        majorDia: round(D, 4),
        pitchDia: round(pitchDia, 4),
        minorDia: round(extMinorDia, 4)
      },
      internal: {
        majorDiaMin: round(intMajorDiaMin, 4),
        pitchDia: round(pitchDia, 4),
        minorDia: round(extMinorDia, 4)
      },
      tensileStressArea: round(tensileStressArea, 5)
    };
  };

  /**
   * Basic (theoretical, zero-tolerance) diameters for an ISO metric
   * M-profile screw thread, external and internal.
   * Standard: ISO 68-1 (basic profile), constants also used by ISO 965-1
   * for the tolerance system built on top of this basic profile.
   * Constants (multiples of pitch P):
   *   H (basic triangle height)     = 0.866025 * P
   *   pitch diameter                = D - 0.649519 * P
   *   external minor diameter (d3)  = D - 1.226869 * P
   *   internal minor diameter (D1)  = D - 1.082532 * P
   * Tensile stress area per ISO 898-1: As = (pi/4)*(D - 0.9382*P)^2.
   */
  calc.metricThreadGeometry = function (opts) {
    var D = opts.majorDia, P = opts.pitch;
    var H = 0.866025 * P;
    var pitchDia = D - 0.649519 * P;
    var extMinorDia = D - 1.226869 * P;
    var intMinorDia = D - 1.082532 * P;
    var tensileStressArea = Math.PI / 4 * Math.pow(D - 0.9382 * P, 2);
    return {
      pitch: round(P, 4),
      threadHeight: round(H, 4),
      external: {
        majorDia: round(D, 3),
        pitchDia: round(pitchDia, 3),
        minorDia: round(extMinorDia, 3)
      },
      internal: {
        majorDia: round(D, 3),
        pitchDia: round(pitchDia, 3),
        minorDia: round(intMinorDia, 3)
      },
      tensileStressArea: round(tensileStressArea, 3)
    };
  };

  // ---------------------------------------------------------------------
  // Speeds & feeds
  // No single ISO/ANSI standard defines these — they're the conventional
  // machining relations found in shop reference handbooks (e.g. Machinery's
  // Handbook), built from the surface-speed/circumference relationship
  // (SFM = pi * D[in] * RPM / 12, rearranged and with unit constants folded in).
  // ---------------------------------------------------------------------

  /** RPM from surface speed (SFM) and cutter/stock diameter (inches). RPM = (SFM * 3.82) / D. */
  calc.rpmFromSfm = function (sfm, diameterIn) {
    return round((sfm * 3.82) / diameterIn, 0);
  };
  /** Surface speed (SFM) from RPM and diameter (inches). Inverse of rpmFromSfm. */
  calc.sfmFromRpm = function (rpm, diameterIn) {
    return round((rpm * diameterIn) / 3.82, 1);
  };
  /** RPM from surface speed (m/min) and cutter/stock diameter (mm). RPM = (SMM * 318.3) / D. */
  calc.rpmFromSmm = function (smm, diameterMm) {
    return round((smm * 318.3) / diameterMm, 0);
  };
  /** Surface speed (m/min) from RPM and diameter (mm). Inverse of rpmFromSmm. */
  calc.smmFromRpm = function (rpm, diameterMm) {
    return round((rpm * diameterMm) / 318.3, 1);
  };
  /** Table/plunge feed rate = RPM * chip load per tooth * number of flutes. */
  calc.feedRate = function (rpm, chipLoad, numFlutes) {
    return round(rpm * chipLoad * numFlutes, 4);
  };
  /** Feed per revolution = chip load per tooth * number of flutes (feed-per-flute conversion). */
  calc.feedPerRev = function (chipLoad, numFlutes) {
    return round(chipLoad * numFlutes, 5);
  };
  /** Material removal rate = feed rate * depth of cut * width of cut (consistent linear units). */
  calc.mrr = function (feedRate, depthOfCut, widthOfCut) {
    return round(feedRate * depthOfCut * widthOfCut, 4);
  };

  /**
   * Recommended turning cutting speed ranges (SFM) by workpiece material
   * and tool material. Not a formal ISO/ANSI standard — general
   * shop-reference starting points in the style of Machinery's Handbook
   * speed/feed tables. Treat as a starting point, not a target: actual
   * optimal speed depends on the specific alloy/temper, machine rigidity,
   * coolant, and tool coating — always confirm against the tooling
   * manufacturer's data.
   */
  calc.recommendedSfm = [
    { material: 'Aluminum & aluminum alloys', hss: [300, 600], carbide: [600, 1200] },
    { material: 'Brass & bronze', hss: [150, 300], carbide: [300, 600] },
    { material: 'Free-machining low-carbon steel (11xx/12xx)', hss: [90, 120], carbide: [300, 500] },
    { material: 'Low-carbon steel (10xx, <0.3% C)', hss: [80, 110], carbide: [275, 425] },
    { material: 'Medium-carbon steel (10xx, 0.3-0.5% C)', hss: [70, 100], carbide: [250, 400] },
    { material: 'Alloy steel, annealed (41xx, 86xx)', hss: [50, 70], carbide: [200, 300] },
    { material: 'Tool steel, annealed', hss: [40, 60], carbide: [150, 250] },
    { material: 'Stainless steel, austenitic (300 series)', hss: [40, 70], carbide: [150, 300] },
    { material: 'Gray cast iron', hss: [50, 80], carbide: [200, 400] },
    { material: 'Titanium alloys', hss: [20, 30], carbide: [100, 150] }
  ];

  // ---------------------------------------------------------------------
  // Bolt circle
  // Plain analytic geometry (points on a circle) — no ISO/ANSI standard
  // governs this; it's a coordinate-geometry convenience calculation.
  // ---------------------------------------------------------------------

  /**
   * Coordinates of N holes evenly spaced on a bolt circle of diameter `bcd`,
   * centered at the origin, starting at `startAngleDeg` (measured in the
   * standard math convention: 0° = +X axis, CCW positive; default 90° = top).
   */
  calc.boltCirclePoints = function (opts) {
    var bcd = opts.bcd, count = opts.count;
    var startAngleDeg = opts.startAngleDeg == null ? 90 : opts.startAngleDeg;
    var clockwise = opts.clockwise !== false;
    var radius = bcd / 2;
    var step = 360 / count;
    var points = [];
    for (var i = 0; i < count; i++) {
      var angleDeg = clockwise ? (startAngleDeg - i * step) : (startAngleDeg + i * step);
      var rad = (angleDeg * Math.PI) / 180;
      points.push({
        index: i + 1,
        angleFromStartDeg: round(i * step, 3),
        x: round(radius * Math.cos(rad), 4),
        y: round(radius * Math.sin(rad), 4)
      });
    }
    return points;
  };

  // ---------------------------------------------------------------------
  // Right triangle solver
  // Plain trigonometry (Pythagorean theorem, SOH-CAH-TOA) — no ISO/ANSI
  // standard governs this; it's general-purpose geometry used for angle
  // layout, tapers, and angle-plate/sine-bar setup work.
  // ---------------------------------------------------------------------

  /**
   * Solve a right triangle (right angle at C) given exactly 2 of: leg a,
   * leg b, hypotenuse c, angle A in degrees (opposite side a; B = 90 - A).
   * Any count other than exactly 2 knowns is rejected — including angle A
   * alone, which doesn't fix the triangle's size — rather than silently
   * guessing, per the project's enum/precondition-validation convention
   * (see calc.bonusTolerance). The six branches below are the complete set
   * of 2-of-4 combinations, so there's no further fallback case. Inputs
   * must be finite; a result that's still non-finite (numeric overflow)
   * throws rather than returning Infinity/NaN.
   */
  calc.rightTriangleSolve = function (known) {
    var a = known.a, b = known.b, c = known.c, A = known.angleADeg;
    var haveA = a != null, haveB = b != null, haveC = c != null, haveAngle = A != null;
    var count = [haveA, haveB, haveC, haveAngle].filter(Boolean).length;
    if (count !== 2) {
      throw new RangeError('Provide exactly 2 of: side a, side b, hypotenuse c, angle A');
    }
    if (haveAngle && (!Number.isFinite(A) || A <= 0 || A >= 90)) {
      throw new RangeError('Angle A must be a finite number between 0 and 90 degrees, exclusive');
    }
    if (haveA && (!Number.isFinite(a) || a <= 0)) throw new RangeError('Side a must be finite and positive');
    if (haveB && (!Number.isFinite(b) || b <= 0)) throw new RangeError('Side b must be finite and positive');
    if (haveC && (!Number.isFinite(c) || c <= 0)) throw new RangeError('Hypotenuse c must be finite and positive');

    if (haveA && haveB) {
      // Math.hypot (not sqrt(a*a + b*b)) avoids intermediate overflow for very large legs —
      // e.g. a=b=1e308 would otherwise square to Infinity before sqrt ever runs.
      c = Math.hypot(a, b);
      A = calc.radToDeg(Math.atan2(a, b));
    } else if (haveA && haveC) {
      if (a >= c) throw new RangeError('Side a must be less than hypotenuse c');
      // c*sqrt(1-(a/c)^2), algebraically sqrt(c^2-a^2), squares a bounded ratio instead of the
      // raw values, avoiding the same overflow (or NaN from catastrophic cancellation) risk.
      b = c * Math.sqrt(1 - (a / c) * (a / c));
      A = calc.radToDeg(Math.asin(a / c));
    } else if (haveB && haveC) {
      if (b >= c) throw new RangeError('Side b must be less than hypotenuse c');
      a = c * Math.sqrt(1 - (b / c) * (b / c));
      A = calc.radToDeg(Math.acos(b / c));
    } else if (haveA && haveAngle) {
      b = a / Math.tan(calc.degToRad(A));
      c = a / Math.sin(calc.degToRad(A));
    } else if (haveB && haveAngle) {
      a = b * Math.tan(calc.degToRad(A));
      c = b / Math.cos(calc.degToRad(A));
    } else if (haveC && haveAngle) {
      a = c * Math.sin(calc.degToRad(A));
      b = c * Math.cos(calc.degToRad(A));
    }

    var result = {
      a: round(a, 5),
      b: round(b, 5),
      c: round(c, 5),
      angleADeg: round(A, 4),
      angleBDeg: round(90 - A, 4)
    };
    // Checked post-rounding, not on the raw a/b/c/A: round()'s own *10^decimals step can
    // overflow back to Infinity for a value large enough to survive Math.hypot/the scaled-ratio
    // formula above but not this multiplication — e.g. a=b=1e308 solves to a finite c via
    // Math.hypot, but round(c, 5) internally computes c*1e5, which overflows.
    if (!Object.values(result).every(Number.isFinite)) {
      throw new RangeError('Values are outside the supported numeric range');
    }
    return result;
  };

  // ---------------------------------------------------------------------
  // True position
  // Standard: ASME Y14.5 (Dimensioning and Tolerancing) — position
  // tolerance and material-condition (MMC/LMC) bonus tolerance.
  // ---------------------------------------------------------------------

  /**
   * Diametral true position value from measured vs. basic (true) X/Y
   * coordinates. Standard: ASME Y14.5, position tolerance zone.
   * TP = 2 * sqrt(devX^2 + devY^2), i.e. twice the radial deviation,
   * because position tolerance is specified as a diameter, not a radius.
   */
  calc.truePosition = function (opts) {
    var devX = opts.actualX - opts.basicX;
    var devY = opts.actualY - opts.basicY;
    var tp = 2 * Math.sqrt(devX * devX + devY * devY);
    return { devX: round(devX, 5), devY: round(devY, 5), truePosition: round(tp, 5) };
  };

  /**
   * Bonus tolerance available under an MMC material-condition modifier.
   * Standard: ASME Y14.5, rule for bonus tolerance at MMC.
   * Directional: for an internal feature (hole), MMC is the *smallest*
   * allowed size, and bonus accrues as the actual size grows above it.
   * For an external feature (shaft/pin/boss), MMC is the *largest*
   * allowed size, and bonus accrues as the actual size shrinks below it.
   * Departure in the opposite direction (toward, not away from, MMC) is
   * not a valid bonus — that's a size-tolerance violation, not something
   * this calculator adjudicates — so it's clamped to 0 rather than
   * returned as a (wrong-signed) positive bonus via Math.abs.
   * Caller adds the result to the stated position tolerance to get the
   * total allowable true position at the actual feature size.
   * `featureType` must be exactly 'internal' or 'external' — anything
   * else (typo, undefined) throws rather than silently defaulting, since
   * defaulting the wrong direction is precisely the kind of confidently-
   * wrong-number bug this function exists to avoid.
   */
  calc.bonusTolerance = function (actualFeatureSize, mmcSize, featureType) {
    if (featureType !== 'internal' && featureType !== 'external') {
      throw new RangeError('featureType must be "internal" or "external"');
    }
    var isInternal = featureType === 'internal';
    var delta = isInternal ? (actualFeatureSize - mmcSize) : (mmcSize - actualFeatureSize);
    return round(Math.max(delta, 0), 5);
  };

  // ---------------------------------------------------------------------
  // Surface finish
  // No ISO/ANSI standard defines this predictive formula — it's the
  // classic theoretical-roughness approximation from shop reference
  // handbooks (e.g. Machinery's Handbook), relating feed rate and tool
  // nose radius for a single-point turning operation. Actual Ra also
  // depends on tool wear, material, and vibration, which this ignores.
  // ---------------------------------------------------------------------

  /** Theoretical turning surface roughness Ra (microinches) from feed (in/rev) and tool nose radius (in). Ra = f^2 / (32*R). */
  calc.surfaceFinishRaImperial = function (feedIpr, noseRadiusIn) {
    return round((feedIpr * feedIpr) / (32 * noseRadiusIn) * 1e6, 1); // microinches
  };
  /** Theoretical turning surface roughness Ra (micrometers) from feed (mm/rev) and tool nose radius (mm). Ra = f^2 / (32*R). */
  calc.surfaceFinishRaMetric = function (feedMmpr, noseRadiusMm) {
    return round((feedMmpr * feedMmpr) / (32 * noseRadiusMm) * 1000, 3); // micrometers
  };

  // ---------------------------------------------------------------------
  // ISO tolerance (IT grade)
  // Standard: ISO 286-1 (ISO code system for tolerances on linear sizes) —
  // fundamental tolerance unit `i` and the IT grade step multipliers.
  // ---------------------------------------------------------------------

  var IT_MULTIPLIERS = {
    IT5: 7, IT6: 10, IT7: 16, IT8: 25, IT9: 40, IT10: 64,
    IT11: 100, IT12: 160, IT13: 250, IT14: 400, IT15: 640, IT16: 1000
  };
  calc.itGrades = Object.keys(IT_MULTIPLIERS);

  /**
   * Standard tolerance for a given nominal size and IT grade.
   * Standard: ISO 286-1. Fundamental tolerance unit i (µm) =
   * 0.45*cbrt(D) + 0.001*D, where D is nominal size in mm; IT grade
   * tolerance = i * grade multiplier (IT5=7i ... IT16=1000i, valid for
   * grades IT5-IT18 per the standard).
   * NOTE: ISO 286-1 formally computes `i` from the geometric mean of the
   * official size range (e.g. sqrt(10*18) for the "over 10 up to 18mm"
   * range), not the exact nominal size. This calculator uses the nominal
   * size directly as a general-purpose approximation — close to the
   * official table value near the middle of a size range, but not a
   * substitute for the published ISO 286-1 range tables where an exact
   * figure is required.
   */
  calc.isoFundamentalTolerance = function (nominalMm, grade) {
    var D = nominalMm;
    var i = 0.45 * Math.cbrt(D) + 0.001 * D; // microns
    var mult = IT_MULTIPLIERS[grade];
    var toleranceUm = i * mult;
    return {
      i: round(i, 4),
      toleranceUm: round(toleranceUm, 2),
      toleranceMm: round(toleranceUm / 1000, 5)
    };
  };

  /**
   * General bilateral/unilateral limit calculation from a nominal size
   * plus upper/lower tolerances. Plain arithmetic per the definitions in
   * ASME Y14.5 / ISO 286-1 (max/min limits, total tolerance) — not tied
   * to a specific standard's numeric tables.
   */
  calc.limits = function (opts) {
    var nominal = opts.nominal, upperTol = opts.upperTol, lowerTol = Math.abs(opts.lowerTol);
    return {
      maxLimit: round(nominal + upperTol, 5),
      minLimit: round(nominal - lowerTol, 5),
      totalTolerance: round(upperTol + lowerTol, 5),
      midpoint: round(nominal + (upperTol - lowerTol) / 2, 5)
    };
  };

  // ---------------------------------------------------------------------
  // Scientific calculator expression evaluator
  // General-purpose arithmetic/trigonometry — no ISO/ANSI standard governs
  // this. Deliberately a hand-written recursive-descent parser rather than
  // eval()/Function() on the input string: the app's Content-Security-Policy
  // (script-src 'self', no unsafe-eval) blocks both anyway, and evaluating
  // an arbitrary string as code is a textbook injection risk regardless of
  // CSP — see the source-scan regression test in tests/run.js.
  // ---------------------------------------------------------------------

  var SCI_FUNCTIONS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'log', 'ln', 'abs'];
  var SCI_CONSTANTS = { pi: Math.PI, e: Math.E };

  /** Split an expression string into number/identifier/operator tokens. Throws SyntaxError on anything unrecognized. */
  function sciTokenize(expr) {
    var tokens = [];
    var i = 0;
    while (i < expr.length) {
      var ch = expr[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      if (/[0-9.]/.test(ch)) {
        var start = i;
        while (i < expr.length && /[0-9.]/.test(expr[i])) i++;
        // Optional exponent suffix (1e5, 1.5e-10) so a very large/small result's default
        // string form (e.g. from Number#toString(), used when recalling memory or chaining
        // off "=") round-trips back through this tokenizer instead of erroring as malformed.
        if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
          var expDigitsStart = i + 1;
          if (expDigitsStart < expr.length && (expr[expDigitsStart] === '+' || expr[expDigitsStart] === '-')) {
            expDigitsStart++;
          }
          var expDigitsEnd = expDigitsStart;
          while (expDigitsEnd < expr.length && /[0-9]/.test(expr[expDigitsEnd])) expDigitsEnd++;
          if (expDigitsEnd > expDigitsStart) i = expDigitsEnd;
        }
        var numStr = expr.slice(start, i);
        var dotCount = (numStr.match(/\./g) || []).length;
        var value = parseFloat(numStr);
        if (dotCount > 1 || isNaN(value)) {
          throw new SyntaxError('Malformed number: "' + numStr + '"');
        }
        tokens.push({ type: 'number', value: value });
        continue;
      }
      if (/[a-zA-Z]/.test(ch)) {
        var startId = i;
        while (i < expr.length && /[a-zA-Z]/.test(expr[i])) i++;
        tokens.push({ type: 'ident', value: expr.slice(startId, i) });
        continue;
      }
      if ('+-*/^()'.indexOf(ch) !== -1) {
        tokens.push({ type: ch });
        i++;
        continue;
      }
      throw new SyntaxError('Unexpected character: "' + ch + '"');
    }
    return tokens;
  }

  /** Evaluate a single-argument function by name, honoring the deg/rad angle mode for trig. */
  function sciApplyFunction(name, arg, angleMode) {
    var toRad = function (deg) { return angleMode === 'deg' ? calc.degToRad(deg) : deg; };
    var fromRad = function (rad) { return angleMode === 'deg' ? calc.radToDeg(rad) : rad; };
    switch (name) {
      case 'sin': return Math.sin(toRad(arg));
      case 'cos': return Math.cos(toRad(arg));
      case 'tan': return Math.tan(toRad(arg));
      case 'asin':
        if (arg < -1 || arg > 1) throw new RangeError('asin domain is [-1, 1]');
        return fromRad(Math.asin(arg));
      case 'acos':
        if (arg < -1 || arg > 1) throw new RangeError('acos domain is [-1, 1]');
        return fromRad(Math.acos(arg));
      case 'atan': return fromRad(Math.atan(arg));
      case 'sqrt':
        if (arg < 0) throw new RangeError('sqrt domain is >= 0');
        return Math.sqrt(arg);
      case 'log':
        if (arg <= 0) throw new RangeError('log domain is > 0');
        return Math.log10(arg);
      case 'ln':
        if (arg <= 0) throw new RangeError('ln domain is > 0');
        return Math.log(arg);
      case 'abs': return Math.abs(arg);
      default: throw new SyntaxError('Unknown function: ' + name);
    }
  }

  /**
   * Recursive-descent parser/evaluator over a token stream. Grammar
   * (standard precedence, `^` right-associative, unary +/- binds looser
   * than `^` so `-2^2` is -4 not 4):
   *   expr   := term (('+'|'-') term)*
   *   term   := unary (('*'|'/') unary)*
   *   unary  := ('-'|'+') unary | power
   *   power  := atom ('^' unary)?
   *   atom   := number | ident | ident '(' expr ')' | '(' expr ')'
   */
  function sciParse(tokens, angleMode) {
    var pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function expect(type) {
      var t = next();
      if (!t || t.type !== type) {
        throw new SyntaxError('Expected "' + type + '"' +
          (t ? ' but got "' + (t.value != null ? t.value : t.type) + '"' : ' but reached end of expression'));
      }
      return t;
    }

    function parseExpr() {
      var value = parseTerm();
      while (peek() && (peek().type === '+' || peek().type === '-')) {
        var op = next().type;
        var rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      }
      return value;
    }
    function parseTerm() {
      var value = parseUnary();
      while (peek() && (peek().type === '*' || peek().type === '/')) {
        var op = next().type;
        var rhs = parseUnary();
        if (op === '/' && rhs === 0) throw new RangeError('Division by zero');
        value = op === '*' ? value * rhs : value / rhs;
      }
      return value;
    }
    function parseUnary() {
      if (peek() && peek().type === '-') { next(); return -parseUnary(); }
      if (peek() && peek().type === '+') { next(); return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      var base = parseAtom();
      if (peek() && peek().type === '^') {
        next();
        return Math.pow(base, parseUnary());
      }
      return base;
    }
    function parseAtom() {
      var t = peek();
      if (!t) throw new SyntaxError('Unexpected end of expression');
      if (t.type === 'number') { next(); return t.value; }
      if (t.type === '(') {
        next();
        var value = parseExpr();
        expect(')');
        return value;
      }
      if (t.type === 'ident') {
        next();
        var name = t.value.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(SCI_CONSTANTS, name)) {
          return SCI_CONSTANTS[name];
        }
        if (SCI_FUNCTIONS.indexOf(name) !== -1) {
          expect('(');
          var arg = parseExpr();
          expect(')');
          return sciApplyFunction(name, arg, angleMode);
        }
        throw new SyntaxError('Unknown identifier: "' + t.value + '"');
      }
      throw new SyntaxError('Unexpected token: "' + (t.value != null ? t.value : t.type) + '"');
    }

    var result = parseExpr();
    if (pos !== tokens.length) {
      var trailing = peek();
      throw new SyntaxError('Unexpected token: "' + (trailing.value != null ? trailing.value : trailing.type) + '"');
    }
    return result;
  }

  /**
   * Evaluate a scientific-calculator expression string: + - * / ^
   * (right-associative power), unary +/-, parentheses, number literals
   * with an optional exponent suffix (1e-8, 2.5E+10),
   * sin/cos/tan/asin/acos/atan/sqrt/log(base 10)/ln/abs, and the constants
   * pi/e. `angleMode` is 'deg' (default) or 'rad', controlling whether trig
   * functions take/return degrees or radians. Throws SyntaxError for
   * malformed input and RangeError for a domain violation (divide by zero,
   * asin/acos outside [-1,1], sqrt/log of a non-positive number, or a
   * result that overflows to a non-finite number).
   */
  calc.evaluateExpression = function (expr, angleMode) {
    angleMode = angleMode === 'rad' ? 'rad' : 'deg';
    if (typeof expr !== 'string' || expr.trim() === '') {
      throw new SyntaxError('Empty expression');
    }
    var tokens = sciTokenize(expr);
    if (tokens.length === 0) throw new SyntaxError('Empty expression');
    var result = sciParse(tokens, angleMode);
    if (!isFinite(result)) {
      throw new RangeError('Result is not a finite number');
    }
    return result;
  };

  // ---------------------------------------------------------------------
  // Unit conversion
  // Conversion factors are exact SI/imperial definitions (1 in = 25.4mm
  // exactly, per the 1959 international yard-and-pound agreement) —
  // not an ISO/ANSI dimensioning standard, just unit definitions.
  // ---------------------------------------------------------------------

  /** Length unit factors expressed as "units per inch" (1 inch = 25.4mm exactly, per the international yard-and-pound agreement). */
  calc.LENGTH_UNITS_PER_INCH = {
    in: 1, mm: 25.4, cm: 2.54, m: 0.0254, ft: 1 / 12, um: 25400, mil: 1000
  };
  /** Convert a length value between any two units in LENGTH_UNITS_PER_INCH. */
  calc.convertLength = function (value, fromUnit, toUnit) {
    var perInchFrom = calc.LENGTH_UNITS_PER_INCH[fromUnit];
    var perInchTo = calc.LENGTH_UNITS_PER_INCH[toUnit];
    var inches = value / perInchFrom;
    return inches * perInchTo;
  };

  /** Convert surface speed from feet/min (SFM) to meters/min (SMM). 1 ft = 0.3048 m exactly. */
  calc.sfmToSmm = function (sfm) { return round(sfm * 0.3048, 3); };
  /** Convert surface speed from meters/min (SMM) to feet/min (SFM). Inverse of sfmToSmm. */
  calc.smmToSfm = function (smm) { return round(smm / 0.3048, 3); };

  calc.degToRad = function (deg) { return (deg * Math.PI) / 180; };
  calc.radToDeg = function (rad) { return (rad * 180) / Math.PI; };

  return calc;
});
