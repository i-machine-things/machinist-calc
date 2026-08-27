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

## Multi-Way Solver UI Pattern (JS)

- **When the same fields serve as both input and auto-filled output (e.g. "enter any 2 of N, the rest solve"), don't decide "which N are known" from which fields are currently non-empty — once a solve fills every field, editing any one of them makes all N look filled.** Track the (at most 2) field keys the user most recently *typed into* and solve from only those, treating every other field as pure output to overwrite. Also skip overwriting whichever field currently has focus, or a live recalc mid-keystroke clobbers what's being typed. See `setupRightTriangle` in `src/js/app.js`. Self-caught in machinist-calc before this shipped.

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

## Metric Thread Tolerance Class Notation (ISO 965-1)

- **A compound class like `4g6g` means pitch-diameter grade 4, major/minor-diameter grade 6 — not "grade 4 for everything."** First grade+letter = pitch diameter; second (if shown) = crest diameter. `6g` alone means `6g6g`.

## Easter Eggs

- **machinist-calc**: Ctrl+Alt+Shift+M toggles a small hidden "Machinist's Rule 0" ASCII-art note (`#easter-egg` in `src/index.html`, wired in `src/js/app.js`'s `setupEasterEgg()`). Not referenced anywhere in the visible UI. Dismiss with Esc or a click.
