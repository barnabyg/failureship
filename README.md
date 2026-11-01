# Failureship

A satirical, single-player browser game. You climb a ten-storey office tower by
reading people. The design is in
[failureship-grill-outcome.md](failureship-grill-outcome.md).

## Play

From the repository root, with Node.js 22 or later installed:

```powershell
npm run play
```

This installs anything missing, starts the game and opens it in your browser.

## Develop

`npm run verify` runs every check: formatting, lint, types, engine tests, browser
tests, dependency audit and build. The browser tests need Chromium once:
`npx playwright install chromium`.

- `content/` holds the game's data and text. Editing it needs no code change.
- `src/engine/` holds the rules: headless, seeded, and free of Three.js and React.
- `src/tower/` draws the tower and holds no rules.
- `src/ui/` holds the React panels over the tower.

### Checks and exceptions

- Static bug analysis is the type-aware `typescript-eslint` strict rule set.
- Secret scanning is not a separate gate: the project holds no credentials.
- The `minimatch` override in `package.json` patches GHSA-g3hv-75wg-m249 in the
  lint tooling. Remove it when `eslint` depends on a patched version itself.
- `.prettierignore` leaves the owner's design records and agent docs unformatted.
