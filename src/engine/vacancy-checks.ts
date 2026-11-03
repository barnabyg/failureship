import type { Content } from "./content";

/**
 * Seats: each is on a known floor and leads to another, what is competed for
 * while it is open is written, and whoever its holder moves up to is there, and
 * is not under that floor's boss. One seat to a floor, since a floor has one boss.
 */
export function findBrokenVacancies(content: Content): string[] {
  const written = content.vacancies;
  if (!written) return [];
  const problems: string[] = [];
  const jobs = content.floors.map((f) => f.job);
  const competing = new Set(content.rivals?.competing.map((c) => c.id));
  const characters = new Map(content.characters.map((c) => [c.id, c]));
  const answersTo = (id: string, above: string): boolean => {
    const seen = new Set<string>();
    let at = characters.get(id)?.reportsTo;
    while (at !== undefined && !seen.has(at)) {
      if (at === above) return true;
      seen.add(at);
      at = characters.get(at)?.reportsTo;
    }
    return false;
  };
  const floors = new Set<string>();
  for (const seat of written.seats) {
    const owner = `Seat "${seat.id}"`;
    if (floors.has(seat.floor)) {
      problems.push(`${owner} is a second seat on floor "${seat.floor}".`);
    }
    floors.add(seat.floor);
    for (const job of [seat.floor, seat.job]) {
      if (!jobs.includes(job))
        problems.push(`${owner} names unknown floor "${job}".`);
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
