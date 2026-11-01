# Failureship

A satirical, single-player browser game. You climb a ten-storey office tower by
reading people. The design is in
[failureship-grill-outcome.md](failureship-grill-outcome.md).

This is the Phase 2 build: a run of six months on a blocked-out Floor 1, ready
for the owner to play and steer.

## Play

You need [Node.js](https://nodejs.org/) 22 or later. From the root of the
repository, run:

```powershell
npm run play
```

This installs anything missing the first time, starts the game and opens it in
your browser. If the browser does not open, go to the address the command prints.
Press `Ctrl+C` in the terminal to stop it.

## What to try

Every run has a seed, shown at the bottom right. Add `?seed=1` to the address to
pick one. The month has the same steps each time:

1. **A Notification arrives.** Answer it: finish the report or go to the pub.
   Each costs 1 of your 3 actions.
2. **Spend your remaining actions** by clicking a place on the floor or its label.
   The panel at the bottom left always says what you can do now.
3. **A Character Move lands on you.** You do not get a choice.
4. **The month closes** with the official story beside what actually happened.

Press **Org Chart** at any step to see the formal hierarchy, at no cost. The real
one is the hidden Power Map, dealt from the seed.

Press **Continue** on the official story to open the next month. After six months
the results screen shows who was really who: each Character's kind and Hidden
Fact, including facts you could never have known, and the Org Chart beside the
true Power Map.

At any step, **New run** deals a new seed, and typing a seed then pressing
**Restart from seed** plays that deal from month 1. Leaving a run in progress asks
first. Swap a seed with a friend and you both get the same deal.

### See each choice's different result

Start at `http://localhost:5173/?seed=8`.

| Try this                                                       | Expect                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Go to the pub                                                  | A short dialog with the office behind it. You learn the Buzzword "strategic patience", and it appears at the top of the screen.            |
| Then go to Meeting Room 1B                                     | The Scene offers an extra option about strategic patience. Using it gives its own result.                                                  |
| Restart, finish the report, then go to Meeting Room 1B         | No trace of the Buzzword option or the phrase anywhere in the month.                                                                       |
| In the meeting, agree with each person in turn across restarts | Seed 8 has Dennis holding influence in the room, so agreeing with Dennis goes well and agreeing with anyone else does not.                 |
| Repeat the meeting on seeds 1, 6 and 2                         | The signs point elsewhere: to Priya on seed 1, Marjorie on seed 6 and Callum on seed 2. The same choice now has a different result.        |
| Compare two official stories                                   | "As reported upstairs" and "What actually happened" change with the Notification answer, the Scene choice and how you spent other actions. |
| Skip the meeting altogether                                    | The official story records you as present anyway.                                                                                          |
| Restart the same seed and repeat your choices                  | The same Move and the same official story, every time.                                                                                     |

## Change the game

All the text and numbers are in `content/`, and editing them needs no code
change. The running game reloads when you save a file. If an edit breaks the
format, the page shows what is wrong instead of the game.

| File                  | What it holds                                                         |
| --------------------- | --------------------------------------------------------------------- |
| `ui.json`             | Headings, buttons and the "What you can do now" hints                 |
| `notifications.json`  | The month's Notifications, their choices and their results            |
| `dialogs.json`        | Short text dialogs, such as the pub                                   |
| `buzzwords.json`      | Buzzwords and their meanings                                          |
| `actions.json`        | What can be done on the floor, and the results                        |
| `scenes.json`         | The meeting: its signs, its choices and their results                 |
| `moves.json`          | Character Moves, and when each can land                               |
| `official-story.json` | The official story, assembled from entries according to what you did  |
| `characters.json`     | Names, public job titles and who reports to whom on the Org Chart     |
| `hidden-truth.json`   | The rules of the deal: kinds, their weights, and the Hidden Facts     |
| `balance.json`        | Actions a month, months in a run and the cost of each choice          |
| `floor-1.json`        | The rooms on the floor: positions, sizes, colours and the lift's sign |

In a Scene, `{holder}`, `{ignored}` and `{bystander}` are replaced by the names of
the most influential, the least influential and the next most influential of those
present, read from the dealt Power Map. `holderIs` means the same in a Scene's
results. A `when` or `requires` condition can be
`{ "holderIs": "boss" }`, `{ "hasBuzzword": "strategic-patience" }`,
`{ "flag": "went-to-pub" }`, `{ "not": ... }` or `{ "all": [...] }`. Options
gated with `requires` cannot depend on the hidden truth. Flags come from `sets`,
and are wiped when a new month opens. Buzzwords carry over for the whole run.

A Hidden Fact says `{name}`, so that it reads correctly for whoever is dealt it,
and can list `"characters"` to limit who that can be.

A Notification, action, Scene or Move can list `"months": [2, 3]` to belong only
to those months. Without it, it belongs to every month.

## Develop

`npm run verify` runs every check: formatting, lint, types, engine tests, browser
tests, dependency audit and build. The browser tests need Chromium once:
`npx playwright install chromium`.

- `content/` holds the game's data and text.
- `src/content/` loads and checks it at start-up.
- `src/engine/` holds the rules: headless, seeded, and free of Three.js and React.
- `src/tower/` draws the tower and holds no rules.
- `src/ui/` holds the React panels over the tower.

A Scene that data cannot express can name a `script`, which is passed to
`startRun` in `sceneScripts`. This format is a trial, as the spec says.

### Checks and exceptions

- Static bug analysis is the type-aware `typescript-eslint` strict rule set. It
  skips `eslint.config.js` and `scripts/`, which sit outside `tsconfig.json`.
- Secret scanning is not a separate gate: the project holds no credentials.
  Review this if it ever needs any.
- The `minimatch` override in `package.json` patches GHSA-g3hv-75wg-m249 in the
  lint tooling. Remove it when `eslint` depends on a patched version itself.
- `build.chunkSizeWarningLimit` in `vite.config.ts` is raised because Three.js
  is most of the single bundle. Review it if hosting is ever added.
- `.prettierignore` leaves the owner's design records and agent docs unformatted.
