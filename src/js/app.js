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

  function unifiedToleranceTable(t) {
    if (t.external) {
      return '<table>' +
        '<tr><th>Allowance</th><td class="num">' + t.allowance.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Major Dia</th><td class="num">' + t.majorMin.toFixed(4) + ' – ' + t.majorMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(4) + ' – ' + t.pdMax.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Minor Dia (ref, max)</th><td class="num">' + t.minorMax.toFixed(4) + ' in</td></tr>' +
        '</table>';
    }
    return '<table>' +
      '<tr><th>Major Dia (min)</th><td class="num">' + t.majorMin.toFixed(4) + ' in</td></tr>' +
      '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(4) + ' – ' + t.pdMax.toFixed(4) + ' in</td></tr>' +
      '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(4) + ' – ' + t.minorMax.toFixed(4) + ' in</td></tr>' +
      '</table>';
  }

  function setupThreadUnified() {
    var preset = $('th-uni-preset'), major = $('th-uni-major'), tpi = $('th-uni-tpi'), out = $('th-uni-result');
    var classSelect = $('th-uni-class'), tolHint = $('th-uni-tol-hint'), tolOut = $('th-uni-tol-result');
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

    function renderTolerance(sizeName) {
      var cls = classSelect.value;
      if (!sizeName) {
        tolHint.textContent = 'Tolerance classes are only available for the standard/selected sizes above — pick one from "Common size", or enter a major diameter and TPI that match one exactly.';
        tolOut.innerHTML = '';
        return;
      }
      tolHint.textContent = '';
      if (!cls) { tolOut.innerHTML = ''; return; }
      var t = calc.unifiedThreadTolerance(sizeName, cls);
      tolOut.innerHTML = t ? unifiedToleranceTable(t) : '';
    }

    var currentSizeName = null;
    function recalc() {
      var m = parseFloat(major.value), t = parseFloat(tpi.value);
      if (isNaN(m) || isNaN(t) || t <= 0) { out.innerHTML = ''; currentSizeName = null; refreshToleranceClasses(null); renderTolerance(null); return; }
      var g = calc.unifiedThreadGeometry({ majorDia: m, tpi: t });
      out.innerHTML =
        '<table>' +
        '<tr><th>Pitch</th><td class="num">' + g.pitch.toFixed(5) + ' in</td></tr>' +
        '<tr><th>Thread Height (H)</th><td class="num">' + g.threadHeight.toFixed(5) + ' in</td></tr>' +
        '<tr><th>External Major Dia</th><td class="num">' + g.external.majorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>External Pitch Dia</th><td class="num">' + g.external.pitchDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>External Minor Dia</th><td class="num">' + g.external.minorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Internal Major Dia (min)</th><td class="num">' + g.internal.majorDiaMin.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Internal Pitch Dia</th><td class="num">' + g.internal.pitchDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Internal Minor Dia</th><td class="num">' + g.internal.minorDia.toFixed(4) + ' in</td></tr>' +
        '<tr><th>Tensile Stress Area</th><td class="num">' + g.tensileStressArea.toFixed(5) + ' in²</td></tr>' +
        '</table>';
      currentSizeName = findUnifiedSizeName(m, t);
      refreshToleranceClasses(currentSizeName);
      renderTolerance(currentSizeName);
    }
    [major, tpi].forEach(function (el) { el.addEventListener('input', recalc); });
    classSelect.addEventListener('change', function () { renderTolerance(currentSizeName); });
    recalc();
  }

  function metricToleranceTable(t) {
    if (t.external) {
      return '<table>' +
        '<tr><th>Allowance</th><td class="num">' + t.allowance.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Major Dia</th><td class="num">' + t.majorMin.toFixed(3) + ' – ' + t.majorMax.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(3) + ' – ' + t.pdMax.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(3) + ' – ' + t.minorMax.toFixed(3) + ' mm</td></tr>' +
        '</table>';
    }
    return '<table>' +
      '<tr><th>Major Dia (min)</th><td class="num">' + t.majorMin.toFixed(3) + ' mm</td></tr>' +
      '<tr><th>Pitch Dia</th><td class="num">' + t.pdMin.toFixed(3) + ' – ' + t.pdMax.toFixed(3) + ' mm</td></tr>' +
      '<tr><th>Minor Dia</th><td class="num">' + t.minorMin.toFixed(3) + ' – ' + t.minorMax.toFixed(3) + ' mm</td></tr>' +
      '</table>';
  }

  function setupThreadMetric() {
    var preset = $('th-met-preset'), major = $('th-met-major'), pitch = $('th-met-pitch'), out = $('th-met-result');
    var classSelect = $('th-met-class'), tolHint = $('th-met-tol-hint'), tolOut = $('th-met-tol-result');
    fillSelect(preset, calc.metricThreadSizes);
    preset.addEventListener('change', function () {
      if (preset.value === '') return;
      var t = calc.metricThreadSizes[+preset.value];
      major.value = t.majorDia; pitch.value = t.pitch;
      recalc();
    });

    function renderTolerance(m, p) {
      var cls = classSelect.value;
      if (!cls) { tolHint.textContent = ''; tolOut.innerHTML = ''; return; }
      var t = calc.metricThreadTolerance(m, p, cls);
      if (!t) {
        tolHint.textContent = 'No tolerance data for this diameter/pitch combination (outside the tabulated 1.5-355mm diameter / 0.2-6mm pitch range).';
        tolOut.innerHTML = '';
        return;
      }
      tolHint.textContent = '';
      tolOut.innerHTML = metricToleranceTable(t);
    }

    function recalc() {
      var m = parseFloat(major.value), p = parseFloat(pitch.value);
      if (isNaN(m) || isNaN(p) || p <= 0) { out.innerHTML = ''; tolOut.innerHTML = ''; tolHint.textContent = ''; return; }
      var g = calc.metricThreadGeometry({ majorDia: m, pitch: p });
      out.innerHTML =
        '<table>' +
        '<tr><th>Pitch</th><td class="num">' + g.pitch.toFixed(4) + ' mm</td></tr>' +
        '<tr><th>Thread Height (H)</th><td class="num">' + g.threadHeight.toFixed(4) + ' mm</td></tr>' +
        '<tr><th>External Major Dia (d)</th><td class="num">' + g.external.majorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>External Pitch Dia (d2)</th><td class="num">' + g.external.pitchDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>External Minor Dia (d3)</th><td class="num">' + g.external.minorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Internal Major Dia (D)</th><td class="num">' + g.internal.majorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Internal Pitch Dia (D2)</th><td class="num">' + g.internal.pitchDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Internal Minor Dia (D1)</th><td class="num">' + g.internal.minorDia.toFixed(3) + ' mm</td></tr>' +
        '<tr><th>Tensile Stress Area</th><td class="num">' + g.tensileStressArea.toFixed(3) + ' mm²</td></tr>' +
        '</table>';
      renderTolerance(m, p);
    }
    [major, pitch].forEach(function (el) { el.addEventListener('input', recalc); });
    classSelect.addEventListener('change', function () {
      var m = parseFloat(major.value), p = parseFloat(pitch.value);
      if (!isNaN(m) && !isNaN(p) && p > 0) renderTolerance(m, p);
    });
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
    setupRecommendedSfm();
    setupSpeedsFeedsImperial();
    setupSpeedsFeedsMetric();
    setupFeedPerToothImperial();
    setupFeedPerToothMetric();
    setupBoltCircle();
    setupTruePosition();
    setupSurfaceFinish();
    setupTolerance();
    setupCharts();
  });
})();
