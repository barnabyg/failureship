## Working here

The [README](README.md) covers playing and steering the game, and the code map. The data format is in [docs/content-format.md](docs/content-format.md).

### Verifying

- `npm run verify` runs every check: formatting, lint, types, engine tests, browser tests, dependency audit and build. The browser tests need Chromium once: `npx playwright install chromium`.
- One engine test: `npx vitest run <file> -t "<name>"`.
- One browser test: `npx playwright test <file> -g "<name>"`.

### Tests

- `tests/engine/` tests the rules headlessly, and a few checks on the builds and lint. `fixture.ts` there builds small content, and `src/engine/hidden-truth.ts` is the test-only read of the hidden truth.
- `tests/e2e/` holds the browser tests. `play.ts` there has the helpers for playing through a month. Most run against a test-only build, `vite build --mode e2e` in `dist-e2e/`, where `?month=N` starts a run at a later month, so use it when a test only needs walking months as setup. The start plays as `src/ui/later-month.ts` does, and `&choose=a,b` has it take those options, in order, on the way. `&last=N` ends the run as month N closes, with every rule still going by the run's eighteen months, so a test of the results screen need not walk the rest of them. `npm run build` and `npm run play` ignore both.
- `tests/tower/` tests the tower's fittings.
- `tests/engine/playtest-seeds.test.ts` keeps the seven seeds at the top of `docs/playtest.md` true, and `ways-of-playing.test.ts` gives the numbers in its balance section: change them together.

### Adding a game mechanic

A new mechanic is rarely a data-only change. It usually touches:

1. `content/*.json`, for its data and words, with its labels in `content/ui.json`.
2. `src/content/index.ts`, which imports a new data file and passes it to `parseContent`, and lists the panels' new `ui.json` keys in `panelSchema`.
3. The schema in `src/engine/`, with its checks across files beside it: `truth-schema.ts` and `truth-checks.ts`, `boss-schema.ts` and `boss-checks.ts`, or `consequence-schema.ts` and `consequence-checks.ts`, whichever the README's code map gives that kind of check. A mechanic with checks of its own, such as `floor-checks.ts`, `word-checks.ts` or `review-checks.ts`, has its own file, called from `content-checks.ts`. A step's own schema goes in `step-schema.ts`, a choice's effects in `outcome-schema.ts` and parts they all share in `basic-schema.ts`, with any checks in `content-checks.ts`. `contentSchema` in `content.ts` puts them together.
4. `src/engine/state.ts` for what it keeps in a run, and `dealtState` in `run.ts` for where that starts.
5. A mechanic's own module in `src/engine/` for the rules, added to the README's code map. A consequence takes effect through `applyOutcome` in `outcome.ts`, and `month.ts` holds the month's order. Reads that several mechanics share go in `reads.ts`. Anything offered or said in a Scene goes through `scenes.ts`.
6. `src/engine/view.ts` and `src/engine/to-view.ts`, for what the player sees, and `to-results.ts` for its reveal on the results screen.
7. `src/ui/panels.tsx`, for showing it, or `ScenePanel.tsx`, `FindOutPanel.tsx` or `ResultsPanel.tsx` where the step has its own panel. Header buttons and cards that stay up at every step, such as Your word given and the Gauges, are in `Header.tsx`, and `App.tsx` wires them to the run and holds the modals they open.
8. Tests in `tests/engine/` and `tests/e2e/`, and `docs/content-format.md`, whose section for the mechanic says what to write for it.

### Docs

Keep each agent-facing doc to 200 lines, and state each rule in one place. Two docs are allowed to be longer: `docs/content-format.md` is a reference read one section at a time, and `failureship-grill-outcome.md` is the owner's design record. Test scenarios for playing by hand are in [docs/playtest.md](docs/playtest.md).

### Vocabulary

The project's terms are in the [Language section of the grill outcome](failureship-grill-outcome.md#language), which stands in for a `GLOSSARY.md`. Use them.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on barnabyg/failureship, using the gh CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context, with no `GLOSSARY.md` or `docs/adr/` yet: [Vocabulary](#vocabulary) says where the terms are. See `docs/agents/domain.md`.
