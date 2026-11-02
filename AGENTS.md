## Working here

The [README](README.md) covers playing and steering the game, and the code map. The data format is in [docs/content-format.md](docs/content-format.md).

### Verifying

- `npm run verify` runs every check: formatting, lint, types, engine tests, browser tests, dependency audit and build. The browser tests need Chromium once: `npx playwright install chromium`.
- One engine test: `npx vitest run <file> -t "<name>"`.
- One browser test: `npx playwright test <file> -g "<name>"`.

### Tests

- `tests/engine/` tests the rules headlessly, and a few checks on the builds and lint. `fixture.ts` there builds small content, and `src/engine/hidden-truth.ts` is the test-only read of the hidden truth.
- `tests/e2e/` holds the browser tests. `play.ts` there has the helpers for playing through a month. Most run against a test-only build, `vite build --mode e2e` in `dist-e2e/`, where `?month=N` starts a run at a later month, so use it when a test only needs walking months as setup. `npm run build` and `npm run play` ignore it.
- `tests/tower/` tests the tower's fittings.

### Adding a game mechanic

A new mechanic is rarely a data-only change. It usually touches:

1. `content/*.json`, for its data and words, with its labels in `content/ui.json`.
2. `src/content/index.ts`, which imports a new data file and passes it to `parseContent`, and lists the panels' new `ui.json` keys in `panelSchema`.
3. `src/engine/content.ts` for the schema, and for its checks across files `truth-checks.ts`, `boss-checks.ts`, `consequence-checks.ts` or `content-checks.ts`, whichever the README's code map gives that kind of check.
4. `src/engine/state.ts` for what it keeps in a run, and `dealtState` in `run.ts` for where that starts.
5. A mechanic's own module in `src/engine/` for the rules, added to the README's code map. A consequence takes effect through `applyOutcome` in `outcome.ts`, and `month.ts` holds the month's order. Reads that several mechanics share go in `reads.ts`. Anything offered or said in a Scene goes through `scenes.ts`.
6. `src/engine/view.ts` and `src/engine/to-view.ts`, for what the player sees, and `to-results.ts` for its reveal on the results screen.
7. `src/ui/panels.tsx`, for showing it, or `ScenePanel.tsx`, `FindOutPanel.tsx` or `ResultsPanel.tsx` where the step has its own panel. Header buttons and cards that stay up at every step, such as Your word given and the Gauges, are in `App.tsx`.
8. Tests in `tests/engine/` and `tests/e2e/`, and `docs/content-format.md`, whose section for the mechanic says what to write for it.

### Docs

Keep each agent-facing doc to 200 lines, and state each rule in one place. Two docs are allowed to be longer: `docs/content-format.md` is a reference read one section at a time, and `failureship-grill-outcome.md` is the owner's design record. Test scenarios for playing by hand are in [docs/playtest.md](docs/playtest.md).

### Vocabulary

There is no glossary yet. The project's terms are in the [Language section of the grill outcome](failureship-grill-outcome.md#language). Use them.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on barnabyg/failureship, using the gh CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. There is no `GLOSSARY.md` or `docs/adr/` yet: until one is made, the Language section named under Vocabulary stands in for `GLOSSARY.md`. See `docs/agents/domain.md`.
