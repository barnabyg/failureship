## Working here

The [README](README.md) covers playing and steering the game, and the code map. The data format is in [docs/content-format.md](docs/content-format.md).

### Verifying

- `npm run verify` runs every check. The browser tests need Chromium once: `npx playwright install chromium`.
- One engine test: `npx vitest run <file> -t "<name>"`.
- One browser test: `npx playwright test <file> -g "<name>"`.

### Tests

- `tests/engine/` tests the rules headlessly. `fixture.ts` there builds small content, and `src/engine/hidden-truth.ts` is the test-only read of the hidden truth.
- `tests/e2e/` holds the browser tests. `play.ts` there has the helpers for playing through a month.
- `tests/tower/` tests the tower's fittings.

### Adding a game mechanic

A new mechanic is rarely a data-only change. It usually touches:

1. `content/*.json`, for its data and words.
2. `src/engine/content.ts` for the schema, and `src/engine/content-checks.ts` for its checks across files.
3. `src/engine/run.ts`, or a mechanic's own module beside it, for the rules.
4. `src/engine/view.ts` and `src/engine/to-view.ts`, for what the player sees.
5. `src/ui/panels.tsx`, for showing it.
6. Tests in `tests/engine/` and `tests/e2e/`, and `docs/content-format.md`.

### Vocabulary

There is no glossary yet. The project's terms are in the [Language section of the grill outcome](failureship-grill-outcome.md#language). Use them.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on barnabyg/failureship, using the gh CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
