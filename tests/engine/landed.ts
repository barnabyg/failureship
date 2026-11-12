import type { LandedView, NoticeView, PlayerView } from "../../src/engine";

/** What landed as the month closed, told in its official story, if the view is one. */
export function landedIn(view: PlayerView): LandedView[] {
  return view.step.kind === "story" ? view.step.landed : [];
}

/** Everything that landed as each month closed, in the order the views told it. */
export function everyLanded(views: readonly PlayerView[]): LandedView[] {
  return views.flatMap(landedIn);
}

/** What the month's opening told, waiting in the inbox to be read. */
export function notesIn(view: PlayerView): NoticeView[] {
  return view.inbox.items.filter((i) => i.kind === "notice");
}

/** One thing the player was told, the month they were told it, and the view it was in. */
export interface Told {
  month: number;
  told: NoticeView | LandedView;
  view: PlayerView;
}

/**
 * Everything the player was told, in order: a notice that stopped the month,
 * one kept in the inbox as the month opened, and whatever landed in a Monthly
 * Summary. A note is counted once, in the view where it first appears.
 */
export function everyTold(views: readonly PlayerView[]): Told[] {
  return views.flatMap((view, i) => {
    const before = views[i - 1];
    const fresh =
      before === undefined || before.month !== view.month
        ? notesIn(view)
        : notesIn(view).slice(notesIn(before).length);
    return [
      ...(view.step.kind === "notice" ? [view.step] : []),
      ...fresh,
      ...landedIn(view),
    ].map((told) => ({ month: view.month, told, view }));
  });
}

/** Every notice the player was told, wherever it was told. */
export function everyNotice(views: readonly PlayerView[]): NoticeView[] {
  return everyTold(views).flatMap(({ told }) =>
    told.kind === "notice" ? [told] : [],
  );
}

/** The months in which the player was told something of this title, by any means. */
export function monthsTold(
  views: readonly PlayerView[],
  title: string,
): number[] {
  return everyTold(views)
    .filter(({ told }) => told.title === title)
    .map(({ month }) => month);
}

/** The first time the player was told something of this title, by any means. */
export function firstTold(
  views: readonly PlayerView[],
  title: string,
): Told | undefined {
  return everyTold(views).find(({ told }) => told.title === title);
}
