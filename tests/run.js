'use strict';

/*
 * Dependency-free test runner for the calc-core engine.
 * Run with: node tests/run.js
 */

const assert = require('assert');
const fs = require('fs');
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
// Scientific calculator expression evaluator
// -------------------------------------------------------------------------

test('evaluateExpression: basic arithmetic with standard precedence', () => {
  approx(calc.evaluateExpression('2 + 3 * 4'), 14, 1e-9);
  approx(calc.evaluateExpression('(2 + 3) * 4'), 20, 1e-9);
});

test('evaluateExpression: unary minus binds looser than exponent (-2^2 = -4)', () => {
  approx(calc.evaluateExpression('-2^2'), -4, 1e-9);
});

test('evaluateExpression: parses exponent-suffixed number literals', () => {
  approx(calc.evaluateExpression('1e-8'), 1e-8, 1e-20);
  approx(calc.evaluateExpression('1.5E+10'), 1.5e10, 1);
  approx(calc.evaluateExpression('2e3 + 1'), 2001, 1e-9);
});

test('evaluateExpression: round-trips a very small/large result through its own default string form', () => {
  // MR (memory recall) and "=" chaining both re-insert String(result) into the display; if the
  // magnitude is small/large enough that JS renders it in exponential form, the tokenizer must
  // be able to parse that same string back, or recalling a stored value silently breaks.
  const small = calc.evaluateExpression('1 / 100000000');
  assert.strictEqual(calc.evaluateExpression(String(small)), small);
  const large = calc.evaluateExpression('10^25');
  assert.strictEqual(calc.evaluateExpression(String(large)), large);
});

test('evaluateExpression: exponent is right-associative (2^3^2 = 512)', () => {
  approx(calc.evaluateExpression('2^3^2'), 512, 1e-9);
});

test('evaluateExpression: negative exponent', () => {
  approx(calc.evaluateExpression('2^-2'), 0.25, 1e-9);
});

test('evaluateExpression: trig functions default to degrees', () => {
  approx(calc.evaluateExpression('sin(30)'), 0.5, 1e-9);
  approx(calc.evaluateExpression('cos(60)'), 0.5, 1e-9);
});

test('evaluateExpression: trig functions honor radian mode', () => {
  approx(calc.evaluateExpression('sin(pi/2)', 'rad'), 1, 1e-9);
});

test('evaluateExpression: inverse trig returns degrees by default', () => {
  approx(calc.evaluateExpression('asin(1)'), 90, 1e-9);
});

test('evaluateExpression: sqrt, log, ln, abs, and constants', () => {
  approx(calc.evaluateExpression('sqrt(9)'), 3, 1e-9);
  approx(calc.evaluateExpression('log(100)'), 2, 1e-9);
  approx(calc.evaluateExpression('ln(e)'), 1, 1e-9);
  approx(calc.evaluateExpression('abs(-5)'), 5, 1e-9);
  approx(calc.evaluateExpression('pi'), Math.PI, 1e-9);
});

test('evaluateExpression: rejects division by zero', () => {
  assert.throws(() => calc.evaluateExpression('1/0'), RangeError);
});

test('evaluateExpression: rejects out-of-domain inputs instead of returning NaN', () => {
  assert.throws(() => calc.evaluateExpression('asin(2)'), RangeError);
  assert.throws(() => calc.evaluateExpression('sqrt(-1)'), RangeError);
  assert.throws(() => calc.evaluateExpression('log(0)'), RangeError);
});

test('evaluateExpression: rejects malformed input instead of silently guessing', () => {
  assert.throws(() => calc.evaluateExpression('2 + '), SyntaxError);
  assert.throws(() => calc.evaluateExpression('2 3'), SyntaxError);
  assert.throws(() => calc.evaluateExpression('2 + )'), SyntaxError);
  assert.throws(() => calc.evaluateExpression('foo(1)'), SyntaxError);
  assert.throws(() => calc.evaluateExpression(''), SyntaxError);
  assert.throws(() => calc.evaluateExpression('1.2.3'), SyntaxError);
});

test('calc-core.js never calls eval() or the Function constructor (regression guard)', () => {
  // The scientific calculator evaluates arbitrary user-typed strings; a hand-written parser is
  // the whole point (see calc-core.js), so this scans the real source rather than trusting a
  // future refactor not to reintroduce eval()/Function() as a shortcut.
  const src = fs.readFileSync(require.resolve('../src/js/calc-core.js'), 'utf8');
  assert.ok(!/\beval\s*\(/.test(src), 'calc-core.js must not call eval()');
  assert.ok(!/new\s+Function\s*\(/.test(src), 'calc-core.js must not use the Function constructor');
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
