import { everyNotification, type Content } from "./content";
import { isUnder } from "./deal";
import { bossesAtStart, managerAtStart, meantBy } from "./places";

/** Everything that can act for a seat, and whether a Character's Move makes it. */
function seatActs(content: Content) {
  return [
    ...content.moves.flatMap((m) =>
      m.seat
        ? [{ owner: `Move "${m.id}"`, act: m.seat, move: true, by: m.by }]
        : [],
    ),
    ...everyNotification(content).flatMap((n) =>
      n.options.flatMap((o) =>
        "seat" in o && o.seat
          ? [
              {
                owner: `Notification "${n.id}" option "${o.id}"`,
                act: o.seat,
                move: false,
                by: undefined,
              },
            ]
          : [],
      ),
    ),
    ...content.scenes.flatMap((s) =>
      s.options.flatMap((o) =>
        o.results.flatMap((r) =>
          r.seat
            ? [
                {
                  owner: `Scene "${s.id}" option "${o.id}"`,
                  act: r.seat,
                  move: false,
                  by: undefined,
                },
              ]
            : [],
        ),
      ),
    ),
  ];
}

/**
 * What is done for a seat: only a Character's Move, made by someone, tells a
 * story or gets into a diary, only the player approaches someone, and whoever is
 * approached is there.
 */
function findBrokenSeatActs(content: Content): string[] {
  const problems: string[] = [];
  const bosses = bossesAtStart(content);
  const known = new Set(content.characters.map((c) => c.id));
  for (const { owner, act, move, by } of seatActs(content)) {
    if (!content.vacancies) {
      problems.push(`${owner} acts for a seat, but no seats are written.`);
    }
    if (move && by === undefined) {
      problems.push(`${owner} acts for a seat, so it needs a "by".`);
    }
    if (!move && (act.story || act.diary)) {
      problems.push(
        `${owner} tells a story or gets into a diary, which only a Move does.`,
      );
    }
    if (move && act.approach !== undefined) {
      problems.push(`${owner} approaches someone, which only the player does.`);
    }
    const target =
      act.approach && (meantBy(bosses, act.approach) ?? act.approach);
    if (target && !known.has(target)) {
      problems.push(`${owner} approaches unknown "${act.approach ?? ""}".`);
    }
  }
  return problems;
}

/**
 * Every way of getting rid of the boss that a choice names is written, and
 * anyone who could be the boss got rid of has a cover for text to say instead.
 */
function findBrokenOusting(content: Content): string[] {
  const named = [
    ...everyNotification(content).flatMap((n) =>
      n.options.flatMap((o) =>
        "ousts" in o && o.ousts !== undefined
          ? [{ owner: `Notification "${n.id}" option "${o.id}"`, way: o.ousts }]
          : [],
      ),
    ),
    ...content.scenes.flatMap((s) =>
      s.options.flatMap((o) =>
        o.results.flatMap((r) =>
          r.ousts !== undefined
            ? [{ owner: `Scene "${s.id}" option "${o.id}"`, way: r.ousts }]
            : [],
        ),
      ),
    ),
  ];
  const ways = content.vacancies?.ousting?.ways ?? {};
  const problems = named
    .filter(({ way }) => !(way in ways))
    .map(
      ({ owner, way }) =>
        `${owner} gets rid of the boss by unknown way "${way}" in vacancies.json.`,
    );
  if (named.length === 0) return problems;
  // Whoever could be the boss got rid of: the first boss, or one of their
  // team, who can win the seat. Text says the cover in place of whoever went.
  const { boss } = bossesAtStart(content);
  const team = content.characters
    .filter((c) => managerAtStart(content, c.id) === boss)
    .map((c) => c.id);
  const leaving = content.changing?.leaving ?? {};
  for (const id of [boss, ...team].filter((c) => !(c in leaving))) {
    problems.push(
      `"${id}" can be got rid of as the player's boss, so needs a cover in changing.json's leaving.`,
    );
  }
  return problems;
}

/**
 * Seats: each is on a known floor and leads to another, or wins, what is competed for
 * while it is open is written, and whoever its holder moves up to is there, and
 * is not under that floor's boss. One seat to a floor, since a floor has one boss.
 * A big mistake in a seat demotes, so being demoted needs its words.
 */
export function findBrokenVacancies(content: Content): string[] {
  const problems = [
    ...findBrokenSeatActs(content),
    ...findBrokenOusting(content),
  ];
  const written = content.vacancies;
  if (!written) return problems;
  const jobs = content.floors.map((f) => f.job);
  const competing = new Set(content.rivals?.competing.map((c) => c.id));
  const characters = new Map(content.characters.map((c) => [c.id, c]));
  const answersTo = (id: string, above: string) =>
    isUnder((at) => characters.get(at)?.reportsTo, id, above);
  if (content.mistakes && !content.mistakes.demoted) {
    problems.push(
      "A seat is written, so mistakes.json needs the words for being demoted.",
    );
  }
  const floors = new Set<string>();
  for (const seat of written.seats) {
    const owner = `Seat "${seat.id}"`;
    if (floors.has(seat.floor)) {
      problems.push(`${owner} is a second seat on floor "${seat.floor}".`);
    }
    floors.add(seat.floor);
    for (const job of [seat.floor, ...(seat.job ? [seat.job] : [])]) {
      if (!jobs.includes(job))
        problems.push(`${owner} names unknown floor "${job}".`);
    }
    if ((seat.job === undefined) === (seat.win === undefined)) {
      problems.push(
        `${owner} needs either a "job" to lead to or a "win", and not both.`,
      );
    }
    if (seat.floor === seat.job) {
      problems.push(`${owner} leads to the floor it is on.`);
    }
    if (!competing.has(seat.competing)) {
      problems.push(
        `${owner} is competed for as unknown "${seat.competing}" in rivals.json.`,
      );
    }
    const up = seat.movesUp.reportsTo;
    if (!characters.has(up)) {
      problems.push(`${owner} moves its holder up to unknown "${up}".`);
    } else if (seat.floor === content.you.job) {
      const boss = content.you.reportsTo;
      if (up === boss || answersTo(up, boss)) {
        problems.push(`${owner} moves its holder up to someone under them.`);
      }
    }
    if (!seat.lost.body.includes("{winner}")) {
      problems.push(`${owner} needs to say {winner} when it is lost.`);
    }
  }
  return problems;
}

/** A condition that reads whether a seat is open needs seats to be written. */
export function needsVacancies(content: Content, owner: string): string[] {
  return content.vacancies
    ? []
    : [`${owner} reads whether a seat is open, but no seats are written.`];
}
