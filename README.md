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

Every run has a seed, shown at the top right. Add `?seed=8` to the address to pick
one. Each of the six months has the same shape and different contents:

1. **A Notification arrives.** Answer it. The answer may cost one of your 3 actions.
2. **Spend your remaining actions** by clicking a place on the floor or its label.
   The panel at the bottom left always says what you can do now.
3. **A Character Move lands on you.** You do not get a choice.
4. **The month closes** with the official story beside what actually happened.

There are three ways to spend an action:

- **Meeting Room 1B** opens that month's Scene. Everyone present behaves according
  to their dealt kind, and no single sign settles what they are. Your boss's
  treatment of you shows what they think of you, but only roughly.
- **The photocopier** and **the loading bay** are Find Out. You pick a source and a
  subject, and get a claim that may be true, mistaken, out of date or deliberately
  false. Asking is mostly about people. Buying is mostly about Hidden Facts.
- **The kitchen, Priya's desk and your desk** do what they look like.

Press **Notebook** at any step, at no cost. It keeps claims and important signs for
you, and it never says which to trust. Mark each Character with the kind you suspect.

Press **Org Chart** at any step to see the formal hierarchy, also at no cost. The real
one is the hidden Power Map, dealt from the seed.

After six months the results screen shows who was really who: each Character's kind
and Hidden Fact, your marks against the truth, each claim and whether it was true,
each clue and what it was worth, and the Org Chart beside the true Power Map.

At any step, **New run** deals a new seed, and typing a seed then pressing
**Restart from seed** plays that deal from month 1. Leaving a run in progress asks
first. Swap a seed with a friend and you both get the same deal.

### A test scenario: two contrasting deals

This takes about ten minutes, and it gives away two deals, so use other seeds if you
want to play blind. Seeds 8 and 1 differ in who runs the floor and whose secrets are
dangerous. Start at `http://localhost:5173/?seed=8`.

| Try this                                                                       | Expect                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seed 8. In month 1 go to the pub, then Meeting Room 1B                         | You learn "strategic patience", and the Scene offers an extra option using it. The signs point to Dennis.                                                    |
| Agree warmly with Dennis                                                       | It goes well: Dennis holds influence on this seed.                                                                                                           |
| Open the Notebook, and mark Dennis as anything you like                        | The action count does not change, and new clues are at the top.                                                                                              |
| Month 2. In the Lessons Learned Review, say that the delay began with Callum   | It goes badly, and you are not told why. At the end, the results screen explains: Callum has a dangerous Hidden Fact.                                        |
| Restart from seed 1, and do the same in month 2                                | Callum takes the blame and you get away with it. Blaming Priya is what goes badly on this seed.                                                              |
| In month 1 on seed 1, look at who the signs point to                           | They point to Priya, not Dennis. The same warm agreement with Dennis now does little for you. Signs mislead about one Scene in five, so watch more than one. |
| Compare how your boss treats you in month 2 after agreeing with Dennis or Hugh | The sign under "How your boss is with you" is usually warmer after agreeing with Dennis. No sign is sure.                                                    |
| Go to the loading bay, buy from Marjorie, and ask about someone                | Often a Hidden Fact. If it is one of the useful ones, a later Scene offers a new option about it, whether it is true.                                        |
| Play to the end of any run, and read the results screen                        | Your marks against the truth, each claim's truth, and which clues were false or did not matter.                                                              |
| Restart the same seed and repeat your choices                                  | The same signs, claims, Move and official story, every time.                                                                                                 |

## Change the game

All the text and numbers are in `content/`, and editing them needs no code
change. The running game reloads when you save a file. If an edit breaks the
format, the page shows what is wrong instead of the game.

| File                  | What it holds                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ui.json`             | Headings, buttons and the "What you can do now" hints                                                                |
| `notifications.json`  | The month's Notifications, their choices and their results                                                           |
| `dialogs.json`        | Short text dialogs, such as the pub                                                                                  |
| `buzzwords.json`      | Buzzwords and their meanings                                                                                         |
| `actions.json`        | What can be done on the floor, and the results                                                                       |
| `scenes.json`         | Each month's Scene: its signs, its choices and their results                                                         |
| `moves.json`          | Character Moves, and when each can land                                                                              |
| `official-story.json` | The official story, assembled from entries according to what you did                                                 |
| `behaviours.json`     | What Characters can be seen doing, and how likely each kind is to do it                                              |
| `boss.json`           | Who your boss is, and the signs of how they treat you                                                                |
| `sources.json`        | Find Out: who can be asked, how reliable each kind is, and every claim                                               |
| `notebook.json`       | Events the Notebook keeps a clue of, and what each clue was worth                                                    |
| `characters.json`     | Names, public job titles and who reports to whom on the Org Chart                                                    |
| `hidden-truth.json`   | The rules of the deal: kinds, their weights, and the Hidden Facts                                                    |
| `balance.json`        | Actions a month, months in a run, the cost of each choice, how often signs mislead and when the boss's opinion shows |
| `floor-1.json`        | The rooms on the floor: positions, sizes, colours and the lift's sign                                                |

In a Scene, `{holder}`, `{ignored}` and `{bystander}` are replaced by the names of
the most influential, the least influential and the next most influential of those
present, read from the dealt Power Map's `order`. A Scene without the whole cast can
therefore show a holder whom the Power Map's tree does not place above everyone
present, so the meeting has everyone in it. `holderIs` means the same in a Scene's
results. A `when` or `requires` condition can be
`{ "holderIs": "boss" }`, `{ "hasBuzzword": "strategic-patience" }`,
`{ "flag": "went-to-pub" }`, `{ "heardFact": "lost-list" }`, `{ "not": ... }` or `{ "all": [...] }`,
and a Scene result's `when` can also use `factNature` and `heardTrue`, described below. Options
gated with `requires` cannot depend on the hidden truth. Flags come from `sets`,
and are wiped when a new month opens. Buzzwords carry over for the whole run.

In `balance.json`, `signsMisleadChance` is how often a Scene's signs swap `{holder}`
with `{bystander}`, so that one Scene never settles who holds influence. A Scene's
results still go by the truth.

A behaviour says `{who}`, and is written for a kind of person, never a named one.
When a Scene opens, each person present shows one, chosen by their dealt kind. Its
`likelihood` gives the weight for each kind. Every behaviour must be possible from
at least two kinds, with different likelihoods, or the game will not start.

A choice can carry `"opinion": 1` or `-1` to move your boss's hidden opinion of you.
The opinion has no number on screen. It shows only through `boss.json`: when the boss
is in a Scene, one sign is picked using the `likelihood` for how the opinion stands,
which `balance.json` sets with `warmAt` and `coldAt`. Every sign must be possible from
at least two of `warm`, `neutral` and `cold`, so that no sign settles it.

An action with `"findOut": "ask"` spends an action to get a claim from a source.
`sources.json` sets how often each kind of source tells the truth, is mistaken, is
out of date or lies. A dealt motive shifts those weights. A claim's words never
depend on which of these it is, so the results screen is the only place that says.

The Notebook keeps every claim by itself. It keeps a sign only if that sign is
written with a `clue`, which can sit on a behaviour or on a Scene's sign. It also
keeps `notebook.json`'s events, each noted once in a month when its `when` holds.
Each has a `verdict` of `held`, `wrong` or `idle`, which only the results screen
shows. A behaviour's clue counts as `held` if its likelihood is highest for the
kind of the person who showed it, and otherwise as `wrong`.

A Hidden Fact says `{name}`, so that it reads correctly for whoever is dealt it,
and can list `"characters"` to limit who that can be. Its `nature` is `dangerous`,
`useful` or `idle`. A Scene result can read one with
`{ "factNature": { "character": "projects", "nature": "dangerous" } }`, and a
result with `factNote` is listed on the results screen beside the fact itself. `factAt`
names whose fact it was, unless the option is `about` one.

A Scene option with `"about": "lost-list"` appears once the player has been told
that fact about someone, true or not, and can say `{subject}` for that person.
Its results can check `{ "heardTrue": "lost-list" }`. An option must never appear
or disappear on undiscovered truth, so `requires` with `holderIs`,
`factNature` or `heardTrue` stops the game from starting. `heardFact` is fine.

A Notification, action, Scene, Move, Notebook event or official story entry can list
`"months": [2, 3]` to belong only to those months. Without it, it belongs to every
month. An action can add `moreResults`, used in turn so that a place reads differently
each month. A Move does not land twice in a run while another could. A Move with `"priority": true`
lands ahead of the others whenever its `when` holds, which is how a meeting you skip
gives you an action.

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
