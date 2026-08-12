# Coding Best Practices & Reminders

> **Style rule:** Notes must be clear and concise — 300 characters or less each. Group by topic, not by date. Whenever a PR review (CodeRabbit or human) catches a mistake, add or amend a note here right away so it isn't repeated.

## Resource Cleanup & Temporary Files

This project is Electron/Node, not the Python/PyQt/PyInstaller stack the shared template's original note assumed (that guidance didn't apply here and was replaced per a 2026-08-12 review finding). Electron-specific: register `app.on('window-all-closed'/'before-quit')` handlers for any cleanup, avoid orphaning child processes, and close file handles opened via Node's `fs` module explicitly rather than relying on GC.

## General Style Notes

- **Keep lines under 120 characters.** Long lines are hard to review side-by-side in a diff or split editor pane, and tend to signal a line doing too many things at once. Wrap or break up expressions rather than letting them run long.
- **Add docstrings to explain code.** Focus on *why* a function/class exists or *why* it does something non-obvious — the code itself already shows *what* it does. A docstring worth writing usually covers intent, assumptions, edge cases, or a gotcha a future reader would otherwise have to rediscover the hard way.
- **Strip docstrings when building a release.** Release builds don't need internal rationale shipped alongside the binary — it bloats the artifact and can leak implementation notes you didn't mean to publish. Run Python with `-OO` (or an equivalent build step) to drop docstrings and assertions from the compiled output before packaging.

## JSDoc / Standard Citations (JS)

- **Cite the specific standard a formula implements, in the function's JSDoc.** E.g. tap drill/thread formulas → ASME B1.1 / ISO 68-1; true position → ASME Y14.5; IT tolerance grades → ISO 286-1. If no formal standard governs a formula (e.g. speeds & feeds, surface finish Ra), say so explicitly rather than citing nothing or citing the wrong standard. See `src/js/calc-core.js` in machinist-calc for the pattern.
- **A blanket "80% docstring coverage" automated check is not a target to chase.** CodeRabbit flagged 29.55% coverage in machinist-calc; declined to blanket-add docstrings to small, self-explanatory DOM-wiring helpers (`setupNav`, `fillSelect`, etc.) per the no-comments-unless-non-obvious rule above — only formula-bearing functions get JSDoc, and they already have it.

## Easter Eggs

- **machinist-calc**: Ctrl+Alt+Shift+M toggles a small hidden "Machinist's Rule 0" ASCII-art note (`#easter-egg` in `src/index.html`, wired in `src/js/app.js`'s `setupEasterEgg()`). Not referenced anywhere in the visible UI. Dismiss with Esc or a click.
