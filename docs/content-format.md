# Content format

The reference for the data files in `content/`. Each file has one section here, and
the conditions they share have their own. Adding to any of them needs no code. To start
editing, see [Change the game](../README.md#change-the-game) in the README.

The game checks all of this at start-up. Where this page says a mistake is _refused_,
the game does not start and the page shows what is wrong.

## Conditions

A `when` or `requires` holds one of these:

| Condition                                                              | Holds when                                                                              | Reads the hidden truth |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| `{ "flag": "went-to-pub" }`                                            | A flag is set this month                                                                | Only if the flag does  |
| `{ "did": "moved-a-colleague" }`                                       | A flag has been set in any month of the run                                             | Only if the flag does  |
| `{ "remembers": { "character": "projects", "about": "passed-over" } }` | That Character keeps a memory written with that `about`                                 | Yes                    |
| `{ "believes": { "character": "admin", "mood": "cold" } }`             | That Character's mood, how their belief stands: `warm`, `neutral` or `cold`             | Yes                    |
| `{ "hasBuzzword": "strategic-patience" }`                              | The player has learnt the Buzzword                                                      | No                     |
| `{ "heardFact": "lost-list" }`                                         | The player has been told that Hidden Fact about someone, true or not                    | No                     |
| `{ "heardTrue": "lost-list" }`                                         | What the player was told about that Hidden Fact is true                                 | Yes                    |
| `{ "holderIs": "{boss}" }`                                             | That Character is the most influential of those present, or of everyone outside a Scene | Yes                    |
| `{ "bossIs": "practitioner" }`                                         | The boss is of that kind                                                                | Yes                    |
| `{ "factNature": { "character": "projects", "nature": "dangerous" } }` | That Character's Hidden Fact has that `nature`                                          | Yes                    |
| `{ "youOwe": "projects" }`                                             | The player owes that Character a favour                                                 | No                     |
| `{ "sawMove": "rumour" }`                                              | That Move from [`moves.json`](#movesjson) has landed on the player in this run          | No                     |
| `{ "planRunning": "one-tool" }`                                        | That is your boss's [Grand Plan](#grand-plansjson) now, and it is still to be done      | No                     |
| `{ "vacancyOpen": true }`                                              | A [seat](#vacanciesjson) is open now, and still to be decided                           | No                     |
| `{ "not": ... }`                                                       | The condition inside does not hold                                                      | If the inner one does  |
| `{ "all": [...] }`                                                     | Every condition inside holds                                                            | If any inner one does  |
| `{ "any": [...] }`                                                     | At least one condition inside holds                                                     | If any inner one does  |

Where each can be used. These are all the places that take a condition:

| Used on                                    | Conditions allowed                                     |
| ------------------------------------------ | ------------------------------------------------------ |
| A Scene result's `when`                    | All                                                    |
| A Move's `when`                            | All                                                    |
| An official story's `when`                 | All                                                    |
| A Thread outcome's `when`                  | All                                                    |
| A hidden risk's `route.means` and `traced` | All                                                    |
| A Grand Plan's `blame.sticks`              | All                                                    |
| A Grand Plan way's `when`                  | Only those that do not read the hidden truth           |
| What Rivals compete for's `when`           | All                                                    |
| A whistleblower report's `when`            | All                                                    |
| A Scene option's `requires`                | Only those that do not read the hidden truth           |
| A Notification's `when`, a Demand's too    | Only those that do not read the hidden truth           |
| A Notebook event's `when`                  | Only those that do not read the hidden truth, as below |

A condition anywhere else is refused, as is one that names an unknown Character, Hidden
Fact, Buzzword or Move. A condition can name your boss or your boss's boss, as in
[the next section](#your-boss-and-your-bosss-boss). An option must never appear or disappear on undiscovered
truth, and that includes the boss's kind, so a condition that would show the truth
this way stops the game from starting. This also goes for a flag set by something
hidden: a Scene result or a Move whose `when` reads the truth, a Rival's Move, a Bill or any of its
options, a Company Event, a Demand being forgotten or chased, or your boss finding out
about going over their head. A
Notebook event can still read such a flag, because the player has just seen that result.

Flags come from `sets`, and are wiped when a new month opens, though `did` can still read
them for the rest of the run. Buzzwords carry over for the whole run.

## Your boss and your boss's boss

There are two places above the player on the Org Chart. Your boss is whoever the player reports
to, and your boss's boss is whoever your boss reports to. A place is not a Character: whoever is
in it can change when someone moves on the Org Chart. Where the player sits is `you` in
[`characters.json`](#charactersjson), and a run keeps it from there. If your boss reports to
nobody, there is no boss's boss, and data that names one is refused.

Everything written for your boss or your boss's boss goes to whoever is in that place at the time:
the signs and approaches in [`boss.json`](#bossjson), going over the head in
[`over-head.json`](#over-headjson), `opinion` and `headOpinion`, their `mood`, and the words for
them in `places`. What was done with one boss stays with them: a Promise to `{boss}` is made to
whoever is boss then, and the results screen lists only what came across to the boss at the end.

Data names them as `{boss}` and `{head}`, wherever it would name a Character to say who a choice
or a condition concerns: any condition, `remembers`, news `at`, `factAt`, `repays`, a Promise's
`to`, a Deal's `word.over`, a Company Event's `reshuffle`, a Move's `by`, a Rival's `who` and a Scene's `cast`, which
puts whoever is in the place in the room once, so that a Scene can be held on more than one floor or
after a promotion. Name a Character there only when it means that person, whatever their place.
The Org Chart's own `reportsTo`, Find Out's `sources`, `leaving`, a Hidden Fact's `characters`, a risk's `route.character` and a
Deal's `with` always name a Character. A `from` line can say `{boss}` or `{head}` for the name of
whoever is in that place, such as `"From: Your boss, {boss}"`.

## Floors and their months

Each job is done on its own floor, written in [`floors.json`](#floorsjson), and the player's job
decides which floor they are on. A Scene, Notification, Demand, action, Move, Notebook event,
official story entry, Project event or the Project's `input` can say `"floor": "junior-employee"`,
a floor's `job`, to belong only to that floor. Without it, it comes on any floor. An action is
offered only on a floor that has a room of its `place`.

`"months": [2, 3]` makes something belong only to those months on its floor: the month the player
is in there, counting every month they have spent on it. The first month on a new floor is month 1
whatever the run's month, and coming back to a floor picks it up where it was left. Anything with
`months` must name its `floor`, so nothing written for one floor's months comes again on another.
Without `months`, something belongs to every month, so the Monthly Status Report recurs on any
floor, and a stalled Demand follows the player wherever they go. Only Company Events, under
`schedule` in [`events.json`](#eventsjson), and [quarterly reviews](#quarterly-reviews) go by the
run's month instead. The run always ends at `monthsPerRun` in [`balance.json`](#balancejson).

A floor is written for as many months as its own Scenes, Notifications and Demands name. Each of
those months needs at least one of them, and a stay longer than that draws from the floor's
**pool**: Scenes and Notifications with `"pool": true` and the floor's `floor`, and no `months`.
Each month past the written ones gets one pool Scene and one pool Notification, if it has them,
each in a seeded turn, so that every one comes up before any repeats. A pool Scene needs an action
without `months` in a room on its floor, which is offered in the months it is drawn. Only Scenes and
Notifications can be in a pool.

These are refused: a `floor` that names no floor, `months` with no `floor`, a floor with no Scene,
Notification or Demand of its own, a written month with none of them, a floor written for fewer
months than the run with no pool, a pool item with `months` or no `floor`, a pool Scene with no
action to open it on its floor, and a room `id` used more than once in the tower.

## Quarterly reviews

A quarterly review is a Scene in [`scenes.json`](#scenesjson) with `"quarter": 2`, the quarter of
the run that it closes. `monthsPerQuarter` in [`balance.json`](#balancejson) says how long a quarter
is, so with 3 the reviews come in months 3, 6, 9 and so on of the run, not of a floor, whatever the
run's length and whichever floor the player is on. Each quarter has a review of its own, so each
reads differently: a longer run needs one more review for each quarter it adds, and nothing else.

A review opens by itself, after the month's Notifications and any flagged Project and before the
player's actions. Nobody can stay away, and it takes none of the player's actions. It is staged:
everyone is on their best behaviour, so the cast shows none of the behaviours in
[`behaviours.json`](#behavioursjson), only the review's own signs, the boss's treatment and
everyone's regard. Otherwise it is written like any Scene, with a `cast`, `signs` and `options`.

A review's verdict on the player is paperwork: its flags go on the official record, in `deeds` in
[`standing.json`](#standingjson), and can be told in [`official-story.json`](#official-storyjson), so
the same choices move Official standing the same way on every deal. Those present can still take
note of how the player behaves, as in any Scene, through a result's `opinion`, `headOpinion`,
`approach`, `remembers` and `news`, and the Threads its flags start. A review cannot be a big
mistake, so by itself it never decides how a run goes.

These are refused: a review with `floor`, `months`, `pool` or a `script`, one that an action or the
Project's flag opens, a result whose `when` reads the hidden truth or that is a `mistake`, a review
that nothing in it moves Official standing, a quarter of the run with no review or more than one, a
review for a quarter the run never reaches, and reviews with no `monthsPerQuarter`.

## `actions.json`

What can be done on the floor, and the results.

- `moreResults` are used in turn, so that a place reads differently each month.
- `"findOut": "ask"` spends an action to get a claim, using that method in
  [`sources.json`](#sourcesjson).
- `"overHead": true` goes over your boss's head, as set out in
  [`over-head.json`](#over-headjson).
- `"project"` moves the Project, as in [`project.json`](#projectjson).
- `"family"` says which family of Moves it is, as in [`families.json`](#familiesjson).

## `balance.json`

Actions a month, months in a run and the cost of each choice.

- `monthsPerQuarter` is how many months of the run make a quarter, each closed by a review, as
  [Quarterly reviews](#quarterly-reviews) says. Without it there are no reviews.

- `disasterChance` is how often a month brings a disaster with no clue, as in
  [`events.json`](#eventsjson).
- `signsMisleadChance` is how often a Scene's signs swap `{holder}` with `{bystander}`,
  so that one Scene never settles who holds influence. A Scene's results still go by the
  truth.
- `mood` holds `warmAt` and `coldAt`, the points at which the boss's belief about the player
  makes their mood `warm` or `cold`.
- `bossBeliefKeeps` is how much of the boss's belief carries into each new month, so that it is
  mostly about lately.

## `behaviours.json`

What Characters can be seen doing. When a Scene opens, each person present shows one,
chosen by their dealt kind.

- A behaviour says `{who}`, and is written for a kind of person, never a named one.
- `likelihood` gives the weight for each kind. Every behaviour must be possible from at
  least two kinds, with different likelihoods, or it is refused.
- `"roles": ["team-leader"]` means only a Character with one of those roles in
  `characters.json` can show it. Every role must have a behaviour nobody else can show,
  and every Character must have something to show as each kind, or it is refused.
- `clue` makes the Notebook keep the behaviour. It counts as `held` if its likelihood is
  highest for the kind of the person who showed it, and otherwise as `wrong`.
- A role's own behaviours are what tell it apart: only someone who chairs meetings, such as
  the Team Leader, can overrun one, and only the Office Co-ordinator controls the minutes and
  the stationery.

## `boss.json`

The signs of how [your boss](#your-boss-and-your-bosss-boss) treats you, and what impresses each
kind.

A choice can carry `"opinion": 1` or `-1` to move your boss's hidden belief about you. The
belief has no number on screen. It shows only through `signs`: when the boss is in a
Scene, one sign is picked using the `likelihood` for their mood, as `balance.json` sets. Every sign must be possible from at least two of `warm`, `neutral`
and `cold`, so that no sign settles it.

A choice can also carry `"approach": "theatre"`. `approaches` lists each one, how far it
moves the belief of each kind of boss, and how each kind shows it, so the same choice can
warm one boss and chill another. The player reads that from `reaction` lines and never
from a label: a line naming a kind, or an approach that every kind takes alike, is
refused. A choice can write its own `reaction` for each kind.

An approach can have `overdone`, which changes how the listed kinds take it after `after`
uses in a run. This is how a Practitioner boss turns on someone who shines.

## `buzzwords.json`

Buzzwords and their meanings. A choice's `learns` teaches one, and `hasBuzzword` reads it.

## `changing.json`

How a Believer burned enough changes. How the player treats people changes them: a Believer who is
burned enough, by something done to them directly, becomes a Practitioner, a whistleblower, or
leaves. The player is not told. The results screen says who changed, from what to what, and why.

- `burns` are what burns someone: a memory with that `about`, from news or `remembers`, of something
  done to them, whether in front of them or to them. Hearing of it second-hand does not burn. Each has
  a `weight`, a `why` for the results screen, and `leans`, the weights for `practitioner`,
  `whistleblower` and `left` that pick, by a seeded draw, what they become.
- `threshold` is the total weight at which a Believer changes, checked as each month opens. Someone
  changes once. Other kinds never change.
- `became` is what the results screen calls each change.
- `whistleblower.signs` say `{who}` and are shown, by `weight`, beside what any Believer of their
  role might show. A `clue` makes the Notebook keep one. A month after changing, a whistleblower
  sends the first of `reports` whose `when` holds, a Bill as in [`threads.json`](#threadsjson): what
  they know about goes first. Failing that, they bring out the first hidden risk still waiting,
  whatever its own route, or else send the last report, which needs no `when`. `share` is how much of
  what a whistleblower is seen doing is one of their own signs. `motive` says `{who}` and is what the results screen says of a risk they brought out.
- `leaving` is keyed by Character. Only those listed can leave, and your boss and your boss's boss
  cannot be. Each has the `cover` text uses for whoever stands in for them, the `notice` that says
  they have gone, and optional `sets` and `project`.

Someone who leaves comes off the Power Map, and whoever answered to them answers to whoever was above
them. Scenes and Find Out go on without them. Any option or action whose words name them, or Notification or Move
from them, is no longer offered, and a Thread's outcome from them is passed over. A risk that would
come out through them never does. Their open Promises and Deals lapse. If the report's `input` came
from them, it is never late again.

## `characters.json`

Job titles, roles, names, who reports to whom on the Org Chart, and where the player sits on it.

- `characters` lists the Characters. Each has an `id`, `name`, `title`, `called`, `role`, and
  `reportsTo`, whom they answer to on the Org Chart, except for whoever is at the top.
- `you` is where the player sits as a run starts: `reportsTo` names a Character, as in
  [Your boss and your boss's boss](#your-boss-and-your-bosss-boss), and `job` names the floor in
  [`floors.json`](#floorsjson) they start on.
- `places` holds the words for whoever is in each place, `boss` and `head`, while they are:
  `called`, and a `title` that says `{title}`, their own job title.
- A Character with `floor`, the `job` of a later floor, is written for that floor's cast, such as
  whoever is above your boss's boss. They are in the company from the start, on the charts, but are
  dealt after the first floor's cast by draws of their own: a kind, a Hidden Fact as often as the
  first cast has one, and a place on the Power Map below its `influentialCount` most influential.
  So adding one leaves every deal of the floors below alone. `charactersWithFact` and
  `minPractitioners` in [`hidden-truth.json`](#hidden-truthjson) count the first floor's cast only.
- `you.name` is what the Org Chart calls the player, once anyone answers to them.
- A later floor's cast is met only when the player reaches its floor. Until then nobody of it is
  on the Org Chart, in Find Out, in the Notebook's marks or on the results screen, and whoever
  answers to one of them is shown at the top.
- Moving up gives a Character a new title and `called`, from [`vacancies.json`](#vacanciesjson),
  and whoever takes a seat takes its holder's.

A Character's `called` is how running text refers to them, such as `the Senior Analyst`, and it
gets a capital only where a sentence starts. While someone is your boss or your boss's boss, the
place's `called` is used instead. Write people into text that way too, and keep their `name` for a
Notification or Move's `from` line. A test fails if a name turns up in the running text.

## `deals.json`

Deals, in which each side offers something. A Deal is worth only what the people in it can really
deliver, and either side can fail.

- `favours` deals `dealt` favours between Characters when a run is dealt, each with one of the
  `why` lines, which say `{owes}` and `{to}`. They are part of the hidden Power Map. The player
  sees only the favours they are party to, at no cost, and the results screen shows the rest.
- `owed` is how a favour reads: `youOwe` and `owesYou` say `{who}` and `{why}`, and `between`,
  shown only on the results screen, says `{why}`.
- `statuses` say where the player's side has got to.
- Each item has `with`, `title`, `what`, `agreed` (which says `{who}`), `word`, `after`, `due`,
  `owed` and `worth`.
- `word` is their side: a good word with `over`, given `after` a seeded wait with a seeded `chance`
  by their kind, which moves that person's belief by `shift` only if they have sway: they are above
  that person on the Power Map, or are owed a favour by them. The player is told the same either
  way. `given` and `withheld` are what the player is told. If it is withheld, they owe the player.
- `due` is the player's side, written as for a Promise. Breaking it starts the same news as a broken
  Promise, and the player owes them. `owed.you` and `owed.them` say why.
- `worth` is what the results screen says it was really worth: `landed`, `worthless`, `withheld`,
  or `pending` if the run ended first.

A Scene option or Notification option offers one with `"deal"`, once in a run. Deals need
[`promises.json`](#promisesjson), whose `broken` news they share.

## `demands.json`

Demands, listed in `items`, arrive as Notifications with their `floor` and `months`, and must offer
`deliver`, `push-back`, `hand-off`, `fake` and `stall`. An answer that needs a colleague
names them by role.

`"stalls": true` on `stall` leaves the Demand open, and the player can see it on the **Your
project** card. Each later month, a seeded draw uses `odds` for the boss's kind: it is
`forgotten`, or it is `chased`, which costs the `chasedPenalty` and arrives as a
Notification of its own, or nothing happens yet. `sets` names the flags for that month.
`chased` must have an answer that costs nothing.

`missed` says what a meeting you skip leaves you with. A month's meeting is the action that
sets `attended`, and there must be an action written for every month. If you spent an action
elsewhere and did not go, then as the month closes you are told about one of its `actions`,
each given once in a run, and your boss takes the absence according to the `approach`. It
then stays open, arrives the month after as a Notification with the `options` shared by all
of them, and goes on like any other Demand. A meeting you had no action left for leaves no
Demand behind.

## `dialogs.json`

Short text dialogs, such as the pub. A choice's `dialog` opens one.

## `events.json`

Company Events: things that happen to the company as a whole. They land after the player's
actions and before the month closes, ahead of the month's Character Move.

Each has `from`, `title`, `body`, and `story`, the official story's own `reported` and optional
`happened` words for it. It can carry `sets` and `project`. It has no `mistake`, so a surprise is
never a big mistake by itself: it should be funny and not unfair. A risk that lands can still be
one, through its own Bill.

Each has exactly one way to land, or it is refused:

- A hidden risk's `event` names it, and it lands in the month the risk comes out.
- `schedule` comes from outside: the `months` it can land in, a seeded `chance` in each until it
  does, and an optional `clue` for the Notebook, `before` months earlier.
- `"disaster": true` arrives with no clue. Each month, `disasterChance` in `balance.json` is the
  chance of one, and a run does not repeat one.

`reshuffle` changes the charts. `reports` moves a Character on the Org Chart, so `character` now
reports `to` someone else, and a move that would make a loop does not happen. `rises` sends someone
to the top of the Power Map, and `falls` to the bottom, which changes later signs. Any of them can be
`{boss}` or `{head}`. Your boss, your boss's boss and the player, `you`, cannot be moved in
`reports`, since nothing creates a vacancy yet. An event that moves anyone needs `changed`, which the
results screen shows beside the charts.

## `families.json`

What the results screen calls each family of Moves, and what it says of them.

A Notification option, a Scene option or an action can carry `"family": "attack"`, which is
one of `impress`, `fabricate`, `trade`, `find-out`, `deflect`, `attack` or `deliver`. Nothing
during play shows it. **How you played** counts the Moves the player made in each family. A
choice with an `approach` should say which family it is, and a test fails if it does not.

## `floors.json`

The floors of the tower, from the bottom up. Each has a `job`, which keys it, the job `title`
that the header, the e-mails and the official story show, and its `rooms`: positions, sizes,
colours, `fittings` and, for a place the player can see but not act on, such as the lift, a
`sign`. Content goes to a floor as [Floors and their months](#floors-and-their-months) says. A room
without `fittings` is a blocked-out box, as on Floor 2. Room ids are unique across floors, so the
same kind of place on another floor, such as your desk, is an action of its own, with its own id.
The player reaches another floor only by a [seat](#vacanciesjson), and the lift is ridden then.

## `gauges.json`

The player's Gauges, Teflon and Fawning: their track record, in plain view at every step.

Each has `id`, `label`, `start`, and the `min` and `max` it stays within. Its `milestones` are
earned once each, on reaching `at`, and the player is told `title` and `body` as the month closes.
A Milestone it can never reach is refused. A Gauge moves only from the `gauges` of a Thread's outcome,
as in [`threads.json`](#threadsjson), as the month closes, and the official story says which. Nothing
else moves it. It never reads the Power Map or a hidden risk, and nothing but its Milestones reads it,
so a high one does not mean the player is safe.

A Thread that moves Fawning starts from a choice aimed at your boss or your boss's boss, and every
result of that choice sets its flag. Its outcomes' `when` read only what the player did, and no
Bill's `from` names a Character, since nothing comes back through someone who has left, and who
leaves is dealt. `tests/engine/fawning.test.ts` holds the content to this.

## `grand-plans.json`

Grand Plans: each boss's big ambition, which the player can complete in reality or in appearance.
A Plan belongs to its boss, not to the place: as each month opens, [your boss](#your-boss-and-your-bosss-boss),
if their last Plan has ended or they have none, takes on the first in `plans` for the player's floor
that they have not had and nobody else is running. So each boss has one at a time, and a new boss
brings a new one. A Plan is followed to its end whoever the player works for by then.

- `floor` is the floor whose bosses take it on, as in [Floors and their months](#floors-and-their-months).
  A Plan has no `months`: it runs for `lasts` months from the month the boss takes it on, the first
  of them included, and it must be done by the end of the last. That is at least 2, and no longer
  than the run.
- `heardIn` names the Scenes and Notifications in which the player hears of it: on opening the
  Scene, or answering the Notification. Until then it is not in view. Once heard of, the **Your
  project** card shows its `title`, and its details its `what`, with where it has got to from
  `statuses`, of which `running` says `{month}`, the month it is due by. Text about a Plan should
  leave its deadline to that: a Scene can say `{plan}` for the title of your boss's Plan.
- `ways` are how it can be completed, each `how` it is done: `reality` or `appearance`. Every Plan
  needs at least one of each. The first way whose `when` holds, in time, completes it at once. A
  `when` reads only what the player did while the Plan ran, usually a flag set by a choice offered
  with `planRunning`, and never the hidden truth. Completing it does four things. Its `sets` go on
  the official record, the same on every deal, so a flag there can move Official standing in
  [`standing.json`](#standingjson). It moves its boss's belief by `belief` for their kind. Their
  kind decides too whether they count it done, by the kinds in `counts`: a Believer wants it really
  done, an Incompetent wants it to look done, and a Practitioner wants it to make them look good.
  And the player is told `done`, with the `reaction` for that boss's kind, which is a sign and must
  not name a kind. Every kind must count some way done, and not every way can be counted by all.
- A way done in appearance must add a [hidden risk](#risksjson), by a flag in its `sets` that is a
  risk's `addedBy`, and one done in reality must not. A way that every kind takes alike is refused.
- `needs` is what doing it for real takes, and who might have it: as the Plan is taken on, one of
  `from` is dealt to really have it. A Scene's sign can say `{keeper}` for them. The player has it
  once they have done `asked`, a flag, of that person while the Plan runs. A way with `"needs":
true` is done in reality only then, and otherwise as its `otherwise`, a way in appearance with no
  `when` of its own, which must put the same on the official record. `told` says `{who}`, for the
  results screen.
- `failed` is what happens if it is not done in time, as the month after it was due opens: its
  boss looks for someone to blame, even if the player has moved away from them. If `blame.sticks`
  holds, or is left out, it is the player at the seeded `chance` for that boss's kind, plus `mood`
  for how they stand with the player, and `onPlayer` is sent, which can be `"mistake": "big"`.
  Otherwise `onSomeoneElse` is. Both are Bills, as in [`threads.json`](#threadsjson), and may not
  say `{boss}` or `{head}`, since by then that may be someone else.
- `results` is what the results screen says became of each boss's Plan: `reality`, `appearance`,
  `failed`, or `running` if the run ended first.

Whatever follows from a Plan being completed, such as its boss moving up, reads `planCompleted` in
`src/engine/grand-plans.ts`: whether a boss's latest Plan was completed, how, and whether they
counted it done. A Plan counted done opens its boss's seat, as [`vacancies.json`](#vacanciesjson)
says, and a boss on their way up takes on no new Plan. `formerBoss` is the title the player is told
instead of a way's `done.title` when the Plan's boss is no longer theirs.

## `hidden-truth.json`

The rules of the deal: kinds, their weights, and the Hidden Facts.

A Hidden Fact says `{name}`, so that it reads correctly for whoever is dealt it, and can list
`"characters"` to limit who that can be. Its `nature` is `dangerous`, `useful` or `idle`. Its
`told` is how someone would say it out loud, and its `text` is how the results screen states
it.

The first `minPractitioners` are dealt to seats in a seeded order. With
[`rivals.json`](#rivalsjson), a deal in which nobody who could compete with the player is a
Practitioner is dealt again, once, `dealAgain` of the time, so that a run with no Rival is rare.
Dealing again leans every role the same way, so no role's kind is a tell.

## `mistakes.json`

The words of a Final Warning, of being demoted and of being fired, and what the results screen
says of them.

A choice's outcome, a Move or a Bill can say `"mistake": "big"`. Nothing else is needed for
it to count. The first puts the player on a Final Warning, which they are told about and can
see from then on. The second gets them fired, which ends the run at the results screen. There
is no meter behind this.

Where a big mistake is made decides what else it costs, so a blocking or demoting mistake is
written as any other, and offered where it should bite:

- **Blocking:** one made while a seat is open, in content for the months it is open, is the
  player's `mistake` reason when it is decided. See [`vacancies.json`](#vacanciesjson).
- **Demoting:** one made on a floor the player won a seat to, in content for that floor, demotes
  them as the month closes, as well as the Final Warning. They go back to the seat's `floor`, its
  job and its rooms, which pick up at the month on that floor where they left it. Whoever of the
  team that answered to them came closest to the seat when it was decided takes it, with the
  title its last holder had, and the player and the rest of the team answer to them. With nobody
  left on the team, the seat stays empty, and the player answers to whoever they answered to.
  `demoted` is told as the next month opens, and the lift takes the player down after it. It
  says `{boss}`, whoever the player answers to now, and is required wherever seats are written.

A Notification option's outcome or a Scene result can instead say `"mistake": "catastrophic"`,
which gets the player fired outright. It is fair only if they are warned, so the option must
carry `stakes`, words shown on the choice before it is made. Stakes with nothing catastrophic
behind them, or the reverse, are refused. An action cannot be catastrophic, and can be a big
mistake only if it has a `result`.

## `moves.json`

Character Moves, and when each can land. A Move does not land twice in a run while another
could. A Move with `"priority": true` lands ahead of the others whenever its `when` holds.
`"repays": "projects"` pays back the favour the player owes that Character, as it lands.

- `by` says who makes it: a Character, `{boss}` or `{head}`, or `{competitor}`, anyone competing
  with the player in [`rivals.json`](#rivalsjson), whatever their kind, drawn by the odds in
  `makers`. It lands only while they are there to make it. Only a competitor's Move can say
  `{competitor}`, and only in its `body`, for what text calls whoever made it. A Practitioner is
  likeliest to make one, but anyone competing can, so a named maker is a sign of a Rival and never
  says who is one.
- `family` is which family of Move it is, from [`families.json`](#familiesjson). A Move made by
  someone while they are a Rival, with a `family`, is listed on the results screen as what they did.
  Made by anyone else, it is listed nowhere as theirs.
- `opinion` and `headOpinion` move your bosses' beliefs, as a choice's do.
- `falseStory` is a false story about the player: an `about`, which `remembers` reads, and the
  `text` that the results screen shows. It needs a `by`, who made it up. It starts with them and
  travels the Power Map as true news does, in [`reputation.json`](#reputationjson), moving the belief
  of each person it reaches, though not of whoever made it up, until someone sees through it. A
  story about the same thing is only ever started once, however often its Move lands.
- An option can wait for a Move with `requires` and `sawMove`, so the player can use a Move once
  they have seen it done to them, and not before. `any` gives other means to the same option, such
  as `hasBuzzword`, as the metric review's tricky question does with "single source of truth".

## `notebook.json`

The Notebook keeps every claim by itself. It keeps a sign only if that sign is written with
a `clue`, which can sit on a behaviour or on a Scene's sign.

`events` are the other things it keeps, each noted once in a month when its `when` holds.
Each has a `verdict` of `held`, `wrong` or `idle`, which only the results screen shows.

## `notifications.json`

The month's Notifications, their choices and their results.

- A Notification with a `when` waits until that holds.
- A body can say `{real}` and `{reported}`, the Project's two statuses.
- An option with a `bet` has a seeded `chance` of going well, and otherwise uses what `lost`
  says.
- An option's `sets`, `opinion`, `approach`, `family` and `project` work as for any choice.

An option's outcome or a Scene result can carry `"remembers"`, a list of what a Character
keeps of this, each with their `character`, an `about` that the `remembers` condition reads, and
`text`, and optionally a `tone`, which moves what they believe of the player, as in
[`reputation.json`](#reputationjson). A Budget comes back this way: a later Thread's outcome
reads who remembers what.

A Budget is a one-off decision and never a running balance, so it needs nothing of its own:
the Budget Round is a Scene, and the bonus pot and the underspend are Notifications here,
with `months`, `approach` and `project` like any other choice. Nothing tracks money between
them.

## `official-story.json`

The official story, assembled from `entries` according to what you did. Its `title` can say
`{job}`, the player's job title. Each entry has `reported` or `happened` text, or both, and can
have `when`, `floor` and `months`.

## `over-head.json`

Going over your boss's head, to [your boss's boss](#your-boss-and-your-bosss-boss), which an action
with `"overHead": true` does. It is refused if there is no boss's boss.

Your boss's boss has a hidden belief of their own, which `signs` show whenever they are in a
Scene, and which a choice can move with `"headOpinion": 1`. Its own `mood` here says when
that shows.

- `outcomes` holds the seeded chance of it working, by their dealt kind and by whether they
  are `influential` or `sidelined`. The count at the top of the Power Map that makes someone
  influential is `influentialCount` in [`sources.json`](#sourcesjson).
- `effects` says how far each belief moves if it works. Your boss gains little if your boss's
  boss has little influence.
- `findsOut` is the seeded chance of your boss hearing of it, by your boss's kind, which grows
  by `perUse` with each trip, and how sharply their belief then falls.
- `verdict` is what the results screen says your boss's boss made of you.

## `project.json`

The player's Project: its `owner`, its `statuses` from best to worst, each with a `colour`,
where it `start`s, and the `events` that happen to it as a month opens. The **Your project**
card stays on the floor, showing how it really is and how it has been reported. It can be
clicked at any step, at no cost, for the details.

A Notification option, Scene result or action can carry
`"project": { "real": "better", "reported": "worse" }`. Each side is a status's id, `better` or
`worse`, and `reported` can also be `real`, which is what telling the truth does. Nothing else
moves them.

`flagged` says at which reported status the Project is flagged, and which Scene then opens and
what it costs. That Scene belongs to no month and no action: it opens once each time the
reported status arrives at `at`, before the player's actions, whichever month that is.

`input` names who the report needs figures from, the `months` they can be late, and the
`chance` of that for each kind they might be. Lateness is drawn from the seed and never from
the player's choices, and it sets a flag for the month. It must be possible from at least two
kinds, and certain from none, so that it never settles what someone is.

## `promises.json`

The player's word, which they can give whether or not they can deliver it. There is no meter
behind it: it is a commitment and a memory.

- `belief` sets the seeded chance of being believed: `chance` by the kind they were dealt, plus
  `mood` for how they stand with the player, less `perBroken` for each broken word that has reached
  them, and plus `perKept` for each kept one.
- `replies` are what they say back, and say `{who}` and `{what}`. `believed` and `doubted` are
  written for each kind, `letDown` is for someone the player let down before, and `heard` is for
  someone who heard of it, and also says `{victim}`. A reply that names a kind is refused.
- `broken` and `kept` are the news each starts, as in [`reputation.json`](#reputationjson). A
  broken Promise is known at once to its victim and to everyone tied to them on the Power Map, and the
  victim's belief falls `perTie` further for each of those.
- `statuses` are how the player's own list, and the results screen, say where each has got to.
- `items` are the Promises. Each has `to`, `title`, `what`, which reads after "You told them", a
  seeded wait `after`, and `due`, a Notification whose options each `settles` it as `kept` or
  `broken`. One of them must break it for nothing, so that it can always be answered. A Promise
  that cannot be delivered has only ways to break it.

A Notification option or Scene option offers one with `"promise"`, once in a run. A Notification
option that does has no `result`, since what is said back is its result. A Promise not believed never
falls due. The player can see their word at any time, for nothing.

## `reputation.json`

There is no single reputation score. Each Character has their own belief about the player, and
your bosses' beliefs are the same idea, so there is one idea of what someone thinks of you. It has no number on screen. It shows through signs, and through
anything written with the `believes` condition.

A choice's outcome, a Bill or a Scene result can carry `news`: an `about` that the `remembers`
condition reads, a `tone` of `good` or `bad`, the `text` that the results screen shows, and `at`,
whom it was done in front of, or to. They know at once. A `falseStory` is news too, but false.

- `travel` sets how far and how fast it goes. As each month opens, it moves `hopsPerMonth` steps
  along the ties of the Power Map, no more than `maxHops` from where it started. `passOnChance` is
  the seeded chance of each person telling each person tied to them, and `shift` is how far it then
  moves their belief. So the same deed reaches different people on different deals.
- `mood` says when the belief of anyone but your bosses shows. Your bosses have their own, in
  [`balance.json`](#balancejson) and [`over-head.json`](#over-headjson).
- `signs` show how everyone else present in a Scene is with the player. Each says `{who}`, and
  must be possible from at least two of `warm`, `neutral` and `cold`, so that no sign settles it.
- `believes` and `how` are the results screen's words. `how.heardFrom` says `{who}`.
- `falseStories` says how a false story is found out. As each month opens, before news moves, each
  person who heard one in an earlier month sees through it at the seeded chance in `foundOut` for
  their kind. They then believe what they did before it reached them, and pass it on no further.
  Seeing through one the player made up traces it back to them: its `exposed` starts as bad news of
  the player, from whoever saw through it, and burns only the one it was about. `started` is what
  the results screen says of whoever made a story up, and `found`, which says `{month}`, of someone
  who found out.

## `risks.json`

The short list of hidden risks the player's decisions build up. There is no running balance and
no company simulation: a risk is a written item with a source, a route out and a way of being
traced. The same risk can land on the player, land on someone else, or never come out at all. The
player sees none of it until it does, and the results screen lists the lot.

- `addedBy` is a flag, from the `sets` of a choice. The first time anything sets it, the risk is
  added. A one-off Budget is a good source.
- `after` gives the `min` and `max` months until it can come out, which are seeded.
- `route` is who it comes out through: their `character`, the seeded `chance` that they act,
  by the kind they were dealt, their `motive`, for the results screen, and optionally their
  `means`, a condition they need. It gets one chance. If that fails, it never comes out.
- `traced` is read as it comes out. Reading a flag with `did` lets the player change that, as
  clearing the shared drive in month 7 does. If it holds, `onPlayer` is sent. If not, `onSomeoneElse`
  is, if it is written, and otherwise nothing happens. Either is a Bill, as in
  [`threads.json`](#threadsjson), so a risk that lands can be `"mistake": "big"`.
- `event` names a Company Event, from [`events.json`](#eventsjson), that lands as it comes out.
- `note` says what was building up, and `landedOnYou`, `landedElsewhere` and `neverCameOut` say
  what became of it. The results screen lists every risk that was added.

## `rivals.json`

Who competes with the player. Rival is a relationship, not a kind: a Rival is any Practitioner
competing with the player for something, as things stand, wherever they are on the Org Chart. Your
boss can be one. The player is never told who is a Rival, and reads it from signs, such as the Moves
made against them. The results screen lists each Rival, what they competed for and what they did.

- `competing` lists what can be competed for. Each has an `id`, `for`, which the results screen
  shows, and `who`, read as things stand: `{boss}` or `{head}` for whoever is in that place,
  `{peers}` for whoever shares the player's boss on the Org Chart, `{everyone}` for anyone still in
  the company, or a Character by name, whatever their place, such as a former boss. A `when` makes
  it a competition only while that holds, which is how a vacancy can be written: its candidates,
  with a `when` that reads the flag that opened the seat.
- As each month opens, and as a Move lands, every Practitioner among them is a Rival, up to `most` of
  them, the most influential on the Power Map first. A Believer who changes into a Practitioner can
  become one. Anyone who has been a Rival stays on the results screen.
- `dealAgain` is how often a deal with no Practitioner among those who could compete as a run
  starts is dealt again, as in [`hidden-truth.json`](#hidden-truthjson).
- `moveChance` is how often a month's Character Move is a competitor's, while one is still to land
  and anyone competes. Any priority Move still comes first. See [`moves.json`](#movesjson).
- `makers` are the odds, for each kind, of a competitor being the one who makes such a Move. Every
  kind must be able to, and the odds must differ, so that it is a sign and never settles anything.
- `didNothing` is what the results screen says of a Rival who made no Move against the player.

These are refused: a `who` that names nobody, an `id` written twice, `makers` that are all the
same, a Move by `{competitor}` with no `rivals.json`, a Move by someone unknown, `{competitor}` in a
Move no competitor makes or outside its `body`, a Move's `falseStory` with no `by` or with an `of`
or `at`, a choice's with no `of` or `at`, and any `falseStory` with no `falseStories` in
[`reputation.json`](#reputationjson).

## `scenes.json`

Each month's Scene: its signs, its choices and their results.

`{holder}`, `{ignored}` and `{bystander}` are replaced by what text calls the most influential,
the least influential and the next most influential of those present, read from the dealt Power
Map's `order`. `holderIs` reads the same in a Scene's results. A Scene without the whole cast can
therefore show a holder whom the Power Map's tree does not place above everyone present, so the
meeting has everyone in it. `{plan}` and `{keeper}` say your boss's [Grand Plan](#grand-plansjson)
and who really has what it needs.

- A sign can have a `clue`, for the Notebook.
- An option's `requires` hides it until that holds. See [Conditions](#conditions).
- An option with `"about": "lost-list"` appears once the player has been told that Hidden Fact
  about someone, true or not, and can say `{subject}` for that person.
- A result's `when` picks it. A result with `factNote` is listed on the results screen beside the
  fact itself, and `factAt` names whose fact it was, unless the option is `about` one.
- A result can carry `sets`, `opinion`, `headOpinion`, `approach`, `reaction` and `project`.
- A result's `falseStory` is one the player tells, as a Rival's Move does: an `about`, a `text`,
  `of`, whom it is about, `at`, whom the player tells it to first, and optionally `exposed`, the
  `about` and `text` of the news of the player once someone sees through it. See
  [`reputation.json`](#reputationjson). It moves nobody's belief in the player until it is seen
  through.
- A Scene with a `verdict` adds what the boss finally says, by their mood.
- A Scene that data cannot express can name a `script`, which is passed to `startRun` in
  `sceneScripts`. This format is a trial, as the spec, issue #1, says.
- A Scene with a `quarter` is a quarterly review, as [Quarterly reviews](#quarterly-reviews) says.

## `sources.json`

Find Out: who can be asked, how each role talks, how reliable each kind is, and every claim.

`methods` are the ways of finding out, which an action names with `findOut`.

- `someoneThere: true` deals one of its `sources` to be there, and its `prompt` can say
  `{source}`. Otherwise the player chooses from them.
- `frames` are the conversation around a claim: each says `{said}` and can say `{source}`.

`voices` give each role its own way of putting a claim: each line says `{said}`, and is chosen
apart from whether the claim is true.

`reliability` sets how often each kind of source tells the truth, is mistaken, is out of date or
lies. A dealt motive shifts those weights. A claim's words never depend on which of these it is,
so the results screen is the only place that says.

`influentialCount` is how many people, from the top of the Power Map, count as influential.

## `standing.json`

Official standing: how the player would fare on paper if a vacancy arose. It is shown at every
step as a bar from red through amber to green, with no number, and it decides nothing.

It runs from 0 to 100, starting at `start`. Each time a flag in `deeds` is set, it moves `by`
that much, and the Project's current reported status adds what `reported` gives it, which must
name every status in [`project.json`](#projectjson). On a Final Warning it can be no higher
than `finalWarning`, which must be within the first band.

`bands` start `from` 0 and go up. Each has the `label` said for the bar, and `onPaper`, what the
results screen says of ending in it. There, `decides` says `{who}`: whoever holds influence over
your boss on the Power Map, or your boss if nobody does, followed by what they ended up believing
of you, from [`reputation.json`](#reputationjson): who would decide the seat above you, if it fell
vacant. Each [vacancy](#vacanciesjson) decided is set beside its band at the time, as it is decided
and again on the results screen.

It reads only the official record. A flag in `deeds` must be set by an action, a Notification's
answer or a Scene's result, and never by a result, Move, Bill or event that reads the hidden
truth, or the bar would give the Power Map away. A chased Demand's answers do not count either,
since whether it is chased goes by the boss's kind, though they may set a flag the Demand's own
answers set. One that is not is refused.
`label` and `title` are said beside the bar. The results screen's heading is
`resultsStandingHeading` in [`ui.json`](#uijson).

## `vacancies.json`

Seats: how a boss's seat falls vacant, and who really decides who gets it. As the official story
closes a month in which your boss completed their [Grand Plan](#grand-plansjson) and counted it
done, they are on their way up, and their seat is open for `openFor` months from the next. As the
last of them closes, it is decided, and the next month opens with the decision. A seat decided as
the run's last month closes is told before the results. Nothing opens that the run would end
before deciding.

- `seats` has one seat for each floor that has one, keyed by `floor`, the floor it is on: the
  player's boss holds it while the player's job is that floor's. `job` is the floor that winning it
  takes the player to. `competing` names what is competed for in [`rivals.json`](#rivalsjson) while
  it is open, usually with `"when": { "vacancyOpen": true }` and `"who": ["{peers}"]`: they and the
  player are the candidates. `movesUp` is where its holder goes: whom they now answer to, and their
  new `title` and `called`. `opened` is told as it opens, and says `{holder}` and `{month}`, the
  month it is decided in; `won` and `lost` as it is decided, and `lost` says `{winner}`;
  `blocked`, which says `{winner}`, instead of `lost` when a big mistake cost the player the seat.
- Whoever holds influence over the holder on the Power Map decides, or the holder if nobody does,
  and weighs each candidate's `reasons` by their own kind, in `weight`. They add up, and the most
  wins, with a seeded draw among equals. Every input is hidden truth, never the Org Chart, a Gauge
  or Official standing. For a Character: `self`, being the one deciding; `owed`, being owed a
  favour by them; `protege`, being directly under them on the Power Map, or `circle`, further
  down; and `credited`, having claimed the Plan's credit. For the player: `owedYou` and `calledIn`,
  a favour they are owed, and one they have called in; `credited`; `delivered`, having completed
  the Plan for real and had it counted; `results`, having made `resultsAt` Moves of the deliver
  family; `looks`, `looksAt` of impress and fabricate; `warm`, `neutral` or `cold`, the mood of
  the one deciding; and `mistake`, a [big mistake](#mistakesjson) made while the seat was open. So
  a Believer can weigh what was really done, a Practitioner favours and protégés, and an
  Incompetent who looks the part.
- A reason's `rulesOut` lists the kinds of decider who will not give the seat to a candidate with
  it while anyone else stands, however the rest weighs. If the player is ruled out and nobody
  competes, the holder's team stands instead. The game's `mistake` rules the player out with a
  Believer or an Incompetent, and only weighs against them with a Practitioner, who can be owed
  enough to overlook it. When the player would have had the seat without the mistake, the decision
  says `blocked` and the mistake's `told`, and the results screen gives its `why` first.
- Each reason's `why` is what the results screen says of it, with `{decider}` and, for a Character,
  `{who}`. Its `told`, if it has one, is what the decision itself says, when it is the winner's
  strongest tie to whoever decided: it never says how anyone feels about the player, that a favour
  is owed, or who is a Rival. With nothing to tell, the decision says `untold`, and `close` when it
  was too close to call. `inFact` says `{decider}` and `{why}`, set beside Official standing's band.
  The results screen adds `asForYou`, every reason of the player's, if they lost, and `results`,
  with `{holder}`, `{winner}` and `{month}`. `you` is how all of these call the player.
- Winning makes the player the floor's new job: they answer to whoever the holder answered to, and
  the holder's team answers to them. Losing puts the winner in the holder's place, with the
  holder's title, and the player and the rest of the team answer to them. Each Character passed over
  keeps a memory: `passedOver.forYou` if the player won, and `forSomeoneElse` if not, each with its
  own `about`, which a Move can read with `remembers`, and a `text` that can say `{winner}`.

While a seat is open, a Notification option, a Scene result or a Move can act for it with `seat`:

- `approach`, a Character or a place: the player has a word with them about it. If they decide,
  whoever decides keeps `acts.approach.decider`, and if they have sway with whoever decides,
  `acts.approach.sway`: each a memory, with how far it moves that person's `belief` of the player.
  Anyone else, and nothing comes of it, so knowing the Power Map pays.
- `callIn`: a favour owed to whoever acts by the one deciding is called in, as `calledIn`, or else
  one owed by someone with sway with them, who puts in a word, `acts.callIn.sway`. Either is paid.
- `credit`: whoever acts claims the Plan's credit. Whoever claims it last has it.
- On a Move only, which must have a `by`: `story`, a story about the player that reaches whoever
  decides, `acts.story`, and `diary`, after which whoever decides owes the Move's maker a favour,
  for `acts.diary`. Rivals' Moves for a seat are written as `"by": "{competitor}"`, `"priority":
true` and `"when": { "vacancyOpen": true }`.

These are refused: two seats on one floor, a `floor` or `job` that names no floor, a seat that leads
to its own floor, `competing` that names nothing in `rivals.json`, moving its holder up to someone
who answers to them, a `lost` that does not say `{winner}`, `vacancyOpen` or `seat` with no seats,
`seat` on a Move with no `by`, `story` or `diary` on anything but a Move, `approach` on a Move, and
an `approach` that names nobody. Until issue #107 the player's boss and boss's boss cannot leave,
whoever they are, and the checks that keep them in place still stand: only a seat moves them.

## `threads.json`

A Thread runs from something the player did to the point, months later, where it pays off or
backfires. The player hears nothing of it until its Bill arrives, and the results screen then
traces it back to what started it. Not every Move needs a Thread, and a Bill is better if it
arrives through someone else.

- `startedBy` is a flag, from the `sets` of a choice. The first time anything sets it, the Thread
  starts.
- `chance` is the seeded chance that it ever comes back, and `after` gives the `min` and `max`
  months it then waits. A Thread due past the end of the run never plays out.
- `started` is what the results screen says started it.
- `outcomes` are tried in order as the month it is due opens, and the first whose `when` holds
  plays out, so the last can be a fallback with no `when`. If none holds, it comes to nothing.
  Each has `playedOut`, for the results screen, and a `bill`, which is what reaches the player.
  A Bill can be good news.

A `bill` has a unique `id`, a `title` and a `body`, and `as` says how it arrives:

- `"notice"` tells the player as the month opens.
- `"notification"` arrives as a Notification, and needs `from` and `options`, at least one of
  them free. The options are written as in [`notifications.json`](#notificationsjson).
- `"move"` lands where Character Moves do, beside the month's own, and needs `from`.

An outcome's `gauges` move the player's Gauges as the month it plays out closes, each with the
`gauge`, how far it moves it `by`, and the `note` the player sees. Only a Thread can move a Gauge.

A Bill can carry `sets`, `opinion`, `headOpinion`, `project`, `"mistake": "big"`, `remembers` and
`news`, and these take effect when it arrives, or, as a Move, when it lands. Its flags can be read by the official
story, and they count as hidden, so no option can depend on them.

## `ui.json`

Headings, buttons and the "What you can do now" hints.
