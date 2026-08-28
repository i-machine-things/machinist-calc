'use strict';

/*
 * Dependency-free test runner for the calc-core engine.
 * Run with: node tests/run.js
 */

const assert = require('assert');
const calc = require('../src/js/calc-core.js');

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    failures.push({ name: name, error: err });
  }
}

function approx(actual, expected, tol, msg) {
  tol = tol == null ? 1e-4 : tol;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    (msg || '') + ` expected ${actual} to be within ${tol} of ${expected}`
  );
}

// -------------------------------------------------------------------------
// Tap drills — spot-checked against the universally-cited standard tap
// drill sizes for UNC threads (ASME B1.1, 75% thread engagement).
// -------------------------------------------------------------------------

test('tapDrillImperial: 1/4-20 UNC -> #7 drill', () => {
  const r = calc.tapDrillImperial({ majorDia: 0.25, tpi: 20 });
  approx(r.drillDecimal, 0.2013, 0.0001);
  assert.strictEqual(r.nearestDrill.name, '#7');
});

test('tapDrillImperial: 3/8-16 UNC -> 5/16" drill', () => {
  const r = calc.tapDrillImperial({ majorDia: 0.375, tpi: 16 });
  approx(r.drillDecimal, 0.3141, 0.0001);
  assert.strictEqual(r.nearestDrill.name, '5/16"');
});

test('tapDrillImperial: 1/2-13 UNC -> 27/64" drill', () => {
  const r = calc.tapDrillImperial({ majorDia: 0.5, tpi: 13 });
  approx(r.drillDecimal, 0.4251, 0.0001);
  assert.strictEqual(r.nearestDrill.name, '27/64"');
});

test('tapDrillImperial: percentThread scales linearly from the 75% anchor', () => {
  const r50 = calc.tapDrillImperial({ majorDia: 0.5, tpi: 13, percentThread: 50 });
  const r75 = calc.tapDrillImperial({ majorDia: 0.5, tpi: 13, percentThread: 75 });
  // Lower % thread engagement -> larger (looser) drill.
  assert.ok(r50.drillDecimal > r75.drillDecimal);
});

test('tapDrillMetric: M6x1.0 at 75% thread', () => {
  const r = calc.tapDrillMetric({ majorDia: 6, pitch: 1.0 });
  approx(r.drillMm, 5.188, 0.001);
});

test('tapDrillMetric: 100% thread matches ISO 68-1 internal minor diameter', () => {
  // Cross-check two independently-written functions that should agree on
  // the D1 = D - 1.08253*P internal minor diameter at 100% engagement.
  const drill100 = calc.tapDrillMetric({ majorDia: 10, pitch: 1.5, percentThread: 100 });
  const geom = calc.metricThreadGeometry({ majorDia: 10, pitch: 1.5 });
  approx(drill100.drillMm, geom.internal.minorDia, 0.002);
  approx(drill100.drillMm, 8.376, 0.001);
});

// -------------------------------------------------------------------------
// Thread geometry (ASME B1.1 / ISO 68-1 basic profile)
// -------------------------------------------------------------------------

test('unifiedThreadGeometry: 1/2-13 UNC basic pitch diameter is 0.4500"', () => {
  const g = calc.unifiedThreadGeometry({ majorDia: 0.5, tpi: 13 });
  approx(g.external.pitchDia, 0.45, 0.0001);
  approx(g.pitch, 1 / 13, 0.00001);
});

test('unifiedThreadGeometry: basic internal major diameter equals the basic major diameter D', () => {
  // Regression test — a fabricated "D - 0.108253*P" decrement was caught in
  // review; at the basic (theoretical, zero-tolerance) profile, internal and
  // external major diameters coincide at D by definition (ASME B1.1).
  const g = calc.unifiedThreadGeometry({ majorDia: 0.5, tpi: 13 });
  approx(g.internal.majorDiaMin, 0.5, 1e-9);
});

test('metricThreadGeometry: M10x1.5 pitch diameter and minor diameters', () => {
  const g = calc.metricThreadGeometry({ majorDia: 10, pitch: 1.5 });
  approx(g.external.pitchDia, 10 - 0.649519 * 1.5, 0.0005);
  approx(g.internal.minorDia, 10 - 1.082532 * 1.5, 0.0005);
  approx(g.external.minorDia, 10 - 1.226869 * 1.5, 0.0005);
});

// -------------------------------------------------------------------------
// Thread tolerance classes
// Unified (ASME B1.1) values spot-checked against Machinery's Handbook 26th
// ed. Table 3. Metric (ISO 965-1 / ANSI-ASME B1.13M) values spot-checked
// against Table 12/13 (standard-size precomputed 6H/6g/4g6g limits) — the
// metric implementation was independently cross-validated by recomputing
// all of Table 12/13 (33 internal + 67 external rows, sizes M1.6-M30) from
// the Table 7-11 formulas and finding 0 discrepancies >0.0015mm.
// -------------------------------------------------------------------------

test('unifiedThreadTolerance: 1/4-20 UNC Class 2A (external)', () => {
  const t = calc.unifiedThreadTolerance('1/4-20', '2A');
  assert.strictEqual(t.class, '2A');
  assert.strictEqual(t.external, true);
  approx(t.allowance, 0.0011, 1e-4);
  approx(t.majorMax, 0.2489, 1e-4);
  approx(t.majorMin, 0.2408, 1e-4);
  approx(t.pdMax, 0.2164, 1e-4);
  approx(t.pdMin, 0.2127, 1e-4);
});

test('unifiedThreadTolerance: 1/4-20 UNC Class 2B (internal)', () => {
  const t = calc.unifiedThreadTolerance('1/4-20', '2B');
  assert.strictEqual(t.external, false);
  approx(t.pdMin, 0.2175, 1e-4);
  approx(t.pdMax, 0.2224, 1e-4);
  approx(t.majorMin, 0.25, 1e-4);
});

test('unifiedThreadTolerance: Class 1A/1B is only tabulated for 1/4" and larger', () => {
  assert.strictEqual(calc.unifiedThreadTolerance('#0-80', '1A'), null);
  assert.strictEqual(calc.unifiedThreadTolerance('#0-80', '1B'), null);
  assert.ok(calc.unifiedThreadTolerance('1/4-20', '1A'));
  assert.ok(calc.unifiedThreadTolerance('1/4-20', '1B'));
});

test('unifiedThreadTolerance: unknown size or class returns null', () => {
  assert.strictEqual(calc.unifiedThreadTolerance('M6x1.0', '2A'), null);
  assert.strictEqual(calc.unifiedThreadTolerance('1/4-20', '5A'), null);
});

test('unifiedThreadToleranceClasses: reflects the 1A/1B tabulation cutoff', () => {
  assert.deepStrictEqual(calc.unifiedThreadToleranceClasses('#0-80'), ['2A', '3A', '2B', '3B']);
  assert.deepStrictEqual(
    calc.unifiedThreadToleranceClasses('1/4-20'),
    ['1A', '2A', '3A', '1B', '2B', '3B']
  );
});

test('unifiedMeasurementOverWires: 1/2-13 UNC Class 2A matches the ASME B1.2 / Machinery\'s Handbook 60-degree formula', () => {
  // M = E - 0.86603P + 3W, applied to Class 2A's own pdMax/pdMin (verified elsewhere).
  const t = calc.unifiedThreadTolerance('1/2-13', '2A');
  const m = calc.unifiedMeasurementOverWires(t.pdMax, t.pdMin, 13, 0.0505);
  approx(m.max, 0.5334, 1e-4);
  approx(m.min, 0.5284, 1e-4);
});

test('metricThreadTolerance: M10x1.5 Class 6H (internal) matches Machinery\'s Handbook Table 12', () => {
  const t = calc.metricThreadTolerance(10, 1.5, '6H');
  assert.strictEqual(t.external, false);
  approx(t.minorMin, 8.376, 0.002);
  approx(t.minorMax, 8.676, 0.002);
  approx(t.pdMin, 9.026, 0.002);
  approx(t.pdMax, 9.206, 0.002);
  approx(t.majorMin, 10.0, 0.002);
  approx(t.majorMax, 10.396, 0.002);
});

test('metricThreadTolerance: M10x1.5 Class 6g (external) matches Table 13', () => {
  const t = calc.metricThreadTolerance(10, 1.5, '6g');
  assert.strictEqual(t.external, true);
  approx(t.allowance, 0.032, 0.002);
  approx(t.majorMax, 9.968, 0.002);
  approx(t.majorMin, 9.732, 0.002);
  approx(t.pdMax, 8.994, 0.002);
  approx(t.pdMin, 8.862, 0.002);
});

test('metricThreadTolerance: M10x1.5 Class 4g6g (external) matches Table 13', () => {
  const t = calc.metricThreadTolerance(10, 1.5, '4g6g');
  approx(t.pdMax, 8.994, 0.002);
  approx(t.pdMin, 8.909, 0.002);
  // 4g6g and 6g share the same major-diameter grade (6) -- only the
  // pitch-diameter grade differs (4 vs 6) per the standard's compound-class
  // notation, so major-diameter limits must match the 6g class exactly.
  const g6 = calc.metricThreadTolerance(10, 1.5, '6g');
  approx(t.majorMax, g6.majorMax, 1e-9);
  approx(t.majorMin, g6.majorMin, 1e-9);
});

test('metricThreadTolerance: M30x3.5 Class 6H matches Table 12 at the largest supported standard size', () => {
  const t = calc.metricThreadTolerance(30, 3.5, '6H');
  approx(t.pdMin, 27.727, 0.002);
  approx(t.pdMax, 28.007, 0.002);
  approx(t.majorMax, 30.785, 0.002);
});

test('metricThreadTolerance: works for a non-standard "odd" size/pitch not in calc.metricThreadSizes', () => {
  // M11x1.5 isn't a standard tabulated size, but the diameter (11mm) falls
  // within Table 8/11's 5.6-11.2mm range and the pitch (1.5mm) is tabulated,
  // so the general formula path should still resolve it.
  const t = calc.metricThreadTolerance(11, 1.5, '6H');
  assert.ok(t);
  approx(t.majorMin, 11, 1e-9);
  assert.ok(t.pdMax > t.pdMin);
});

test('metricThreadTolerance: out-of-range diameter/pitch returns null rather than extrapolating', () => {
  assert.strictEqual(calc.metricThreadTolerance(500, 8, '6H'), null);
});

test('metricThreadTolerance: the documented 1.5mm lower diameter bound is actually reachable', () => {
  // Regression test -- findByDiaRange used an exclusive lower bound (diaOver < majorDia), so a
  // diameter of exactly 1.5mm (the table's own stated minimum, and the app's documented lower
  // bound) fell through every bracket and returned null. Caught by CodeRabbit.
  const internal = calc.metricThreadTolerance(1.5, 0.35, '6H');
  const external = calc.metricThreadTolerance(1.5, 0.35, '6g');
  assert.ok(internal, 'expected 1.5mm internal to resolve, not fall through to null');
  assert.ok(external, 'expected 1.5mm external to resolve, not fall through to null');
  approx(internal.majorMin, 1.5, 1e-9);
});

test('metricThreadTolerance: a diameter exactly on a shared bracket boundary still resolves to the lower bracket', () => {
  // 2.8mm is the boundary between the (1.5,2.8] and (2.8,5.6] Table 8/11 brackets, which have
  // different tolerance values at the same pitch -- confirms the fix for the test above (using
  // <= for the lower bound too) didn't also make the *upper* bracket match early.
  const atBoundary = calc.metricThreadTolerance(2.8, 0.35, '6H');
  const justBelow = calc.metricThreadTolerance(2.79, 0.35, '6H');
  const justAbove = calc.metricThreadTolerance(2.81, 0.35, '6H');
  approx(atBoundary.pdMax - justBelow.pdMax, 0.01, 0.002, 'boundary value should track the lower bracket');
  assert.ok(
    Math.abs(atBoundary.pdMax - justBelow.pdMax) < Math.abs(atBoundary.pdMax - justAbove.pdMax),
    'boundary value should be closer to the lower-bracket neighbor than the upper-bracket one'
  );
});

test('metricThreadTolerance: unknown class returns null', () => {
  assert.strictEqual(calc.metricThreadTolerance(10, 1.5, '6X'), null);
});

test('metricMeasurementOverWires: M10x1.5 Class 6g matches the same 60-degree formula as unifiedMeasurementOverWires', () => {
  // Machinery's Handbook: "International Standard: use the formula given above for the American
  // National Standard Unified Thread" -- metric M-profile shares the same 60-degree formula.
  const t = calc.metricThreadTolerance(10, 1.5, '6g');
  const m = calc.metricMeasurementOverWires(t.pdMax, t.pdMin, 1.5, 0.866);
  approx(m.max, 10.293, 1e-3);
  approx(m.min, 10.161, 1e-3);
});

// -------------------------------------------------------------------------
// ACME threads (General Purpose, single-start)
// Spot-checked against Machinery's Handbook 26th ed. Tables 2b/2c (worked
// limiting dimensions for all 23 standard sizes, ASME/ANSI B1.5-1988) and
// Table 3 (basic geometry). Includes regression tests for two errors found
// and corrected relative to a local reference spreadsheet used as a
// starting point (see calc-core.js's ACME section header comment).
// -------------------------------------------------------------------------

test('acmeThreadGeometry: 1/4-16 Acme basic diameters match Table 3', () => {
  const g = calc.acmeThreadGeometry({ majorDia: 0.25, tpi: 16 });
  approx(g.pitch, 0.0625, 1e-4);
  approx(g.pitchDia, 0.2188, 1e-4);
  approx(g.minorDia, 0.1875, 1e-4);
});

test('acmeThreadTolerance: 1/4-16 Acme Class 2G external matches Table 2b', () => {
  const t = calc.acmeThreadTolerance(0.25, 16, '2G', true);
  assert.strictEqual(t.external, true);
  approx(t.majorMax, 0.2500, 1e-4);
  approx(t.majorMin, 0.2450, 1e-4);
  approx(t.pdMax, 0.2148, 1e-4);
  approx(t.pdMin, 0.2043, 1e-4);
  approx(t.minorMax, 0.1775, 1e-4);
  approx(t.minorMin, 0.1618, 1e-4);
});

test('acmeThreadTolerance: 1/4-16 Acme Class 2G internal matches Table 2b', () => {
  const t = calc.acmeThreadTolerance(0.25, 16, '2G', false);
  assert.strictEqual(t.external, false);
  approx(t.majorMin, 0.2600, 1e-4);
  approx(t.majorMax, 0.2700, 1e-4);
  approx(t.pdMin, 0.2188, 1e-4);
  approx(t.pdMax, 0.2293, 1e-4);
  approx(t.minorMin, 0.1875, 1e-4);
  approx(t.minorMax, 0.1925, 1e-4);
});

test('acmeThreadTolerance: 1/2-10 Acme external minor max is 0.3800, not 0.39 (TPI<=10 boundary regression)', () => {
  // Regression test -- a local reference spreadsheet used "TPI < 10" for the minor/major
  // diameter clearance threshold (0.020 vs 0.010), so an exact TPI of 10 fell through to the
  // wrong (finer-pitch) value. The standard's own worked example proves TPI<=10 is correct.
  const t = calc.acmeThreadTolerance(0.5, 10, '2G', true);
  approx(t.minorMax, 0.3800, 1e-4);
});

test('acmeThreadTolerance: 1-1/4in Acme is 5 TPI, not 4 (matches calc.acmeThreadSizes and Table 2b/3)', () => {
  // Regression test -- the same reference spreadsheet's "1 1/4-5 Acme" row used TPI=4 in its
  // formulas despite its own label saying "-5"; both Table 2b and Table 3 confirm 5 TPI.
  const size = calc.acmeThreadSizes.find((s) => s.name === '1 1/4-5');
  assert.strictEqual(size.tpi, 5);
  const t = calc.acmeThreadTolerance(1.25, 5, '2G', true);
  approx(t.majorMin, 1.2400, 1e-4);
  approx(t.minorMax, 1.0300, 1e-4);
});

test('acmeThreadTolerance: 5-2 Acme (largest standard size) matches Table 2c', () => {
  const ext = calc.acmeThreadTolerance(5.0, 2, '2G', true);
  const int = calc.acmeThreadTolerance(5.0, 2, '2G', false);
  approx(ext.majorMin, 4.9750, 1e-4);
  approx(ext.minorMax, 4.4800, 1e-4);
  approx(int.majorMin, 5.0200, 1e-4);
  approx(int.majorMax, 5.0400, 1e-4);
});

test('acmeThreadTolerance: Class 3G and 4G external pitch diameters match Table 2b (5/16-14 Acme)', () => {
  const g3 = calc.acmeThreadTolerance(0.3125, 14, '3G', true);
  const g4 = calc.acmeThreadTolerance(0.3125, 14, '4G', true);
  approx(g3.pdMax, 0.2738, 1e-4);
  approx(g3.pdMin, 0.2685, 1e-4);
  approx(g4.pdMax, 0.2748, 1e-4);
  approx(g4.pdMin, 0.2710, 1e-4);
});

test('acmeThreadTolerance: out-of-range diameter/pitch returns null rather than extrapolating', () => {
  assert.strictEqual(calc.acmeThreadTolerance(0, 16, '2G', true), null);
  assert.strictEqual(calc.acmeThreadTolerance(10, 16, '2G', true), null);
  assert.strictEqual(calc.acmeThreadTolerance(0.5, 20, '2G', true), null);
});

test('acmeThreadTolerance: 5.0in is the largest diameter with verified tolerance data, not 5.5in', () => {
  // Table 4 (allowance) alone reaches 5.5in, but Table 5's diameter checkpoints (needed for the
  // pitch-diameter tolerance) stop at 5.0in, as does every worked example in Table 2b/2c -- so a
  // diameter in (5.0, 5.5] has no verified tolerance and must not silently combine Table 4's
  // reach with an under-specified Table 5 value. Caught by CodeRabbit.
  assert.ok(calc.acmeThreadTolerance(5.0, 2, '2G', true));
  assert.strictEqual(calc.acmeThreadTolerance(5.25, 2, '2G', true), null);
  assert.strictEqual(calc.acmeThreadTolerance(5.5, 2, '2G', true), null);
});

test('acmeThreadTolerance: unsupported class (e.g. legacy 5G) returns null', () => {
  assert.strictEqual(calc.acmeThreadTolerance(0.5, 10, '5G', true), null);
});

test('acmeMeasurementOverWires: 1/4-16 Acme 2G external with a 0.04in wire matches the reference spreadsheet', () => {
  const t = calc.acmeThreadTolerance(0.25, 16, '2G', true);
  const m = calc.acmeMeasurementOverWires(t.pdMax, t.pdMin, 1 / 16, 0.04);
  approx(m.max, 0.2937, 1e-4);
  approx(m.min, 0.2832, 1e-4);
});

// -------------------------------------------------------------------------
// Speeds & feeds
// -------------------------------------------------------------------------

test('rpmFromSfm / sfmFromRpm round-trip', () => {
  const rpm = calc.rpmFromSfm(100, 0.5);
  approx(rpm, 764, 1);
  const sfm = calc.sfmFromRpm(rpm, 0.5);
  approx(sfm, 100, 0.5);
});

test('rpmFromSmm', () => {
  approx(calc.rpmFromSmm(30, 10), 955, 1);
});

test('feedRate', () => {
  approx(calc.feedRate(1000, 0.002, 4), 8, 0.0001);
});

test('feedPerRev', () => {
  approx(calc.feedPerRev(0.002, 4), 0.008, 0.00001);
});

test('mrr', () => {
  approx(calc.mrr(8, 0.1, 0.5), 0.4, 0.0001);
});

test('recommendedSfm: every row has ordered HSS/carbide ranges, carbide faster than HSS', () => {
  assert.ok(calc.recommendedSfm.length > 0);
  for (const row of calc.recommendedSfm) {
    assert.ok(typeof row.material === 'string' && row.material.length > 0);
    assert.ok(row.hss[0] < row.hss[1], `${row.material}: hss range out of order`);
    assert.ok(row.carbide[0] < row.carbide[1], `${row.material}: carbide range out of order`);
    assert.ok(row.carbide[0] >= row.hss[0], `${row.material}: carbide should cut faster than HSS`);
  }
});

test('recommendedSfm: Inconel HSS range matches Machinery\'s Handbook Table 9 and is slower than titanium', () => {
  const inconel = calc.recommendedSfm.find((r) => r.material.indexOf('Inconel') !== -1);
  assert.ok(inconel, 'expected an Inconel/nickel-superalloy row');
  approx(inconel.hss[0], 15, 1e-9);
  approx(inconel.hss[1], 35, 1e-9);
  const titanium = calc.recommendedSfm.find((r) => r.material.indexOf('Titanium') !== -1);
  assert.ok(inconel.carbide[1] <= titanium.carbide[1], 'Inconel should not out-cut titanium on carbide');
});

// -------------------------------------------------------------------------
// Bolt circle
// -------------------------------------------------------------------------

test('boltCirclePoints: 4 holes on a 10" BCD starting at top, clockwise', () => {
  const pts = calc.boltCirclePoints({ bcd: 10, count: 4, startAngleDeg: 90, clockwise: true });
  assert.strictEqual(pts.length, 4);
  approx(pts[0].x, 0, 1e-3); approx(pts[0].y, 5, 1e-3);
  approx(pts[1].x, 5, 1e-3); approx(pts[1].y, 0, 1e-3);
  approx(pts[2].x, 0, 1e-3); approx(pts[2].y, -5, 1e-3);
  approx(pts[3].x, -5, 1e-3); approx(pts[3].y, 0, 1e-3);
});

// -------------------------------------------------------------------------
// Right triangle solver
// -------------------------------------------------------------------------

test('rightTriangleSolve: legs a=3, b=4 -> classic 3-4-5 triangle', () => {
  const r = calc.rightTriangleSolve({ a: 3, b: 4 });
  approx(r.c, 5, 1e-4);
  approx(r.angleADeg, 36.8699, 1e-3);
  approx(r.angleBDeg, 53.1301, 1e-3);
});

test('rightTriangleSolve: leg a and hypotenuse c -> solves b and both angles', () => {
  const r = calc.rightTriangleSolve({ a: 3, c: 5 });
  approx(r.b, 4, 1e-4);
  approx(r.angleADeg, 36.8699, 1e-3);
});

test('rightTriangleSolve: leg b and hypotenuse c -> solves a and both angles', () => {
  const r = calc.rightTriangleSolve({ b: 4, c: 5 });
  approx(r.a, 3, 1e-4);
  approx(r.angleBDeg, 53.1301, 1e-3);
});

test('rightTriangleSolve: leg a and angle A -> solves b and c', () => {
  const r = calc.rightTriangleSolve({ a: 3, angleADeg: 36.8699 });
  approx(r.b, 4, 1e-3);
  approx(r.c, 5, 1e-3);
});

test('rightTriangleSolve: leg b and angle A -> solves a and c', () => {
  const r = calc.rightTriangleSolve({ b: 4, angleADeg: 36.8699 });
  approx(r.a, 3, 1e-3);
  approx(r.c, 5, 1e-3);
});

test('rightTriangleSolve: hypotenuse c and angle A -> solves both legs', () => {
  const r = calc.rightTriangleSolve({ c: 10, angleADeg: 30 });
  approx(r.a, 5, 1e-3);
  approx(r.b, 8.6603, 1e-3);
});

test('rightTriangleSolve: rejects a count other than exactly 2 knowns', () => {
  assert.throws(() => calc.rightTriangleSolve({ a: 3 }), RangeError);
  assert.throws(() => calc.rightTriangleSolve({ a: 3, b: 4, c: 5 }), RangeError);
});

test('rightTriangleSolve: angle A alone (no side) does not determine size', () => {
  assert.throws(() => calc.rightTriangleSolve({ angleADeg: 30 }), RangeError);
});

test('rightTriangleSolve: rejects a leg that is not shorter than the given hypotenuse', () => {
  assert.throws(() => calc.rightTriangleSolve({ a: 6, c: 5 }), RangeError);
});

test('rightTriangleSolve: rejects non-finite inputs', () => {
  assert.throws(() => calc.rightTriangleSolve({ a: Infinity, b: 4 }), RangeError);
  assert.throws(() => calc.rightTriangleSolve({ a: NaN, c: 5 }), RangeError);
});

test('rightTriangleSolve: rejects a non-number angleADeg (e.g. a string) instead of coercing it', () => {
  // '30' <= 0 / '30' >= 90 coerce and pass the bounds check even though '30' isn't a number;
  // Number.isFinite('30') is false and must be checked explicitly, same as the a/b/c guards.
  assert.throws(() => calc.rightTriangleSolve({ a: 3, angleADeg: '30' }), RangeError);
});

test('rightTriangleSolve: large finite legs/hypotenuse do not overflow to Infinity/NaN', () => {
  // sqrt(a*a + b*b) would overflow a=b=1e200 to Infinity before sqrt ever runs (1e200^2 alone
  // exceeds Number.MAX_VALUE); Math.hypot avoids that. Scale down to check the answer's shape.
  const legs = calc.rightTriangleSolve({ a: 1e200, b: 1e200 });
  assert.ok(Number.isFinite(legs.c));
  approx(legs.c / 1e200, Math.sqrt(2), 1e-9);
  approx(legs.angleADeg, 45, 1e-6);

  const legHyp = calc.rightTriangleSolve({ a: 6e199, c: 1e200 });
  assert.ok(Number.isFinite(legHyp.b));
  approx(legHyp.b / 1e200, Math.sqrt(1 - 0.6 * 0.6), 1e-6);
});

test('rightTriangleSolve: rejects inputs so extreme that even the safe formulas cannot round', () => {
  // a=b=1e308 solves to a finite c via Math.hypot, but round(c, 5) multiplies by 1e5 internally,
  // which overflows c back to Infinity -- must throw rather than return a non-finite result.
  assert.throws(() => calc.rightTriangleSolve({ a: 1e308, b: 1e308 }), RangeError);
});

// -------------------------------------------------------------------------
// True position (ASME Y14.5)
// -------------------------------------------------------------------------

test('truePosition', () => {
  const r = calc.truePosition({ actualX: 0.502, basicX: 0.5, actualY: 0.499, basicY: 0.5 });
  approx(r.truePosition, 0.004472, 0.00001);
});

test('bonusTolerance: internal feature (hole) grows above MMC', () => {
  approx(calc.bonusTolerance(0.257, 0.25, 'internal'), 0.007, 0.0001);
});

test('bonusTolerance: internal feature at/below MMC gets no bonus (clamped to 0)', () => {
  approx(calc.bonusTolerance(0.248, 0.25, 'internal'), 0, 0.0001);
});

test('bonusTolerance: external feature (shaft) shrinks below MMC', () => {
  approx(calc.bonusTolerance(0.245, 0.25, 'external'), 0.005, 0.0001);
});

test('bonusTolerance: external feature at/above MMC gets no bonus (clamped to 0)', () => {
  approx(calc.bonusTolerance(0.252, 0.25, 'external'), 0, 0.0001);
});

test('bonusTolerance: rejects an unsupported featureType instead of silently defaulting', () => {
  assert.throws(() => calc.bonusTolerance(0.257, 0.25, 'hole'), RangeError);
  assert.throws(() => calc.bonusTolerance(0.257, 0.25, undefined), RangeError);
});

// -------------------------------------------------------------------------
// Surface finish
// -------------------------------------------------------------------------

test('surfaceFinishRaImperial', () => {
  approx(calc.surfaceFinishRaImperial(0.008, 0.032), 62.5, 0.1);
});

test('surfaceFinishRaMetric', () => {
  approx(calc.surfaceFinishRaMetric(0.2, 0.8), 1.563, 0.001);
});

// -------------------------------------------------------------------------
// ISO tolerance (ISO 286-1)
// -------------------------------------------------------------------------

test('isoFundamentalTolerance: IT7 near the 6-10mm range is close to the published 15um value', () => {
  const r = calc.isoFundamentalTolerance(10, 'IT7');
  approx(r.toleranceUm, 15.67, 0.5);
});

test('limits: bilateral tolerance', () => {
  const r = calc.limits({ nominal: 10, upperTol: 0.05, lowerTol: 0.02 });
  approx(r.maxLimit, 10.05, 0.0001);
  approx(r.minLimit, 9.98, 0.0001);
  approx(r.totalTolerance, 0.07, 0.0001);
  approx(r.midpoint, 10.015, 0.0001);
});

// -------------------------------------------------------------------------
// Unit conversion
// -------------------------------------------------------------------------

test('convertLength: in <-> mm exact (1in = 25.4mm)', () => {
  approx(calc.convertLength(1, 'in', 'mm'), 25.4, 1e-9);
  approx(calc.convertLength(25.4, 'mm', 'in'), 1, 1e-9);
});

test('convertLength: ft -> in', () => {
  approx(calc.convertLength(1, 'ft', 'in'), 12, 1e-9);
});

test('sfmToSmm / smmToSfm round-trip', () => {
  approx(calc.sfmToSmm(100), 30.48, 0.001);
  approx(calc.smmToSfm(30.48), 100, 0.001);
});

test('degToRad / radToDeg', () => {
  approx(calc.degToRad(180), Math.PI, 1e-9);
  approx(calc.radToDeg(Math.PI), 180, 1e-9);
});

// -------------------------------------------------------------------------
// Drill reference table
// -------------------------------------------------------------------------

test('drillTable: combines number, letter, and fractional drills, sorted ascending', () => {
  assert.strictEqual(calc.drillTable.length, 80 + 26 + 64);
  for (let i = 1; i < calc.drillTable.length; i++) {
    assert.ok(calc.drillTable[i].decimal >= calc.drillTable[i - 1].decimal);
  }
});

test('fractionalDrills: reduces to lowest terms (32/64 -> 1/2")', () => {
  const fracs = calc.fractionalDrills(1, 64);
  const half = fracs.find((f) => Math.abs(f[1] - 0.5) < 1e-9);
  assert.strictEqual(half[0], '1/2"');
});

// -------------------------------------------------------------------------
// Report
// -------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}`);
    console.log(`    ${f.error.message}`);
  }
  process.exit(1);
}
