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

## Enum-like String Parameters (JS)

- **Reject unrecognized values instead of silently defaulting to one branch.** `calc.bonusTolerance`'s `featureType` used to treat anything except `'external'` as `'internal'`, so a typo or omitted argument would silently apply the wrong GD&T direction and return a confidently-wrong number. Throw (`RangeError`) on an unmatched value instead — caught by CodeRabbit in machinist-calc.

## JSDoc / Standard Citations (JS)

- **Cite the specific standard a formula implements, in the function's JSDoc.** E.g. tap drill/thread formulas → ASME B1.1 / ISO 68-1; true position → ASME Y14.5; IT tolerance grades → ISO 286-1. If no formal standard governs a formula (e.g. speeds & feeds, surface finish Ra), say so explicitly rather than citing nothing or citing the wrong standard. See `src/js/calc-core.js` in machinist-calc for the pattern.
- **A blanket "80% docstring coverage" automated check is not a target to chase.** CodeRabbit flagged 29.55% coverage in machinist-calc; declined to blanket-add docstrings to small, self-explanatory DOM-wiring helpers (`setupNav`, `fillSelect`, etc.) per the no-comments-unless-non-obvious rule above — only formula-bearing functions get JSDoc, and they already have it.

## Numeric Input Validation (JS)

- **Count-like inputs (flute count, hole count, etc.) must be validated as positive integers, not just non-NaN.** `setupFeedPerToothImperial`/`Metric` accepted 0, negative, and fractional flute counts, producing meaningless feed results — caught by CodeRabbit in machinist-calc. Use `!Number.isInteger(f) || f <= 0` alongside the `isNaN` check.

## Auto-Update (Network Exception)

- **machinist-calc**: the only network call in the app is the GitHub Releases update check in `main.js` (`electron-updater`, `build.publish` in `package.json`). Everything else must stay offline — don't add other outbound calls without updating the "no network calls" claims in README.md and `.claude/CLAUDE.md`.
- **Don't assume "which installer format" determines self-update support — verify against the actual updater, not intuition.** `electron-updater` self-updates NSIS (win), AppImage *and* `.deb` (linux, via system package manager) in place; only the win *portable* `.exe` is inherently excluded. macOS is blocked by lack of code signing (`CSC_IDENTITY_AUTO_DISCOVERY: false` in CI), not by `.dmg` vs `.zip` — caught by CodeRabbit in machinist-calc, an earlier note here had this backwards.

## Electron Event Listeners & Window Lifecycle

- **`once()` listeners for a user-triggered action must clean up on *every* outcome, not just the one you're watching for.** `checkForUpdatesManually` only removed its `update-not-available`/`error` listeners in those two handlers; an update-found result left them attached, firing again as stale duplicates on a later, unrelated check. Also guard re-entrancy (e.g. a double-click) with an in-progress flag. Caught by Claude review in machinist-calc.
- **Never pass a `BrowserWindow` as a dialog parent without checking `!win.isDestroyed()`.** On macOS the app outlives its windows (`window-all-closed` doesn't quit), so a long-running background op (e.g. an update download) can complete after the window that started it was closed — passing the stale reference throws. Null the reference on `'closed'` and fall back to no parent.

## ESLint Config Globals

- **`eslint.config.js`'s `main.js`/`preload.js` block hand-lists Node globals instead of using the `globals` package's Node set — it's missing timer functions (`setTimeout`, etc.) that weren't used until now.** Adding the auto-updater's `setTimeout` call failed CI (`no-undef`) on a global the main process has always had at runtime. Add each newly-used Node global explicitly here rather than assuming it's covered.

## Easter Eggs

- **machinist-calc**: Ctrl+Alt+Shift+M toggles a small hidden "Machinist's Rule 0" ASCII-art note (`#easter-egg` in `src/index.html`, wired in `src/js/app.js`'s `setupEasterEgg()`). Not referenced anywhere in the visible UI. Dismiss with Esc or a click.
