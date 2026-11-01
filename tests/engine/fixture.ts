import { parseContent, type Content } from "../../src/engine";

/**
 * A small content set for engine tests, so that editing the game's real text
 * never breaks a rules test.
 */
export function fixtureRaw() {
  return {
    balance: { actionsPerMonth: 3, actionCosts: { standard: 1 } },
    hiddenTruth: {
      facts: [
        { id: "fact-a", text: "SECRET-FACT-ALPHA" },
        { id: "fact-b", text: "SECRET-FACT-BRAVO" },
        { id: "fact-c", text: "SECRET-FACT-CHARLIE" },
      ],
    },
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
        actions: "Click the floor. You have {actions} left.",
        notice: "Press continue.",
        story: "The month has closed.",
      },
      actionCount: { one: "1 action", other: "{n} actions" },
      costLabel: "Costs {actions}",
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
