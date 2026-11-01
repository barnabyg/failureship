# Content format

The reference for the data files in `content/`. Each file has one section here, and
the conditions they share have their own. To start editing, see
[Change the game](../README.md#change-the-game) in the README.

The game checks all of this at start-up. Where this page says a mistake is _refused_,
the game does not start and the page shows what is wrong.

## Conditions

A `when` or `requires` holds one of these:

| Condition                                                              | Holds when                                                                              | Reads the hidden truth |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------- |
| `{ "flag": "went-to-pub" }`                                            | A flag is set this month                                                                | Only if the flag does  |
| `{ "did": "moved-a-colleague" }`                                       | A flag has been set in any month of the run                                             | Only if the flag does  |
| `{ "remembers": { "character": "projects", "about": "passed-over" } }` | That Character keeps a memory written with that `about`                                 | Yes                    |
| `{ "hasBuzzword": "strategic-patience" }`                              | The player has learnt the Buzzword                                                      | No                     |
| `{ "heardFact": "lost-list" }`                                         | The player has been told that Hidden Fact about someone, true or not                    | No                     |
| `{ "heardTrue": "lost-list" }`                                         | What the player was told about that Hidden Fact is true                                 | Yes                    |
| `{ "holderIs": "boss" }`                                               | That Character is the most influential of those present, or of everyone outside a Scene | Yes                    |
| `{ "bossIs": "practitioner" }`                                         | The boss is of that kind                                                                | Yes                    |
| `{ "factNature": { "character": "projects", "nature": "dangerous" } }` | That Character's Hidden Fact has that `nature`                                          | Yes                    |
| `{ "not": ... }`                                                       | The condition inside does not hold                                                      | If the inner one does  |
| `{ "all": [...] }`                                                     | Every condition inside holds                                                            | If any inner one does  |

Where each can be used:

| Used on                     | Conditions allowed                                     |
| --------------------------- | ------------------------------------------------------ |
| A Scene result's `when`     | All                                                    |
| A Move's `when`             | All                                                    |
| An official story's `when`  | All                                                    |
| A Scene option's `requires` | Only those that do not read the hidden truth           |
| A Notification's `when`     | Only those that do not read the hidden truth           |
| A Notebook event's `when`   | Only those that do not read the hidden truth, as below |

Anything else is refused. An option must never appear or disappear on undiscovered
truth, and that includes the boss's kind, so a condition that would show the truth
this way stops the game from starting. This also goes for a flag set by something
hidden: a Scene result or a Move whose `when` reads the truth, a Demand being
forgotten or chased, or your boss finding out about going over their head. A
Notebook event can still read such a flag, because the player has just seen that result.

Flags come from `sets`, and are wiped when a new month opens, though `did` can still read
them for the rest of the run. Buzzwords carry over for the whole run.

## `months`, in several files

A Notification, action, Scene, Move, Notebook event or official story entry can list
`"months": [2, 3]` to belong only to those months. Without it, it belongs to every
month.

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

- `disasterChance` is how often a month brings a disaster with no clue, as in
  [`events.json`](#eventsjson).
- `signsMisleadChance` is how often a Scene's signs swap `{holder}` with `{bystander}`,
  so that one Scene never settles who holds influence. A Scene's results still go by the
  truth.
- `opinion` holds `warmAt` and `coldAt`, which say how the boss's hidden opinion stands,
  and `keeps`, which is how much of it carries into each new month, so that it is mostly
  about lately.

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

## `boss.json`

Who your boss is, the signs of how they treat you, and what impresses each kind.

A choice can carry `"opinion": 1` or `-1` to move your boss's hidden opinion of you. The
opinion has no number on screen. It shows only through `signs`: when the boss is in a
Scene, one sign is picked using the `likelihood` for how the opinion stands, as
`balance.json` sets. Every sign must be possible from at least two of `warm`, `neutral`
and `cold`, so that no sign settles it.

A choice can also carry `"approach": "theatre"`. `approaches` lists each one, how far it
moves the opinion of each kind of boss, and how each kind shows it, so the same choice can
warm one boss and chill another. The player reads that from `reaction` lines and never
from a label: a line naming a kind, or an approach that every kind takes alike, is
refused. A choice can write its own `reaction` for each kind.

An approach can have `overdone`, which changes how the listed kinds take it after `after`
uses in a run. This is how a Practitioner boss turns on someone who shines.

## `buzzwords.json`

Buzzwords and their meanings. A choice's `learns` teaches one, and `hasBuzzword` reads it.

## `characters.json`

Job titles, roles, names, and who reports to whom on the Org Chart.

A Character's `called` is how running text refers to them, such as `your boss`, and it gets
a capital only where a sentence starts. Write people into text that way too, and keep their
`name` for a Notification or Move's `from` line. A test fails if a name turns up in the
running text.

## `demands.json`

Demands, listed in `items`, arrive as Notifications with their `months`, and must offer
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
of them, and goes on like any other Demand.

## `dialogs.json`

Short text dialogs, such as the pub. A choice's `dialog` opens one.

## `events.json`

Company Events: things that happen to the company as a whole. They land after the player's
actions and before the month closes, ahead of the month's Character Move. How to write one is in
[Write a Company Event](../README.md#write-a-company-event) in the README.

Each has `from`, `title`, `body`, and `story`, the official story's own `reported` and optional
`happened` words for it. It can carry `sets` and `project`. It has no `mistake`, so a surprise is
never a big mistake by itself. A risk that lands can still be one, through its own Bill.

Each has exactly one way to land, or it is refused:

- A hidden risk's `event` names it, and it lands in the month the risk comes out.
- `schedule` comes from outside: the `months` it can land in, a seeded `chance` in each until it
  does, and an optional `clue` for the Notebook, `before` months earlier.
- `"disaster": true` arrives with no clue. Each month, `disasterChance` in `balance.json` is the
  chance of one, and a run does not repeat one.

`reshuffle` changes the charts. `reports` moves a Character on the Org Chart, so `character` now
reports `to` someone else, and a move that would make a loop does not happen. `rises` sends someone
to the top of the Power Map, and `falls` to the bottom, which changes later signs. Your boss and your
boss's boss cannot be moved in `reports`, since nothing creates a vacancy yet. An event that moves
anyone needs `changed`, which the results screen shows beside the charts.

## `families.json`

What the results screen calls each family of Moves, and what it says of them.

A Notification option, a Scene option or an action can carry `"family": "attack"`, which is
one of `impress`, `fabricate`, `trade`, `find-out`, `deflect`, `attack` or `deliver`. Nothing
during play shows it. **How you played** counts the Moves the player made in each family. A
choice with an `approach` should say which family it is, and a test fails if it does not.

## `floor-1.json`

The rooms on the floor: positions, sizes, colours and the lift's sign.

## `hidden-truth.json`

The rules of the deal: kinds, their weights, and the Hidden Facts.

A Hidden Fact says `{name}`, so that it reads correctly for whoever is dealt it, and can list
`"characters"` to limit who that can be. Its `nature` is `dangerous`, `useful` or `idle`. Its
`told` is how someone would say it out loud, and its `text` is how the results screen states
it.

## `mistakes.json`

The words of a Final Warning and of being fired, and what the results screen says of them.

A choice's outcome, a Move or a Bill can say `"mistake": "big"`. Nothing else is needed for
it to count. The first puts the player on a Final Warning, which they are told about and can
see from then on. The second gets them fired, which ends the run at the results screen. There
is no meter behind this.

A Notification option's outcome or a Scene result can instead say `"mistake": "catastrophic"`,
which gets the player fired outright. It is fair only if they are warned, so the option must
carry `stakes`, words shown on the choice before it is made. Stakes with nothing catastrophic
behind them, or the reverse, are refused. An action cannot be catastrophic, and can be a big
mistake only if it has a `result`.

## `moves.json`

Character Moves, and when each can land. A Move does not land twice in a run while another
could. A Move with `"priority": true` lands ahead of the others whenever its `when` holds.

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
`text`. A Budget comes back this way: a later Thread's outcome reads who remembers what.

A Budget is a one-off decision and never a running balance, so it needs nothing of its own:
the Budget Round is a Scene, and the bonus pot and the underspend are Notifications here,
with `months`, `approach` and `project` like any other choice. Nothing tracks money between
them.

## `official-story.json`

The official story, assembled from `entries` according to what you did. Each entry has
`reported` or `happened` text, or both, and can have `when` and `months`.

## `over-head.json`

Going over your boss's head, which an action with `"overHead": true` does.

Your boss's boss has a hidden opinion of their own, which `signs` show whenever they are in a
Scene, and which a choice can move with `"headOpinion": 1`. Its own `opinion` here says when
that shows.

- `outcomes` holds the seeded chance of it working, by their dealt kind and by whether they
  are `influential` or `sidelined`. The count at the top of the Power Map that makes someone
  influential is `influentialCount` in [`sources.json`](#sourcesjson).
- `effects` says how far each opinion moves if it works. Your boss gains little if your boss's
  boss has little influence.
- `findsOut` is the seeded chance of your boss hearing of it, by your boss's kind, which grows
  by `perUse` with each trip, and how sharply their opinion then falls.
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

## `risks.json`

The short list of hidden risks the player's decisions build up. There is no running balance and
no company simulation: a risk is a written item with a source, a route out and a way of being
traced. The player never sees the list during play. How to write one is in
[Write a hidden risk](../README.md#write-a-hidden-risk) in the README.

- `addedBy` is a flag. The first time anything sets it, the risk is added.
- `after` gives the `min` and `max` months until it can come out, which are seeded.
- `route` is who it comes out through: their `character`, the seeded `chance` that they act,
  by the kind they were dealt, their `motive`, for the results screen, and optionally their
  `means`, a condition they need. It gets one chance. If that fails, it never comes out.
- `traced` is read as it comes out. If it holds, `onPlayer` is sent. If not, `onSomeoneElse`
  is, if it is written, and otherwise nothing happens. Either is a Bill, as in
  [`threads.json`](#threadsjson), so a risk that lands can be `"mistake": "big"`.
- `event` names a Company Event, from [`events.json`](#eventsjson), that lands as it comes out.
- `note` says what was building up, and `landedOnYou`, `landedElsewhere` and `neverCameOut` say
  what became of it. The results screen lists every risk that was added.

## `scenes.json`

Each month's Scene: its signs, its choices and their results.

`{holder}`, `{ignored}` and `{bystander}` are replaced by what text calls the most influential,
the least influential and the next most influential of those present, read from the dealt Power
Map's `order`. `holderIs` reads the same in a Scene's results. A Scene without the whole cast can
therefore show a holder whom the Power Map's tree does not place above everyone present, so the
meeting has everyone in it.

- A sign can have a `clue`, for the Notebook.
- An option's `requires` hides it until that holds. See [Conditions](#conditions).
- An option with `"about": "lost-list"` appears once the player has been told that Hidden Fact
  about someone, true or not, and can say `{subject}` for that person.
- A result's `when` picks it. A result with `factNote` is listed on the results screen beside the
  fact itself, and `factAt` names whose fact it was, unless the option is `about` one.
- A result can carry `sets`, `opinion`, `headOpinion`, `approach`, `reaction` and `project`.
- A Scene with a `verdict` adds what the boss finally says, by how the opinion stands.

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

## `threads.json`

A Thread runs from something the player did to the point, months later, where it pays off or
backfires. Adding one needs no code. How to write one is in
[Write a Thread](../README.md#write-a-thread) in the README.

- `startedBy` is a flag. The first time anything sets it, the Thread starts.
- `chance` is the seeded chance that it ever comes back, and `after` gives the `min` and `max`
  months it then waits. A Thread due past the end of the run never plays out.
- `started` is what the results screen says started it.
- `outcomes` are tried in order as the month it is due opens, and the first whose `when` holds
  plays out. If none holds, it comes to nothing. Each has `playedOut`, for the results screen,
  and a `bill`.

A `bill` has a unique `id`, a `title` and a `body`, and `as` says how it arrives:

- `"notice"` tells the player as the month opens.
- `"notification"` arrives as a Notification, and needs `from` and `options`, at least one of
  them free. The options are written as in [`notifications.json`](#notificationsjson).
- `"move"` lands where Character Moves do, beside the month's own, and needs `from`.

It can carry `sets`, `opinion`, `headOpinion`, `project` and `"mistake": "big"`, and these
take effect when it arrives, or, as a Move, when it lands. Its flags can be read by the official
story, and they count as hidden, so no option can depend on them.

## `ui.json`

Headings, buttons and the "What you can do now" hints.
