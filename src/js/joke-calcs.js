/*
 * Break Room: the hidden novelty calculators (see CODING_NOTES "Easter Eggs"). Pure functions, no DOM,
 * same UMD shape as calc-core.js so tests/run.js can require it. Novelty throughout (one real formula,
 * the steel thermal expansion, is called out where it appears) and none of it is a standard.
 *
 * Note from the author: after I did an independent blindfolded review of my own work, I found that I am
 * perfect and this all worked on the first try. Except for line 366. It seems a little half baked.
 */
(function (root, factory) {
  var joke = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = joke;
  }
  if (root) {
    root.MC = root.MC || {};
    root.MC.joke = joke;
  }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : null), function () {
  'use strict';

  var joke = {};

  function round(value, decimals) {
    var factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  // ---------------------------------------------------------------------
  // Caffeine budget ("ideal Monster")
  // ---------------------------------------------------------------------

  /**
   * Typical caffeine per serving. Real drinks vary by brand and brew (brewed coffee is roughly 80-100 mg per
   * 8 oz, a 1 oz espresso shot 47-64 mg, a 12 oz cola 30-40 mg); these are round mid-range figures.
   */
  joke.caffeineDrinks = [
    { name: 'Coffee (8 oz)', mg: 95 },
    { name: 'Monster (16 oz)', mg: 160 },
    { name: 'Espresso shot (1 oz)', mg: 63 },
    { name: 'Cola (12 oz)', mg: 34 }
  ];

  var DAILY_CAP_MG = 400;     // up to ~400 mg/day for healthy adults (quoted by both the FDA and EFSA)
  var SERVING_CAP_MG = 200;   // EFSA only: single doses up to 200 mg (~3 mg/kg for a 70 kg adult)
  var REFERENCE_KG = 70;      // the "typical adult" those two figures are quoted for
  // Adults only. EFSA's guidance for children and adolescents is a stricter ~3 mg/kg/day, and scaling the adult
  // figure down linearly (~5.7 mg/kg/day) would overshoot that, so below this weight we refuse to answer.
  var MIN_WEIGHT_KG = 40;
  var MAX_WEIGHT_KG = 300;

  /**
   * Novelty caffeine budget by body weight, for adults. NOT medical advice. Takes the commonly quoted adult
   * ceilings -- 400 mg/day (FDA and EFSA) and 200 mg per single dose (~3 mg/kg for a 70 kg adult, EFSA 2015
   * opinion; the FDA quotes only the daily figure) -- and scales them down proportionally for anyone lighter
   * than the 70 kg adult they're quoted for (never up past the cap). That scaling is this app's own arithmetic,
   * not something either agency publishes.
   * `weightKg` 40-300, `drinkMg` > 0, `shiftHours` > 0; throws RangeError otherwise.
   * Returns daily and single-serving ceilings (mg), how many of the chosen drink that is, the spacing across
   * a shift, and a whole-drink verdict. `splitAdvice` is true when at least one whole drink fits the daily
   * ceiling but one serving exceeds the single-dose ceiling (a 160 mg can for anyone from 40 up to 56 kg);
   * when not even one whole drink fits, the advice is water, not "split it".
   */
  joke.caffeineBudget = function (weightKg, drinkMg, shiftHours) {
    if (!Number.isFinite(weightKg) || weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
      throw new RangeError('weightKg must be between ' + MIN_WEIGHT_KG + ' and ' + MAX_WEIGHT_KG);
    }
    if (!Number.isFinite(drinkMg) || drinkMg <= 0) throw new RangeError('drinkMg must be positive');
    if (!Number.isFinite(shiftHours) || shiftHours <= 0) throw new RangeError('shiftHours must be positive');

    var dailyMg = Math.min(DAILY_CAP_MG, DAILY_CAP_MG * weightKg / REFERENCE_KG);
    var servingMg = Math.min(SERVING_CAP_MG, SERVING_CAP_MG * weightKg / REFERENCE_KG);
    var drinks = dailyMg / drinkMg;
    var whole = Math.floor(drinks);
    return {
      dailyMg: round(dailyMg, 0),
      servingMg: round(servingMg, 0),
      // Floored, not rounded: the whole-drink count next to it is a floor, and "4 (3 whole)" reads as a mistake.
      drinksPerDay: Math.floor(drinks * 10 + 1e-9) / 10,
      wholeDrinks: whole,
      hoursBetween: whole >= 1 ? round(shiftHours / whole, 1) : null,
      splitAdvice: whole >= 1 && drinkMg > servingMg,
      verdict: joke.caffeineVerdict(whole)
    };
  };

  /** Pounds to kilograms (1 lb = 0.45359237 kg exactly). Throws RangeError for a non-finite value. */
  joke.lbToKg = function (lb) {
    if (!Number.isFinite(lb)) throw new RangeError('lb must be finite');
    return lb * 0.45359237;
  };

  /** One-liner for a whole number of drinks per day. */
  joke.caffeineVerdict = function (wholeDrinks) {
    if (wholeDrinks <= 0) return 'Water. Just water.';
    if (wholeDrinks === 1) return 'One. Make it count.';
    if (wholeDrinks === 2) return 'Two. Pace yourself.';
    if (wholeDrinks <= 4) return 'A respectable amount of beverage.';
    return 'That is a lot of small drinks. Consider a bigger mug.';
  };

  // ---------------------------------------------------------------------
  // "Should I get a donut?" flowchart
  // ---------------------------------------------------------------------

  /**
   * A decision tree that branches out and, whichever way you answer, comes back to YES. Every option's
   * `next` is another node id; 'yes' is the only terminal. It's a DAG (no loops), which the tests check
   * along with "every path ends at yes".
   */
  joke.donutChart = {
    start: 'start',
    nodes: {
      start: { q: 'Is there a donut within reach?',
        options: [{ label: 'Yes', next: 'hungry' }, { label: 'No', next: 'far' }] },
      far: { q: 'Is there a donut within driving distance?',
        options: [{ label: 'Yes', next: 'hungry' }, { label: 'No', next: 'store' }] },
      store: { q: 'Is there a bakery, gas station, or grocery store nearby?',
        options: [{ label: 'Yes', next: 'hungry' }, { label: 'No', next: 'make' }] },
      make: { q: 'Could you make donuts?',
        options: [{ label: 'Sure, why not', next: 'hungry' }, { label: 'Absolutely not', next: 'friend' }] },
      friend: { q: 'Do you know anyone who could make donuts?',
        options: [{ label: 'Yes', next: 'hungry' }, { label: 'I have no friends', next: 'rough' }] },
      rough: { q: 'Rough day. Do you deserve a donut?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'Also yes', next: 'yes' }] },
      hungry: { q: 'Are you hungry?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'No', next: 'day' }] },
      day: { q: "Is today a day ending in 'y'?",
        options: [{ label: 'Yes', next: 'boss' }, { label: 'No', next: 'calendar' }] },
      calendar: { q: 'Is it Monday, Tuesday, Wednesday, Thursday, Friday, Saturday or Sunday?',
        options: [{ label: 'One of those', next: 'boss' }, { label: 'None of those', next: 'clock' }] },
      clock: { q: 'Then time has stopped. Does a stopped clock justify a donut?',
        options: [{ label: 'Obviously', next: 'yes' }, { label: 'Only if it is a good clock', next: 'yes' }] },
      boss: { q: 'Is the boss watching?',
        options: [{ label: 'Yes', next: 'bossDonut' }, { label: 'No', next: 'diet' }] },
      bossDonut: { q: 'Is the boss holding a donut?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'No', next: 'offer' }] },
      offer: { q: 'Offer to get the boss one too. Deal?',
        options: [{ label: 'Deal', next: 'yes' }, { label: 'The boss is on a diet', next: 'diet' }] },
      diet: { q: 'Are you on a diet?',
        options: [{ label: 'Yes', next: 'tolerance' }, { label: 'No', next: 'coffee' },
          { label: 'Define "diet"', next: 'tolerance' }] },
      tolerance: { q: 'Is one donut within your tolerance stack?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'No', next: 'salad' }] },
      salad: { q: 'Can you take the tolerance out of the salad instead?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'The salad is already at MMC', next: 'yes' }] },
      coffee: { q: 'Is there coffee nearby?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'No', next: 'breakRoom' }] },
      breakRoom: { q: 'Is there a break room?',
        options: [{ label: 'Yes', next: 'had' }, { label: 'No', next: 'had' }] },
      had: { q: 'Have you already had a donut today?',
        options: [{ label: 'No', next: 'yes' }, { label: 'Yes', next: 'full' }] },
      full: { q: 'Was it a full-size donut?',
        options: [{ label: 'No, holes', next: 'yes' }, { label: 'Yes', next: 'different' }] },
      different: { q: 'Is this a different donut?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'No', next: 'hand' }] },
      hand: { q: 'Is the first donut still in your hand?',
        options: [{ label: 'Yes', next: 'yes' }, { label: 'No', next: 'yes' }] },
      yes: { q: 'YES. Get the donut.', terminal: true, options: [] }
    }
  };

  /**
   * Checks a decision chart is well formed: the start exists, every `next` exists, no loops, every node is
   * reachable, every non-terminal node has at least two answers, and every terminal node has text and no
   * answers (so every path ends somewhere). Returns a list of problems (empty when it's fine).
   */
  function own(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  joke.chartProblems = function (chart) {
    var problems = [];
    var nodes = chart.nodes;
    // Own-property lookups only: `nodes['constructor']` is truthy on a plain object.
    if (!own(nodes, chart.start)) problems.push('start node missing');
    Object.keys(nodes).forEach(function (id) {
      var node = nodes[id];
      if (node.terminal) {
        if (!node.q) problems.push('terminal node ' + id + ' has no text');
        if (node.options && node.options.length) problems.push('terminal node ' + id + ' has answers');
        return;
      }
      if (!node.q) problems.push(id + ' has no question text');
      if (!node.options || node.options.length < 2) problems.push(id + ' needs at least two answers');
      (node.options || []).forEach(function (opt) {
        if (!opt.label) problems.push(id + ' has an answer with no label');
        if (!own(nodes, opt.next)) problems.push(id + ' -> missing node ' + opt.next);
      });
    });
    if (problems.length) return problems;

    var state = Object.create(null); // 1 = on the current path, 2 = finished
    function visit(id) {
      if (state[id] === 1) { problems.push('loop through ' + id); return; }
      if (state[id] === 2) return;
      state[id] = 1;
      (nodes[id].options || []).forEach(function (opt) { visit(opt.next); });
      state[id] = 2;
    }
    visit(chart.start);
    Object.keys(nodes).forEach(function (id) {
      if (!state[id]) problems.push(id + ' is unreachable from the start');
    });
    return problems;
  };

  /** chartProblems, plus the donut promise: 'yes' exists and is the only place a path can end. */
  joke.donutProblems = function (chart) {
    var problems = joke.chartProblems(chart);
    if (!own(chart.nodes, 'yes')) problems.push('yes is missing');
    Object.keys(chart.nodes).forEach(function (id) {
      if (chart.nodes[id].terminal && id !== 'yes') problems.push('terminal node ' + id + ' is not "yes"');
    });
    return problems;
  };

  // ---------------------------------------------------------------------
  // Scrap excuses: same format as the donut chart, but the answers lead to different ends
  // ---------------------------------------------------------------------

  /** Answer a few questions, get a tailored excuse. Every path ends at one of the terminal excuses. */
  joke.excuseChart = {
    start: 'start',
    nodes: {
      start: { q: 'What went out?',
        options: [{ label: 'A dimension', next: 'dim' }, { label: 'The surface finish', next: 'finish' },
          { label: 'The whole part', next: 'whole' }] },
      dim: { q: 'Did it ever measure good?',
        options: [{ label: 'Yes, earlier today', next: 'earlier' },
          { label: 'Only on the CMM in the other room', next: 'cmm' }, { label: 'No', next: 'never' }] },
      earlier: { q: 'What changed since then?',
        options: [{ label: 'The temperature', next: 'thermal' }, { label: 'The coolant', next: 'coolant' },
          { label: 'Somebody leaned on the machine', next: 'leaned' }] },
      never: { q: 'Was the print the latest revision?',
        options: [{ label: 'Yes', next: 'toolFine' }, { label: 'Define "latest"', next: 'revision' }] },
      finish: { q: 'What does the surface look like?',
        options: [{ label: 'Chatter', next: 'chatter' }, { label: 'Smeared', next: 'smeared' },
          { label: 'Shiny, which is the problem', next: 'shiny' }] },
      whole: { q: 'When did you last check it?',
        options: [{ label: 'Just now', next: 'gauge' }, { label: 'This morning', next: 'thermal' },
          { label: 'Never', next: 'suggestion' }] },
      cmm: { terminal: true, options: [],
        q: 'It is perfect on the CMM in the other room. Recommended action: measure it there.' },
      thermal: { terminal: true, options: [],
        q: 'Thermal growth. It was fine at 6 a.m. Recommended action: re-measure it after lunch.' },
      coolant: { terminal: true, options: [],
        q: 'The coolant concentration drifted. Recommended action: blame the refractometer, then re-measure.' },
      leaned: { terminal: true, options: [],
        q: 'It moved when somebody leaned on the machine. Recommended action: put up a sign.' },
      toolFine: { terminal: true, options: [],
        q: 'The tool was fine until it was not. Recommended action: call it "as-is" and move on.' },
      revision: { terminal: true, options: [],
        q: 'It was made to a different revision, in my heart. Recommended action: coffee, then decide.' },
      chatter: { terminal: true, options: [],
        q: 'Mercury is in retrograde, and so is the spindle. Recommended action: measure it again, but slower.' },
      smeared: { terminal: true, options: [],
        q: 'The material lot changed. Again. Recommended action: complain to purchasing, politely.' },
      shiny: { terminal: true, options: [],
        q: 'A finish that good is suspicious. Recommended action: nobody questions a shiny part.' },
      gauge: { terminal: true, options: [],
        q: 'The gauge has opinions. Recommended action: ask a second gauge.' },
      suggestion: { terminal: true, options: [],
        q: 'A print is a suggestion. Recommended action: coffee, then decide.' }
    }
  };

  // ---------------------------------------------------------------------
  // Tolerance translator
  // ---------------------------------------------------------------------

  // Linear thermal expansion of carbon steel, inches per inch per degree F: a typical handbook value of
  // 6.5 millionths (about 11.7e-6 per degree C); it varies a little by alloy. No standard governs the tiers
  // below; this constant is the one real number in the Break Room.
  var STEEL_EXPANSION_PER_DEGF = 6.5e-6;

  /** Ascending by the tightest tolerance (in thou, 0.001 in) each answer covers; the last covers the rest. */
  var TOLERANCE_TIERS = [
    { maxThou: 0.1, verdict: 'Are you sure that is not a typo? Your body heat is bigger than the tolerance.',
      instrument: 'A CMM in a temperature-controlled room, and nobody breathing near it' },
    { maxThou: 0.5, verdict: 'Bring the good gauge blocks and a sweater.',
      instrument: 'Gauge blocks, a comparator, and a lot of patience' },
    { maxThou: 1, verdict: 'Temperature matters now. Let the part cool down before you measure it.',
      instrument: 'A micrometer you trust, on a part at room temperature' },
    { maxThou: 5, verdict: 'Now we are talking. Micrometer time.', instrument: 'A micrometer' },
    { maxThou: 10, verdict: 'Calipers will do. Do not lean on them.', instrument: 'Calipers' },
    { maxThou: 30, verdict: 'Hold it up to the light.',
      instrument: 'A steel rule, or calipers if you are feeling fancy' },
    { maxThou: 1000, verdict: 'Close enough for government work.',
      instrument: 'A tape measure and good intentions' },
    { maxThou: Infinity, verdict: 'Eyecrometer. From across the shop.',
      instrument: 'An eyecrometer, from across the shop' }
  ];

  /** A length in inches or millimetres, converted to thou (0.001 in). Throws RangeError for anything else. */
  joke.lengthToThou = function (value, unit) {
    if (!Number.isFinite(value)) throw new RangeError('value must be finite');
    if (unit === 'in') return value * 1000;
    if (unit === 'mm') return value / 0.0254;
    throw new RangeError('unit must be "in" or "mm"');
  };

  /**
   * Shop-speak for a +/- tolerance given in thou (0.001 in). Returns the tier index (0 = tightest), a verdict,
   * what to measure it with, and the temperature swing (deg F) that would use up the whole tolerance on a
   * 1 inch carbon-steel part (dL = alpha * L * dT, alpha = 6.5e-6 per deg F). Novelty text on top of one
   * real formula; not a standard. Throws RangeError unless `tolThou` is positive and finite.
   */
  joke.toleranceTalk = function (tolThou) {
    if (!Number.isFinite(tolThou) || tolThou <= 0) throw new RangeError('tolThou must be positive and finite');
    var tier = 0;
    while (tolThou > TOLERANCE_TIERS[tier].maxThou) tier++;
    return {
      tier: tier,
      verdict: TOLERANCE_TIERS[tier].verdict,
      instrument: TOLERANCE_TIERS[tier].instrument,
      degF: round(tolThou / 1000 / STEEL_EXPANSION_PER_DEGF, 1)
    };
  };

  // ---------------------------------------------------------------------
  // Shift countdown
  // ---------------------------------------------------------------------

  /**
   * Where you are in a shift. All times are minutes since midnight (0 to <1440); a shift whose end is earlier
   * than its start runs past midnight. On the clock: minutes left, percent done, and how many coffee refills
   * (one per two hours) are still ahead. Off the clock: minutes until the next shift starts. Throws
   * RangeError for out-of-range times or a zero-length shift. Pure wall-clock arithmetic: on the two
   * daylight-saving changeover nights, a shift that spans the change is an hour off.
   */
  joke.shiftCountdown = function (nowMin, startMin, endMin) {
    [nowMin, startMin, endMin].forEach(function (t) {
      if (!Number.isFinite(t) || t < 0 || t >= 1440) throw new RangeError('times must be minutes since midnight');
    });
    var duration = (endMin - startMin + 1440) % 1440;
    if (duration === 0) throw new RangeError('the shift must have a length');
    var minutesIn = (nowMin - startMin + 1440) % 1440;
    if (minutesIn >= duration) {
      return { onShift: false, minutesUntilStart: (startMin - nowMin + 1440) % 1440, verdict: 'Off the clock.' };
    }
    var left = duration - minutesIn;
    var percent = round(minutesIn / duration * 100, 0);
    var verdict = 'Home stretch.';
    if (percent < 25) verdict = 'Long way to go.';
    else if (percent < 50) verdict = 'Warming up.';
    else if (percent < 75) verdict = 'Downhill from here.';
    return { onShift: true, minutesLeft: round(left, 0), percentDone: percent,
      coffeeRefills: Math.floor(left / 120), verdict: verdict };
  };

  // ---------------------------------------------------------------------
  // Unlock words for the Break Room
  // ---------------------------------------------------------------------

  /**
   * Typing either one (outside a form field) toggles the hidden panel: "coffee", or "M00", the G-code
   * program stop -- a break by definition. Lower-case here; callers lower-case what was typed.
   */
  joke.unlockWords = ['coffee', 'm00'];

  /** True when the most recently typed characters (lower-case, oldest first) end with an unlock word. */
  joke.unlockMatches = function (typed) {
    return joke.unlockWords.some(function (word) {
      return typed.length >= word.length && typed.slice(typed.length - word.length) === word;
    });
  };

  // True position is only true if you use the correct datums, and the correct datums are the ones the drawing
  // calls out, in the order the drawing calls them, except when the drawing says A|B|C and the part was set up
  // on C|A|B, in which case the part is fine and the drawing is a suggestion. Datum A is the primary datum,
  // meaning it controls the most, which is why it is the one nobody can find. Datum B locates the feature that
  // datum A was measured from, so B depends on A the way A depends on B, and if C is a hole at MMC then its
  // bonus tolerance is also a datum shift, which is not the same thing as the bonus, and is not the same thing
  // as the shift. Never mix RFS and MMC on one frame unless the frame is also mixed. If your position comes out
  // to 0.000 you measured from the feature you were measuring. Measure it from the feature it was made from,
  // then from the feature that was made from that, and stop when the answer agrees with you.

  return joke;
});
