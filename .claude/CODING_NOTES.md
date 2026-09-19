# Coding Best Practices & Reminders

> **Style rule:** Notes must be clear and concise — 300 characters or less each. Group by topic, not by date. Whenever a PR review (CodeRabbit or human) catches a mistake, add or amend a note here right away so it isn't repeated.

## Resource Cleanup & Temporary Files

This project is Electron/Node, not the Python/PyQt/PyInstaller stack the shared template's original note assumed (that guidance didn't apply here and was replaced per a 2026-08-12 review finding). Electron-specific: register `app.on('window-all-closed'/'before-quit')` handlers for any cleanup, avoid orphaning child processes, and close file handles opened via Node's `fs` module explicitly rather than relying on GC.

## General Style Notes

- **Keep lines under 120 characters.** Long lines are hard to review side-by-side in a diff or split editor pane, and tend to signal a line doing too many things at once. Wrap or break up expressions rather than letting them run long.
- **Add docstrings to explain code.** Focus on *why* a function/class exists or *why* it does something non-obvious — the code itself already shows *what* it does. A docstring worth writing usually covers intent, assumptions, edge cases, or a gotcha a future reader would otherwise have to rediscover the hard way.
- **Strip docstrings when building a release.** Release builds don't need internal rationale shipped alongside the binary — it bloats the artifact and can leak implementation notes you didn't mean to publish. Run Python with `-OO` (or an equivalent build step) to drop docstrings and assertions from the compiled output before packaging.

## GitHub Actions Security

- **Never interpolate `${{ github.* }}` context values directly into a `run:` shell script.** GitHub Actions substitutes `${{ }}` expressions as raw text *before* the shell runs, so an attacker-controllable value (tag name, branch name, PR title, commit message) can break out of quoting and execute arbitrary commands. Assign the value to `env:` and reference the shell variable (`"$VAR"`) instead — caught by CodeRabbit/zizmor on `github.ref_name`/`github.repository` in the release job.

## electron-builder Publish / Update Metadata

- **`electron-builder --publish never` skips generating `latest.yml`/`latest-mac.yml`/`latest-linux.yml`, not just uploading them.** Metadata generation is gated on the same internal flag as publishing (`isPublish`, true only when the policy isn't `never`), so a build-once-then-attach-artifacts-elsewhere release flow silently ships a working installer with a permanently broken auto-updater — CodeRabbit caught this in machinist-calc PR #5; verified against electron-builder's own `PublishManager` source rather than taking the fix suggestion at face value. Use `--publish always` (electron-builder's own documented CI pattern) in whatever job actually publishes the release, so metadata and installers are generated together.
- Electron-builder's GitHub publish defaults to a **draft** release (`releaseType: 'draft'`). Set `releaseType: 'release'` in `build.publish` (`package.json`) if the release should go live immediately on tag push, matching the previous `gh release create` (non-draft) behavior.

## Enum-like String Parameters (JS)

- **Reject unrecognized values instead of silently defaulting to one branch.** `calc.bonusTolerance`'s `featureType` used to treat anything except `'external'` as `'internal'`, so a typo or omitted argument would silently apply the wrong GD&T direction and return a confidently-wrong number. Throw (`RangeError`) on an unmatched value instead — caught by CodeRabbit in machinist-calc.

## JSDoc / Standard Citations (JS)

- **Cite the specific standard a formula implements, in the function's JSDoc.** E.g. tap drill/thread formulas → ASME B1.1 / ISO 68-1; true position → ASME Y14.5; IT tolerance grades → ISO 286-1. If no formal standard governs a formula (e.g. speeds & feeds, surface finish Ra), say so explicitly rather than citing nothing or citing the wrong standard. See `src/js/calc-core.js` in machinist-calc for the pattern.
- **A blanket "80% docstring coverage" automated check is not a target to chase.** CodeRabbit flagged 29.55% coverage in machinist-calc; declined to blanket-add docstrings to small, self-explanatory DOM-wiring helpers (`setupNav`, `fillSelect`, etc.) per the no-comments-unless-non-obvious rule above — only formula-bearing functions get JSDoc, and they already have it.

## Numeric Input Validation (JS)

- **Count-like inputs (flute count, hole count, etc.) must be validated as positive integers, not just non-NaN.** `setupFeedPerToothImperial`/`Metric` accepted 0, negative, and fractional flute counts, producing meaningless feed results — caught by CodeRabbit in machinist-calc. Use `!Number.isInteger(f) || f <= 0` alongside the `isNaN` check.
- **Squaring large-but-finite inputs (`a*a + b*b`, `c*c - a*a`) can overflow to `Infinity`/`NaN` well before any individual value looks unreasonable.** Use `Math.hypot(a, b)` instead of `Math.sqrt(a*a+b*b)`, and a scaled-ratio form (`c*Math.sqrt(1-(a/c)**2)`, algebraically `sqrt(c*c-a*a)`) instead of squaring raw large values directly — caught by CodeRabbit in machinist-calc (`rightTriangleSolve`).
- **This project's shared `round(value, decimals)` helper (`calc-core.js`) computes `value * 10^decimals` internally, which can itself overflow back to `Infinity` for a value large enough to survive the calculation above but not that multiplication.** Check `Number.isFinite` on the *rounded* return values, not just the raw pre-rounding ones, or a sufficiently extreme (but technically finite) input still silently returns `Infinity`. Self-caught in machinist-calc while fixing the overflow issue above — CodeRabbit's own suggested fix missed this second step.
- **`Number.isFinite` must guard *every* numeric-ish field a function accepts, not just the ones that were failing.** Adding `!Number.isFinite(a/b/c)` guards but leaving a coercive `angleADeg <= 0` bounds check let a string like `'30'` slip through (relational operators coerce; `Number.isFinite` doesn't) — same function, inconsistent rigor. Caught by CodeRabbit in machinist-calc (`rightTriangleSolve`).

- **A value validated as positive *before* rounding can still round to exactly 0 for display, and downstream code that only ever sees the rounded value won't know the difference.** `rtGeometry` divided by a solved leg's *rounded* value to compute a diagram scale factor; a raw leg of e.g. `4e-7` rounds to `0.00000`, so `maxW / 0` produced `Infinity`, cascading into `NaN` coordinates everywhere. Floor any value used as a divisor to a nominal positive fallback if it could legitimately round to 0. Caught by CodeRabbit in machinist-calc (`rtGeometry`).

- **`isNaN` alone doesn't reject `Infinity` from `parseFloat`.** A `type=number` field may hold `1e309` per the HTML spec, giving `Infinity`, which makes calc-core throw inside an input handler. Guard UI inputs with `Number.isFinite`. CodeRabbit, PR #12 (this Chromium clears such input).

## Multi-Way Solver UI Pattern (JS)

- **When the same fields serve as both input and auto-filled output (e.g. "enter any 2 of N, the rest solve"), don't decide "which N are known" from which fields are currently non-empty — once a solve fills every field, editing any one of them makes all N look filled.** Track the (at most 2) field keys the user most recently *typed into* and solve from only those, treating every other field as pure output to overwrite. Also skip overwriting whichever field currently has focus, or a live recalc mid-keystroke clobbers what's being typed. See `setupRightTriangle` in `src/js/app.js`. Self-caught in machinist-calc before this shipped.

## Geometry Formulas (JS)

- **A sin/cos swap is invisible at 45°/90°.** `toolFinish` joined arc to flanks at R·sin(θ/2), not R·cos(θ/2); all tests used 90°, so other angles shipped 15-20% off. Test 2+ asymmetric angles against an independently built shape, plus a slope-continuity scan. CodeRabbit, PR #12.

## HTML / CSS

- **An author rule like `label { display: flex }` beats the browser's `[hidden] { display: none }`, so `el.hidden = true` silently does nothing.** Add an explicit `label[hidden] { display: none; }` (as `.easter-egg[hidden]` does). Hit while prototyping a show/hide field in machinist-calc.

## ESLint Config Globals

- **`eslint.config.js` hand-lists globals per file group instead of using the `globals` package's built-in sets — each group is missing whichever globals its code hadn't needed yet.** Both the `main.js`/`preload.js`/`tests` block and the `src/js/**/*.js` (renderer) block were missing `setTimeout`/`clearTimeout` until something actually called them, failing CI (`no-undef`) each time. Add each newly-used global explicitly to the right block rather than assuming it's covered.

## Auto-Update (Network Exception)

- **machinist-calc**: the only network call in the app is the GitHub Releases update check in `main.js` (`electron-updater`, `build.publish` in `package.json`). Everything else must stay offline — don't add other outbound calls without updating the "no network calls" claims in README.md and `.claude/CLAUDE.md`.
- **Don't assume "which installer format" determines self-update support — verify against the actual updater, not intuition.** `electron-updater` self-updates NSIS (win), AppImage *and* `.deb` (linux, via system package manager) in place; only the win *portable* `.exe` is inherently excluded. macOS is blocked by lack of code signing (`CSC_IDENTITY_AUTO_DISCOVERY: false` in CI), not by `.dmg` vs `.zip` — caught by CodeRabbit in machinist-calc, an earlier note here had this backwards.
- **`checkForUpdates()`/`checkForUpdatesAndNotify()` resolve with `result.downloadPromise` when `autoDownload` finds an update — that's a separate promise from the check itself and needs its own `.catch()`**, or a later download failure (network drop mid-download, etc.) is an unhandled rejection even though the check-phase `.catch()` looks like it covers everything. Caught by CodeRabbit in machinist-calc.
- **Prefer `checkForUpdates()` over `checkForUpdatesAndNotify()`.** The "AndNotify" variant has its own internal `downloadPromise.then()` (for its native OS notification) with no rejection handler of its own — attaching `.catch()` to *your* reference to `downloadPromise` doesn't reach it, so a failed auto-download can still be an unhandled rejection. Caught by CodeRabbit in machinist-calc.

## Electron Event Listeners & Window Lifecycle

- **`once()` listeners for a user-triggered action must clean up on *every* outcome, not just the one you're watching for.** `checkForUpdatesManually` only removed its `update-not-available`/`error` listeners in those two handlers; an update-found result left them attached, firing again as stale duplicates on a later, unrelated check. Also guard re-entrancy (e.g. a double-click) with an in-progress flag. Caught by Claude review in machinist-calc.
- **Never pass a `BrowserWindow` as a dialog parent without checking `!win.isDestroyed()`.** On macOS the app outlives its windows (`window-all-closed` doesn't quit), so a long-running background op (e.g. an update download) can complete after the window that started it was closed — passing the stale reference throws. Null the reference on `'closed'` and fall back to no parent.

## ESLint Config Globals

- **`eslint.config.js`'s `main.js`/`preload.js` block hand-lists Node globals instead of using the `globals` package's Node set — it's missing timer functions (`setTimeout`, etc.) that weren't used until now.** Adding the auto-updater's `setTimeout` call failed CI (`no-undef`) on a global the main process has always had at runtime. Add each newly-used Node global explicitly here rather than assuming it's covered.

## Reference Data Extraction (PDF-Sourced Standards Tables)

- **Validate transcribed table data for completeness (every expected key present), not just consistency.** A regex parser dropped most external classes for ~30/39 sizes; a consistency-only check reported "0 issues" since it never checked for missing keys.
- **Prefer bbox/row-reconstructed PDF extraction over a flattened text blob + regex** for multi-column tables — designations split across lines by stacked-fraction glyphs (e.g. "1/4-20") break blob-based row matching.
- **Cross-validate a formula against the standard's own precomputed table, not just internal consistency.** `metricThreadTolerance` was confirmed by recomputing the book's Table 12/13 (100 rows) — 0 discrepancies.
- **A table matching `k*sqrt(x)` at every checkpoint isn't necessarily a continuous formula.** ACME Table 4/5 read that way, but the standard says "between two entries, use the larger/coarser" — discrete lookup. The formula alone got 458/460 right, silently missing 2; worked examples caught it.
- **Re-verify a reference spreadsheet's constants against the primary standard, not just its formulas' internal logic.** A shop ACME chart used `TPI < 10` for a clearance threshold (handbook proves `TPI <= 10`) and mislabeled 1-1/4in Acme as 4 TPI (handbook + the chart's own text label both say 5).

## Test Assertions (JS)

- **Asserting only one bound of a known range lets the other drift silently.** The Inconel carbide test checked `carbide[1] <= titanium.carbide[1]` but never pinned `[60, 120]` directly. Assert exact values when known, alongside any cross-row comparison. Caught by CodeRabbit, machinist-calc PR #11.

- **Ratio/relationship assertions must be checked against the *rounded* outputs.** A "cusp ≈ 4×Ra" test passed on raw values (4.001) but the rounded outputs gave 3.9898, outside its ±0.01 tolerance. Use inputs large enough that rounding is negligible. Self-caught in machinist-calc, cusp height.

## UI Behavior (JS)

- **Re-rendering a container that holds the focused button silently drops keyboard focus.** After swapping a wizard's buttons (innerHTML), focus a `tabindex="-1"` heading so keyboard and screen-reader users land on the new content; not on the first render. CodeRabbit, PR #17.
- **A secondary advice flag must repeat the headline number's precondition.** A "split the serving" note fired when zero whole servings fit the daily ceiling (`drinkMg > servingMg` alone), advising the very overshoot the number forbids. Guard it (`whole >= 1`) and test it. CodeRabbit, PR #17.
- **A validator that looks ids up with `obj[key]` accepts inherited names like `'constructor'`.** Use `hasOwnProperty` (and `Object.create(null)` for scratch maps), and validate labels and text, not just links. Independent review, PR #17.
- **Rounding for display can contradict a floored count shown beside it** (3.994 shows "4" next to "3 whole"). Floor the displayed value when a whole count sits next to it. Independent review, PR #17.
- **A theme rule that lists input types by name doesn't cover a new one.** `input[type=time]` rendered white on the dark theme. Check every new control type on the theme, and set `color-scheme` on it. Independent review, PR #17.
- **Register global listeners before setup code that can throw, and schedule the next timer tick before doing the work.** Otherwise one failure silently disables the feature or ends the refresh chain. Independent review, PR #17.
- **Derive a threshold quoted in a comment from the formula, and pin it with a boundary test.** A comment said 53 kg while the formula then gave 56 kg (160 x 70 / 200) and no test noticed. Independent review, PR #17.
- **A formula that switches branches at a threshold can jump (120 mg to 229 mg at 40 kg).** Blend the branches so the result is continuous, and test it with a sweep: never decreasing, bounded step size, and equal just either side of the threshold. Self-caught in machinist-calc, PR #17.

## Metric Thread Tolerance Class Notation (ISO 965-1)

- **A compound class like `4g6g` means pitch-diameter grade 4, major/minor-diameter grade 6 — not "grade 4 for everything."** First grade+letter = pitch diameter; second (if shown) = crest diameter. `6g` alone means `6g6g`.

## Easter Eggs

- **machinist-calc**: Ctrl+Alt+Shift+M toggles a small hidden "Machinist's Rule 0" ASCII-art note (`#easter-egg` in `src/index.html`, wired in `src/js/app.js`'s `setupEasterEgg()`). Not referenced anywhere in the visible UI. Dismiss with Esc or a click.
- **machinist-calc**: another hidden extra lives in `src/js/joke-calcs.js`, wired up by `setupBreakRoom()` in `src/js/app.js` (the unlock is in that function). Deliberately undocumented elsewhere; don't remove or "fix" it.
