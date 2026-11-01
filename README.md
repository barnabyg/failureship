# Failureship

A satirical, single-player browser game. You climb a ten-storey office tower by
reading people. The design is in
[failureship-grill-outcome.md](failureship-grill-outcome.md).

This is Phase 4 in progress: a run of nine months on a furnished Floor 1, with kinds of
boss, a Project, the Monthly Status Report, Demands, one-off Budgets, every family of Moves
and going over your boss's head. Now earlier choices come back through Threads, hidden risks
and what people have heard, things happen to the company, you can be fired, and runs save.

## Play

You need [Node.js](https://nodejs.org/) 22 or later. From the root of the
repository, run:

```powershell
npm run play
```

This installs anything missing the first time, starts the game and opens it in
your browser. If the browser does not open, go to the address the command prints.
Press `Ctrl+C` in the terminal to stop it.

On Windows, you can double-click `run.bat` in the root of the repository instead.

## What to try

Every run has a seed, shown at the top right. Add `?seed=8` to the address to pick
one. Each of the nine months has the same shape and different contents:

1. **A Notification arrives.** Answer it. The answer may cost one of your 3 actions.
2. **Spend your remaining actions** by clicking a place on the floor or its label.
   The panel at the bottom left always says what you can do now.
3. **Any Company Event, then a Character Move, lands on you.** You do not get a choice.
4. **The month closes** with the official story beside what actually happened.

There are four ways to spend an action:

- **Meeting Room 1B** opens that month's Scene. You can stay away: it saves the action,
  but you see none of its signs, your boss may take it badly, and the minutes give you
  an action that follows you as a Demand. Everyone present behaves according
  to their role and their dealt kind, and no single sign settles what they are. Your
  boss's treatment of you shows what they think of you, but only roughly.
- **The photocopier** and **the loading bay** are Find Out. At the photocopier, someone
  is already there and you choose whom to ask about. At the loading bay, you also
  choose who to buy from. Either way you get a claim that may be true, mistaken, out of date or deliberately
  false. Asking is mostly about people. Buying is mostly about Hidden Facts.
- **Your boss's boss's office** goes over your boss's head. It can pay off better than
  anything else you can do, or cost you more if your boss finds out. You are not told the odds.
- **The kitchen, the Senior Analyst's desk and your desk** do what they look like.

People are read first as what they do: your boss, your boss's boss, the Office
Co-ordinator. Each role is held by the same Character in every deal, and each has
things only it can be seen doing and its own way of talking. Only someone who chairs
meetings can overrun one, and only the Office Co-ordinator controls the minutes and
the stationery. Each of these can still come from more than one kind. Names stay in
support on the charts, in the cast list and the Notebook's marks, on the results
screen, on the `from` lines of messages and the Find Out buttons, and in what sources
say about people.

Press **Notebook** at any step, at no cost. It keeps claims and important signs for
you, and it never says which to trust. Mark each Character with the kind you suspect.

Press **Org Chart** at any step to see the formal hierarchy, also at no cost. The real
one is the hidden Power Map, dealt from the seed. A Company Event can change either of them
mid-run, and later signs and charts follow.

What you do can travel. There is no reputation score: each person believes what has reached them
along the Power Map, and that shows only in how they are with you. So the same deed is known to
some and unknown to others, and good news travels too.

After nine months the results screen shows who was really who: each Character's kind
and Hidden Fact, your marks against the truth, how you played by family of Move, what
your boss and your boss's boss really made of you, each claim and whether it was true,
each clue and what it was worth, and the Org Chart beside the true Power Map.

You can also be fired. Some choices are big mistakes, and blaming someone with a dangerous
Hidden Fact is one. The first puts you on a **Final Warning**, shown beside your job title
from then on. The second ends the run, at the same results screen. A few choices fire you
outright, and those say so on the button before you press it.

At any step, **New run** deals a new seed, and typing a seed then pressing
**Restart from seed** plays that deal from month 1. Leaving a run in progress asks
first. Swap a seed with a friend and you both get the same deal.

The run is saved in your browser at every step, so reloading the page or coming back
later carries on exactly where you left off. An address with a different seed starts
that deal instead, and replaces the saved run. If you have changed anything in
`content/` since the save, or the game has moved on, you are offered a new run: a save
only holds for the data it was dealt from. A save can be read in browser storage, hidden
truth included, which is accepted while the game is in development.

### A test scenario: three kinds of boss

This takes about twenty minutes, and it gives away these deals, so use other seeds if
you want to play blind. Each seed deals a different kind of boss:

| Seed                             | Your boss      | Try                                                            |
| -------------------------------- | -------------- | -------------------------------------------------------------- |
| `http://localhost:5173/?seed=1`  | A Believer     | Do the work, tell the truth, and stay away from the theatre    |
| `http://localhost:5173/?seed=8`  | An Incompetent | Slides, confidence and buzzwords, and the green report         |
| `http://localhost:5173/?seed=16` | A Practitioner | Make your boss look good, offer favours, and do not shine much |

Play each one the same way first, then the way the table suggests. The same choice
reads and lands differently, and the results screen shows how each of your choices
went down. Then try these:

| Try this                                                                                           | Expect                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Seed 8. In month 1 go to the pub, then Meeting Room 1B                                             | You learn "strategic patience", and the Scene offers an extra option using it. The signs point to your boss.                                                       |
| Agree warmly with your boss                                                                        | It goes well: your boss holds influence on this seed.                                                                                                              |
| Open the Notebook, and mark your boss as anything you like                                         | The action count does not change, and new clues are at the top.                                                                                                    |
| Month 2. In the Lessons Learned Review, blame the Project Co-ordinator                             | It goes badly, and you are not told why. At the end, the results screen explains: the Project Co-ordinator has a dangerous Hidden Fact.                            |
| Restart from seed 1, and do the same in month 2                                                    | The Project Co-ordinator takes the blame and you get away with it. Blaming the Senior Analyst is what goes badly on this seed.                                     |
| In month 1 on seed 1, look at who the signs point to                                               | They point to the Senior Analyst, not your boss. The same warm agreement now does little for you. Signs mislead about one Scene in five, so watch more than one.   |
| Compare your boss's treatment of you in month 2 after agreeing with your boss or your boss's boss  | The sign under "How your boss is with you" is usually warmer after agreeing with your boss. No sign is sure.                                                       |
| On seed 8, turn down the pub and file the report, then read the meeting's signs in month 1         | Your boss overruns the meeting, and the Project Co-ordinator closes a late task and reopens it. Only those roles can show those signs.                             |
| Go to the photocopier in two different months                                                      | Each source sounds like their role: the Senior Analyst talks in figures, the Office Co-ordinator in minutes and stationery.                                        |
| Go to the loading bay, buy from the Office Co-ordinator, and ask about someone                     | Often a Hidden Fact. If it is one of the useful ones, a later Scene offers a new option about it, whether it is true.                                              |
| Play to the end of any run, and read the results screen                                            | Your marks against the truth, each claim's truth, and which clues were false or did not matter.                                                                    |
| Seed 1 (a Believer boss) and seed 8 (an Incompetent one). In month 1, agree warmly with your boss  | Your boss's reaction reads quite differently, and neither says what kind your boss is. The results screen does.                                                    |
| Seed 1. In month 1, file the report honestly, then read the Your project card                      | Real and reported are both Amber. Restart and choose "make the project green": real stays Amber and reported is Green.                                             |
| Seed 4. In months 1 and 2, do not file the report                                                  | The Project goes Red in month 2, and the Project Status Review opens by itself. Making it amber changes the reported status.                                       |
| Seed 1, month 2                                                                                    | The report waits on the Project Co-ordinator's late figures. Chase them, wait, or file without them.                                                               |
| Seed 4. Go to the meeting in month 1, then in month 2 stall the Demand from your boss's boss       | It shows under Open Demands. In month 3 you are chased. On seed 8 it is forgotten instead.                                                                         |
| Seed 2. In month 1, go nowhere near Meeting Room 1B                                                | The minutes give you an action, shown under Open Demands. It arrives in month 2 with the same five answers as any Demand, and you saw none of the meeting's signs. |
| Seed 4, month 1. Decline the pub, file the report, and go to your boss's boss's office             | It pays off: your boss's boss has real influence on this seed, and your boss does not hear of it. The next Scene shows how your boss's boss is with you.           |
| Seed 13, the same                                                                                  | It works, but your boss's boss turns out to have little influence, and not much comes of it.                                                                       |
| Seed 16, the same                                                                                  | It goes badly, and then **Your boss knows**. Watch how your boss treats you afterwards.                                                                            |
| Any seed, month 6, then month 8                                                                    | The bonus pot and the underspend. Each is a one-off, with no balance anywhere. Choose who gets the money, and compare a Believer's reaction with a Practitioner's. |
| Any seed, months 4 to 8                                                                            | The desk with no window, the new metric, the Recruitment Panel and the Listening Session. Nothing says which family of Move each of these is.                      |
| Seed 2. In month 4, move the Project Co-ordinator to the desk with no window                       | Nothing, for now. Two or three months later the Health and Safety committee writes. The results screen traces it back to the desk.                                 |
| Play to Annual Calibration in month 9, and to the results screen                                   | Your boss gives a verdict that depends on how you have done. The results screen shows both bosses' kinds, how your choices landed and how you played, by family.   |
| Seed 2, month 2. Blame the Senior Analyst in the Lessons Learned Review, and read the later Scenes | Someone tied to them may start to treat you differently. The results screen shows who heard, and from whom.                                                        |
| Restart the same seed and repeat your choices                                                      | The same signs, claims, Move and official story, every time.                                                                                                       |

A month always leaves you something to decide. Every Notification has an answer that
costs nothing. Beside the report, a month's own Notifications ask for at most one costly
answer, though late figures or an action from a missed meeting can add another. A meeting
you had no action left for leaves no Demand behind.

## Change the game

All the text and numbers are in `content/`, and editing them needs no code
change. The running game reloads when you save a file. If an edit breaks the
format, the page shows what is wrong instead of the game.

| File                  | What it holds                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `ui.json`             | Headings, buttons and the "What you can do now" hints                                                                |
| `notifications.json`  | The month's Notifications, their choices and their results                                                           |
| `demands.json`        | Demands, their five answers, what happens when they are chased or forgotten, and those odds                          |
| `project.json`        | The player's Project: its owner, statuses, starting point and written events                                         |
| `dialogs.json`        | Short text dialogs, such as the pub                                                                                  |
| `buzzwords.json`      | Buzzwords and their meanings                                                                                         |
| `actions.json`        | What can be done on the floor, and the results                                                                       |
| `scenes.json`         | Each month's Scene: its signs, its choices and their results                                                         |
| `moves.json`          | Character Moves, and when each can land                                                                              |
| `threads.json`        | What comes back months later: what starts each Thread, and the Bill it sends                                         |
| `events.json`         | Company Events: where each comes from, how it moves the charts, and the official story's words                       |
| `reputation.json`     | How far and how fast news travels, and the signs of what each Character believes of you                              |
| `risks.json`          | Hidden risks: what adds each, who it comes out through, and whether it can be traced to you                          |
| `mistakes.json`       | The words of a Final Warning and of being fired                                                                      |
| `official-story.json` | The official story, assembled from entries according to what you did                                                 |
| `behaviours.json`     | What Characters can be seen doing, which roles can do it, and how likely each kind is to do it                       |
| `boss.json`           | Who your boss is, the signs of how they treat you, and what impresses each kind                                      |
| `families.json`       | What the results screen calls each family of Moves, and what it says of them                                         |
| `over-head.json`      | Going over your boss's head: the odds, the effects, the words and your boss's boss's signs                           |
| `sources.json`        | Find Out: who can be asked, how each role talks, how reliable each kind is, and every claim                          |
| `notebook.json`       | Events the Notebook keeps a clue of, and what each clue was worth                                                    |
| `characters.json`     | Job titles, roles, how text refers to each person, names, and who reports to whom on the Org Chart                   |
| `hidden-truth.json`   | The rules of the deal: kinds, their weights, and the Hidden Facts                                                    |
| `balance.json`        | Actions a month, months in a run, the cost of each choice, how often signs mislead and when the boss's opinion shows |
| `floor-1.json`        | The rooms on the floor: positions, sizes, colours and the lift's sign                                                |

Each file's fields, and the conditions they can use, are in the
[content format reference](docs/content-format.md).

### Write a Thread

A Thread is how an earlier choice comes back. To add one, needing no code:

1. Find or add the flag that starts it, in the `sets` of a choice. Not every Move should
   have a Thread, and a Bill is better if it arrives through someone else.
2. Add an entry to `content/threads.json`, with `startedBy`, a `chance` that it comes back,
   how many months `after` it does, and the `started` words for the results screen.
3. Write its `outcomes`, each with a `bill`, which is what reaches the player, and `playedOut`
   words. The first whose `when` holds is used, and a later one can be written as the fallback.
   A Bill can be good news, and `"mistake": "big"` makes it a big mistake.

The player hears nothing of a Thread until its Bill arrives. Results then trace it back to what
started it.

### Write a Company Event

A Company Event happens to the company as a whole. To add one, needing no code, add an entry to
`content/events.json` with `from`, `title`, `body` and its `story`, then give it one way to land:

- Name it as the `event` of a hidden risk in `content/risks.json`.
- Give it a `schedule`, for something from outside, with the `months` and `chance`, and a `clue`
  if the Notebook should see it coming.
- Say `"disaster": true`, for one with no clue. `disasterChance` in `content/balance.json` sets
  how often these come. It cannot be a big mistake, because a surprise should be funny and not unfair.

Its `reshuffle` can move people on the Org Chart and the Power Map, and `changed` says so on the
results screen. Your boss stays your boss for now, so neither of your bosses can be moved on the chart.

### Write a hidden risk

A hidden risk is what the player's decisions have built up, with no simulation behind it. To
add one, needing no code:

1. Find or add the flag that adds it, in the `sets` of a choice. A one-off Budget is a good source.
2. Add an entry to `content/risks.json`, with `addedBy`, how many months `after` it can come out,
   and a `note` saying what was building up.
3. Give it a `route`: the Character it comes out through, the `chance` they act by their kind, and
   their `motive`.
4. Say what makes it `traced` to the player. Reading a flag with `did` lets the player change that,
   as clearing the shared drive in month 7 does.
5. Write `onPlayer` and `onSomeoneElse`, which are Bills, and the words for how it ended.
   `"mistake": "big"` on `onPlayer` makes a landed risk a big mistake.

The same risk can land on the player, land on someone else, or never come out at all. The player
sees none of it until it does, and the results screen lists the lot.

## Develop

`npm run verify` runs every check: formatting, lint, types, engine tests, browser
tests, dependency audit and build. The browser tests need Chromium once:
`npx playwright install chromium`. They run against their own build,
`vite build --mode e2e` in `dist-e2e/`, the only one where `?month=N` starts a run
at a later month. `npm run build` and `npm run play` ignore it.

- `content/` holds the game's data and text.
- `src/content/` loads it at start-up, through the checks in `src/engine/`, and
  checks the panel text itself.
- `src/engine/` holds the rules: headless, seeded, and free of Three.js and React.
  `run.ts` is the interface to a run; `choices.ts` carries out each choice;
  `month.ts` holds the month's order; `charts.ts` moves people on the charts; `outcome.ts` is the one place any consequence
  takes effect; `state.ts` and `reads.ts` are what the mechanics share; `boss.ts`,
  `demands.ts`, `find-out.ts`, `notebook.ts`, `over-head.ts`, `project.ts` and
  `scenes.ts` are mechanics of their own, as are `company-events.ts`, `mistakes.ts`, `reputation.ts`,
  `risks.ts`, and `threads.ts`
  with `bills.ts`; `to-view.ts` builds the player view, and
  `to-results.ts` its reveal at the end; `save.ts` writes and reads a run. Everything
  in a run's `State` is plain data, so a mechanic gets saving for free. Raise
  `SAVE_VERSION` if a mechanic changes what saved state means. `src/engine/content.ts` holds the content
  schema, and `src/engine/content-checks.ts` and `consequence-checks.ts` hold the checks: it parses data against
  the schema and checks it across files.
- `src/tower/` draws the tower and holds no rules.
- `src/ui/` holds the React panels over the tower.

A Scene that data cannot express can name a `script`, which is passed to
`startRun` in `sceneScripts`. This format is a trial, as the spec, issue #1, says.

### Checks and exceptions

- Static bug analysis is the type-aware `typescript-eslint` strict rule set. It
  skips `eslint.config.js` and `scripts/`, which sit outside `tsconfig.json`.
- Secret scanning is not a separate gate: the project holds no credentials.
  Review this if it ever needs any.
- The `minimatch` override in `package.json` patches GHSA-g3hv-75wg-m249 in the
  lint tooling. Remove it when `eslint` depends on a patched version itself.
- `test.testTimeout` in `vite.config.ts` is raised because some engine tests play
  hundreds of whole runs. Review it if the suite gets much faster or slower.
- `build.chunkSizeWarningLimit` in `vite.config.ts` is raised because Three.js
  and the game's text make up the single bundle. Review it if hosting is ever added.
- `.prettierignore` leaves the owner's design records and agent docs unformatted.
- `.prettierignore` and `eslint.config.js` skip `.claude/worktrees/`, and
  `.prettierignore` skips `.claude/settings.local.json`: both are untracked and local to
  one machine. Review this if anything in them comes to be tracked.
