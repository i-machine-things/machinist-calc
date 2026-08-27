'use strict';

/*
 * UI wiring for the calculator suite. Plain DOM + event listeners — no
 * framework, no bundler. Depends on calc-core.js having already attached
 * window.MC.calc.
 */

(function () {
  var calc = window.MC.calc;

  function $(id) { return document.getElementById(id); }

  function fillSelect(select, items) {
    items.forEach(function (item, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = item.name;
      select.appendChild(opt);
    });
  }

  function setupNav() {
    var buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
        $(btn.dataset.panel).classList.add('active');
      });
    });
  }

  function setupTabs() {
    document.querySelectorAll('.tabs').forEach(function (tabGroup) {
      var btns = tabGroup.querySelectorAll('.tab-btn');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          btns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          var section = tabGroup.closest('section');
          section.querySelectorAll(':scope > .tab-panel').forEach(function (p) { p.classList.remove('active'); });
          $(btn.dataset.tab).classList.add('active');
        });
      });
    });
  }

  // ------------------------------------------------------------------
  // Unit Converter
  // ------------------------------------------------------------------
  function setupUnitConverter() {
    var value = $('uc-value'), from = $('uc-from'), to = $('uc-to'), result = $('uc-result');
    function recalc() {
      var v = parseFloat(value.value);
      if (isNaN(v)) { result.textContent = '—'; return; }
      var r = calc.convertLength(v, from.value, to.value);
      result.textContent = calc.round(r, 6) + ' ' + to.value;
    }
    [value, from, to].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();

    var sfm = $('uc-sfm'), smm = $('uc-smm');
    sfm.addEventListener('input', function () {
      var v = parseFloat(sfm.value);
      if (!isNaN(v)) smm.value = calc.sfmToSmm(v);
    });
    smm.addEventListener('input', function () {
      var v = parseFloat(smm.value);
      if (!isNaN(v)) sfm.value = calc.smmToSfm(v);
    });
  }

  // ------------------------------------------------------------------
  // Tap Drills
  // ------------------------------------------------------------------
  function setupTapDrillImperial() {
    var preset = $('td-imp-preset'), major = $('td-imp-major'), tpi = $('td-imp-tpi'),
      pct = $('td-imp-pct'), pctOut = $('td-imp-pct-out'), result = $('td-imp-result'), nearest = $('td-imp-nearest');
    fillSelect(preset, calc.unifiedThreadSizes);
    preset.addEventListener('change', function () {
      if (preset.value === '') return;
      var t = calc.unifiedThreadSizes[+preset.value];
      major.value = t.majorDia; tpi.value = t.tpi;
      recalc();
    });
    function recalc() {
      pctOut.textContent = pct.value;
      var m = parseFloat(major.value), t = parseFloat(tpi.value), p = parseFloat(pct.value);
      if (isNaN(m) || isNaN(t) || t <= 0) { result.textContent = '—'; nearest.textContent = '—'; return; }
      var r = calc.tapDrillImperial({ majorDia: m, tpi: t, percentThread: p });
      result.textContent = r.drillDecimal.toFixed(4) + '"';
      nearest.textContent = 'Nearest standard drill: ' + r.nearestDrill.name + ' (' + r.nearestDrill.decimal.toFixed(4) + '")';
    }
    [major, tpi, pct].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  function setupTapDrillMetric() {
    var preset = $('td-met-preset'), major = $('td-met-major'), pitch = $('td-met-pitch'),
      pct = $('td-met-pct'), pctOut = $('td-met-pct-out'), result = $('td-met-result'), nearest = $('td-met-nearest');
    fillSelect(preset, calc.metricThreadSizes);
    preset.addEventListener('change', function () {
      if (preset.value === '') return;
      var t = calc.metricThreadSizes[+preset.value];
      major.value = t.majorDia; pitch.value = t.pitch;
      recalc();
    });
    function recalc() {
      pctOut.textContent = pct.value;
      var m = parseFloat(major.value), p = parseFloat(pitch.value), pc = parseFloat(pct.value);
      if (isNaN(m) || isNaN(p) || p <= 0) { result.textContent = '—'; nearest.textContent = '—'; return; }
      var r = calc.tapDrillMetric({ majorDia: m, pitch: p, percentThread: pc });
      result.textContent = r.drillMm.toFixed(3) + ' mm';
      nearest.textContent = 'Nearest standard drill: ' + r.nearestDrill.name + ' (' +
        r.nearestDrill.decimal.toFixed(4) + '" / ' + (r.nearestDrill.decimal * 25.4).toFixed(3) + ' mm)';
    }
    [major, pitch, pct].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  // ------------------------------------------------------------------
  // Thread Calculator
  // ------------------------------------------------------------------
  /** Find the calc.unifiedThreadSizes entry exactly matching a major dia / TPI pair, or null. */
  function findUnifiedSizeName(majorDia, tpi) {
    for (var i = 0; i < calc.unifiedThreadSizes.length; i++) {
      var s = calc.unifiedThreadSizes[i];
      if (Math.abs(s.majorDia - majorDia) < 1e-6 && s.tpi === tpi) return s.name;
    }
    return null;
  }

  function unifiedToleranceRows(t) {
    var head = '<tr class="subhead"><th colspan="2">Class ' + t.class + ' (' + (t.external ? 'external' : 'internal') + ')</th></tr>';
    if (t.external) {
      return head +
        '<tr><th>Allowance</th><td class="num">' + t.allowance.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Major Dia</th><td class="num">' + t.majorMin.toFixed(4) + ' – ' + t.majorMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(4) + ' – ' + t.pdMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Minor Dia (ref, max)</th><td class="num">' + t.minorMax.toFixed(4) + ' in</td></tr>';
    }
    return head +
      '<tr><th>Major Dia (min)</th><td class="num">' + t.majorMin.toFixed(4) + ' in</td></tr>' +
      '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(4) + ' – ' + t.pdMax.toFixed(4) + ' in</td></tr>' +
      '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(4) + ' – ' + t.minorMax.toFixed(4) + ' in</td></tr>';
  }

  function setupThreadUnified() {
    var preset = $('th-uni-preset'), major = $('th-uni-major'), tpi = $('th-uni-tpi'), out = $('th-uni-result');
    var classSelect = $('th-uni-class'), tolHint = $('th-uni-tol-hint');
    var wireIn = $('th-uni-wire'), wireHint = $('th-uni-wire-hint'), wireOut = $('th-uni-wire-result');
    fillSelect(preset, calc.unifiedThreadSizes);
    preset.addEventListener('change', function () {
      if (preset.value === '') return;
      var t = calc.unifiedThreadSizes[+preset.value];
      major.value = t.majorDia; tpi.value = t.tpi;
      recalc();
    });

    function refreshToleranceClasses(sizeName) {
      var prevValue = classSelect.value;
      classSelect.innerHTML = '<option value="">None (basic profile only)</option>';
      var classes = sizeName ? calc.unifiedThreadToleranceClasses(sizeName) : [];
      classes.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c + (c.charAt(1) === 'A' ? ' (external)' : ' (internal)');
        classSelect.appendChild(opt);
      });
      classSelect.disabled = classes.length === 0;
      classSelect.value = classes.indexOf(prevValue) !== -1 ? prevValue : '';
    }

    var currentTol = null, currentBasicPD = null;
    function recalcWire() {
      var w = parseFloat(wireIn.value);
      if (currentBasicPD == null) {
        wireHint.textContent = 'Enter a valid major diameter and TPI above.';
        wireOut.innerHTML = '';
        return;
      }
      if (isNaN(w) || w <= 0) { wireHint.textContent = ''; wireOut.innerHTML = ''; return; }
      var t = parseFloat(tpi.value);
      if (currentTol && currentTol.external) {
        var m = calc.unifiedMeasurementOverWires(currentTol.pdMax, currentTol.pdMin, t, w);
        wireHint.textContent = '';
        wireOut.innerHTML = '<table><tr><th>Measurement Over Wires</th><td class="num">' +
          m.min.toFixed(4) + ' – ' + m.max.toFixed(4) + ' in</td></tr></table>';
      } else {
        var basic = calc.unifiedMeasurementOverWires(currentBasicPD, currentBasicPD, t, w);
        wireHint.textContent = 'No external tolerance class selected (or none available for this size) — showing the theoretical value at the basic pitch diameter, not a toleranced range.';
        wireOut.innerHTML = '<table><tr><th>Measurement Over Wires (basic PD)</th><td class="num">' +
          basic.max.toFixed(4) + ' in</td></tr></table>';
      }
    }

    function recalc() {
      var m = parseFloat(major.value), t = parseFloat(tpi.value);
      if (isNaN(m) || isNaN(t) || t <= 0 || m <= 0) {
        out.innerHTML = ''; tolHint.textContent = ''; refreshToleranceClasses(null); currentTol = null; currentBasicPD = null; recalcWire();
        return;
      }
      var g = calc.unifiedThreadGeometry({ majorDia: m, tpi: t });
      currentBasicPD = g.external.pitchDia;
      var rows =
        '<tr><th>Pitch</th><td class="num">' + g.pitch.toFixed(5) + ' in</td></tr>' +
        '<tr><th>Thread Height (H)</th><td class="num">' + g.threadHeight.toFixed(5) + ' in</td></tr>' +
        '<tr><th>External Major Dia</th><td class="num">' + g.external.majorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>External Pitch Dia</th><td class="num">' + g.external.pitchDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>External Minor Dia</th><td class="num">' + g.external.minorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Internal Major Dia (min)</th><td class="num">' + g.internal.majorDiaMin.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Internal Pitch Dia</th><td class="num">' + g.internal.pitchDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Internal Minor Dia</th><td class="num">' + g.internal.minorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Tensile Stress Area</th><td class="num">' + g.tensileStressArea.toFixed(5) + ' in²</td></tr>';

      var sizeName = findUnifiedSizeName(m, t);
      refreshToleranceClasses(sizeName);
      currentTol = null;
      if (!sizeName) {
        tolHint.textContent = 'Tolerance classes are only available for the standard/selected sizes above — pick one from "Common size", or enter a major diameter and TPI that match one exactly.';
      } else {
        tolHint.textContent = '';
        var cls = classSelect.value;
        if (cls) {
          var tol = calc.unifiedThreadTolerance(sizeName, cls);
          if (tol) { rows += unifiedToleranceRows(tol); currentTol = tol; }
        }
      }
      out.innerHTML = '<table>' + rows + '</table>';
      recalcWire();
    }
    [major, tpi].forEach(function (el) { el.addEventListener('input', recalc); });
    classSelect.addEventListener('change', recalc);
    wireIn.addEventListener('input', recalcWire);
    recalc();
  }

  function metricToleranceRows(t) {
    var head = '<tr class="subhead"><th colspan="2">Class ' + t.class + ' (' + (t.external ? 'external' : 'internal') + ')</th></tr>';
    if (t.external) {
      return head +
        '<tr><th>Allowance</th><td class="num">' + t.allowance.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Major Dia</th><td class="num">' + t.majorMin.toFixed(3) + ' – ' + t.majorMax.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(3) + ' – ' + t.pdMax.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(3) + ' – ' + t.minorMax.toFixed(3) + ' mm</td></tr>';
    }
    return head +
      '<tr><th>Major Dia (min)</th><td class="num">' + t.majorMin.toFixed(3) + ' mm</td></tr>' +
      '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(3) + ' – ' + t.pdMax.toFixed(3) + ' mm</td></tr>' +
      '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(3) + ' – ' + t.minorMax.toFixed(3) + ' mm</td></tr>';
  }

  function setupThreadMetric() {
    var preset = $('th-met-preset'), major = $('th-met-major'), pitch = $('th-met-pitch'), out = $('th-met-result');
    var classSelect = $('th-met-class'), tolHint = $('th-met-tol-hint');
    var wireIn = $('th-met-wire'), wireHint = $('th-met-wire-hint'), wireOut = $('th-met-wire-result');
    fillSelect(preset, calc.metricThreadSizes);
    preset.addEventListener('change', function () {
      if (preset.value === '') return;
      var t = calc.metricThreadSizes[+preset.value];
      major.value = t.majorDia; pitch.value = t.pitch;
      recalc();
    });

    var currentTol = null, currentBasicPD = null;
    function recalcWire() {
      var w = parseFloat(wireIn.value);
      if (currentBasicPD == null) {
        wireHint.textContent = 'Enter a valid major diameter and pitch above.';
        wireOut.innerHTML = '';
        return;
      }
      if (isNaN(w) || w <= 0) { wireHint.textContent = ''; wireOut.innerHTML = ''; return; }
      var p = parseFloat(pitch.value);
      if (currentTol && currentTol.external) {
        var m = calc.metricMeasurementOverWires(currentTol.pdMax, currentTol.pdMin, p, w);
        wireHint.textContent = '';
        wireOut.innerHTML = '<table><tr><th>Measurement Over Wires</th><td class="num">' +
          m.min.toFixed(3) + ' – ' + m.max.toFixed(3) + ' mm</td></tr></table>';
      } else {
        var basic = calc.metricMeasurementOverWires(currentBasicPD, currentBasicPD, p, w);
        wireHint.textContent = 'No external tolerance class selected (or none available for this size) — showing the theoretical value at the basic pitch diameter, not a toleranced range.';
        wireOut.innerHTML = '<table><tr><th>Measurement Over Wires (basic PD)</th><td class="num">' +
          basic.max.toFixed(3) + ' mm</td></tr></table>';
      }
    }

    function recalc() {
      var m = parseFloat(major.value), p = parseFloat(pitch.value);
      if (isNaN(m) || isNaN(p) || p <= 0 || m <= 0) { out.innerHTML = ''; tolHint.textContent = ''; currentTol = null; currentBasicPD = null; recalcWire(); return; }
      var g = calc.metricThreadGeometry({ majorDia: m, pitch: p });
      currentBasicPD = g.external.pitchDia;
      var rows =
        '<tr><th>Pitch</th><td class="num">' + g.pitch.toFixed(4) + ' mm</td></tr>' +
        '<tr><th>Thread Height (H)</th><td class="num">' + g.threadHeight.toFixed(4) + ' mm</td></tr>' +
        '<tr><th>External Major Dia (d)</th><td class="num">' + g.external.majorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>External Pitch Dia (d2)</th><td class="num">' + g.external.pitchDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>External Minor Dia (d3)</th><td class="num">' + g.external.minorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Internal Major Dia (D)</th><td class="num">' + g.internal.majorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Internal Pitch Dia (D2)</th><td class="num">' + g.internal.pitchDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Internal Minor Dia (D1)</th><td class="num">' + g.internal.minorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Tensile Stress Area</th><td class="num">' + g.tensileStressArea.toFixed(3) + ' mm²</td></tr>';

      var cls = classSelect.value;
      currentTol = null;
      if (!cls) {
        tolHint.textContent = '';
      } else {
        var tol = calc.metricThreadTolerance(m, p, cls);
        if (tol) {
          tolHint.textContent = '';
          rows += metricToleranceRows(tol);
          currentTol = tol;
        } else {
          tolHint.textContent = 'No tolerance data for this diameter/pitch combination (outside the tabulated 1.5-355mm diameter / 0.2-6mm pitch range).';
        }
      }
      out.innerHTML = '<table>' + rows + '</table>';
      recalcWire();
    }
    [major, pitch].forEach(function (el) { el.addEventListener('input', recalc); });
    classSelect.addEventListener('change', recalc);
    wireIn.addEventListener('input', recalcWire);
    recalc();
  }

  function acmeToleranceRows(t) {
    var head = '<tr class="subhead"><th colspan="2">Class ' + t.class + ' (' + (t.external ? 'external' : 'internal') + ')</th></tr>';
    if (t.external) {
      return head +
        '<tr><th>Major Dia</th><td class="num">' + t.majorMin.toFixed(4) + ' – ' + t.majorMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(4) + ' – ' + t.pdMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(4) + ' – ' + t.minorMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Tensile Stress Area</th><td class="num">' + t.stressArea.toFixed(5) + ' in²</td></tr>';
    }
    return head +
      '<tr><th>Major Dia</th><td class="num">' + t.majorMin.toFixed(4) + ' – ' + t.majorMax.toFixed(4) + ' in</td></tr>' +
      '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(4) + ' – ' + t.pdMax.toFixed(4) + ' in</td></tr>' +
      '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(4) + ' – ' + t.minorMax.toFixed(4) + ' in</td></tr>';
  }

  function setupThreadAcme() {
    var preset = $('th-acme-preset'), major = $('th-acme-major'), tpi = $('th-acme-tpi'), out = $('th-acme-result');
    var classSelect = $('th-acme-class'), tolHint = $('th-acme-tol-hint');
    var wireIn = $('th-acme-wire'), wireHint = $('th-acme-wire-hint'), wireOut = $('th-acme-wire-result');
    fillSelect(preset, calc.acmeThreadSizes);
    preset.addEventListener('change', function () {
      if (preset.value === '') return;
      var t = calc.acmeThreadSizes[+preset.value];
      major.value = t.majorDia; tpi.value = t.tpi;
      recalc();
    });

    // Wire measurement only needs *a* pitch diameter (max/min if toleranced, otherwise the
    // basic/theoretical one) plus a wire diameter -- it doesn't itself depend on tolerance-class
    // data, so it shouldn't be blocked just because a size falls outside the tolerance tables'
    // range (e.g. ACME above 5in) or no class is selected.
    var currentTol = null, currentBasicPD = null;
    function recalcWire() {
      var w = parseFloat(wireIn.value);
      if (currentBasicPD == null) {
        wireHint.textContent = 'Enter a valid major diameter and TPI above.';
        wireOut.innerHTML = '';
        return;
      }
      if (isNaN(w) || w <= 0) { wireHint.textContent = ''; wireOut.innerHTML = ''; return; }
      var t = parseFloat(tpi.value);
      if (currentTol && currentTol.external) {
        var m = calc.acmeMeasurementOverWires(currentTol.pdMax, currentTol.pdMin, 1 / t, w);
        wireHint.textContent = '';
        wireOut.innerHTML = '<table><tr><th>Measurement Over Wires</th><td class="num">' +
          m.min.toFixed(4) + ' – ' + m.max.toFixed(4) + ' in</td></tr></table>';
      } else {
        var basic = calc.acmeMeasurementOverWires(currentBasicPD, currentBasicPD, 1 / t, w);
        wireHint.textContent = 'No external tolerance class selected (or none available for this size) — showing the theoretical value at the basic pitch diameter, not a toleranced range.';
        wireOut.innerHTML = '<table><tr><th>Measurement Over Wires (basic PD)</th><td class="num">' +
          basic.max.toFixed(4) + ' in</td></tr></table>';
      }
    }

    function recalc() {
      var m = parseFloat(major.value), t = parseFloat(tpi.value);
      if (isNaN(m) || isNaN(t) || t <= 0 || m <= 0) {
        out.innerHTML = ''; tolHint.textContent = ''; currentTol = null; currentBasicPD = null; recalcWire();
        return;
      }
      var g = calc.acmeThreadGeometry({ majorDia: m, tpi: t });
      currentBasicPD = g.pitchDia;
      var rows =
        '<tr><th>Pitch</th><td class="num">' + g.pitch.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Thread Height</th><td class="num">' + g.threadHeight.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Basic Major Dia</th><td class="num">' + g.majorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Basic Pitch Dia</th><td class="num">' + g.pitchDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Basic Minor Dia</th><td class="num">' + g.minorDia.toFixed(4) + ' in</td></tr>';

      var cls = classSelect.value;
      currentTol = null;
      if (!cls) {
        tolHint.textContent = '';
      } else {
        var external = cls.indexOf('-ext') !== -1;
        var clsName = cls.replace('-ext', '').replace('-int', '');
        var tol = calc.acmeThreadTolerance(m, t, clsName, external);
        if (tol) {
          tolHint.textContent = '';
          rows += acmeToleranceRows(tol);
          currentTol = tol;
        } else {
          tolHint.textContent = 'No tolerance data for this diameter/pitch combination (outside the tabulated 0-5in diameter / 1-16 TPI range).';
        }
      }
      out.innerHTML = '<table>' + rows + '</table>';
      recalcWire();
    }
    [major, tpi].forEach(function (el) { el.addEventListener('input', recalc); });
    classSelect.addEventListener('change', recalc);
    wireIn.addEventListener('input', recalcWire);
    recalc();
  }

  // ------------------------------------------------------------------
  // Speeds & Feeds
  // ------------------------------------------------------------------
  function setupRecommendedSfm() {
    var material = $('sf-material'), tool = $('sf-tool'), out = $('sf-recommended');
    calc.recommendedSfm.forEach(function (row, i) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = row.material;
      material.appendChild(opt);
    });
    function currentRange() {
      var row = calc.recommendedSfm[+material.value];
      return tool.value === 'carbide' ? row.carbide : row.hss;
    }
    // Fills the surface-speed fields with the recommended midpoint whenever
    // the material/tool selection changes — a starting point, not a lock;
    // the fields stay plain inputs the user can type over afterward.
    function recalc() {
      var range = currentRange();
      var smmMin = calc.sfmToSmm(range[0]), smmMax = calc.sfmToSmm(range[1]);
      out.textContent = range[0] + '–' + range[1] + ' SFM (' + smmMin + '–' + smmMax + ' m/min)';

      var mid = Math.round((range[0] + range[1]) / 2);
      var sfmInput = $('sf-imp-sfm'), smmInput = $('sf-met-smm');
      sfmInput.value = mid;
      sfmInput.dispatchEvent(new Event('input'));
      smmInput.value = calc.sfmToSmm(mid);
      smmInput.dispatchEvent(new Event('input'));
    }
    [material, tool].forEach(function (el) { el.addEventListener('change', recalc); });
    recalc();
  }

  function setupSpeedsFeedsImperial() {
    var sfm = $('sf-imp-sfm'), dia = $('sf-imp-dia'), flutes = $('sf-imp-flutes'), chip = $('sf-imp-chipload'),
      rpmOut = $('sf-imp-rpm'), feedOut = $('sf-imp-feed');
    function recalc() {
      var s = parseFloat(sfm.value), d = parseFloat(dia.value), f = parseFloat(flutes.value), c = parseFloat(chip.value);
      if ([s, d, f, c].some(isNaN) || d <= 0 || !Number.isInteger(f) || f <= 0) {
        rpmOut.textContent = '—'; feedOut.textContent = '—'; return;
      }
      var rpm = calc.rpmFromSfm(s, d);
      rpmOut.textContent = rpm;
      feedOut.textContent = calc.feedRate(rpm, c, f);
    }
    [sfm, dia, flutes, chip].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  function setupSpeedsFeedsMetric() {
    var smm = $('sf-met-smm'), dia = $('sf-met-dia'), flutes = $('sf-met-flutes'), chip = $('sf-met-chipload'),
      rpmOut = $('sf-met-rpm'), feedOut = $('sf-met-feed');
    function recalc() {
      var s = parseFloat(smm.value), d = parseFloat(dia.value), f = parseFloat(flutes.value), c = parseFloat(chip.value);
      if ([s, d, f, c].some(isNaN) || d <= 0 || !Number.isInteger(f) || f <= 0) {
        rpmOut.textContent = '—'; feedOut.textContent = '—'; return;
      }
      var rpm = calc.rpmFromSmm(s, d);
      rpmOut.textContent = rpm;
      feedOut.textContent = calc.feedRate(rpm, c, f);
    }
    [smm, dia, flutes, chip].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  function setupFeedPerToothImperial() {
    var rpm = $('sf-imp-fpt-rpm'), flutes = $('sf-imp-fpt-flutes'), chip = $('sf-imp-fpt-chipload'),
      iprOut = $('sf-imp-fpt-ipr'), feedOut = $('sf-imp-fpt-feed');
    function recalc() {
      var r = parseFloat(rpm.value), f = parseFloat(flutes.value), c = parseFloat(chip.value);
      if ([r, f, c].some(isNaN) || !Number.isInteger(f) || f <= 0) {
        iprOut.textContent = '—'; feedOut.textContent = '—'; return;
      }
      iprOut.textContent = calc.feedPerRev(c, f);
      feedOut.textContent = calc.feedRate(r, c, f);
    }
    [rpm, flutes, chip].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  function setupFeedPerToothMetric() {
    var rpm = $('sf-met-fpt-rpm'), flutes = $('sf-met-fpt-flutes'), chip = $('sf-met-fpt-chipload'),
      iprOut = $('sf-met-fpt-ipr'), feedOut = $('sf-met-fpt-feed');
    function recalc() {
      var r = parseFloat(rpm.value), f = parseFloat(flutes.value), c = parseFloat(chip.value);
      if ([r, f, c].some(isNaN) || !Number.isInteger(f) || f <= 0) {
        iprOut.textContent = '—'; feedOut.textContent = '—'; return;
      }
      iprOut.textContent = calc.feedPerRev(c, f);
      feedOut.textContent = calc.feedRate(r, c, f);
    }
    [rpm, flutes, chip].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  // ------------------------------------------------------------------
  // Bolt Circle
  // ------------------------------------------------------------------
  function renderBoltCircleSvg(svg, pts, bcd) {
    var r = bcd / 2;
    var scale = 90 / Math.max(r, 0.001);
    var html = '<circle class="bc-circle" cx="0" cy="0" r="' + (r * scale).toFixed(2) + '" />';
    html += '<line class="bc-crosshair" x1="-100" y1="0" x2="100" y2="0" />';
    html += '<line class="bc-crosshair" x1="0" y1="-100" x2="0" y2="100" />';
    pts.forEach(function (p) {
      var x = p.x * scale, y = -p.y * scale; // flip Y: SVG y grows downward
      html += '<circle class="bc-hole" cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="4" />';
      html += '<text class="bc-label" x="' + (x + 6).toFixed(2) + '" y="' + (y - 6).toFixed(2) + '">' + p.index + '</text>';
    });
    svg.innerHTML = html;
  }

  function setupBoltCircle() {
    var dia = $('bc-dia'), count = $('bc-count'), start = $('bc-start'), dir = $('bc-dir'),
      tbody = document.querySelector('#bc-table tbody'), svg = $('bc-svg');
    function recalc() {
      var bcd = parseFloat(dia.value), n = parseInt(count.value, 10), s = parseFloat(start.value);
      if (isNaN(bcd) || isNaN(n) || n < 2 || isNaN(s)) { tbody.innerHTML = ''; svg.innerHTML = ''; return; }
      var pts = calc.boltCirclePoints({ bcd: bcd, count: n, startAngleDeg: s, clockwise: dir.value === 'cw' });
      tbody.innerHTML = pts.map(function (p) {
        return '<tr><td>' + p.index + '</td><td>' + p.angleFromStartDeg.toFixed(2) + '°</td>' +
          '<td class="num">' + p.x.toFixed(4) + '</td><td class="num">' + p.y.toFixed(4) + '</td></tr>';
      }).join('');
      renderBoltCircleSvg(svg, pts, bcd);
    }
    [dia, count, start, dir].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();
  }

  // ------------------------------------------------------------------
  // Right Triangle Solver
  // ------------------------------------------------------------------
  // A single scale factor maps the real a/b onto the available drawing budget (canvas size minus
  // the margin reserved for each field label) while preserving the true aspect ratio, so the
  // drawing morphs to the actual proportions instead of a fixed generic shape. The triangle plus
  // its label margins is then centered as one block within the canvas, rather than anchored to a
  // fixed corner, so leftover space (whichever dimension wasn't the binding constraint) is split
  // evenly instead of piling up on one side.
  var RT_LEFT_PAD = 20, RT_RIGHT_PAD = 90, RT_TOP_PAD = 45, RT_BOTTOM_PAD = 45;

  /** Pixel-space vertex positions for a solved (real-unit) a/b/c triangle, centered within a `width` x `height` box. */
  function rtGeometry(a, b, c, width, height) {
    var usableW = Math.max(width - RT_LEFT_PAD - RT_RIGHT_PAD, 40);
    var usableH = Math.max(height - RT_TOP_PAD - RT_BOTTOM_PAD, 40);
    // A leg can round to exactly 0 at the displayed precision even though the solver validated
    // it as positive pre-rounding (e.g. a raw 4e-7 rounds to 0.00000) -- dividing by that would
    // turn every downstream coordinate into Infinity/NaN, so floor it to a nominal positive size.
    var drawA = a > 0 ? a : 1, drawB = b > 0 ? b : 1;
    var scale = Math.min(usableW / drawB, usableH / drawA);
    var bPx = drawB * scale, aPx = drawA * scale;
    var contentW = bPx + RT_LEFT_PAD + RT_RIGHT_PAD, contentH = aPx + RT_TOP_PAD + RT_BOTTOM_PAD;
    var offsetX = Math.max((width - contentW) / 2, 0), offsetY = Math.max((height - contentH) / 2, 0);
    var originX = offsetX + RT_LEFT_PAD, originY = offsetY + RT_TOP_PAD + aPx;
    return {
      A: { x: originX, y: originY },
      C: { x: originX + bPx, y: originY },
      B: { x: originX + bPx, y: originY - aPx }
    };
  }

  /** Draws the triangle outline and the right-angle marker at C. */
  function renderRightTriangle(svg, geo, width, height) {
    var A = geo.A, B = geo.B, C = geo.C, mark = 14;
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.innerHTML =
      '<polygon class="rt-triangle" points="' + A.x + ',' + A.y + ' ' + C.x + ',' + C.y + ' ' +
        B.x + ',' + B.y + '" />' +
      '<path class="rt-rightangle-mark" d="M' + (C.x - mark) + ',' + C.y + ' L' + (C.x - mark) + ',' + (C.y - mark) +
        ' L' + C.x + ',' + (C.y - mark) + '" />';
  }

  /** Positions (CSS left/top) for the 6 field overlays, derived from the same solved geometry. */
  function rtFieldStyle(geo) {
    var A = geo.A, B = geo.B, C = geo.C;
    return {
      b: { left: (A.x + C.x) / 2 - 37, top: C.y + 6 },
      a: { left: C.x + 6, top: (C.y + B.y) / 2 - 13 },
      c: { left: (A.x + B.x) / 2 - 60, top: (A.y + B.y) / 2 - 35 },
      anglea: { left: A.x + 10, top: A.y - 34 },
      angleb: { left: B.x - 62, top: B.y + 8 },
      anglec: { left: C.x - 54, top: C.y - 34 }
    };
  }

  // Diagram has 6 positions (side a/b/c, angle A/B/C) but only 4 independent quantities --
  // angle C is fixed at 90 and angle A/B are complementary (A+B=90), so the two angle fields
  // are kept mirrored (like the SFM/SMM pair in the Unit Converter) and tracked as one 'angle'
  // slot. After a solve every field holds a value (inputs *and* derived results share the same
  // 5 fields), so "which 2 fields are non-empty" can't tell knowns from stale leftovers once
  // all 5 are filled -- instead, track the 2 field keys the user most recently typed into and
  // solve from only those, treating everything else as output to overwrite.
  function setupRightTriangle() {
    var wrap = document.querySelector('#panel-righttriangle .rt-diagram-wrap');
    var svg = $('rt-svg');
    var aIn = $('rt-a'), bIn = $('rt-b'), cIn = $('rt-c'),
      angleAIn = $('rt-anglea'), angleBIn = $('rt-angleb'), angleCEl = $('rt-anglec'), errOut = $('rt-error');
    var fieldEls = { a: aIn, b: bIn, c: cIn, anglea: angleAIn, angleb: angleBIn, anglec: angleCEl };
    var editOrder = ['a', 'b']; // most-recently-edited last; matches the default seed below

    function markEdited(key) {
      var idx = editOrder.indexOf(key);
      if (idx !== -1) editOrder.splice(idx, 1);
      editOrder.push(key);
      if (editOrder.length > 2) editOrder.shift();
    }

    function redraw(a, b, c) {
      // clientWidth reads 0 while this panel is hidden (display: none) -- fall back to sane
      // defaults so the diagram still lays out until the panel becomes visible (see the nav
      // click/resize listeners below, which redraw with the real measured size). Height fills
      // whatever vertical space is left in the viewport below the diagram's top, clamped to a
      // reasonable range rather than growing unbounded.
      var width = wrap.clientWidth, height;
      if (!width) {
        width = 380;
        height = 260;
      } else {
        height = Math.max(Math.min(window.innerHeight - wrap.getBoundingClientRect().top - 40, 600), 220);
      }
      wrap.style.height = height + 'px';
      var geo = rtGeometry(a, b, c, width, height);
      renderRightTriangle(svg, geo, width, height);
      var style = rtFieldStyle(geo);
      Object.keys(style).forEach(function (key) {
        fieldEls[key].style.left = style[key].left + 'px';
        fieldEls[key].style.top = style[key].top + 'px';
      });
    }

    function recalc() {
      var values = {
        a: parseFloat(aIn.value), b: parseFloat(bIn.value), c: parseFloat(cIn.value),
        angle: parseFloat(angleAIn.value)
      };
      var known = {};
      editOrder.forEach(function (key) {
        if (isNaN(values[key])) return;
        if (key === 'angle') known.angleADeg = values[key]; else known[key] = values[key];
      });
      if (Object.keys(known).length !== 2) { errOut.textContent = ''; return; }
      try {
        var r = calc.rightTriangleSolve(known);
        errOut.textContent = '';
        // Never overwrite the field the user is actively typing into, or a live recalc mid
        // keystroke would clobber what they're typing and move their cursor.
        var focused = document.activeElement;
        if (focused !== aIn) aIn.value = r.a;
        if (focused !== bIn) bIn.value = r.b;
        if (focused !== cIn) cIn.value = r.c;
        if (focused !== angleAIn) angleAIn.value = r.angleADeg;
        if (focused !== angleBIn) angleBIn.value = r.angleBDeg;
        redraw(r.a, r.b, r.c);
      } catch (err) {
        errOut.textContent = err.message;
      }
    }

    aIn.addEventListener('input', function () { markEdited('a'); recalc(); });
    bIn.addEventListener('input', function () { markEdited('b'); recalc(); });
    cIn.addEventListener('input', function () { markEdited('c'); recalc(); });
    angleAIn.addEventListener('input', function () {
      markEdited('angle');
      var v = parseFloat(angleAIn.value);
      angleBIn.value = isNaN(v) ? '' : calc.round(90 - v, 4);
      recalc();
    });
    angleBIn.addEventListener('input', function () {
      markEdited('angle');
      var v = parseFloat(angleBIn.value);
      angleAIn.value = isNaN(v) ? '' : calc.round(90 - v, 4);
      recalc();
    });
    [aIn, bIn, cIn, angleAIn, angleBIn].forEach(function (el) {
      el.addEventListener('focus', function () { el.select(); });
    });

    // clientWidth is 0 while this panel is hidden, so the diagram drawn at page load (on
    // whichever panel starts active) uses the fallback width -- reflow with the real width
    // once this panel is actually shown, and again on any window resize while it's visible.
    var navBtn = document.querySelector('.nav-btn[data-panel="panel-righttriangle"]');
    if (navBtn) navBtn.addEventListener('click', recalc);
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(recalc, 150);
    });

    aIn.value = 3;
    bIn.value = 4;
    recalc();
  }

  // ------------------------------------------------------------------
  // True Position
  // ------------------------------------------------------------------
  function setupTruePosition() {
    var bx = $('tp-basicx'), by = $('tp-basicy'), ax = $('tp-actualx'), ay = $('tp-actualy'),
      devxOut = $('tp-devx'), devyOut = $('tp-devy'), resOut = $('tp-result');
    function recalc() {
      var vals = [bx, by, ax, ay].map(function (el) { return parseFloat(el.value); });
      if (vals.some(isNaN)) { devxOut.textContent = '—'; devyOut.textContent = '—'; resOut.textContent = '—'; return; }
      var r = calc.truePosition({ basicX: vals[0], basicY: vals[1], actualX: vals[2], actualY: vals[3] });
      devxOut.textContent = r.devX;
      devyOut.textContent = r.devY;
      resOut.textContent = r.truePosition;
    }
    [bx, by, ax, ay].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();

    var actSize = $('tp-actualsize'), mmc = $('tp-mmcsize'), featureType = $('tp-featuretype'), bonusOut = $('tp-bonus');
    function recalcBonus() {
      var a = parseFloat(actSize.value), m = parseFloat(mmc.value);
      if (isNaN(a) || isNaN(m)) { bonusOut.textContent = '—'; return; }
      bonusOut.textContent = calc.bonusTolerance(a, m, featureType.value);
    }
    [actSize, mmc, featureType].forEach(function (el) { el.addEventListener('input', recalcBonus); });
    recalcBonus();
  }

  // ------------------------------------------------------------------
  // Surface Finish
  // ------------------------------------------------------------------
  function setupSurfaceFinish() {
    var impFeed = $('sfin-imp-feed'), impR = $('sfin-imp-radius'), impOut = $('sfin-imp-result');
    function recalcImp() {
      var f = parseFloat(impFeed.value), r = parseFloat(impR.value);
      if (isNaN(f) || isNaN(r) || r <= 0) { impOut.textContent = '—'; return; }
      impOut.textContent = calc.surfaceFinishRaImperial(f, r);
    }
    [impFeed, impR].forEach(function (el) { el.addEventListener('input', recalcImp); });
    recalcImp();

    var metFeed = $('sfin-met-feed'), metR = $('sfin-met-radius'), metOut = $('sfin-met-result');
    function recalcMet() {
      var f = parseFloat(metFeed.value), r = parseFloat(metR.value);
      if (isNaN(f) || isNaN(r) || r <= 0) { metOut.textContent = '—'; return; }
      metOut.textContent = calc.surfaceFinishRaMetric(f, r);
    }
    [metFeed, metR].forEach(function (el) { el.addEventListener('input', recalcMet); });
    recalcMet();
  }

  // ------------------------------------------------------------------
  // ISO Tolerance
  // ------------------------------------------------------------------
  function setupTolerance() {
    var nominal = $('it-nominal'), grade = $('it-grade'), iOut = $('it-i'), umOut = $('it-tol-um'), mmOut = $('it-tol-mm');
    calc.itGrades.forEach(function (g) {
      var opt = document.createElement('option');
      opt.value = g; opt.textContent = g;
      grade.appendChild(opt);
    });
    grade.value = 'IT7';
    function recalc() {
      var n = parseFloat(nominal.value);
      if (isNaN(n) || n <= 0) { iOut.textContent = '—'; umOut.textContent = '—'; mmOut.textContent = '—'; return; }
      var r = calc.isoFundamentalTolerance(n, grade.value);
      iOut.textContent = r.i;
      umOut.textContent = r.toleranceUm;
      mmOut.textContent = r.toleranceMm;
    }
    [nominal, grade].forEach(function (el) { el.addEventListener('input', recalc); });
    recalc();

    var ln = $('lim-nominal'), lu = $('lim-upper'), ll = $('lim-lower'),
      maxOut = $('lim-max'), minOut = $('lim-min'), totOut = $('lim-total');
    function recalcLimits() {
      var n = parseFloat(ln.value), u = parseFloat(lu.value), l = parseFloat(ll.value);
      if ([n, u, l].some(isNaN)) { maxOut.textContent = '—'; minOut.textContent = '—'; totOut.textContent = '—'; return; }
      var r = calc.limits({ nominal: n, upperTol: u, lowerTol: l });
      maxOut.textContent = r.maxLimit;
      minOut.textContent = r.minLimit;
      totOut.textContent = r.totalTolerance;
    }
    [ln, lu, ll].forEach(function (el) { el.addEventListener('input', recalcLimits); });
    recalcLimits();
  }

  // ------------------------------------------------------------------
  // Reference Charts
  // ------------------------------------------------------------------
  function setupCharts() {
    var filter = $('chart-filter'), tbody = document.querySelector('#chart-table tbody');
    function render() {
      var q = filter.value.trim().toLowerCase();
      var rows = calc.drillTable.filter(function (d) {
        if (!q) return true;
        return d.name.toLowerCase().indexOf(q) !== -1 || d.decimal.toFixed(4).indexOf(q) !== -1;
      });
      tbody.innerHTML = rows.map(function (d) {
        return '<tr><td>' + d.name + '</td><td class="num">' + d.decimal.toFixed(4) +
          '</td><td class="num">' + (d.decimal * 25.4).toFixed(3) + '</td></tr>';
      }).join('');
    }
    filter.addEventListener('input', render);
    render();
  }

  // Hidden Ctrl+Alt+Shift+M easter egg — quiet, no accidental trigger, not
  // referenced anywhere in the UI. See CODING_NOTES.md "Easter Eggs".
  function setupEasterEgg() {
    var el = $('easter-egg');
    if (!el) return;
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyM') {
        el.hidden = !el.hidden;
      } else if (e.key === 'Escape' && !el.hidden) {
        el.hidden = true;
      }
    });
    el.addEventListener('click', function () { el.hidden = true; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupNav();
    setupTabs();
    setupEasterEgg();
    setupUnitConverter();
    setupTapDrillImperial();
    setupTapDrillMetric();
    setupThreadUnified();
    setupThreadMetric();
    setupThreadAcme();
    setupRecommendedSfm();
    setupSpeedsFeedsImperial();
    setupSpeedsFeedsMetric();
    setupFeedPerToothImperial();
    setupFeedPerToothMetric();
    setupBoltCircle();
    setupRightTriangle();
    setupTruePosition();
    setupSurfaceFinish();
    setupTolerance();
    setupCharts();
  });
})();
