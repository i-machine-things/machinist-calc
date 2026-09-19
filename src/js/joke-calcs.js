/*
 * Break Room: the hidden novelty calculators (see CODING_NOTES "Easter Eggs"). Pure functions, no DOM,
 * same UMD shape as calc-core.js so tests/run.js can require it. Novelty throughout (one real formula,
 * the steel thermal expansion, is called out where it appears) and none of it is a standard.
 *
 * Note from the author: after I did an independent blindfolded review of my own work, I found that I am
 * perfect and this all worked on the first try. Except for line 420. It seems a little half baked.
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

  var ADULT_DAILY_MG = 400;   // up to ~400 mg/day for a healthy adult (quoted by both the FDA and EFSA)
  var SERVING_CAP_MG = 200;   // EFSA only: single doses up to 200 mg...
  var SERVING_MG_PER_KG = 3;  // ...which is "about 3 mg/kg" (EFSA), so a per-kg figure works at any weight
  var REFERENCE_KG = 70;      // the "typical adult" the 400 mg/day figure is quoted for (~5.7 mg/kg/day)
  // EFSA's stricter level for children and adolescents is 3 mg/kg/day, which is what a very light person gets
  // here. From RAMP_START_KG the per-kg rate then rises in a straight line to the adult rate (400 mg over 70 kg,
  // ~5.7 mg/kg) by 70 kg, so the daily ceiling has no jumps. Above 70 kg it keeps scaling at that adult rate with
  // no cap. The ramp and the scaling above 70 kg are this app's own arithmetic, not agency figures.
  var RAMP_START_KG = 40;
  var LIGHT_DAILY_MG_PER_KG = 3;

  /** Daily ceiling (mg) at a given weight: 3 mg/kg, ramping up to the adult 400 mg at 70 kg, then proportional. */
  function dailyCeilingMg(weightKg) {
    var adultRate = ADULT_DAILY_MG / REFERENCE_KG;
    if (weightKg >= REFERENCE_KG) return adultRate * weightKg;
    if (weightKg <= RAMP_START_KG) return LIGHT_DAILY_MG_PER_KG * weightKg;
    var rate = LIGHT_DAILY_MG_PER_KG +
      (adultRate - LIGHT_DAILY_MG_PER_KG) * (weightKg - RAMP_START_KG) / (REFERENCE_KG - RAMP_START_KG);
    return rate * weightKg;
  }

  /**
   * Novelty caffeine budget by body weight. NOT medical advice. Works at any positive weight.
   * - One serving: 3 mg per kg (EFSA 2015: single doses up to 200 mg, "about 3 mg/kg" for a 70 kg adult),
   *   never above 200 mg. The FDA quotes no single-dose figure.
   * - Per day: 400 mg (FDA and EFSA) for a 70 kg adult. Lighter people get EFSA's stricter 3 mg/kg/day for
   *   children and adolescents, with the per-kg rate rising in a straight line from 40 kg to the adult rate at
   *   70 kg, and heavier people keep scaling at that adult rate with NO cap (see dailyCeilingMg). Neither agency
   *   publishes a per-kg ceiling above 400 mg, so everything above 70 kg is this app's extrapolation, and the
   *   FDA cites seizures at around 1,200 mg taken quickly.
   * `weightKg` and `drinkMg` and `shiftHours` must be positive and finite; throws RangeError otherwise.
   * Returns daily and single-serving ceilings (mg), how many of the chosen drink that is, the spacing across
   * a shift, and a whole-drink verdict. `splitAdvice` is true when at least one whole drink fits the daily
   * ceiling but one serving exceeds the single-dose ceiling (a 160 mg can for anyone from ~45 up to ~53 kg);
   * when not even one whole drink fits, the advice is water, not "split it". `shareAdvice` is true when the
   * whole day's ceiling is one drink or less (including less than one), so the app suggests splitting it.
   */
  joke.caffeineBudget = function (weightKg, drinkMg, shiftHours) {
    if (!Number.isFinite(weightKg) || weightKg <= 0) throw new RangeError('weightKg must be positive');
    if (!Number.isFinite(drinkMg) || drinkMg <= 0) throw new RangeError('drinkMg must be positive');
    if (!Number.isFinite(shiftHours) || shiftHours <= 0) throw new RangeError('shiftHours must be positive');

    var dailyMg = dailyCeilingMg(weightKg);
    var servingMg = Math.min(SERVING_CAP_MG, SERVING_MG_PER_KG * weightKg);
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
      shareAdvice: drinks <= 1,
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

  /**
   * Answer a few questions, get a tailored excuse: about 30 questions leading to 72 different excuses, and
   * every path ends at one of them. Same format as the donut chart (see chartProblems for what is checked).
   */
  joke.excuseChart = {
    start: 'start',
    nodes: {
      // What went out?
      start: { q: 'What went out?',
        options: [
          { label: 'A dimension', next: 'dim' },
          { label: 'The surface finish', next: 'finish' },
          { label: 'The whole part', next: 'whole' },
          { label: 'A thread', next: 'thread' },
          { label: 'A hole', next: 'hole' },
          { label: 'Flatness, squareness or runout', next: 'geo' },
          { label: 'Something broke', next: 'broke' },
          { label: 'It is the wrong part', next: 'wrong' }
        ] },
      // Dimensions
      dim: { q: 'Did it ever measure good?',
        options: [
          { label: 'Yes, earlier today', next: 'earlier' },
          { label: 'Only on the CMM in the other room', next: 'cmm' },
          { label: 'Only when I measured it', next: 'mine' },
          { label: 'No', next: 'never' }
        ] },
      earlier: { q: 'What changed since then?',
        options: [
          { label: 'The temperature', next: 'temp' },
          { label: 'The coolant', next: 'coolant' },
          { label: 'Somebody leaned on the machine', next: 'leaned' },
          { label: 'Nothing, I checked', next: 'nothing' }
        ] },
      temp: { q: 'Where has the part been?',
        options: [
          { label: 'Right off the machine', next: 'hotpart' },
          { label: 'In my hand', next: 'handpart' },
          { label: 'Under the skylight', next: 'skylight' },
          { label: 'In the truck', next: 'truck' }
        ] },
      never: { q: 'Was the print the latest revision?',
        options: [
          { label: 'Yes', next: 'toolFine' },
          { label: 'Define "latest"', next: 'revision' },
          { label: 'There was no print', next: 'noPrint' }
        ] },
      cmm: { terminal: true, options: [],
        q: 'It is perfect on the CMM in the other room. Recommended action: measure it there.' },
      mine: { terminal: true, options: [],
        q: 'It measured good when I did it. Measuring is a skill. Recommended action: measure it' +
          ' again and let the part decide who is right.' },
      coolant: { terminal: true, options: [],
        q: 'The coolant concentration drifted. Recommended action: blame the refractometer, then' +
          ' re-measure.' },
      leaned: { terminal: true, options: [],
        q: 'It moved when somebody leaned on the machine. Recommended action: put up a sign.' },
      nothing: { terminal: true, options: [],
        q: 'Nothing changed, which is exactly what changed. Recommended action: check what the ' +
          'gauge did.' },
      hotpart: { terminal: true, options: [],
        q: 'It was measured right off the machine and it is still cooling down. Recommended ' +
          'action: let it reach room temperature, then measure it.' },
      handpart: { terminal: true, options: [],
        q: 'Body heat is bigger than the tolerance. Recommended action: hold it with a clean ' +
          'rag, not your hand.' },
      skylight: { terminal: true, options: [],
        q: 'The skylight grew the part and nobody asked it to. Recommended action: measure it in' +
          ' the shade.' },
      truck: { terminal: true, options: [],
        q: 'A part that rode in a truck has seen things. Recommended action: let it settle, then' +
          ' measure it.' },
      toolFine: { terminal: true, options: [],
        q: 'The tool was fine until it was not. Recommended action: call it "as-is" and move on.' },
      revision: { terminal: true, options: [],
        q: 'It was made to a different revision, in my heart. Recommended action: coffee, then ' +
          'decide.' },
      noPrint: { terminal: true, options: [],
        q: 'There was no print, so nothing is out. Recommended action: ask for a print and enjoy' +
          ' the silence.' },
      // Surface finish
      finish: { q: 'What does the surface look like?',
        options: [
          { label: 'Chatter', next: 'chatter' },
          { label: 'Smeared', next: 'smeared' },
          { label: 'Scratched', next: 'scratched' },
          { label: 'Dull', next: 'dull' },
          { label: 'Shiny, which is the problem', next: 'shiny' }
        ] },
      chatter: { q: 'Where is it worst?',
        options: [
          { label: 'On the thin section', next: 'thin' },
          { label: 'Everywhere', next: 'everywhere' },
          { label: 'Only after lunch', next: 'afterLunch' },
          { label: 'It comes and goes', next: 'mercury' }
        ] },
      smeared: { q: 'What is the insert like?',
        options: [
          { label: 'Brand new', next: 'newInsert' },
          { label: 'The one that was fine yesterday', next: 'oldInsert' },
          { label: 'I have not looked', next: 'noLook' },
          { label: 'The insert is fine, the material feels gummy', next: 'lot' }
        ] },
      scratched: { q: 'Where did the scratch come from?',
        options: [
          { label: 'The chip', next: 'chipScratch' },
          { label: 'The gauge', next: 'gaugeScratch' },
          { label: 'It came that way', next: 'cameScratch' }
        ] },
      thin: { terminal: true, options: [],
        q: 'The thin section is a tuning fork with a job. Recommended action: support it, or ' +
          'slow it down.' },
      everywhere: { terminal: true, options: [],
        q: 'When everything chatters it is the machine, the tool, or Mercury. Recommended ' +
          'action: change the speed by 10 percent and see who blinks.' },
      afterLunch: { terminal: true, options: [],
        q: 'The machine is a creature of habit and lunch is not in the program. Recommended ' +
          'action: warm it up again.' },
      mercury: { terminal: true, options: [],
        q: 'Mercury is in retrograde, and so is the spindle. Recommended action: measure it ' +
          'again, but slower.' },
      newInsert: { terminal: true, options: [],
        q: 'A new insert has not learned the job yet. Recommended action: give it a few parts to' +
          ' break in.' },
      oldInsert: { terminal: true, options: [],
        q: 'The insert was fine yesterday, and today is a different day. Recommended action: ' +
          'index it.' },
      noLook: { terminal: true, options: [],
        q: 'You cannot blame the insert without looking at it. Recommended action: look at it.' },
      lot: { terminal: true, options: [],
        q: 'The material lot changed. Again. Recommended action: complain to purchasing, ' +
          'politely.' },
      chipScratch: { terminal: true, options: [],
        q: 'A chip got dragged across the finish like a tiny plow. Recommended action: add an ' +
          'air blast or a chip breaker.' },
      gaugeScratch: { terminal: true, options: [],
        q: 'The gauge is fine; the part is just sensitive. Recommended action: clean the gauge ' +
          'and wipe the part.' },
      cameScratch: { terminal: true, options: [],
        q: 'It came that way, and the bar stock has a lot to answer for. Recommended action: ' +
          'check the bar for scratches before it goes in.' },
      dull: { terminal: true, options: [],
        q: 'It is not dull, it is matte, and matte is a choice. Recommended action: ask whether ' +
          'a matte finish is acceptable.' },
      shiny: { terminal: true, options: [],
        q: 'A finish that good is suspicious. Recommended action: nobody questions a shiny part.' },
      // The whole part
      whole: { q: 'When did you last check it?',
        options: [
          { label: 'Just now', next: 'gauge' },
          { label: 'This morning', next: 'thermal' },
          { label: 'Before lunch', next: 'beforeLunch' },
          { label: 'Never', next: 'suggestion' },
          { label: 'Nobody has seen it yet', next: 'schrodinger' }
        ] },
      gauge: { terminal: true, options: [],
        q: 'The gauge has opinions. Recommended action: ask a second gauge.' },
      thermal: { terminal: true, options: [],
        q: 'Thermal growth. It was fine at 6 a.m. Recommended action: re-measure it after lunch.' },
      beforeLunch: { terminal: true, options: [],
        q: 'It was fine before lunch, and lunch is when things change. Recommended action: find ' +
          'out what happened at lunch.' },
      suggestion: { terminal: true, options: [],
        q: 'A print is a suggestion. Recommended action: coffee, then decide.' },
      schrodinger: { terminal: true, options: [],
        q: 'Until it is measured it is both in and out of tolerance. Recommended action: measure' +
          ' it anyway, and be brave.' },
      // Threads
      thread: { q: 'What does the gauge say?',
        options: [
          { label: 'The go gauge will not go', next: 'goFail' },
          { label: 'The no-go goes', next: 'noGoGoes' },
          { label: 'Both are fine but it will not assemble', next: 'assemble' }
        ] },
      goFail: { q: 'Is the gauge clean?',
        options: [
          { label: 'Yes', next: 'gaugeClean' },
          { label: 'Define "clean"', next: 'gaugeDirty' },
          { label: 'I have not looked', next: 'gaugeLook' }
        ] },
      noGoGoes: { q: 'What is the thread insert like?',
        options: [
          { label: 'Brand new', next: 'newThread' },
          { label: 'Old and tired', next: 'oldThread' }
        ] },
      // True position is only true if you use the correct datums, and the correct datums are the ones the drawing
      // calls out, in the order the drawing calls them, except when the drawing says A|B|C and the part was set up
      // on C|A|B, in which case the part is fine and the drawing is a suggestion. Datum A is the primary datum,
      // meaning it controls the most, which is why it is the one nobody can find. Datum B locates the feature that
      // datum A was measured from, so B depends on A the way A depends on B, and if C is a hole at MMC then its
      // bonus tolerance is also a datum shift, which is not the same thing as the bonus, and is not the same thing
      // as the shift. Never mix RFS and MMC on one frame unless the frame is also mixed. If your position comes out
      // to 0.000 you measured from the feature you were measuring. Measure it from the feature it was made from,
      // then from the feature that was made from that, and stop when the answer agrees with you. If the answer still
      // refuses to agree, that is a datum problem and a coffee problem in equal parts. Type coffee. Or M00, which is
      // the same thing with a program stop, and start again from datum A, wherever you left it.

      assemble: { q: 'What does the mating part say?',
        options: [
          { label: 'It is perfect', next: 'matePerfect' },
          { label: 'It is out too', next: 'mateOut' },
          { label: 'I did not check', next: 'mateNone' }
        ] },
      gaugeClean: { terminal: true, options: [],
        q: 'The gauge is clean, so the thread has an opinion. Recommended action: check the ' +
          'pitch and the thread form.' },
      gaugeDirty: { terminal: true, options: [],
        q: 'Clean is a relative term. Recommended action: wipe the gauge and try again.' },
      gaugeLook: { terminal: true, options: [],
        q: 'You cannot blame the thread until you have looked at the gauge. Recommended action: ' +
          'look at the gauge.' },
      newThread: { terminal: true, options: [],
        q: 'A new thread insert cuts a little too honest. Recommended action: take a spring ' +
          'pass.' },
      oldThread: { terminal: true, options: [],
        q: 'The insert is old and tired and the thread shows it. Recommended action: give it a ' +
          'new edge.' },
      matePerfect: { terminal: true, options: [],
        q: 'Two perfect parts should fit. They are probably just shy. Recommended action: ' +
          'introduce them slowly.' },
      mateOut: { terminal: true, options: [],
        q: 'Two parts, out in opposite directions. Recommended action: alert the Quality ' +
          'department immediately.' },
      mateNone: { terminal: true, options: [],
        q: 'You cannot say it will not assemble without a mate. Recommended action: check the ' +
          'mating part.' },
      // Holes
      hole: { q: 'What is wrong with the hole?',
        options: [
          { label: 'Too big', next: 'holeBig' },
          { label: 'Too small', next: 'holeSmall' },
          { label: 'Out of round', next: 'holeRound' },
          { label: 'In the wrong place', next: 'holePlace' },
          { label: 'Tapered', next: 'holeTaper' }
        ] },
      holeBig: { q: 'How was it made?',
        options: [
          { label: 'Drilled', next: 'drilled' },
          { label: 'Bored', next: 'bored' },
          { label: 'Reamed', next: 'reamed' }
        ] },
      holeSmall: { q: 'Was it measured warm?',
        options: [
          { label: 'Yes', next: 'warmSmall' },
          { label: 'No', next: 'coldSmall' }
        ] },
      holeRound: { q: 'How many lobes does it have?',
        options: [
          { label: 'Two', next: 'twoLobe' },
          { label: 'Three', next: 'threeLobe' },
          { label: 'It is random', next: 'randomLobe' }
        ] },
      holePlace: { q: 'Which datum did you use?',
        options: [
          { label: 'The one the print calls out', next: 'datumPrint' },
          { label: 'The convenient one', next: 'datumConvenient' },
          { label: 'What is a datum?', next: 'datumWhat' }
        ] },
      holeTaper: { q: 'Which end is bigger?',
        options: [
          { label: 'The far end', next: 'farEnd' },
          { label: 'The near end', next: 'nearEnd' }
        ] },
      drilled: { terminal: true, options: [],
        q: 'Drills are optimists and they wander. Recommended action: spot it first, then drill.' },
      bored: { terminal: true, options: [],
        q: 'The boring bar deflected, and it is sorry. Recommended action: shorten the overhang.' },
      reamed: { terminal: true, options: [],
        q: 'The reamer was sharp and the hole is grateful. Recommended action: measure the ' +
          'reamer.' },
      warmSmall: { terminal: true, options: [],
        q: 'It shrank when it cooled off. Recommended action: measure it at room temperature.' },
      coldSmall: { terminal: true, options: [],
        q: 'It was measured cold, so it is honest. Recommended action: check the size of the ' +
          'tool.' },
      twoLobe: { terminal: true, options: [],
        q: 'Two lobes means the chuck jaws squeezed it. Recommended action: use soft jaws or ' +
          'less pressure.' },
      threeLobe: { terminal: true, options: [],
        q: 'Three lobes means a three-jaw chuck squeezed it. Recommended action: lighter ' +
          'clamping, or soft jaws bored to size.' },
      randomLobe: { terminal: true, options: [],
        q: 'Random lobes are vibration with a personality. Recommended action: change the speed.' },
      datumPrint: { terminal: true, options: [],
        q: 'The print datum and the machine datum are not on speaking terms. Recommended action:' +
          ' check the work offset.' },
      datumConvenient: { terminal: true, options: [],
        q: 'A convenient datum is a bad influence. Recommended action: use the datums the print ' +
          'calls out, in the order it calls them.' },
      datumWhat: { terminal: true, options: [],
        q: 'A datum is where the truth begins. Recommended action: read the print, then read it ' +
          'again.' },
      farEnd: { terminal: true, options: [],
        q: 'The far end grew because the tailstock is having a moment. Recommended action: check' +
          ' the alignment.' },
      nearEnd: { terminal: true, options: [],
        q: 'The spindle is leaning toward the operator. Recommended action: coffee, then ' +
          'indicate it in.' },
      // Flatness, squareness and runout
      geo: { q: 'What is it?',
        options: [
          { label: 'Not flat', next: 'notFlat' },
          { label: 'Not square', next: 'notSquare' },
          { label: 'Runout', next: 'runout' },
          { label: 'Not parallel', next: 'notParallel' }
        ] },
      notFlat: { q: 'Did it move after it came off the machine?',
        options: [
          { label: 'Yes, when I released the vise', next: 'viseRelease' },
          { label: 'It moved on the granite', next: 'graniteMove' },
          { label: 'It never moved', next: 'neverMoved' }
        ] },
      notSquare: { q: 'How square was the stock?',
        options: [
          { label: 'Square', next: 'squareStock' },
          { label: 'A parallelogram', next: 'paraStock' }
        ] },
      runout: { q: 'Where did you measure it?',
        options: [
          { label: 'Between centers', next: 'centers' },
          { label: 'In the chuck', next: 'inChuck' },
          { label: 'On the spindle', next: 'onSpindle' }
        ] },
      notParallel: { q: 'How was it made?',
        options: [
          { label: 'Ground', next: 'ground' },
          { label: 'Milled', next: 'milled' }
        ] },
      viseRelease: { terminal: true, options: [],
        q: 'The part remembers being squeezed. Recommended action: release the clamps gently and' +
          ' re-measure.' },
      graniteMove: { terminal: true, options: [],
        q: 'Stress relief happens on its own schedule. Recommended action: give it a day.' },
      neverMoved: { terminal: true, options: [],
        q: 'It never moved, which means the granite is not flat. Recommended action: check the ' +
          'granite.' },
      squareStock: { terminal: true, options: [],
        q: 'The stock was square, so the vise jaws are not. Recommended action: indicate the ' +
          'jaws.' },
      paraStock: { terminal: true, options: [],
        q: 'Garbage in, garbage out. Recommended action: check the stock before it goes in the ' +
          'vise.' },
      centers: { terminal: true, options: [],
        q: 'The centers are the datum and the datum is on vacation. Recommended action: clean ' +
          'the centers.' },
      inChuck: { terminal: true, options: [],
        q: 'The chuck has runout left over from another job. Recommended action: indicate the ' +
          'chuck.' },
      onSpindle: { terminal: true, options: [],
        q: 'Now it is a real problem. Recommended action: call the service tech and bring ' +
          'coffee.' },
      ground: { terminal: true, options: [],
        q: 'Grinders have opinions. Recommended action: spark out longer.' },
      milled: { terminal: true, options: [],
        q: 'The face mill leaves a memory. Recommended action: take a light finishing pass.' },
      // Something broke
      broke: { q: 'What broke?',
        options: [
          { label: 'The tool', next: 'toolBroke' },
          { label: 'The part', next: 'partBroke' },
          { label: 'The machine', next: 'machineBroke' },
          { label: 'My spirit', next: 'spirit' }
        ] },
      toolBroke: { q: 'Was the tool new?',
        options: [
          { label: 'Yes', next: 'newTool' },
          { label: 'No, it was old', next: 'oldTool' }
        ] },
      partBroke: { q: 'When did it break?',
        options: [
          { label: 'While cutting', next: 'cutBreak' },
          { label: 'When it was dropped', next: 'dropBreak' }
        ] },
      machineBroke: { q: 'What did the machine say?',
        options: [
          { label: 'Nothing, it just stopped', next: 'silent' },
          { label: 'A noise', next: 'noise' },
          { label: 'An alarm code', next: 'alarm' }
        ] },
      newTool: { terminal: true, options: [],
        q: 'It was fine right out of the box. Recommended action: file a complaint with the box.' },
      oldTool: { terminal: true, options: [],
        q: 'It gave everything it had. Recommended action: a moment of silence, then a new ' +
          'insert.' },
      cutBreak: { terminal: true, options: [],
        q: 'It did not want to be that shape. Recommended action: slow the feed.' },
      dropBreak: { terminal: true, options: [],
        q: 'Gravity was not consulted. Recommended action: file a report and pad the floor.' },
      silent: { terminal: true, options: [],
        q: 'It is on strike. Recommended action: check the coolant level, then the breaker.' },
      noise: { terminal: true, options: [],
        q: 'A noise is the machine giving its opinion. Recommended action: listen closely, then ' +
          'call maintenance.' },
      alarm: { terminal: true, options: [],
        q: 'The alarm code is in the manual. Recommended action: look it up before pressing ' +
          'reset again.' },
      spirit: { terminal: true, options: [],
        q: 'Your spirit is fine, it is just out of coffee. Recommended action: coffee.' },
      // The wrong part
      wrong: { q: 'How is it wrong?',
        options: [
          { label: 'Wrong revision', next: 'revision' },
          { label: 'Wrong material', next: 'wrongMaterial' },
          { label: 'Wrong quantity', next: 'wrongQty' },
          { label: 'Somebody else\'s part', next: 'wrongCustomer' }
        ] },
      wrongMaterial: { terminal: true, options: [],
        q: 'It is the right part in the wrong material. Recommended action: check the cert ' +
          'against the bar.' },
      wrongQty: { terminal: true, options: [],
        q: 'The count is a rounding error. Recommended action: count again, slower.' },
      wrongCustomer: { terminal: true, options: [],
        q: 'Somebody, somewhere, is happy. Recommended action: find out who.' }
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

  return joke;
});
