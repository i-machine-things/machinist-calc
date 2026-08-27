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
  // Thread tolerance classes
  // Unified (inch): ASME B1.1-1989, Table 3 (Machinery's Handbook 26th ed.,
  // pp.1716-1724) — lookup only, covering the standard/selected combinations
  // already tabulated in calc.unifiedThreadSizes. Machinery's Handbook does
  // not reproduce the general B1.1 tolerance formulas for non-tabulated inch
  // sizes/pitches; it explicitly defers those to the ASME B1.1 standard
  // document itself, so unifiedThreadTolerance only covers the 39 tabulated
  // sizes (disclosed in the UI), unlike metricThreadTolerance below.
  // Metric (M profile): ANSI/ASME B1.13M-1983 (R1995) / ISO 965-1, Tables
  // 7-11 (Machinery's Handbook 26th ed., pp.1764-1768) — general allowance/
  // tolerance-grade formulas, reproduced here in full, so metricThreadTolerance
  // works for ANY diameter/pitch combination, not just standard sizes.
  // Both datasets were cross-validated: the Unified data was checked against
  // basic-profile geometry (basicPD = majorDia - 0.649519*P) for internal
  // consistency; the metric formulas+tables were validated by independently
  // recomputing the book's own precomputed standard-size Tables 12/13 (6H
  // internal, 6g/4g6g external) values for all sizes M1.6-M30 and confirming
  // an exact match (0 discrepancies across 100 checked rows/fields).
  // ---------------------------------------------------------------------

  var UNIFIED_TOLERANCES = {
    '#0-80': {
      external: {
        '2A': { allowance: 0.0005, majorMax: 0.0595, majorMin: 0.0563, pdMax: 0.0514, pdMin: 0.0496, minorMax: 0.0446 },
        '3A': { allowance: 0.0, majorMax: 0.06, majorMin: 0.0568, pdMax: 0.0519, pdMin: 0.0506, minorMax: 0.0451 }
      },
      internal: {
        '2B': { minorMin: 0.0465, minorMax: 0.0514, pdMin: 0.0519, pdMax: 0.0542, majorMin: 0.06 },
        '3B': { minorMin: 0.0465, minorMax: 0.0514, pdMin: 0.0519, pdMax: 0.0536, majorMin: 0.06 }
      }
    },
    '#1-64': {
      external: {
        '2A': { allowance: 0.0006, majorMax: 0.0724, majorMin: 0.0686, pdMax: 0.0623, pdMin: 0.0603, minorMax: 0.0538 },
        '3A': { allowance: 0.0, majorMax: 0.073, majorMin: 0.0692, pdMax: 0.0629, pdMin: 0.0614, minorMax: 0.0544 }
      },
      internal: {
        '2B': { minorMin: 0.0561, minorMax: 0.0623, pdMin: 0.0629, pdMax: 0.0655, majorMin: 0.073 },
        '3B': { minorMin: 0.0561, minorMax: 0.0623, pdMin: 0.0629, pdMax: 0.0648, majorMin: 0.073 }
      }
    },
    '#1-72': {
      external: {
        '2A': { allowance: 0.0006, majorMax: 0.0724, majorMin: 0.0689, pdMax: 0.0634, pdMin: 0.0615, minorMax: 0.0559 },
        '3A': { allowance: 0.0, majorMax: 0.073, majorMin: 0.0695, pdMax: 0.064, pdMin: 0.0626, minorMax: 0.0565 }
      },
      internal: {
        '2B': { minorMin: 0.058, minorMax: 0.0635, pdMin: 0.064, pdMax: 0.0665, majorMin: 0.073 },
        '3B': { minorMin: 0.058, minorMax: 0.0635, pdMin: 0.064, pdMax: 0.0659, majorMin: 0.073 }
      }
    },
    '#2-56': {
      external: {
        '2A': { allowance: 0.0006, majorMax: 0.0854, majorMin: 0.0813, pdMax: 0.0738, pdMin: 0.0717, minorMax: 0.0642 },
        '3A': { allowance: 0.0, majorMax: 0.086, majorMin: 0.0819, pdMax: 0.0744, pdMin: 0.0728, minorMax: 0.0648 }
      },
      internal: {
        '2B': { minorMin: 0.0667, minorMax: 0.0737, pdMin: 0.0744, pdMax: 0.0772, majorMin: 0.086 },
        '3B': { minorMin: 0.0667, minorMax: 0.0737, pdMin: 0.0744, pdMax: 0.0765, majorMin: 0.086 }
      }
    },
    '#2-64': {
      external: {
        '2A': { allowance: 0.0006, majorMax: 0.0854, majorMin: 0.0816, pdMax: 0.0753, pdMin: 0.0733, minorMax: 0.0668 },
        '3A': { allowance: 0.0, majorMax: 0.086, majorMin: 0.0822, pdMax: 0.0759, pdMin: 0.0744, minorMax: 0.0674 }
      },
      internal: {
        '2B': { minorMin: 0.0691, minorMax: 0.0753, pdMin: 0.0759, pdMax: 0.0786, majorMin: 0.086 },
        '3B': { minorMin: 0.0691, minorMax: 0.0753, pdMin: 0.0759, pdMax: 0.0779, majorMin: 0.086 }
      }
    },
    '#3-48': {
      external: {
        '2A': { allowance: 0.0007, majorMax: 0.0983, majorMin: 0.0938, pdMax: 0.0848, pdMin: 0.0825, minorMax: 0.0734 },
        '3A': { allowance: 0.0, majorMax: 0.099, majorMin: 0.0945, pdMax: 0.0855, pdMin: 0.0838, minorMax: 0.0741 }
      },
      internal: {
        '2B': { minorMin: 0.0764, minorMax: 0.0845, pdMin: 0.0855, pdMax: 0.0885, majorMin: 0.099 },
        '3B': { minorMin: 0.0764, minorMax: 0.0845, pdMin: 0.0855, pdMax: 0.0877, majorMin: 0.099 }
      }
    },
    '#3-56': {
      external: {
        '2A': { allowance: 0.0007, majorMax: 0.0983, majorMin: 0.0942, pdMax: 0.0867, pdMin: 0.0845, minorMax: 0.0771 },
        '3A': { allowance: 0.0, majorMax: 0.099, majorMin: 0.0949, pdMax: 0.0874, pdMin: 0.0858, minorMax: 0.0778 }
      },
      internal: {
        '2B': { minorMin: 0.0797, minorMax: 0.0865, pdMin: 0.0874, pdMax: 0.0902, majorMin: 0.099 },
        '3B': { minorMin: 0.0797, minorMax: 0.0865, pdMin: 0.0874, pdMax: 0.0895, majorMin: 0.099 }
      }
    },
    '#4-40': {
      external: {
        '2A': { allowance: 0.0008, majorMax: 0.1112, majorMin: 0.1061, pdMax: 0.095, pdMin: 0.0925, minorMax: 0.0814 },
        '3A': { allowance: 0.0, majorMax: 0.112, majorMin: 0.1069, pdMax: 0.0958, pdMin: 0.0939, minorMax: 0.0822 }
      },
      internal: {
        '2B': { minorMin: 0.0849, minorMax: 0.0939, pdMin: 0.0958, pdMax: 0.0991, majorMin: 0.112 },
        '3B': { minorMin: 0.0849, minorMax: 0.0939, pdMin: 0.0958, pdMax: 0.0982, majorMin: 0.112 }
      }
    },
    '#4-48': {
      external: {
        '2A': { allowance: 0.0007, majorMax: 0.1113, majorMin: 0.1068, pdMax: 0.0978, pdMin: 0.0954, minorMax: 0.0864 },
        '3A': { allowance: 0.0, majorMax: 0.112, majorMin: 0.1075, pdMax: 0.0985, pdMin: 0.0967, minorMax: 0.0871 }
      },
      internal: {
        '2B': { minorMin: 0.0894, minorMax: 0.0968, pdMin: 0.0985, pdMax: 0.1016, majorMin: 0.112 },
        '3B': { minorMin: 0.0894, minorMax: 0.0968, pdMin: 0.0985, pdMax: 0.1008, majorMin: 0.112 }
      }
    },
    '#5-40': {
      external: {
        '2A': { allowance: 0.0008, majorMax: 0.1242, majorMin: 0.1191, pdMax: 0.108, pdMin: 0.1054, minorMax: 0.0944 },
        '3A': { allowance: 0.0, majorMax: 0.125, majorMin: 0.1199, pdMax: 0.1088, pdMin: 0.1069, minorMax: 0.0952 }
      },
      internal: {
        '2B': { minorMin: 0.0979, minorMax: 0.1062, pdMin: 0.1088, pdMax: 0.1121, majorMin: 0.125 },
        '3B': { minorMin: 0.0979, minorMax: 0.1062, pdMin: 0.1088, pdMax: 0.1113, majorMin: 0.125 }
      }
    },
    '#5-44': {
      external: {
        '2A': { allowance: 0.0007, majorMax: 0.1243, majorMin: 0.1195, pdMax: 0.1095, pdMin: 0.107, minorMax: 0.0972 },
        '3A': { allowance: 0.0, majorMax: 0.125, majorMin: 0.1202, pdMax: 0.1102, pdMin: 0.1083, minorMax: 0.0979 }
      },
      internal: {
        '2B': { minorMin: 0.1004, minorMax: 0.1079, pdMin: 0.1102, pdMax: 0.1134, majorMin: 0.125 },
        '3B': { minorMin: 0.1004, minorMax: 0.1079, pdMin: 0.1102, pdMax: 0.1126, majorMin: 0.125 }
      }
    },
    '#6-32': {
      external: {
        '2A': { allowance: 0.0008, majorMax: 0.1372, majorMin: 0.1312, pdMax: 0.1169, pdMin: 0.1141, minorMax: 0.1 },
        '3A': { allowance: 0.0, majorMax: 0.138, majorMin: 0.132, pdMax: 0.1177, pdMin: 0.1156, minorMax: 0.1008 }
      },
      internal: {
        '2B': { minorMin: 0.104, minorMax: 0.114, pdMin: 0.1177, pdMax: 0.1214, majorMin: 0.138 },
        '3B': { minorMin: 0.104, minorMax: 0.114, pdMin: 0.1177, pdMax: 0.1204, majorMin: 0.138 }
      }
    },
    '#6-40': {
      external: {
        '2A': { allowance: 0.0008, majorMax: 0.1372, majorMin: 0.1321, pdMax: 0.121, pdMin: 0.1184, minorMax: 0.1074 },
        '3A': { allowance: 0.0, majorMax: 0.138, majorMin: 0.1329, pdMax: 0.1218, pdMin: 0.1198, minorMax: 0.1082 }
      },
      internal: {
        '2B': { minorMin: 0.111, minorMax: 0.119, pdMin: 0.1218, pdMax: 0.1252, majorMin: 0.138 },
        '3B': { minorMin: 0.111, minorMax: 0.1186, pdMin: 0.1218, pdMax: 0.1243, majorMin: 0.138 }
      }
    },
    '#8-32': {
      external: {
        '2A': { allowance: 0.0009, majorMax: 0.1631, majorMin: 0.1571, pdMax: 0.1428, pdMin: 0.1399, minorMax: 0.1259 },
        '3A': { allowance: 0.0, majorMax: 0.164, majorMin: 0.158, pdMax: 0.1437, pdMin: 0.1415, minorMax: 0.1268 }
      },
      internal: {
        '2B': { minorMin: 0.13, minorMax: 0.139, pdMin: 0.1437, pdMax: 0.1475, majorMin: 0.164 },
        '3B': { minorMin: 0.13, minorMax: 0.1389, pdMin: 0.1437, pdMax: 0.1465, majorMin: 0.164 }
      }
    },
    '#8-36': {
      external: {
        '2A': { allowance: 0.0008, majorMax: 0.1632, majorMin: 0.1577, pdMax: 0.1452, pdMin: 0.1424, minorMax: 0.1301 },
        '3A': { allowance: 0.0, majorMax: 0.164, majorMin: 0.1585, pdMax: 0.146, pdMin: 0.1439, minorMax: 0.1309 }
      },
      internal: {
        '2B': { minorMin: 0.134, minorMax: 0.142, pdMin: 0.146, pdMax: 0.1496, majorMin: 0.164 },
        '3B': { minorMin: 0.134, minorMax: 0.1416, pdMin: 0.146, pdMax: 0.1487, majorMin: 0.164 }
      }
    },
    '#10-24': {
      external: {
        '2A': { allowance: 0.001, majorMax: 0.189, majorMin: 0.1818, pdMax: 0.1619, pdMin: 0.1586, minorMax: 0.1394 },
        '3A': { allowance: 0.0, majorMax: 0.19, majorMin: 0.1828, pdMax: 0.1629, pdMin: 0.1604, minorMax: 0.1404 }
      },
      internal: {
        '2B': { minorMin: 0.145, minorMax: 0.156, pdMin: 0.1629, pdMax: 0.1672, majorMin: 0.19 },
        '3B': { minorMin: 0.145, minorMax: 0.1555, pdMin: 0.1629, pdMax: 0.1661, majorMin: 0.19 }
      }
    },
    '#10-32': {
      external: {
        '2A': { allowance: 0.0009, majorMax: 0.1891, majorMin: 0.1831, pdMax: 0.1688, pdMin: 0.1658, minorMax: 0.1519 },
        '3A': { allowance: 0.0, majorMax: 0.19, majorMin: 0.184, pdMax: 0.1697, pdMin: 0.1674, minorMax: 0.1528 }
      },
      internal: {
        '2B': { minorMin: 0.156, minorMax: 0.164, pdMin: 0.1697, pdMax: 0.1736, majorMin: 0.19 },
        '3B': { minorMin: 0.156, minorMax: 0.1641, pdMin: 0.1697, pdMax: 0.1726, majorMin: 0.19 }
      }
    },
    '#12-24': {
      external: {
        '2A': { allowance: 0.001, majorMax: 0.215, majorMin: 0.2078, pdMax: 0.1879, pdMin: 0.1845, minorMax: 0.1654 },
        '3A': { allowance: 0.0, majorMax: 0.216, majorMin: 0.2088, pdMax: 0.1889, pdMin: 0.1863, minorMax: 0.1664 }
      },
      internal: {
        '2B': { minorMin: 0.171, minorMax: 0.181, pdMin: 0.1889, pdMax: 0.1933, majorMin: 0.216 },
        '3B': { minorMin: 0.171, minorMax: 0.1807, pdMin: 0.1889, pdMax: 0.1922, majorMin: 0.216 }
      }
    },
    '#12-28': {
      external: {
        '2A': { allowance: 0.001, majorMax: 0.215, majorMin: 0.2085, pdMax: 0.1918, pdMin: 0.1886, minorMax: 0.1724 },
        '3A': { allowance: 0.0, majorMax: 0.216, majorMin: 0.2095, pdMax: 0.1928, pdMin: 0.1904, minorMax: 0.1734 }
      },
      internal: {
        '2B': { minorMin: 0.177, minorMax: 0.186, pdMin: 0.1928, pdMax: 0.197, majorMin: 0.216 },
        '3B': { minorMin: 0.177, minorMax: 0.1857, pdMin: 0.1928, pdMax: 0.1959, majorMin: 0.216 }
      }
    },
    '1/4-20': {
      external: {
        '1A': { allowance: 0.0011, majorMax: 0.2489, majorMin: 0.2367, pdMax: 0.2164, pdMin: 0.2108, minorMax: 0.1894 },
        '2A': { allowance: 0.0011, majorMax: 0.2489, majorMin: 0.2408, pdMax: 0.2164, pdMin: 0.2127, minorMax: 0.1894 },
        '3A': { allowance: 0.0, majorMax: 0.25, majorMin: 0.2419, pdMax: 0.2175, pdMin: 0.2147, minorMax: 0.1905 }
      },
      internal: {
        '1B': { minorMin: 0.196, minorMax: 0.207, pdMin: 0.2175, pdMax: 0.2248, majorMin: 0.25 },
        '2B': { minorMin: 0.196, minorMax: 0.207, pdMin: 0.2175, pdMax: 0.2224, majorMin: 0.25 },
        '3B': { minorMin: 0.196, minorMax: 0.2067, pdMin: 0.2175, pdMax: 0.2211, majorMin: 0.25 }
      }
    },
    '1/4-28': {
      external: {
        '1A': { allowance: 0.001, majorMax: 0.249, majorMin: 0.2392, pdMax: 0.2258, pdMin: 0.2208, minorMax: 0.2064 },
        '2A': { allowance: 0.001, majorMax: 0.249, majorMin: 0.2425, pdMax: 0.2258, pdMin: 0.2225, minorMax: 0.2064 },
        '3A': { allowance: 0.0, majorMax: 0.25, majorMin: 0.2435, pdMax: 0.2268, pdMin: 0.2243, minorMax: 0.2074 }
      },
      internal: {
        '1B': { minorMin: 0.211, minorMax: 0.22, pdMin: 0.2268, pdMax: 0.2333, majorMin: 0.25 },
        '2B': { minorMin: 0.211, minorMax: 0.22, pdMin: 0.2268, pdMax: 0.2311, majorMin: 0.25 },
        '3B': { minorMin: 0.211, minorMax: 0.219, pdMin: 0.2268, pdMax: 0.23, majorMin: 0.25 }
      }
    },
    '5/16-18': {
      external: {
        '1A': { allowance: 0.0012, majorMax: 0.3113, majorMin: 0.2982, pdMax: 0.2752, pdMin: 0.2691, minorMax: 0.2452 },
        '2A': { allowance: 0.0012, majorMax: 0.3113, majorMin: 0.3026, pdMax: 0.2752, pdMin: 0.2712, minorMax: 0.2452 },
        '3A': { allowance: 0.0, majorMax: 0.3125, majorMin: 0.3038, pdMax: 0.2764, pdMin: 0.2734, minorMax: 0.2464 }
      },
      internal: {
        '1B': { minorMin: 0.252, minorMax: 0.265, pdMin: 0.2764, pdMax: 0.2843, majorMin: 0.3125 },
        '2B': { minorMin: 0.252, minorMax: 0.265, pdMin: 0.2764, pdMax: 0.2817, majorMin: 0.3125 },
        '3B': { minorMin: 0.252, minorMax: 0.263, pdMin: 0.2764, pdMax: 0.2803, majorMin: 0.3125 }
      }
    },
    '5/16-24': {
      external: {
        '1A': { allowance: 0.0011, majorMax: 0.3114, majorMin: 0.3006, pdMax: 0.2843, pdMin: 0.2788, minorMax: 0.2618 },
        '2A': { allowance: 0.0011, majorMax: 0.3114, majorMin: 0.3042, pdMax: 0.2843, pdMin: 0.2806, minorMax: 0.2618 },
        '3A': { allowance: 0.0, majorMax: 0.3125, majorMin: 0.3053, pdMax: 0.2854, pdMin: 0.2827, minorMax: 0.2629 }
      },
      internal: {
        '1B': { minorMin: 0.267, minorMax: 0.277, pdMin: 0.2854, pdMax: 0.2925, majorMin: 0.3125 },
        '2B': { minorMin: 0.267, minorMax: 0.277, pdMin: 0.2854, pdMax: 0.2902, majorMin: 0.3125 },
        '3B': { minorMin: 0.267, minorMax: 0.2754, pdMin: 0.2854, pdMax: 0.289, majorMin: 0.3125 }
      }
    },
    '3/8-16': {
      external: {
        '1A': { allowance: 0.0013, majorMax: 0.3737, majorMin: 0.3595, pdMax: 0.3331, pdMin: 0.3266, minorMax: 0.2992 },
        '2A': { allowance: 0.0013, majorMax: 0.3737, majorMin: 0.3643, pdMax: 0.3331, pdMin: 0.3287, minorMax: 0.2992 },
        '3A': { allowance: 0.0, majorMax: 0.375, majorMin: 0.3656, pdMax: 0.3344, pdMin: 0.3311, minorMax: 0.3005 }
      },
      internal: {
        '1B': { minorMin: 0.307, minorMax: 0.321, pdMin: 0.3344, pdMax: 0.3429, majorMin: 0.375 },
        '2B': { minorMin: 0.307, minorMax: 0.321, pdMin: 0.3344, pdMax: 0.3401, majorMin: 0.375 },
        '3B': { minorMin: 0.307, minorMax: 0.3182, pdMin: 0.3344, pdMax: 0.3387, majorMin: 0.375 }
      }
    },
    '3/8-24': {
      external: {
        '1A': { allowance: 0.0011, majorMax: 0.3739, majorMin: 0.3631, pdMax: 0.3468, pdMin: 0.3411, minorMax: 0.3243 },
        '2A': { allowance: 0.0011, majorMax: 0.3739, majorMin: 0.3667, pdMax: 0.3468, pdMin: 0.343, minorMax: 0.3243 },
        '3A': { allowance: 0.0, majorMax: 0.375, majorMin: 0.3678, pdMax: 0.3479, pdMin: 0.345, minorMax: 0.3254 }
      },
      internal: {
        '1B': { minorMin: 0.33, minorMax: 0.34, pdMin: 0.3479, pdMax: 0.3553, majorMin: 0.375 },
        '2B': { minorMin: 0.33, minorMax: 0.34, pdMin: 0.3479, pdMax: 0.3528, majorMin: 0.375 },
        '3B': { minorMin: 0.33, minorMax: 0.3372, pdMin: 0.3479, pdMax: 0.3516, majorMin: 0.375 }
      }
    },
    '7/16-14': {
      external: {
        '1A': { allowance: 0.0014, majorMax: 0.4361, majorMin: 0.4206, pdMax: 0.3897, pdMin: 0.3826, minorMax: 0.3511 },
        '2A': { allowance: 0.0014, majorMax: 0.4361, majorMin: 0.4258, pdMax: 0.3897, pdMin: 0.385, minorMax: 0.3511 },
        '3A': { allowance: 0.0, majorMax: 0.4375, majorMin: 0.4272, pdMax: 0.3911, pdMin: 0.3876, minorMax: 0.3525 }
      },
      internal: {
        '1B': { minorMin: 0.36, minorMax: 0.376, pdMin: 0.3911, pdMax: 0.4003, majorMin: 0.4375 },
        '2B': { minorMin: 0.36, minorMax: 0.376, pdMin: 0.3911, pdMax: 0.3972, majorMin: 0.4375 },
        '3B': { minorMin: 0.36, minorMax: 0.3717, pdMin: 0.3911, pdMax: 0.3957, majorMin: 0.4375 }
      }
    },
    '7/16-20': {
      external: {
        '1A': { allowance: 0.0013, majorMax: 0.4362, majorMin: 0.424, pdMax: 0.4037, pdMin: 0.3975, minorMax: 0.3767 },
        '2A': { allowance: 0.0013, majorMax: 0.4362, majorMin: 0.4281, pdMax: 0.4037, pdMin: 0.3995, minorMax: 0.3767 },
        '3A': { allowance: 0.0, majorMax: 0.4375, majorMin: 0.4294, pdMax: 0.405, pdMin: 0.4019, minorMax: 0.378 }
      },
      internal: {
        '1B': { minorMin: 0.383, minorMax: 0.395, pdMin: 0.405, pdMax: 0.4131, majorMin: 0.4375 },
        '2B': { minorMin: 0.383, minorMax: 0.395, pdMin: 0.405, pdMax: 0.4104, majorMin: 0.4375 },
        '3B': { minorMin: 0.383, minorMax: 0.3916, pdMin: 0.405, pdMax: 0.4091, majorMin: 0.4375 }
      }
    },
    '1/2-13': {
      external: {
        '1A': { allowance: 0.0015, majorMax: 0.4985, majorMin: 0.4822, pdMax: 0.4485, pdMin: 0.4411, minorMax: 0.4069 },
        '2A': { allowance: 0.0015, majorMax: 0.4985, majorMin: 0.4876, pdMax: 0.4485, pdMin: 0.4435, minorMax: 0.4069 },
        '3A': { allowance: 0.0, majorMax: 0.5, majorMin: 0.4891, pdMax: 0.45, pdMin: 0.4463, minorMax: 0.4084 }
      },
      internal: {
        '1B': { minorMin: 0.417, minorMax: 0.434, pdMin: 0.45, pdMax: 0.4597, majorMin: 0.5 },
        '2B': { minorMin: 0.417, minorMax: 0.434, pdMin: 0.45, pdMax: 0.4565, majorMin: 0.5 },
        '3B': { minorMin: 0.417, minorMax: 0.4284, pdMin: 0.45, pdMax: 0.4548, majorMin: 0.5 }
      }
    },
    '1/2-20': {
      external: {
        '1A': { allowance: 0.0013, majorMax: 0.4987, majorMin: 0.4865, pdMax: 0.4662, pdMin: 0.4598, minorMax: 0.4392 },
        '2A': { allowance: 0.0013, majorMax: 0.4987, majorMin: 0.4906, pdMax: 0.4662, pdMin: 0.4619, minorMax: 0.4392 },
        '3A': { allowance: 0.0, majorMax: 0.5, majorMin: 0.4919, pdMax: 0.4675, pdMin: 0.4643, minorMax: 0.4405 }
      },
      internal: {
        '1B': { minorMin: 0.446, minorMax: 0.457, pdMin: 0.4675, pdMax: 0.4759, majorMin: 0.5 },
        '2B': { minorMin: 0.446, minorMax: 0.457, pdMin: 0.4675, pdMax: 0.4731, majorMin: 0.5 },
        '3B': { minorMin: 0.446, minorMax: 0.4537, pdMin: 0.4675, pdMax: 0.4717, majorMin: 0.5 }
      }
    },
    '9/16-12': {
      external: {
        '1A': { allowance: 0.0016, majorMax: 0.5609, majorMin: 0.5437, pdMax: 0.5068, pdMin: 0.499, minorMax: 0.4617 },
        '2A': { allowance: 0.0016, majorMax: 0.5609, majorMin: 0.5495, pdMax: 0.5068, pdMin: 0.5016, minorMax: 0.4617 },
        '3A': { allowance: 0.0, majorMax: 0.5625, majorMin: 0.5511, pdMax: 0.5084, pdMin: 0.5045, minorMax: 0.4633 }
      },
      internal: {
        '1B': { minorMin: 0.472, minorMax: 0.49, pdMin: 0.5084, pdMax: 0.5186, majorMin: 0.5625 },
        '2B': { minorMin: 0.472, minorMax: 0.49, pdMin: 0.5084, pdMax: 0.5152, majorMin: 0.5625 },
        '3B': { minorMin: 0.472, minorMax: 0.4843, pdMin: 0.5084, pdMax: 0.5135, majorMin: 0.5625 }
      }
    },
    '9/16-18': {
      external: {
        '1A': { allowance: 0.0014, majorMax: 0.5611, majorMin: 0.548, pdMax: 0.525, pdMin: 0.5182, minorMax: 0.495 },
        '2A': { allowance: 0.0014, majorMax: 0.5611, majorMin: 0.5524, pdMax: 0.525, pdMin: 0.5205, minorMax: 0.495 },
        '3A': { allowance: 0.0, majorMax: 0.5625, majorMin: 0.5538, pdMax: 0.5264, pdMin: 0.523, minorMax: 0.4964 }
      },
      internal: {
        '1B': { minorMin: 0.502, minorMax: 0.515, pdMin: 0.5264, pdMax: 0.5353, majorMin: 0.5625 },
        '2B': { minorMin: 0.502, minorMax: 0.515, pdMin: 0.5264, pdMax: 0.5323, majorMin: 0.5625 },
        '3B': { minorMin: 0.502, minorMax: 0.5106, pdMin: 0.5264, pdMax: 0.5308, majorMin: 0.5625 }
      }
    },
    '5/8-11': {
      external: {
        '1A': { allowance: 0.0016, majorMax: 0.6234, majorMin: 0.6052, pdMax: 0.5644, pdMin: 0.5561, minorMax: 0.5152 },
        '2A': { allowance: 0.0016, majorMax: 0.6234, majorMin: 0.6113, pdMax: 0.5644, pdMin: 0.5589, minorMax: 0.5152 },
        '3A': { allowance: 0.0, majorMax: 0.625, majorMin: 0.6129, pdMax: 0.566, pdMin: 0.5619, minorMax: 0.5168 }
      },
      internal: {
        '1B': { minorMin: 0.527, minorMax: 0.546, pdMin: 0.566, pdMax: 0.5767, majorMin: 0.625 },
        '2B': { minorMin: 0.527, minorMax: 0.546, pdMin: 0.566, pdMax: 0.5732, majorMin: 0.625 },
        '3B': { minorMin: 0.527, minorMax: 0.5391, pdMin: 0.566, pdMax: 0.5714, majorMin: 0.625 }
      }
    },
    '5/8-18': {
      external: {
        '1A': { allowance: 0.0014, majorMax: 0.6236, majorMin: 0.6105, pdMax: 0.5875, pdMin: 0.5805, minorMax: 0.5575 },
        '2A': { allowance: 0.0014, majorMax: 0.6236, majorMin: 0.6149, pdMax: 0.5875, pdMin: 0.5828, minorMax: 0.5575 },
        '3A': { allowance: 0.0, majorMax: 0.625, majorMin: 0.6163, pdMax: 0.5889, pdMin: 0.5854, minorMax: 0.5589 }
      },
      internal: {
        '1B': { minorMin: 0.565, minorMax: 0.578, pdMin: 0.5889, pdMax: 0.598, majorMin: 0.625 },
        '2B': { minorMin: 0.565, minorMax: 0.578, pdMin: 0.5889, pdMax: 0.5949, majorMin: 0.625 },
        '3B': { minorMin: 0.565, minorMax: 0.573, pdMin: 0.5889, pdMax: 0.5934, majorMin: 0.625 }
      }
    },
    '3/4-10': {
      external: {
        '1A': { allowance: 0.0018, majorMax: 0.7482, majorMin: 0.7288, pdMax: 0.6832, pdMin: 0.6744, minorMax: 0.6291 },
        '2A': { allowance: 0.0018, majorMax: 0.7482, majorMin: 0.7353, pdMax: 0.6832, pdMin: 0.6773, minorMax: 0.6291 },
        '3A': { allowance: 0.0, majorMax: 0.75, majorMin: 0.7371, pdMax: 0.685, pdMin: 0.6806, minorMax: 0.6309 }
      },
      internal: {
        '1B': { minorMin: 0.642, minorMax: 0.663, pdMin: 0.685, pdMax: 0.6965, majorMin: 0.75 },
        '2B': { minorMin: 0.642, minorMax: 0.663, pdMin: 0.685, pdMax: 0.6927, majorMin: 0.75 },
        '3B': { minorMin: 0.642, minorMax: 0.6545, pdMin: 0.685, pdMax: 0.6907, majorMin: 0.75 }
      }
    },
    '3/4-16': {
      external: {
        '1A': { allowance: 0.0015, majorMax: 0.7485, majorMin: 0.7343, pdMax: 0.7079, pdMin: 0.7004, minorMax: 0.674 },
        '2A': { allowance: 0.0015, majorMax: 0.7485, majorMin: 0.7391, pdMax: 0.7079, pdMin: 0.7029, minorMax: 0.674 },
        '3A': { allowance: 0.0, majorMax: 0.75, majorMin: 0.7406, pdMax: 0.7094, pdMin: 0.7056, minorMax: 0.6755 }
      },
      internal: {
        '1B': { minorMin: 0.682, minorMax: 0.696, pdMin: 0.7094, pdMax: 0.7192, majorMin: 0.75 },
        '2B': { minorMin: 0.682, minorMax: 0.696, pdMin: 0.7094, pdMax: 0.7159, majorMin: 0.75 },
        '3B': { minorMin: 0.682, minorMax: 0.6908, pdMin: 0.7094, pdMax: 0.7143, majorMin: 0.75 }
      }
    },
    '7/8-9': {
      external: {
        '1A': { allowance: 0.0019, majorMax: 0.8731, majorMin: 0.8523, pdMax: 0.8009, pdMin: 0.7914, minorMax: 0.7408 },
        '2A': { allowance: 0.0019, majorMax: 0.8731, majorMin: 0.8592, pdMax: 0.8009, pdMin: 0.7946, minorMax: 0.7408 },
        '3A': { allowance: 0.0, majorMax: 0.875, majorMin: 0.8611, pdMax: 0.8028, pdMin: 0.7981, minorMax: 0.7427 }
      },
      internal: {
        '1B': { minorMin: 0.755, minorMax: 0.778, pdMin: 0.8028, pdMax: 0.8151, majorMin: 0.875 },
        '2B': { minorMin: 0.755, minorMax: 0.778, pdMin: 0.8028, pdMax: 0.811, majorMin: 0.875 },
        '3B': { minorMin: 0.755, minorMax: 0.7681, pdMin: 0.8028, pdMax: 0.8089, majorMin: 0.875 }
      }
    },
    '7/8-14': {
      external: {
        '1A': { allowance: 0.0016, majorMax: 0.8734, majorMin: 0.8579, pdMax: 0.827, pdMin: 0.8189, minorMax: 0.7884 },
        '2A': { allowance: 0.0016, majorMax: 0.8734, majorMin: 0.8631, pdMax: 0.827, pdMin: 0.8216, minorMax: 0.7884 },
        '3A': { allowance: 0.0, majorMax: 0.875, majorMin: 0.8647, pdMax: 0.8286, pdMin: 0.8245, minorMax: 0.79 }
      },
      internal: {
        '1B': { minorMin: 0.798, minorMax: 0.814, pdMin: 0.8286, pdMax: 0.8392, majorMin: 0.875 },
        '2B': { minorMin: 0.798, minorMax: 0.814, pdMin: 0.8286, pdMax: 0.8356, majorMin: 0.875 },
        '3B': { minorMin: 0.798, minorMax: 0.8068, pdMin: 0.8286, pdMax: 0.8339, majorMin: 0.875 }
      }
    },
    '1-8': {
      external: {
        '1A': { allowance: 0.002, majorMax: 0.998, majorMin: 0.9755, pdMax: 0.9168, pdMin: 0.9067, minorMax: 0.8492 },
        '2A': { allowance: 0.002, majorMax: 0.998, majorMin: 0.983, pdMax: 0.9168, pdMin: 0.91, minorMax: 0.8492 },
        '3A': { allowance: 0.0, majorMax: 1.0, majorMin: 0.985, pdMax: 0.9188, pdMin: 0.9137, minorMax: 0.8512 }
      },
      internal: {
        '1B': { minorMin: 0.865, minorMax: 0.89, pdMin: 0.9188, pdMax: 0.932, majorMin: 1.0 },
        '2B': { minorMin: 0.865, minorMax: 0.89, pdMin: 0.9188, pdMax: 0.9276, majorMin: 1.0 },
        '3B': { minorMin: 0.865, minorMax: 0.8797, pdMin: 0.9188, pdMax: 0.9254, majorMin: 1.0 }
      }
    },
    '1-12': {
      external: {
        '1A': { allowance: 0.0018, majorMax: 0.9982, majorMin: 0.981, pdMax: 0.9441, pdMin: 0.9353, minorMax: 0.899 },
        '2A': { allowance: 0.0018, majorMax: 0.9982, majorMin: 0.9868, pdMax: 0.9441, pdMin: 0.9382, minorMax: 0.899 },
        '3A': { allowance: 0.0, majorMax: 1.0, majorMin: 0.9886, pdMax: 0.9459, pdMin: 0.9415, minorMax: 0.9008 }
      },
      internal: {
        '1B': { minorMin: 0.91, minorMax: 0.928, pdMin: 0.9459, pdMax: 0.9573, majorMin: 1.0 },
        '2B': { minorMin: 0.91, minorMax: 0.928, pdMin: 0.9459, pdMax: 0.9535, majorMin: 1.0 },
        '3B': { minorMin: 0.91, minorMax: 0.9198, pdMin: 0.9459, pdMax: 0.9516, majorMin: 1.0 }
      }
    }
  };

  /**
   * Tolerance-class limiting dimensions for a STANDARD Unified inch thread
   * size (one of calc.unifiedThreadSizes). Lookup only -- Machinery's Handbook
   * does not reproduce the general ASME B1.1 tolerance formulas for
   * non-tabulated inch sizes/pitches, so this has no "odd size" fallback
   * (unlike calc.metricThreadTolerance). Returns null if the size or class
   * isn't tabulated -- notably Class 1A/1B is only tabulated for 1/4" and
   * larger (omitted below that per the standard).
   * Classes: 1A/2A/3A (external), 1B/2B/3B (internal). 2A/2B = general
   * purpose (most common), 3A/3B = precision/no allowance, 1A/1B = loose
   * fit for easy assembly (e.g. rapid production, dirty/coated parts).
   */
  calc.unifiedThreadTolerance = function (sizeName, threadClass) {
    var entry = UNIFIED_TOLERANCES[sizeName];
    if (!entry || !threadClass) return null;
    var isExternal = threadClass.charAt(1) === 'A';
    var vals = (isExternal ? entry.external : entry.internal)[threadClass];
    if (!vals) return null;
    var out = { class: threadClass, external: isExternal };
    for (var k in vals) {
      if (Object.prototype.hasOwnProperty.call(vals, k)) out[k] = vals[k];
    }
    return out;
  };
  /** Tolerance classes available per size (subset of ['1A','2A','3A','1B','2B','3B']). */
  calc.unifiedThreadToleranceClasses = function (sizeName) {
    var entry = UNIFIED_TOLERANCES[sizeName];
    if (!entry) return [];
    return Object.keys(entry.external).concat(Object.keys(entry.internal));
  };

  var METRIC_TABLE7_ALLOWANCE = [
    { pitch: 0.2, EI_G: 0.017, EI_H: 0, es_e: null, es_f: null, es_g: 0.017, es_h: 0 },
    { pitch: 0.25, EI_G: 0.018, EI_H: 0, es_e: null, es_f: null, es_g: 0.018, es_h: 0 },
    { pitch: 0.3, EI_G: 0.018, EI_H: 0, es_e: null, es_f: null, es_g: 0.018, es_h: 0 },
    { pitch: 0.35, EI_G: 0.019, EI_H: 0, es_e: null, es_f: 0.034, es_g: 0.019, es_h: 0 },
    { pitch: 0.4, EI_G: 0.019, EI_H: 0, es_e: null, es_f: 0.034, es_g: 0.019, es_h: 0 },
    { pitch: 0.45, EI_G: 0.02, EI_H: 0, es_e: null, es_f: 0.035, es_g: 0.02, es_h: 0 },
    { pitch: 0.5, EI_G: 0.02, EI_H: 0, es_e: 0.05, es_f: 0.036, es_g: 0.02, es_h: 0 },
    { pitch: 0.6, EI_G: 0.021, EI_H: 0, es_e: 0.053, es_f: 0.036, es_g: 0.021, es_h: 0 },
    { pitch: 0.7, EI_G: 0.022, EI_H: 0, es_e: 0.056, es_f: 0.038, es_g: 0.022, es_h: 0 },
    { pitch: 0.75, EI_G: 0.022, EI_H: 0, es_e: 0.056, es_f: 0.038, es_g: 0.022, es_h: 0 },
    { pitch: 0.8, EI_G: 0.024, EI_H: 0, es_e: 0.06, es_f: 0.038, es_g: 0.024, es_h: 0 },
    { pitch: 1, EI_G: 0.026, EI_H: 0, es_e: 0.06, es_f: 0.04, es_g: 0.026, es_h: 0 },
    { pitch: 1.25, EI_G: 0.028, EI_H: 0, es_e: 0.063, es_f: 0.042, es_g: 0.028, es_h: 0 },
    { pitch: 1.5, EI_G: 0.032, EI_H: 0, es_e: 0.067, es_f: 0.045, es_g: 0.032, es_h: 0 },
    { pitch: 1.75, EI_G: 0.034, EI_H: 0, es_e: 0.071, es_f: 0.048, es_g: 0.034, es_h: 0 },
    { pitch: 2, EI_G: 0.038, EI_H: 0, es_e: 0.071, es_f: 0.052, es_g: 0.038, es_h: 0 },
    { pitch: 2.5, EI_G: 0.042, EI_H: 0, es_e: 0.08, es_f: 0.058, es_g: 0.042, es_h: 0 },
    { pitch: 3, EI_G: 0.048, EI_H: 0, es_e: 0.085, es_f: 0.063, es_g: 0.048, es_h: 0 },
    { pitch: 3.5, EI_G: 0.053, EI_H: 0, es_e: 0.09, es_f: 0.07, es_g: 0.053, es_h: 0 },
    { pitch: 4, EI_G: 0.06, EI_H: 0, es_e: 0.095, es_f: 0.075, es_g: 0.06, es_h: 0 },
    { pitch: 4.5, EI_G: 0.063, EI_H: 0, es_e: 0.1, es_f: 0.08, es_g: 0.063, es_h: 0 },
    { pitch: 5, EI_G: 0.071, EI_H: 0, es_e: 0.106, es_f: 0.085, es_g: 0.071, es_h: 0 },
    { pitch: 5.5, EI_G: 0.075, EI_H: 0, es_e: 0.112, es_f: 0.09, es_g: 0.075, es_h: 0 },
    { pitch: 6, EI_G: 0.08, EI_H: 0, es_e: 0.118, es_f: 0.095, es_g: 0.08, es_h: 0 }
  ];

  var METRIC_TABLE8_TD2_INTERNAL = [
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.2, grades: { 4: 0.042 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.25, grades: { 4: 0.048, 5: 0.06 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.35, grades: { 4: 0.053, 5: 0.067, 6: 0.085 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.4, grades: { 4: 0.056, 5: 0.071, 6: 0.09 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.45, grades: { 4: 0.06, 5: 0.075, 6: 0.095 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.35, grades: { 4: 0.056, 5: 0.071, 6: 0.09 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.5, grades: { 4: 0.063, 5: 0.08, 6: 0.1, 7: 0.125 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.6, grades: { 4: 0.071, 5: 0.09, 6: 0.112, 7: 0.14 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.7, grades: { 4: 0.075, 5: 0.095, 6: 0.118, 7: 0.15 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.75, grades: { 4: 0.075, 5: 0.095, 6: 0.118, 7: 0.15 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.8, grades: { 4: 0.08, 5: 0.1, 6: 0.125, 7: 0.16, 8: 0.2 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 0.75, grades: { 4: 0.085, 5: 0.106, 6: 0.132, 7: 0.17 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 1, grades: { 4: 0.095, 5: 0.118, 6: 0.15, 7: 0.19, 8: 0.236 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 1.25, grades: { 4: 0.1, 5: 0.125, 6: 0.16, 7: 0.2, 8: 0.25 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 1.5, grades: { 4: 0.112, 5: 0.14, 6: 0.18, 7: 0.224, 8: 0.28 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1, grades: { 4: 0.1, 5: 0.125, 6: 0.16, 7: 0.2, 8: 0.25 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1.25, grades: { 4: 0.112, 5: 0.14, 6: 0.18, 7: 0.224, 8: 0.28 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1.5, grades: { 4: 0.118, 5: 0.15, 6: 0.19, 7: 0.236, 8: 0.3 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1.75, grades: { 4: 0.125, 5: 0.16, 6: 0.2, 7: 0.25, 8: 0.315 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 2, grades: { 4: 0.132, 5: 0.17, 6: 0.212, 7: 0.265, 8: 0.335 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 2.5, grades: { 4: 0.14, 5: 0.18, 6: 0.224, 7: 0.28, 8: 0.355 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 1, grades: { 4: 0.106, 5: 0.132, 6: 0.17, 7: 0.212 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 1.5, grades: { 4: 0.125, 5: 0.16, 6: 0.2, 7: 0.25, 8: 0.315 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 2, grades: { 4: 0.14, 5: 0.18, 6: 0.224, 7: 0.28, 8: 0.355 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 3, grades: { 4: 0.17, 5: 0.212, 6: 0.265, 7: 0.335, 8: 0.425 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 3.5, grades: { 4: 0.18, 5: 0.224, 6: 0.28, 7: 0.355, 8: 0.45 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 4, grades: { 4: 0.19, 5: 0.236, 6: 0.3, 7: 0.375, 8: 0.475 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 4.5, grades: { 4: 0.2, 5: 0.25, 6: 0.315, 7: 0.4, 8: 0.5 } },
    { diaOver: 45, diaUpTo: 90, pitch: 1.5, grades: { 4: 0.132, 5: 0.17, 6: 0.212, 7: 0.265, 8: 0.335 } },
    { diaOver: 45, diaUpTo: 90, pitch: 2, grades: { 4: 0.15, 5: 0.19, 6: 0.236, 7: 0.3, 8: 0.375 } },
    { diaOver: 45, diaUpTo: 90, pitch: 3, grades: { 4: 0.18, 5: 0.224, 6: 0.28, 7: 0.355, 8: 0.45 } },
    { diaOver: 45, diaUpTo: 90, pitch: 4, grades: { 4: 0.2, 5: 0.25, 6: 0.315, 7: 0.4, 8: 0.5 } },
    { diaOver: 45, diaUpTo: 90, pitch: 5, grades: { 4: 0.212, 5: 0.265, 6: 0.335, 7: 0.425, 8: 0.53 } },
    { diaOver: 45, diaUpTo: 90, pitch: 5.5, grades: { 4: 0.224, 5: 0.28, 6: 0.355, 7: 0.45, 8: 0.56 } },
    { diaOver: 45, diaUpTo: 90, pitch: 6, grades: { 4: 0.236, 5: 0.3, 6: 0.375, 7: 0.475, 8: 0.6 } },
    { diaOver: 90, diaUpTo: 180, pitch: 2, grades: { 4: 0.16, 5: 0.2, 6: 0.25, 7: 0.315, 8: 0.4 } },
    { diaOver: 90, diaUpTo: 180, pitch: 3, grades: { 4: 0.19, 5: 0.236, 6: 0.3, 7: 0.375, 8: 0.475 } },
    { diaOver: 90, diaUpTo: 180, pitch: 4, grades: { 4: 0.212, 5: 0.265, 6: 0.335, 7: 0.425, 8: 0.53 } },
    { diaOver: 90, diaUpTo: 180, pitch: 6, grades: { 4: 0.25, 5: 0.315, 6: 0.4, 7: 0.5, 8: 0.63 } },
    { diaOver: 180, diaUpTo: 355, pitch: 3, grades: { 4: 0.212, 5: 0.265, 6: 0.335, 7: 0.425, 8: 0.53 } },
    { diaOver: 180, diaUpTo: 355, pitch: 4, grades: { 4: 0.236, 5: 0.3, 6: 0.375, 7: 0.475, 8: 0.6 } },
    { diaOver: 180, diaUpTo: 355, pitch: 6, grades: { 4: 0.265, 5: 0.335, 6: 0.425, 7: 0.53, 8: 0.67 } }
  ];

  var METRIC_TABLE9_TD1_INTERNAL = [
    { pitch: 0.2, grades: { 4: 0.038 } },
    { pitch: 0.25, grades: { 4: 0.045, 5: 0.056 } },
    { pitch: 0.3, grades: { 4: 0.053, 5: 0.067, 6: 0.085 } },
    { pitch: 0.35, grades: { 4: 0.063, 5: 0.08, 6: 0.1 } },
    { pitch: 0.4, grades: { 4: 0.071, 5: 0.09, 6: 0.112 } },
    { pitch: 0.45, grades: { 4: 0.08, 5: 0.1, 6: 0.125 } },
    { pitch: 0.5, grades: { 4: 0.09, 5: 0.112, 6: 0.14, 7: 0.18 } },
    { pitch: 0.6, grades: { 4: 0.1, 5: 0.125, 6: 0.16, 7: 0.2 } },
    { pitch: 0.7, grades: { 4: 0.112, 5: 0.14, 6: 0.18, 7: 0.224 } },
    { pitch: 0.75, grades: { 4: 0.118, 5: 0.15, 6: 0.19, 7: 0.236 } },
    { pitch: 0.8, grades: { 4: 0.125, 5: 0.16, 6: 0.2, 7: 0.25, 8: 0.315 } },
    { pitch: 1, grades: { 4: 0.15, 5: 0.19, 6: 0.236, 7: 0.3, 8: 0.375 } },
    { pitch: 1.25, grades: { 4: 0.17, 5: 0.212, 6: 0.265, 7: 0.335, 8: 0.425 } },
    { pitch: 1.5, grades: { 4: 0.19, 5: 0.236, 6: 0.3, 7: 0.375, 8: 0.475 } },
    { pitch: 1.75, grades: { 4: 0.212, 5: 0.265, 6: 0.335, 7: 0.425, 8: 0.53 } },
    { pitch: 2, grades: { 4: 0.236, 5: 0.3, 6: 0.375, 7: 0.475, 8: 0.6 } },
    { pitch: 2.5, grades: { 4: 0.28, 5: 0.355, 6: 0.45, 7: 0.56, 8: 0.71 } },
    { pitch: 3, grades: { 4: 0.315, 5: 0.4, 6: 0.5, 7: 0.63, 8: 0.8 } },
    { pitch: 3.5, grades: { 4: 0.355, 5: 0.45, 6: 0.56, 7: 0.71, 8: 0.9 } },
    { pitch: 4, grades: { 4: 0.375, 5: 0.475, 6: 0.6, 7: 0.75, 8: 0.95 } },
    { pitch: 4.5, grades: { 4: 0.425, 5: 0.53, 6: 0.67, 7: 0.85, 8: 1.06 } },
    { pitch: 5, grades: { 4: 0.45, 5: 0.56, 6: 0.71, 7: 0.9, 8: 1.12 } },
    { pitch: 5.5, grades: { 4: 0.475, 5: 0.6, 6: 0.75, 7: 0.95, 8: 1.18 } },
    { pitch: 6, grades: { 4: 0.5, 5: 0.63, 6: 0.8, 7: 1.0, 8: 1.25 } }
  ];

  var METRIC_TABLE10_TD_EXTERNAL = [
    { pitch: 0.2, grades: { 4: 0.036, 6: 0.056 } },
    { pitch: 0.25, grades: { 4: 0.042, 6: 0.067 } },
    { pitch: 0.3, grades: { 4: 0.048, 6: 0.075 } },
    { pitch: 0.35, grades: { 4: 0.053, 6: 0.085 } },
    { pitch: 0.4, grades: { 4: 0.06, 6: 0.095 } },
    { pitch: 0.45, grades: { 4: 0.063, 6: 0.1 } },
    { pitch: 0.5, grades: { 4: 0.067, 6: 0.106 } },
    { pitch: 0.6, grades: { 4: 0.08, 6: 0.125 } },
    { pitch: 0.7, grades: { 4: 0.09, 6: 0.14 } },
    { pitch: 0.75, grades: { 4: 0.09, 6: 0.14 } },
    { pitch: 0.8, grades: { 4: 0.095, 6: 0.15, 8: 0.236 } },
    { pitch: 1, grades: { 4: 0.112, 6: 0.18, 8: 0.28 } },
    { pitch: 1.25, grades: { 4: 0.132, 6: 0.212, 8: 0.335 } },
    { pitch: 1.5, grades: { 4: 0.15, 6: 0.236, 8: 0.375 } },
    { pitch: 1.75, grades: { 4: 0.17, 6: 0.265, 8: 0.425 } },
    { pitch: 2, grades: { 4: 0.18, 6: 0.28, 8: 0.45 } },
    { pitch: 2.5, grades: { 4: 0.212, 6: 0.335, 8: 0.53 } },
    { pitch: 3, grades: { 4: 0.236, 6: 0.375, 8: 0.6 } },
    { pitch: 3.5, grades: { 4: 0.265, 6: 0.425, 8: 0.67 } },
    { pitch: 4, grades: { 4: 0.3, 6: 0.475, 8: 0.75 } },
    { pitch: 4.5, grades: { 4: 0.315, 6: 0.5, 8: 0.8 } },
    { pitch: 5, grades: { 4: 0.335, 6: 0.53, 8: 0.85 } },
    { pitch: 5.5, grades: { 4: 0.355, 6: 0.56, 8: 0.9 } },
    { pitch: 6, grades: { 4: 0.375, 6: 0.6, 8: 0.95 } }
  ];

  var METRIC_TABLE11_TD2_EXTERNAL = [
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.2, grades: { 3: 0.025, 4: 0.032, 5: 0.04, 6: 0.05 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.25, grades: { 3: 0.028, 4: 0.036, 5: 0.045, 6: 0.056 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.35, grades: { 3: 0.032, 4: 0.04, 5: 0.05, 6: 0.063, 7: 0.08 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.4, grades: { 3: 0.034, 4: 0.042, 5: 0.053, 6: 0.067, 7: 0.085 } },
    { diaOver: 1.5, diaUpTo: 2.8, pitch: 0.45, grades: { 3: 0.036, 4: 0.045, 5: 0.056, 6: 0.071, 7: 0.09 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.35, grades: { 3: 0.034, 4: 0.042, 5: 0.053, 6: 0.067, 7: 0.085 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.5, grades: { 3: 0.038, 4: 0.048, 5: 0.06, 6: 0.075, 7: 0.095 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.6, grades: { 3: 0.042, 4: 0.053, 5: 0.067, 6: 0.085, 7: 0.106 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.7, grades: { 3: 0.045, 4: 0.056, 5: 0.071, 6: 0.09, 7: 0.112 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.75, grades: { 3: 0.045, 4: 0.056, 5: 0.071, 6: 0.09, 7: 0.112 } },
    { diaOver: 2.8, diaUpTo: 5.6, pitch: 0.8, grades: { 3: 0.048, 4: 0.06, 5: 0.075, 6: 0.095, 7: 0.118, 8: 0.15, 9: 0.19 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 0.75, grades: { 3: 0.05, 4: 0.063, 5: 0.08, 6: 0.1, 7: 0.125 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 1, grades: { 3: 0.056, 4: 0.071, 5: 0.09, 6: 0.112, 7: 0.14, 8: 0.18, 9: 0.224 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 1.25, grades: { 3: 0.06, 4: 0.075, 5: 0.095, 6: 0.118, 7: 0.15, 8: 0.19, 9: 0.236 } },
    { diaOver: 5.6, diaUpTo: 11.2, pitch: 1.5, grades: { 3: 0.067, 4: 0.085, 5: 0.106, 6: 0.132, 7: 0.17, 8: 0.212, 9: 0.265 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1, grades: { 3: 0.06, 4: 0.075, 5: 0.095, 6: 0.118, 7: 0.15, 8: 0.19, 9: 0.236 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1.25, grades: { 3: 0.067, 4: 0.085, 5: 0.106, 6: 0.132, 7: 0.17, 8: 0.212, 9: 0.265 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1.5, grades: { 3: 0.071, 4: 0.09, 5: 0.112, 6: 0.14, 7: 0.18, 8: 0.224, 9: 0.28 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 1.75, grades: { 3: 0.075, 4: 0.095, 5: 0.118, 6: 0.15, 7: 0.19, 8: 0.236, 9: 0.3 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 2, grades: { 3: 0.08, 4: 0.1, 5: 0.125, 6: 0.16, 7: 0.2, 8: 0.25, 9: 0.315 } },
    { diaOver: 11.2, diaUpTo: 22.4, pitch: 2.5, grades: { 3: 0.085, 4: 0.106, 5: 0.132, 6: 0.17, 7: 0.212, 8: 0.265, 9: 0.335 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 1, grades: { 3: 0.063, 4: 0.08, 5: 0.1, 6: 0.125, 7: 0.16, 8: 0.2, 9: 0.25 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 1.5, grades: { 3: 0.075, 4: 0.095, 5: 0.118, 6: 0.15, 7: 0.19, 8: 0.236, 9: 0.3 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 2, grades: { 3: 0.085, 4: 0.106, 5: 0.132, 6: 0.17, 7: 0.212, 8: 0.265, 9: 0.335 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 3, grades: { 3: 0.1, 4: 0.125, 5: 0.16, 6: 0.2, 7: 0.25, 8: 0.315, 9: 0.4 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 3.5, grades: { 3: 0.106, 4: 0.132, 5: 0.17, 6: 0.212, 7: 0.265, 8: 0.335, 9: 0.425 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 4, grades: { 3: 0.112, 4: 0.14, 5: 0.18, 6: 0.224, 7: 0.28, 8: 0.355, 9: 0.45 } },
    { diaOver: 22.4, diaUpTo: 45, pitch: 4.5, grades: { 3: 0.118, 4: 0.15, 5: 0.19, 6: 0.236, 7: 0.3, 8: 0.375, 9: 0.475 } },
    { diaOver: 45, diaUpTo: 90, pitch: 1.5, grades: { 3: 0.08, 4: 0.1, 5: 0.125, 6: 0.16, 7: 0.2, 8: 0.25, 9: 0.315 } },
    { diaOver: 45, diaUpTo: 90, pitch: 2, grades: { 3: 0.09, 4: 0.112, 5: 0.14, 6: 0.18, 7: 0.224, 8: 0.28, 9: 0.355 } },
    { diaOver: 45, diaUpTo: 90, pitch: 3, grades: { 3: 0.106, 4: 0.132, 5: 0.17, 6: 0.212, 7: 0.265, 8: 0.335, 9: 0.425 } },
    { diaOver: 45, diaUpTo: 90, pitch: 4, grades: { 3: 0.118, 4: 0.15, 5: 0.19, 6: 0.236, 7: 0.3, 8: 0.375, 9: 0.475 } },
    { diaOver: 45, diaUpTo: 90, pitch: 5, grades: { 3: 0.125, 4: 0.16, 5: 0.2, 6: 0.25, 7: 0.315, 8: 0.4, 9: 0.5 } },
    { diaOver: 45, diaUpTo: 90, pitch: 5.5, grades: { 3: 0.132, 4: 0.17, 5: 0.212, 6: 0.265, 7: 0.335, 8: 0.425, 9: 0.53 } },
    { diaOver: 45, diaUpTo: 90, pitch: 6, grades: { 3: 0.14, 4: 0.18, 5: 0.224, 6: 0.28, 7: 0.355, 8: 0.45, 9: 0.56 } },
    { diaOver: 90, diaUpTo: 180, pitch: 2, grades: { 3: 0.095, 4: 0.118, 5: 0.15, 6: 0.19, 7: 0.236, 8: 0.3, 9: 0.375 } },
    { diaOver: 90, diaUpTo: 180, pitch: 3, grades: { 3: 0.112, 4: 0.14, 5: 0.18, 6: 0.224, 7: 0.28, 8: 0.355, 9: 0.45 } },
    { diaOver: 90, diaUpTo: 180, pitch: 4, grades: { 3: 0.125, 4: 0.16, 5: 0.2, 6: 0.25, 7: 0.315, 8: 0.4, 9: 0.5 } },
    { diaOver: 90, diaUpTo: 180, pitch: 6, grades: { 3: 0.15, 4: 0.19, 5: 0.236, 6: 0.3, 7: 0.375, 8: 0.475, 9: 0.6 } },
    { diaOver: 180, diaUpTo: 355, pitch: 3, grades: { 3: 0.125, 4: 0.16, 5: 0.2, 6: 0.25, 7: 0.315, 8: 0.4, 9: 0.5 } },
    { diaOver: 180, diaUpTo: 355, pitch: 4, grades: { 3: 0.14, 4: 0.18, 5: 0.224, 6: 0.28, 7: 0.355, 8: 0.45, 9: 0.56 } },
    { diaOver: 180, diaUpTo: 355, pitch: 6, grades: { 3: 0.16, 4: 0.2, 5: 0.25, 6: 0.315, 7: 0.4, 8: 0.5, 9: 0.63 } }
  ];

  /** Exact-match lookup by pitch; returns null if the pitch isn't tabulated. */
  function findByPitch(table, pitch) {
    for (var i = 0; i < table.length; i++) {
      if (Math.abs(table[i].pitch - pitch) < 1e-9) return table[i];
    }
    return null;
  }

  /**
   * Diameter-range lookup: row applies when diaOver <= majorDia <= diaUpTo
   * (matches the book's "Over ... Up to and including ..." column headers,
   * i.e. exclusive-lower/inclusive-upper for every *interior* boundary --
   * rows are checked in ascending order and the first match wins, so a
   * value exactly on a shared boundary, e.g. 2.8, still resolves to the
   * lower bracket as the standard intends. The lower bound is written
   * inclusive here only so the table's own stated minimum, 1.5mm, is
   * actually reachable -- it would otherwise never match anything.)
   * Returns null if majorDia/pitch fall outside the tabulated ranges.
   */
  function findByDiaRange(table, majorDia, pitch) {
    for (var i = 0; i < table.length; i++) {
      var row = table[i];
      if (row.diaOver <= majorDia && majorDia <= row.diaUpTo && Math.abs(row.pitch - pitch) < 1e-9) {
        return row;
      }
    }
    return null;
  }

  function computeMetricInternal(majorDia, pitch, gradePD, gradeMinor) {
    var t7 = findByPitch(METRIC_TABLE7_ALLOWANCE, pitch);
    if (!t7) return null;
    var basicPD = majorDia - 0.649519 * pitch;
    var EI = t7.EI_H; // Class 6H uses tolerance position H, which is 0 by definition.
    var minMajor = majorDia + EI;
    var minPD = basicPD + EI;
    var td2Row = findByDiaRange(METRIC_TABLE8_TD2_INTERNAL, majorDia, pitch);
    var td2 = td2Row && td2Row.grades[gradePD];
    if (td2 == null) return null;
    var maxPD = minPD + td2;
    var maxMajor = maxPD + 0.793857 * pitch;
    var minMinor = minMajor - 1.082532 * pitch;
    var td1Row = findByPitch(METRIC_TABLE9_TD1_INTERNAL, pitch);
    var td1 = td1Row && td1Row.grades[gradeMinor];
    if (td1 == null) return null;
    var maxMinor = minMinor + td1;
    return {
      minorMin: round(minMinor, 3), minorMax: round(maxMinor, 3),
      pdMin: round(minPD, 3), pdMax: round(maxPD, 3),
      majorMin: round(minMajor, 3), majorMax: round(maxMajor, 3)
    };
  }

  function computeMetricExternal(majorDia, pitch, gradePD, gradeMajorMinor) {
    var t7 = findByPitch(METRIC_TABLE7_ALLOWANCE, pitch);
    if (!t7) return null;
    var es = t7.es_g;
    var maxMajor = majorDia - es;
    var tdRow = findByPitch(METRIC_TABLE10_TD_EXTERNAL, pitch);
    var td = tdRow && tdRow.grades[gradeMajorMinor];
    if (td == null) return null;
    var minMajor = maxMajor - td;
    var basicPD = majorDia - 0.649519 * pitch;
    var maxPD = basicPD - es;
    var td2Row = findByDiaRange(METRIC_TABLE11_TD2_EXTERNAL, majorDia, pitch);
    var td2 = td2Row && td2Row.grades[gradePD];
    if (td2 == null) return null;
    var minPD = maxPD - td2;
    var maxMinorFlat = maxPD - 0.433013 * pitch;
    var minMinorRounded = minPD - 0.616025 * pitch;
    return {
      allowance: round(es, 3),
      majorMax: round(maxMajor, 3), majorMin: round(minMajor, 3),
      pdMax: round(maxPD, 3), pdMin: round(minPD, 3),
      minorMax: round(maxMinorFlat, 3), minorMin: round(minMinorRounded, 3)
    };
  }

  /**
   * Tolerance-class limiting dimensions for a metric M-profile thread,
   * computed from the ISO 965-1 / ANSI-ASME B1.13M general allowance and
   * tolerance-grade formulas (Tables 7-11) -- works for ANY diameter/pitch
   * combination (majorDia 1.5-355mm, pitch 0.2-6mm), not just standard
   * tabulated sizes, unlike calc.unifiedThreadTolerance. Returns null if
   * majorDia/pitch fall outside the tabulated ranges or the class is
   * unsupported.
   * Classes: '6H' (internal, general purpose), '6g' (external, general
   * purpose), '4g6g' (external, precision -- tighter pitch-diameter grade
   * 4 with the same major-diameter grade 6 as 6g; per the standard's
   * compound-class notation, only the pitch-diameter grade differs).
   */
  calc.metricThreadTolerance = function (majorDia, pitch, threadClass) {
    var result;
    if (threadClass === '6H') {
      result = computeMetricInternal(majorDia, pitch, 6, 6);
    } else if (threadClass === '6g') {
      result = computeMetricExternal(majorDia, pitch, 6, 6);
    } else if (threadClass === '4g6g') {
      result = computeMetricExternal(majorDia, pitch, 4, 6);
    } else {
      return null;
    }
    if (!result) return null;
    result.class = threadClass;
    result.external = threadClass !== '6H';
    return result;
  };
  calc.metricThreadToleranceClasses = ['6H', '6g', '4g6g'];

  // ---------------------------------------------------------------------
  // ACME threads (General Purpose, single-start)
  // Standard: ASME/ANSI B1.5-1988. Basic geometry (Table 2a formulas),
  // tolerance-class limiting dimensions (Classes 2G/3G/4G external and
  // internal), and the standard 3-wire measurement formula (29 degree
  // thread, half-angle 14.5 degrees). Class 5G exists in some older
  // reference material but is explicitly "not recommended for new designs"
  // by the current standard, and isn't tabulated in it (no independently
  // verifiable data was available), so only 2G/3G/4G are supported here.
  //
  // Tables 4 and 5 (allowance / pitch-diameter tolerance) are discrete
  // checkpoint lookups, not continuous formulas -- despite each checkpoint
  // value equaling a sqrt(diameter)/sqrt(pitch) formula evaluated at that
  // specific checkpoint (confirmed against the standard's own worked
  // examples), a query value that falls *between* checkpoints does not
  // interpolate: Table 4 uses "over X, up to and including Y" diameter
  // bands, and Table 5 explicitly instructs "for a diameter between two
  // tabulated values, use the increment for the larger" (and, by the same
  // logic applied to pitch, use the coarser of two bracketing pitches).
  // Verified against all 23 standard sizes' worked Table 2b/2c limiting
  // dimensions: 458 of 460 values match exactly, the remaining 2 differing
  // by 0.0001in from a rounding-boundary tie-break (e.g. ...385 rounding to
  // .3238 there vs .3239 here) -- not a formula discrepancy.
  //
  // Two errors were found and corrected relative to a local shop reference
  // spreadsheet used as a starting point: (1) it used "TPI < 10" for the
  // minor/major clearance threshold, but the standard's own worked example
  // (1/2-10 Acme external minor max = 0.3800) only matches "TPI <= 10";
  // (2) it listed 1-1/4in Acme as 4 TPI, but both Table 2b and Table 3
  // confirm 5 TPI (matching that same spreadsheet's own text label, "1
  // 1/4-5 Acme" -- only the numeric TPI cell was wrong).
  // ---------------------------------------------------------------------

  var ACME_TABLE4_ALLOWANCE = [
    { diaAbove: 0, diaUpTo: 0.1875, '2G': 0.0024, '3G': 0.0018, '4G': 0.0012 },
    { diaAbove: 0.1875, diaUpTo: 0.3125, '2G': 0.004, '3G': 0.003, '4G': 0.002 },
    { diaAbove: 0.3125, diaUpTo: 0.4375, '2G': 0.0049, '3G': 0.0037, '4G': 0.0024 },
    { diaAbove: 0.4375, diaUpTo: 0.5625, '2G': 0.0057, '3G': 0.0042, '4G': 0.0028 },
    { diaAbove: 0.5625, diaUpTo: 0.6875, '2G': 0.0063, '3G': 0.0047, '4G': 0.0032 },
    { diaAbove: 0.6875, diaUpTo: 0.8125, '2G': 0.0069, '3G': 0.0052, '4G': 0.0035 },
    { diaAbove: 0.8125, diaUpTo: 0.9375, '2G': 0.0075, '3G': 0.0056, '4G': 0.0037 },
    { diaAbove: 0.9375, diaUpTo: 1.0625, '2G': 0.008, '3G': 0.006, '4G': 0.004 },
    { diaAbove: 1.0625, diaUpTo: 1.1875, '2G': 0.0085, '3G': 0.0064, '4G': 0.0042 },
    { diaAbove: 1.1875, diaUpTo: 1.3125, '2G': 0.0089, '3G': 0.0067, '4G': 0.0045 },
    { diaAbove: 1.3125, diaUpTo: 1.4375, '2G': 0.0094, '3G': 0.007, '4G': 0.0047 },
    { diaAbove: 1.4375, diaUpTo: 1.5625, '2G': 0.0098, '3G': 0.0073, '4G': 0.0049 },
    { diaAbove: 1.5625, diaUpTo: 1.875, '2G': 0.0105, '3G': 0.0079, '4G': 0.0052 },
    { diaAbove: 1.875, diaUpTo: 2.125, '2G': 0.0113, '3G': 0.0085, '4G': 0.0057 },
    { diaAbove: 2.125, diaUpTo: 2.375, '2G': 0.012, '3G': 0.009, '4G': 0.006 },
    { diaAbove: 2.375, diaUpTo: 2.625, '2G': 0.0126, '3G': 0.0095, '4G': 0.0063 },
    { diaAbove: 2.625, diaUpTo: 2.875, '2G': 0.0133, '3G': 0.0099, '4G': 0.0066 },
    { diaAbove: 2.875, diaUpTo: 3.25, '2G': 0.014, '3G': 0.0105, '4G': 0.007 },
    { diaAbove: 3.25, diaUpTo: 3.75, '2G': 0.015, '3G': 0.0112, '4G': 0.0075 },
    { diaAbove: 3.75, diaUpTo: 4.25, '2G': 0.016, '3G': 0.012, '4G': 0.008 },
    { diaAbove: 4.25, diaUpTo: 4.75, '2G': 0.017, '3G': 0.0127, '4G': 0.0085 },
    { diaAbove: 4.75, diaUpTo: 5.5, '2G': 0.0181, '3G': 0.0136, '4G': 0.0091 }
  ];

  var ACME_TABLE5_DIA_INCREMENT = [
    { dia: 0.25, '2G': 0.003, '3G': 0.0014, '4G': 0.001 },
    { dia: 0.3125, '2G': 0.00335, '3G': 0.00157, '4G': 0.00112 },
    { dia: 0.375, '2G': 0.00367, '3G': 0.00171, '4G': 0.00122 },
    { dia: 0.4375, '2G': 0.00397, '3G': 0.00185, '4G': 0.00132 },
    { dia: 0.5, '2G': 0.00424, '3G': 0.00198, '4G': 0.00141 },
    { dia: 0.625, '2G': 0.00474, '3G': 0.00221, '4G': 0.00158 },
    { dia: 0.75, '2G': 0.0052, '3G': 0.00242, '4G': 0.00173 },
    { dia: 0.875, '2G': 0.00561, '3G': 0.00262, '4G': 0.00187 },
    { dia: 1.0, '2G': 0.006, '3G': 0.0028, '4G': 0.002 },
    { dia: 1.125, '2G': 0.00636, '3G': 0.00297, '4G': 0.00212 },
    { dia: 1.25, '2G': 0.00671, '3G': 0.00313, '4G': 0.00224 },
    { dia: 1.375, '2G': 0.00704, '3G': 0.00328, '4G': 0.00235 },
    { dia: 1.5, '2G': 0.00735, '3G': 0.00343, '4G': 0.00245 },
    { dia: 1.75, '2G': 0.00794, '3G': 0.0037, '4G': 0.00265 },
    { dia: 2.0, '2G': 0.00849, '3G': 0.00396, '4G': 0.00283 },
    { dia: 2.25, '2G': 0.009, '3G': 0.0042, '4G': 0.003 },
    { dia: 2.5, '2G': 0.00949, '3G': 0.00443, '4G': 0.00316 },
    { dia: 2.75, '2G': 0.00995, '3G': 0.00464, '4G': 0.00332 },
    { dia: 3.0, '2G': 0.01039, '3G': 0.00485, '4G': 0.00346 },
    { dia: 3.5, '2G': 0.01122, '3G': 0.00524, '4G': 0.00374 },
    { dia: 4.0, '2G': 0.012, '3G': 0.0056, '4G': 0.004 },
    { dia: 4.5, '2G': 0.01273, '3G': 0.00594, '4G': 0.00424 },
    { dia: 5.0, '2G': 0.01342, '3G': 0.00626, '4G': 0.00447 }
  ];

  var ACME_TABLE5_PITCH_INCREMENT = [
    { tpi: 16, '2G': 0.0075, '3G': 0.0035, '4G': 0.0025 },
    { tpi: 14, '2G': 0.00802, '3G': 0.00374, '4G': 0.00267 },
    { tpi: 12, '2G': 0.00866, '3G': 0.00404, '4G': 0.00289 },
    { tpi: 10, '2G': 0.00949, '3G': 0.00443, '4G': 0.00316 },
    { tpi: 8, '2G': 0.01061, '3G': 0.00495, '4G': 0.00354 },
    { tpi: 6, '2G': 0.01225, '3G': 0.00572, '4G': 0.00408 },
    { tpi: 5, '2G': 0.01342, '3G': 0.00626, '4G': 0.00447 },
    { tpi: 4, '2G': 0.015, '3G': 0.007, '4G': 0.005 },
    { tpi: 3, '2G': 0.01732, '3G': 0.00808, '4G': 0.00577 },
    { tpi: 2.5, '2G': 0.01897, '3G': 0.00885, '4G': 0.00632 },
    { tpi: 2, '2G': 0.02121, '3G': 0.0099, '4G': 0.00707 },
    { tpi: 1.5, '2G': 0.02449, '3G': 0.01143, '4G': 0.00816 },
    { tpi: 1.333, '2G': 0.02598, '3G': 0.01212, '4G': 0.00866 },
    { tpi: 1, '2G': 0.03, '3G': 0.014, '4G': 0.01 }
  ];

  /** Standard General Purpose Acme sizes, ASME/ANSI B1.5-1988 Table 3 (1/4in through 5in). */
  calc.acmeThreadSizes = [
    { name: '1/4-16', majorDia: 0.25, tpi: 16 },
    { name: '5/16-14', majorDia: 0.3125, tpi: 14 },
    { name: '3/8-12', majorDia: 0.375, tpi: 12 },
    { name: '7/16-12', majorDia: 0.4375, tpi: 12 },
    { name: '1/2-10', majorDia: 0.5, tpi: 10 },
    { name: '5/8-8', majorDia: 0.625, tpi: 8 },
    { name: '3/4-6', majorDia: 0.75, tpi: 6 },
    { name: '7/8-6', majorDia: 0.875, tpi: 6 },
    { name: '1-5', majorDia: 1.0, tpi: 5 },
    { name: '1 1/8-5', majorDia: 1.125, tpi: 5 },
    { name: '1 1/4-5', majorDia: 1.25, tpi: 5 },
    { name: '1 3/8-4', majorDia: 1.375, tpi: 4 },
    { name: '1 1/2-4', majorDia: 1.5, tpi: 4 },
    { name: '1 3/4-4', majorDia: 1.75, tpi: 4 },
    { name: '2-4', majorDia: 2.0, tpi: 4 },
    { name: '2 1/4-3', majorDia: 2.25, tpi: 3 },
    { name: '2 1/2-3', majorDia: 2.5, tpi: 3 },
    { name: '2 3/4-3', majorDia: 2.75, tpi: 3 },
    { name: '3-2', majorDia: 3.0, tpi: 2 },
    { name: '3 1/2-2', majorDia: 3.5, tpi: 2 },
    { name: '4-2', majorDia: 4.0, tpi: 2 },
    { name: '4 1/2-2', majorDia: 4.5, tpi: 2 },
    { name: '5-2', majorDia: 5.0, tpi: 2 }
  ];

  /**
   * Basic (theoretical) diameters for a General Purpose Acme thread.
   * Standard: ASME/ANSI B1.5-1988, Table 2a.
   * E (basic pitch dia) = D - 0.5P; K (basic minor dia) = D - P.
   */
  calc.acmeThreadGeometry = function (opts) {
    var D = opts.majorDia, tpi = opts.tpi;
    var P = 1 / tpi;
    var basicPD = D - 0.5 * P;
    var basicMinor = D - P;
    return {
      pitch: round(P, 4),
      threadHeight: round(P / 2, 4),
      majorDia: round(D, 4),
      pitchDia: round(basicPD, 4),
      minorDia: round(basicMinor, 4)
    };
  };

  /** Table 4 lookup: diaAbove < D <= diaUpTo (checked in ascending order, "over X to including Y"). */
  function acmeAllowance(cls, D) {
    for (var i = 0; i < ACME_TABLE4_ALLOWANCE.length; i++) {
      var row = ACME_TABLE4_ALLOWANCE[i];
      if (row.diaAbove < D && D <= row.diaUpTo) return row[cls];
    }
    return null;
  }

  /** Table 5 diameter-increment: "use the increment for the larger of two tabulated diameters" -- ceiling lookup. */
  function acmeDiaIncrement(cls, D) {
    for (var i = 0; i < ACME_TABLE5_DIA_INCREMENT.length; i++) {
      var row = ACME_TABLE5_DIA_INCREMENT[i];
      if (D <= row.dia + 1e-9) return row[cls];
    }
    return null;
  }

  /** Table 5 pitch-increment: "use the coarser pitch" for a TPI between two tabulated values -- floor lookup on TPI. */
  function acmePitchIncrement(cls, tpi) {
    // The table's finest tabulated pitch is 16 TPI; a finer query has no coarser checkpoint to
    // floor down to and must not silently reuse the 16 TPI row for it.
    if (tpi > ACME_TABLE5_PITCH_INCREMENT[0].tpi + 1e-9) return null;
    for (var i = 0; i < ACME_TABLE5_PITCH_INCREMENT.length; i++) {
      var row = ACME_TABLE5_PITCH_INCREMENT[i];
      if (row.tpi <= tpi + 1e-9) return row[cls];
    }
    return null;
  }

  function acmePdTolerance(cls, D, tpi) {
    var diaInc = acmeDiaIncrement(cls, D);
    var pitchInc = acmePitchIncrement(cls, tpi);
    if (diaInc == null || pitchInc == null) return null;
    return diaInc + pitchInc;
  }

  /**
   * Tolerance-class limiting dimensions for a General Purpose Acme thread.
   * Standard: ASME/ANSI B1.5-1988, Table 2a formulas with Tables 4/5 data.
   * Works for any major diameter in (0, 5.0in] and any TPI in [1, 16] --
   * not just calc.acmeThreadSizes' 23 standard sizes. Note this is Table
   * 5's limit (its diameter checkpoints stop at 5.0in), narrower than
   * Table 4's allowance data alone (which reaches 5.5in) -- without a
   * matching Table 5 checkpoint, a diameter in (5.0, 5.5] can't produce a
   * verified pitch-diameter tolerance, so it's treated as out of range
   * here too rather than silently using an under-specified value. Returns
   * null outside that range or for an unsupported class (only
   * '2G'/'3G'/'4G'; see file-header comment on Class 5G).
   * `external` selects which mating half's limits to return; the
   * stressArea field (external only) is the standard's tensile stress
   * area, computed from the mean of pdMin and minorMax.
   */
  calc.acmeThreadTolerance = function (majorDia, tpi, threadClass, external) {
    if (threadClass !== '2G' && threadClass !== '3G' && threadClass !== '4G') return null;
    var P = 1 / tpi;
    var E = majorDia - 0.5 * P; // basic pitch dia
    var K = majorDia - P; // basic minor dia
    var fixedClearance = Math.max(0.05 * P, 0.005);
    var majorClearance = tpi <= 10 ? 0.020 : 0.010;
    var tol = acmePdTolerance(threadClass, majorDia, tpi);
    var allow = acmeAllowance(threadClass, majorDia);
    if (tol == null || allow == null) return null;

    if (external) {
      var extMajorMax = majorDia;
      var extMajorMin = round(majorDia - fixedClearance, 4);
      var extMinorMax = round(K - majorClearance, 4);
      var extMinorMin = round(extMinorMax - 1.5 * tol, 4);
      var extPdMax = round(E - allow, 4);
      var extPdMin = round(extPdMax - tol, 4);
      var stressArea = round(Math.PI / 4 * Math.pow((extPdMin + extMinorMax) / 2, 2), 5);
      return {
        class: threadClass, external: true,
        majorMax: round(extMajorMax, 4), majorMin: extMajorMin,
        pdMax: extPdMax, pdMin: extPdMin,
        minorMax: extMinorMax, minorMin: extMinorMin,
        stressArea: stressArea
      };
    }
    var intMajorMin = round(majorDia + majorClearance, 4);
    var intMajorMax = round(intMajorMin + majorClearance, 4);
    var intMinorMin = round(K, 4);
    var intMinorMax = round(intMinorMin + fixedClearance, 4);
    var intPdMin = round(E, 4);
    var intPdMax = round(intPdMin + tol, 4);
    return {
      class: threadClass, external: false,
      majorMin: intMajorMin, majorMax: intMajorMax,
      pdMin: intPdMin, pdMax: intPdMax,
      minorMin: intMinorMin, minorMax: intMinorMax
    };
  };
  calc.acmeThreadToleranceClasses = ['2G', '3G', '4G'];

  /**
   * Measurement-over-wires for a 3-wire Acme thread check.
   * Standard: general 3-wire formula for a 29-degree thread (14.5-degree
   * half-angle): M = E + W(1 + csc(14.5°)) − 0.5P·cot(14.5°), which reduces
   * to the constants below (verified against Machinery's Handbook: matches
   * to 5 decimal places). Accepts any wire diameter -- there's no single
   * "correct" wire size, just whatever gauge wire/pins are on hand.
   */
  calc.acmeMeasurementOverWires = function (pdMax, pdMin, pitch, wireDia) {
    var adjustment = 4.9939 * wireDia - 1.933357 * pitch;
    return {
      max: round(pdMax + adjustment, 4),
      min: round(pdMin + adjustment, 4)
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
