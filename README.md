# Failureship

A satirical, single-player browser game. You climb a ten-storey office tower by reading people. The
design is in [failureship-grill-outcome.md](failureship-grill-outcome.md).

Phase 5, ready to steer: eighteen months from a furnished Floor 1 to the top of a blocked-out
Floor 3, with kinds of boss, the Monthly Status Report, Demands, Budgets, every family of Moves,
Threads, hidden risks, news that travels, Company Events, your word and Deals, Believers who change,
Gauges, reviews, Rivals, Grand Plans and more than one route up. You can be fired, or win, sort of.

## Play

You need [Node.js](https://nodejs.org/) 22 or later. From the root of the repository, run:

```powershell
npm run play
```

This installs anything missing the first time, starts the game and opens it in your browser, or
prints its address. `Ctrl+C` stops it. On Windows, you can double-click `run.bat` instead. The game
is made for a 1920×1080 screen, and needs a window at least 1280 pixels wide.

To try it, add `?seed=2` to the address the command prints. File the report, go to the meeting each
month and choose the first thing, but take the blame yourself in month 2's Lessons Learned Review,
and in month 5's Ideas Workshop stick a screenshot of the new tool on your boss's note. Month 8
opens with Congratulations: Team lead, and the lift takes you to Floor 2. A whole run takes about an hour. [The playtest](docs/playtest.md)
has seeds for each way up, a Rival winning, a demotion, being fired and the win.

## What to try

Every run has a seed, on the **Run** menu at the top right, and `?seed=8` picks one. Each month has the same shape:

1. **A Notification arrives.** Answer it. An answer may cost one of your 3 actions, and one always
   costs nothing. A month always leaves you something to decide, on any floor. Every third
   month the **Quarterly Business Review** follows by itself, at no cost, and goes on the record.
2. **Spend your remaining actions** by clicking places on the floor, as the guide at the foot says.
3. **Any Company Event, then a Character Move, lands on you.** You do not get a choice, unless it
   comes back from something you did: then you are offered **Escapes**, such as blaming someone,
   lying or burying it, or taking it. One that fails is worse than taking it.
4. **The month closes** with the official story beside what actually happened.

There are four ways to spend an action:

- **Meeting Room 1B** opens that month's Scene. You can stay away: it saves the action, but you see
  none of its signs, your boss may take it badly, and the minutes give you an action that follows
  you as a Demand. Everyone present behaves according to their role and their dealt kind, and no
  single sign settles what they are. Your boss's treatment of you shows roughly what they think.
- **The photocopier** and **the loading bay** are Find Out: ask whoever is there about someone, or
  buy from someone, for a claim that may be true, mistaken, out of date or deliberately false.
  Asking is mostly about people. Buying is mostly about Hidden Facts.
- **Your boss's boss's office** goes over your boss's head. It can pay off better than
  anything else you can do, or cost you more if your boss finds out. You are not told the odds.
- **The kitchen, the Senior Analyst's desk and your desk** do what they look like.

People are read first as what they do, such as your boss or the Office Co-ordinator, each role with
its own signs and way of talking, whatever its kind. Names stay in support, on charts and lists.

Press **Notebook**, at no cost, for the claims and signs it keeps, which it never says to trust, and
mark each Character with the kind you suspect. **Org Chart** is the formal hierarchy; the real one
is the hidden Power Map, dealt from the seed, and a Company Event can change either.

Your word is yours to give. Some choices offer a **Promise**, whether or not you can deliver it, and
some a **Deal**, in which each side offers something. Whether you are believed, and whether a good
word from someone counts, goes by who they really are and what has reached them. **Your word
given** shows your Promises, Deals and favours, at no cost, and nothing of what others owe.

**Teflon**, in the header, is your track record, not your danger. It rises with each Escape that
works and falls with each that fails, and the bolder Escapes, such as blaming your boss, stay locked
until you have enough of it. **Fawning** is how well sucking up to your managers is paying off, not whether they like
you, and plays no part in promotion. Each moves only when a Thread or an Escape plays out, and the
official story says which. Some levels earn a Milestone.
**Official standing** is a bar from red to green, with no number: how you would fare on paper if a
vacancy arose. It reads only the official record, a Final Warning turns it red, and decides nothing.

What you do can travel. There is no reputation score: each person believes what has reached them
along the Power Map, shown only in how they are with you, and good news travels too, as do false
stories. A **Rival** is any Practitioner competing with you, your boss included, and nothing says
who. Rivals use your own Moves on you, and once you have seen one done, you can use it too.

Your boss's **Grand Plan** is on the status card once you hear of it. Doing it for real
needs whoever really has what it takes. Done or faked, it goes on the record, but whether your boss
counts it goes by who they are, a fake can be found out, and a failed one is blamed on someone.

A Plan your boss counts done moves them up, and opens their seat for two months, as does a boss
seconded, leaving or fired, or a restructure making a post of their team. Get rid of yours by
ringing the Speak Up line in month 8, asking it about the post if you know why, or a rumour once you
have seen one: whoever protects them decides, and it can be traced to you. Whoever really holds
influence over a seat gives it out by what matters to their kind, never a score or a Gauge. Rivals
work on them, and so can you, if you know whom to approach. You are told who decided, beside
Official standing. Win, and you are **Team lead**, on Floor 2. Lose, and the winner is your boss.
The passed over remember. A Team lead's Moves are bigger, and so is the Bill. Floor 2's seat, by
its Plan or Internal Audit, makes you **Middle manager** on Floor 3, under the Programme Manager and
the Head of Transformation, where the Board and the CFO reach down: a cut of 30%, an offsite at a
day's notice, a tricky question. Floor 3's seat, by its Plan or a nomination upstairs, is the way
out: the run ends with a stand-in for the penthouse that goes by how you got there.

The results screen opens with the ending, who really decided and **Play this seed again**, and
folds the rest: who was who, Hidden Facts, Rivals, your marks, Moves, verdicts, claims and charts.

You can also be fired. Some choices are big mistakes, such as blaming someone with a dangerous
Hidden Fact. The first puts you on a **Final Warning**, shown beside your job title, and the second
ends the run. One made while a seat is open can cost you it, and one in a seat you won takes you
down the lift, under whoever takes your seat. A few fire you outright, and say so on the button.

The **Run** menu holds **New run** and **Restart from seed**, and leaving a run asks first. A
friend on your seed gets your deal. Each step is saved in your browser, hidden truth and all, so a
reload carries on, and a change to `content/` or the game offers a new run.

## Change the game

All the text and numbers are in `content/`, and editing them needs no code change. The running
game reloads when you save a file. If an edit breaks the format, the page shows what is wrong.

| File                  | What it holds                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `ui.json`             | Headings, buttons and the "What you can do now" hints                                                  |
| `notifications.json`  | The month's Notifications, their choices and their results                                             |
| `demands.json`        | Demands, their five answers, what happens when they are chased or forgotten, and those odds            |
| `project.json`        | The player's Project: its owner, statuses, starting point and written events                           |
| `dialogs.json`        | Short text dialogs, such as the pub                                                                    |
| `buzzwords.json`      | Buzzwords and their meanings                                                                           |
| `actions.json`        | What can be done on the floor, and the results                                                         |
| `scenes.json`         | Each month's Scene and each quarter's review: signs, choices, results                                  |
| `moves.json`          | Character Moves, and when each can land                                                                |
| `threads.json`        | What comes back months later: what starts each Thread, and the Bill it sends                           |
| `events.json`         | Company Events: where each comes from, how it moves the charts or opens a seat, and the story's words  |
| `reputation.json`     | How far and how fast news travels, and the signs of what each Character believes of you                |
| `risks.json`          | Hidden risks: what adds each, who it comes out through, and whether it can be traced to you            |
| `deals.json`          | Deals: what each side offers, whether a good word counts, and the favours owed between people          |
| `promises.json`       | Promises: who they are made to, what is said back, and what arrives when they fall due                 |
| `mistakes.json`       | The words of a Final Warning, of being demoted and of being fired                                      |
| `official-story.json` | The official story, assembled from entries according to what you did                                   |
| `behaviours.json`     | What Characters can be seen doing, which roles can do it, and how likely each kind is to do it         |
| `boss.json`           | The signs of how your boss treats you, and what impresses each kind                                    |
| `families.json`       | What the results screen calls each family of Moves, and what it says of them                           |
| `over-head.json`      | Going over your boss's head: the odds, the effects, the words and your boss's boss's signs             |
| `sources.json`        | Find Out: who can be asked, how each role talks, how reliable each kind is, and every claim            |
| `notebook.json`       | Events the Notebook keeps a clue of, and what each clue was worth                                      |
| `changing.json`       | What burns a Believer, how much it takes, what they can become, and who covers for anyone who leaves   |
| `characters.json`     | Job titles, roles, how text refers to each person, names, the Org Chart and where you start on it      |
| `gauges.json`         | The Gauges, Teflon and Fawning: where each starts, and the Milestones earned along the way             |
| `escapes.json`        | Escapes: the Gauge a working one raises, what someone blamed keeps, and why one failed                 |
| `standing.json`       | Official standing: what on the official record moves it, its bands, and what the results screen says   |
| `hidden-truth.json`   | The rules of the deal: kinds, their weights, and the Hidden Facts                                      |
| `rivals.json`         | What is competed for and by whom, how many Rivals at once, and who makes a competitor's Move           |
| `grand-plans.json`    | Each boss's Grand Plan: how long it runs, where you hear of it, how it is done, and who is blamed      |
| `vacancies.json`      | Each boss's seat: how it falls vacant, who it is decided between and why, and getting rid of a boss    |
| `balance.json`        | Actions a month, months in a run and a quarter, each choice's cost, how signs mislead, the boss's mood |
| `floors.json`         | Each floor, by the job done on it: the job title, the rooms, their fittings and the lift's sign        |

Each file's fields, the conditions they can use, which floor and month content belongs to, and what
to write for each mechanic are in the [content format reference](docs/content-format.md).

## Develop

How to run the checks and tests is in [AGENTS.md](AGENTS.md#verifying).

- `content/` holds the game's data and text. `src/content/` loads it at start-up, through the checks
  in `src/engine/`, and checks the panel text itself.
- `src/engine/` holds the rules: headless, seeded, and free of Three.js and React. `run.ts` is the
  interface to a run and `deal.ts` deals it; `choices.ts` carries out each choice; `month.ts` holds
  the month's order; `charts.ts` moves people on the charts, and `places.ts` reads your bosses from
  your place on them, and puts people in Org Chart order; `floors.ts` your floor and what is on there each month; `outcome.ts` is the
  one place any consequence takes effect; `state.ts` and `reads.ts` are what the mechanics share.
  The mechanics are `boss.ts`, `demands.ts`, `find-out.ts` with `claims.ts`, `notebook.ts`,
  `over-head.ts`, `project.ts`, `scenes.ts` with `asking.ts`, `company-events.ts`, `mistakes.ts`,
  `reputation.ts`, `risks.ts`, `threads.ts` with `bills.ts`, `escapes.ts` for the ways out of a
  consequence, `promises.ts`, `deals.ts`, `changes.ts` for Believers changing and leaving,
  `gauges.ts`, the only module that reads a Gauge,
  `standing.ts`, `reviews.ts` for quarterly reviews, `rivals.ts` for Rivals, `grand-plans.ts` for
  Grand Plans, `vacancies.ts` for seats and who really decides them, `departures.ts` for leaving and
  being got rid of, `demotions.ts` for losing a seat to a mistake, `win.ts` for winning the run and
  the route up. `say.ts` names Characters in text, and `rng.ts` and `seed.ts` hold the seed.
  `view.ts` is the player view, built by `to-view.ts`, with `to-results.ts` its reveal;
  `hidden-truth.ts` is the tests' read of the truth. `save.ts` writes and reads a run. `State` is
  plain data, so a mechanic gets saving for free: raise `SAVE_VERSION` if it changes what saved
  state means. `content.ts` assembles the schema from the `*-schema.ts` files, as
  [AGENTS.md](AGENTS.md) says. `content-checks.ts` checks data across files, with each mechanic's
  checks beside it: `truth-checks.ts` for the hidden truth and its signs, `boss-checks.ts` for the
  boss, going over the head, Demands and reputation, `consequence-checks.ts` for what choices lead
  to, `escape-checks.ts` for Escapes, `word-checks.ts` for Promises and Deals, and
  `floor-checks.ts`, `review-checks.ts`, `rival-checks.ts`, `plan-checks.ts`, `vacancy-checks.ts`
  and `scene-checks.ts` for floors, reviews, Rivals, Grand Plans, seats and each Scene's word
  budget.
- `src/tower/` draws the floor the view names, and holds no rules.
- `src/ui/` holds the React panels over the tower: `App.tsx` wires them to the run, and rides the
  lift when the floor changes, and `TowerStage.tsx` the tower's hotspots. `panels.tsx` picks each
  step's panel, the larger being `ScenePanel.tsx`, `FindOutPanel.tsx` and `ResultsPanel.tsx`;
  `Panel.tsx` holds their frame and buttons, `Result.tsx` what the player's own choices led to, which
  waits beside what comes next, and `Intranet.tsx` the e-mails and newsletter. `Header.tsx` draws
  the header and status card, with `RunControls.tsx` (the Run menu) and `StandingBar.tsx`.
  `Chart.tsx` and `Notebook.tsx` open in a `Modal.tsx`. `saved-run.ts` saves the run, and
  `later-month.ts` plays the e2e build to `?month=N` and ends it at `&last=N`.

### Checks and exceptions

- Static bug analysis is the type-aware `typescript-eslint` strict rule set. It skips
  `eslint.config.js` and `scripts/`, which sit outside `tsconfig.json`. Secret scanning is not a
  separate gate: the project holds no credentials. Review if that changes.
- The `minimatch` override in `package.json` patches GHSA-g3hv-75wg-m249 in the lint tooling. Remove
  it when `eslint` depends on a patched version itself.
- In `vite.config.ts`, `test.testTimeout` is raised for tests that play many whole runs, most of all
  the balance tests, and `build.chunkSizeWarningLimit` because Three.js and the game's text make up
  the single bundle. Review them if the suite gets much faster or slower, or hosting is ever added.
- `.prettierignore` leaves the owner's design records and agent docs unformatted, and skips
  `.claude/settings.local.json` and, with `eslint.config.js`, `.claude/worktrees/`, which are
  untracked and local to one machine. Review this if anything in them comes to be tracked.
