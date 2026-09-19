/*
 * Break Room: the hidden novelty calculators (see CODING_NOTES "Easter Eggs"). Pure functions, no DOM,
 * same UMD shape as calc-core.js so tests/run.js can require it. Nothing here is a real machining
 * calculation and none of it is a standard.
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

  var DAILY_CAP_MG = 400;     // FDA and EFSA: up to ~400 mg/day is no safety concern for healthy adults
  var SERVING_CAP_MG = 200;   // EFSA: single doses up to 200 mg (~3 mg/kg for a 70 kg adult)
  var REFERENCE_KG = 70;      // the "typical adult" those two figures are quoted for

  /**
   * Novelty caffeine budget by body weight. NOT medical advice. Takes the commonly quoted adult ceilings --
   * 400 mg/day (FDA, EFSA) and 200 mg per single dose (~3 mg/kg, EFSA 2015 opinion) -- and scales them down
   * proportionally for anyone lighter than the 70 kg adult they're quoted for (never up past the cap).
   * `weightKg` 20-300, `drinkMg` > 0, `shiftHours` > 0; throws RangeError otherwise.
   * Returns daily and single-serving ceilings (mg), how many of the chosen drink that is, the spacing across
   * a shift, and a whole-drink verdict. `splitAdvice` is true when one serving already exceeds the
   * single-dose ceiling (e.g. a 16 oz Monster for someone under ~53 kg).
   */
  joke.caffeineBudget = function (weightKg, drinkMg, shiftHours) {
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
      throw new RangeError('weightKg must be between 20 and 300');
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
      drinksPerDay: round(drinks, 1),
      wholeDrinks: whole,
      hoursBetween: whole >= 1 ? round(shiftHours / whole, 1) : null,
      splitAdvice: drinkMg > servingMg,
      verdict: joke.caffeineVerdict(whole)
    };
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
   * Checks a chart is a well-formed "always ends at yes" tree: every `next` exists, no loops, every node is
   * reachable from the start, and every non-terminal node's paths all end at the single 'yes' terminal.
   * Returns a list of problems (empty when it's fine).
   */
  joke.donutProblems = function (chart) {
    var problems = [];
    var nodes = chart.nodes;
    if (!nodes[chart.start]) problems.push('start node missing');
    Object.keys(nodes).forEach(function (id) {
      var node = nodes[id];
      if (node.terminal) {
        if (id !== 'yes') problems.push('terminal node ' + id + ' is not "yes"');
        return;
      }
      if (!node.options || node.options.length < 2) problems.push(id + ' needs at least two answers');
      (node.options || []).forEach(function (opt) {
        if (!nodes[opt.next]) problems.push(id + ' -> missing node ' + opt.next);
      });
    });
    if (problems.length) return problems;

    var state = {}; // 1 = on the current path, 2 = finished
    var reached = {};
    function visit(id) {
      if (state[id] === 1) { problems.push('loop through ' + id); return; }
      if (state[id] === 2) return;
      state[id] = 1;
      reached[id] = true;
      nodes[id].options.forEach(function (opt) { visit(opt.next); });
      state[id] = 2;
    }
    visit(chart.start);
    Object.keys(nodes).forEach(function (id) {
      if (!reached[id]) problems.push(id + ' is unreachable from the start');
    });
    if (!reached.yes) problems.push('yes is never reached');
    return problems;
  };

  // ---------------------------------------------------------------------
  // Tolerance translator
  // ---------------------------------------------------------------------

  // Typical linear expansion of carbon steel, inches per inch per degree F (6.5 millionths).
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
    { maxThou: Infinity, verdict: 'Close enough for government work.',
      instrument: 'A tape measure and good intentions' }
  ];

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
  // Scrap excuse generator
  // ---------------------------------------------------------------------

  var EXCUSE_PARTS = ['The bore', 'The outside diameter', 'The thread', 'The flatness', 'The surface finish',
    'The whole part'];
  var EXCUSE_CAUSES = [
    'was fine at 6 a.m. Thermal growth.',
    'is perfect on the CMM in the other room.',
    'blames the coolant concentration.',
    'moved when somebody leaned on the machine.',
    'was made to a different revision, in my heart.',
    'went out when Mercury went retrograde.',
    'was fine until the tool was not.',
    'changed with the material lot. Again.'
  ];
  var EXCUSE_ACTIONS = [
    'Recommended action: re-measure it after lunch.',
    'Recommended action: measure it again, but slower.',
    'Recommended action: call it "as-is" and move on.',
    'Recommended action: coffee, then decide.'
  ];
  joke.excuseCount = EXCUSE_PARTS.length * EXCUSE_CAUSES.length * EXCUSE_ACTIONS.length;

  function pick(list, rng) {
    return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  }

  /** One clean, plausible-sounding reason the part is out. `rng` returns [0, 1) (defaults to Math.random). */
  joke.scrapExcuse = function (rng) {
    var r = rng || Math.random;
    return pick(EXCUSE_PARTS, r) + ' ' + pick(EXCUSE_CAUSES, r) + ' ' + pick(EXCUSE_ACTIONS, r);
  };

  // ---------------------------------------------------------------------
  // Shift countdown
  // ---------------------------------------------------------------------

  /**
   * Where you are in a shift. All times are minutes since midnight (0 to <1440); a shift whose end is earlier
   * than its start runs past midnight. On the clock: minutes left, percent done, and how many coffee refills
   * (one per two hours) are still ahead. Off the clock: minutes until the next shift starts. Throws
   * RangeError for out-of-range times or a zero-length shift.
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

  return joke;
});
