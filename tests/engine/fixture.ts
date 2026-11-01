import { parseContent, type Content } from "../../src/engine";

interface RawOption {
  id: string;
  label: string;
  cost?: string;
  dialog?: string;
  learns?: string[];
  result?: { title: string; body: string };
}

interface RawNotification {
  id: string;
  from: string;
  subject: string;
  body: string;
  options: RawOption[];
}

/**
 * A small content set for engine tests, so that editing the game's real text
 * never breaks a rules test.
 */
export function fixtureRaw() {
  const notifications: RawNotification[] = [
    {
      id: "invite",
      from: "Your boss",
      subject: "Report or pub",
      body: "Finish the report, or come to the pub.",
      options: [
        {
          id: "report",
          label: "Finish the report",
          cost: "report",
          result: { title: "Report filed", body: "It has been filed." },
        },
        {
          id: "pub",
          label: "Go to the pub",
          cost: "pub",
          dialog: "pub",
          learns: ["fixture-word"],
        },
      ],
    },
  ];
  return {
    balance: {
      actionsPerMonth: 3,
      actionCosts: { standard: 1, report: 1, pub: 1 } as Record<string, number>,
    },
    hiddenTruth: {
      facts: [
        { id: "fact-a", text: "SECRET-FACT-ALPHA" },
        { id: "fact-b", text: "SECRET-FACT-BRAVO" },
        { id: "fact-c", text: "SECRET-FACT-CHARLIE" },
      ],
    },
    notifications,
    dialogs: [
      {
        id: "pub",
        title: "At the pub",
        lines: [{ speaker: "Your boss", text: "Have you heard this one?" }],
      },
    ],
    buzzwords: [
      { id: "fixture-word", term: "FIXTURE-TERM", meaning: "Nothing at all." },
    ],
    actions: [
      action("kettle"),
      action("desk"),
      action("copier"),
      action("plant"),
    ],
    officialStory: { title: "Official story", reported: ["All is well."] },
    floor: { rooms: ["kettle", "desk", "copier", "plant"].map(room) },
    ui: {
      hints: {
        notification: "Answer the Notification.",
        dialog: "Press continue.",
        actions: "Click the floor. You have {actions} left.",
        notice: "Press continue.",
        story: "The month has closed.",
      },
      actionCount: { one: "1 action", other: "{n} actions" },
      costLabel: "Costs {actions}",
      freeLabel: "Costs nothing",
    },
  };
}

export function action(id: string) {
  return {
    id,
    label: `Go to ${id}`,
    description: `The ${id}`,
    place: id,
    cost: "standard",
    result: { title: `At ${id}`, body: `You spent time at ${id}.` },
  };
}

export function room(id: string, index: number) {
  return {
    id,
    label: id,
    x: index * 3,
    z: 0,
    width: 2,
    depth: 2,
    height: 1,
    colour: "#888888",
  };
}

export function fixture(): Content {
  return parseContent(fixtureRaw());
}

/** A month with no Notifications, for tests about spending actions. */
export function emptyMonthRaw() {
  return { ...fixtureRaw(), notifications: [] };
}

export function emptyMonth(): Content {
  return parseContent(emptyMonthRaw());
}
