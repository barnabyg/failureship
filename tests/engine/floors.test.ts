import { describe, expect, it } from "vitest";
import {
  parseContent,
  resumeRun,
  startRun,
  type Content,
  type PlayerView,
  type Run,
} from "../../src/engine";
import { action, emptyMonthRaw, room } from "./fixture";

/** A Notification that costs nothing to answer. */
function memo(id: string, floor?: string, months?: number[]) {
  return {
    id,
    from: "Facilities",
    subject: `MEMO-${id}`,
    body: "Please read.",
    options: [{ id: "noted", label: "Noted" }],
    ...(floor === undefined ? {} : { floor }),
    ...(months === undefined ? {} : { months }),
  };
}

/** A Scene, and the meeting action that opens it in a room on its floor. */
function meeting(id: string, floor: string, months?: number[]) {
  return {
    scene: {
      id,
      title: `SCENE-${id}`,
      location: "Upstairs",
      narration: ["Everyone sits down."],
      cast: ["ana", "ben", "cal"],
      signs: [],
      options: [{ id: "nod", label: "Nod", results: [{ body: "Noted." }] }],
      floor,
      months,
      pool: months === undefined ? true : undefined,
    },
    action: {
      ...action(`go-${id}`),
      place: floor === "manager" ? "boardroom" : "plant",
      result: undefined,
      scene: id,
      oncePerMonth: true,
    },
  };
}

/** Takes the first choice offered until the month's official story. */
function toStory(run: Run): PlayerView {
  let view = run.view();
  while (view.step.kind !== "story") {
    const choice = view.choices[0];
    if (!choice) throw new Error(`Stuck at ${view.step.kind}.`);
    view = run.choose(choice);
  }
  return view;
}

/** Two floors, with the player starting on the upper one. */
function upstairsRaw() {
  const raw = emptyMonthRaw();
  raw.floors.push({
    job: "manager",
    title: "JOB-MANAGER",
    rooms: [room("boardroom", 0), room("lift", 1)],
  });
  raw.you.job = "manager";
  raw.officialStory.title = "{job} Monthly Summary";
  raw.actions.push(action("boardroom"));
  // Its own content, which never arrives.
  raw.notifications.push({
    ...memo("manager-own", "manager"),
    pool: true,
    when: { flag: "never-set" },
  });
  return raw;
}

describe("the floor of the player's job", () => {
  it("is where a run starts the player, with its job title", () => {
    const run = startRun({ seed: 1, content: parseContent(upstairsRaw()) });

    expect(run.view().job).toEqual({ id: "manager", title: "JOB-MANAGER" });
  });

  it("offers only what is done in its own rooms", () => {
    const run = startRun({ seed: 1, content: parseContent(upstairsRaw()) });

    expect(run.view().hotspots.map((h) => h.id)).toEqual(["boardroom"]);
  });

  it("heads the official story with the job title from the run", () => {
    const run = startRun({ seed: 1, content: parseContent(upstairsRaw()) });
    const view = toStory(run);

    expect(view.step.kind === "story" && view.step.title).toBe(
      "JOB-MANAGER Monthly Summary",
    );
  });

  it("refuses a run that starts the player on a floor that does not exist", () => {
    const raw = upstairsRaw();
    raw.you.job = "nowhere";

    expect(() => parseContent(raw)).toThrow(
      'The player starts at unknown job "nowhere".',
    );
  });

  it("refuses two floors for the same job", () => {
    const raw = upstairsRaw();
    raw.floors.push({
      job: "fixture-job",
      title: "JOB-AGAIN",
      rooms: [room("annexe", 0)],
    });

    expect(() => parseContent(raw)).toThrow(
      'Job "fixture-job" has more than one floor.',
    );
  });

  it("refuses a room on two floors", () => {
    const raw = upstairsRaw();
    raw.floors[1]?.rooms.push(room("plant", 2));

    expect(() => parseContent(raw)).toThrow(
      'Room "plant" appears more than once in the tower.',
    );
  });

  it("refuses an action at a place on no floor", () => {
    const raw = upstairsRaw();
    raw.actions.push({ ...action("roof") });

    expect(() => parseContent(raw)).toThrow(
      'Action "roof" is at unknown place "roof".',
    );
  });
});

/**
 * The ground floor is written for two months, with a pool of two Scenes and a
 * Notification. The floor above is written for one month, with a pool of its own.
 */
function scheduledRaw() {
  const raw = emptyMonthRaw();
  raw.balance.monthsPerRun = 6;
  raw.floors.push({
    job: "manager",
    title: "JOB-MANAGER",
    rooms: [room("boardroom", 0)],
  });
  const written = [
    meeting("ground-1", "fixture-job", [1]),
    meeting("ground-2", "fixture-job", [2]),
    meeting("ground-pool-a", "fixture-job"),
    meeting("ground-pool-b", "fixture-job"),
    meeting("manager-1", "manager", [1]),
    meeting("manager-pool", "manager"),
  ];
  return {
    ...raw,
    scenes: written.map((m) => m.scene),
    actions: [...written.map((m) => m.action), ...raw.actions],
    notifications: [
      memo("ground-memo-1", "fixture-job", [1]),
      { ...memo("ground-memo-pool", "fixture-job"), pool: true },
      memo("manager-memo-1", "manager", [1]),
      { ...memo("manager-memo-pool", "manager"), pool: true },
    ],
  };
}

/** What a month brought: its Notifications and the Scene it opened. */
interface MonthPlayed {
  month: number;
  job: string;
  notifications: string[];
  scenes: string[];
}

/**
 * Plays the next month up to its official story, answering everything and going
 * to whatever meeting there is.
 */
function playMonth(run: Run): MonthPlayed {
  let view = run.view();
  if (view.step.kind === "story") view = run.choose({ type: "continue" });
  const played: MonthPlayed = {
    month: view.month,
    job: view.job.id,
    notifications: [],
    scenes: [],
  };
  while (view.step.kind !== "story") {
    const { step, choices } = view;
    if (step.kind === "notification") played.notifications.push(step.id);
    if (step.kind === "scene") played.scenes.push(step.id);
    const meeting = choices.find(
      (c) => c.type === "action" && c.actionId.startsWith("go-"),
    );
    const choice =
      step.kind === "actions" ? (meeting ?? choices[0]) : choices[0];
    if (!choice) throw new Error(`Stuck at ${step.kind}.`);
    view = run.choose(choice);
  }
  return played;
}

/** The run as saved at a month's close, with the player given another job. */
function giveJob(run: Run, content: Content, job: string): Run {
  const saved = JSON.parse(run.save()) as { state: { job: string } };
  saved.state.job = job;
  return resumeRun({ save: JSON.stringify(saved), content });
}

describe("content scheduled by the month on its floor", () => {
  it("plays a floor's own months in order, then draws from its pool", () => {
    const run = startRun({ seed: 3, content: parseContent(scheduledRaw()) });
    const months = Array.from({ length: 6 }, () => playMonth(run));

    expect(months.slice(0, 2)).toEqual([
      {
        month: 1,
        job: "fixture-job",
        notifications: ["ground-memo-1"],
        scenes: ["ground-1"],
      },
      {
        month: 2,
        job: "fixture-job",
        notifications: [],
        scenes: ["ground-2"],
      },
    ]);
    for (const played of months.slice(2)) {
      expect(played.notifications).toEqual(["ground-memo-pool"]);
      expect(played.scenes).toHaveLength(1);
    }
    const pooled = months.slice(2).flatMap((m) => m.scenes);
    // In turn, so that both come up before either repeats.
    expect(new Set(pooled.slice(0, 2))).toEqual(
      new Set(["ground-pool-a", "ground-pool-b"]),
    );
    expect(pooled.slice(2)).toEqual(pooled.slice(0, 2));
  });

  it("never offers a floor's content on another floor", () => {
    const run = startRun({ seed: 3, content: parseContent(scheduledRaw()) });
    const seen = Array.from({ length: 6 }, () => playMonth(run)).flatMap(
      (m) => [...m.notifications, ...m.scenes],
    );

    expect(seen.filter((id) => id.startsWith("manager"))).toEqual([]);
  });

  it("starts a floor at its own first month, and picks it up again on coming back", () => {
    const content = parseContent(scheduledRaw());
    const first = startRun({ seed: 3, content });
    const played = [playMonth(first)];
    const upstairs = giveJob(first, content, "manager");
    played.push(playMonth(upstairs), playMonth(upstairs));
    const back = giveJob(upstairs, content, "fixture-job");
    played.push(playMonth(back), playMonth(back));

    expect(played).toEqual([
      {
        month: 1,
        job: "fixture-job",
        notifications: ["ground-memo-1"],
        scenes: ["ground-1"],
      },
      // Month 1 upstairs, though it is the run's month 2.
      {
        month: 2,
        job: "manager",
        notifications: ["manager-memo-1"],
        scenes: ["manager-1"],
      },
      // Past what it was written for.
      {
        month: 3,
        job: "manager",
        notifications: ["manager-memo-pool"],
        scenes: ["manager-pool"],
      },
      // Back downstairs, at its own month 2.
      {
        month: 4,
        job: "fixture-job",
        notifications: [],
        scenes: ["ground-2"],
      },
      {
        month: 5,
        job: "fixture-job",
        notifications: ["ground-memo-pool"],
        scenes: [expect.stringMatching(/^ground-pool-/) as unknown as string],
      },
    ]);
  });

  it("keeps recurring content on every floor", () => {
    const raw = scheduledRaw();
    raw.notifications.push(memo("report"));
    const content = parseContent(raw);
    const first = startRun({ seed: 3, content });
    const downstairs = playMonth(first);
    const upstairs = playMonth(giveJob(first, content, "manager"));

    expect(downstairs.notifications.at(-1)).toBe("report");
    expect(upstairs.notifications.at(-1)).toBe("report");
  });

  it("stops at the run's length, whatever the floor", () => {
    const run = startRun({ seed: 3, content: parseContent(scheduledRaw()) });
    for (let i = 0; i < 6; i++) playMonth(run);

    expect(run.choose({ type: "continue" }).step.kind).toBe("results");
  });
});

describe("the checks on floors", () => {
  it("accept a floor written for some months, with a pool for a longer stay", () => {
    expect(() => parseContent(scheduledRaw())).not.toThrow();
  });

  it.each([
    ["Scene", (raw: Raw) => raw.scenes[0]],
    ["Notification", (raw: Raw) => raw.notifications[0]],
  ])("refuse a %s for a floor that does not exist", (kind, of) => {
    const raw = scheduledRaw();
    const item = of(raw);
    if (item) item.floor = "nowhere";

    expect(() => parseContent(raw)).toThrow(
      `${kind} "${item?.id ?? ""}" is for unknown floor "nowhere".`,
    );
  });

  it("refuse a story entry for a floor that does not exist", () => {
    const raw = scheduledRaw();
    raw.officialStory.entries.push({ reported: "Up.", floor: "nowhere" });

    expect(() => parseContent(raw)).toThrow(
      'An official story entry is for unknown floor "nowhere".',
    );
  });

  it("refuse a floor with a month of its own left empty", () => {
    const raw = scheduledRaw();
    raw.scenes = raw.scenes.filter((s) => s.id !== "ground-2");
    raw.notifications.push(memo("ground-memo-3", "fixture-job", [3]));

    expect(() => parseContent(raw)).toThrow(
      'Floor "fixture-job" has no Scene, Notification or Demand of its own for month 2.',
    );
  });

  it("refuse a floor whose written months run out with no pool", () => {
    const raw = scheduledRaw();
    raw.scenes = raw.scenes.filter((s) => !s.id.startsWith("ground-pool"));
    raw.notifications = raw.notifications.filter(
      (n) => n.id !== "ground-memo-pool",
    );

    expect(() => parseContent(raw)).toThrow(
      'Floor "fixture-job" is written for 2 months of a 6-month run, so it needs a pool.',
    );
  });

  it("refuse a floor with nothing of its own, even the one a run starts on", () => {
    const raw = scheduledRaw();
    raw.scenes = raw.scenes.filter((s) => !s.id.startsWith("manager"));
    raw.notifications = raw.notifications.filter(
      (n) => !n.id.startsWith("manager"),
    );

    expect(() => parseContent(raw)).toThrow(
      'Floor "manager" has no Scene, Notification or Demand of its own.',
    );
  });

  it("refuse a pool item with months, or with no floor", () => {
    const raw = scheduledRaw();
    raw.notifications.push(
      { ...memo("dated", "fixture-job", [3]), pool: true },
      { ...memo("homeless"), pool: true },
    );

    expect(() => parseContent(raw)).toThrow(
      'Notification "dated" is in a pool, so it cannot have months.',
    );
    expect(() => parseContent(raw)).toThrow(
      'Notification "homeless" is in a pool, so it needs a floor.',
    );
  });

  it("refuse a pool Scene that no action opens in every month", () => {
    const raw = scheduledRaw();
    raw.actions = raw.actions.filter((a) => a.id !== "go-ground-pool-a");

    expect(() => parseContent(raw)).toThrow(
      'Scene "ground-pool-a" is in a pool, but no action without months opens it in a room on its floor.',
    );
  });

  it("refuse a pool Scene opened only in a room on another floor", () => {
    const raw = scheduledRaw();
    const opens = raw.actions.find((a) => a.id === "go-manager-pool");
    if (opens) opens.place = "plant";

    expect(() => parseContent(raw)).toThrow(
      'Scene "manager-pool" is in a pool, but no action without months opens it in a room on its floor.',
    );
  });

  it.each([
    [
      'Notification "late"',
      (raw: Raw) => raw.notifications.push(memo("late", undefined, [2])),
    ],
    [
      'Action "kettle"',
      (raw: Raw) =>
        Object.assign(raw.actions.find((a) => a.id === "kettle") ?? {}, {
          months: [2],
        }),
    ],
    [
      "A Project event",
      (raw: Raw) =>
        raw.project.events.push({ months: [2], text: "Oh." } as never),
    ],
  ])("refuse %s set by months with no floor", (owner, change) => {
    const raw = scheduledRaw();
    change(raw);

    expect(() => parseContent(raw)).toThrow(
      `${owner} has months, so it needs a floor.`,
    );
  });
});

type Raw = ReturnType<typeof scheduledRaw>;

describe("the Project on another floor", () => {
  it("does not replay the events written for the floor the player left", () => {
    const raw = scheduledRaw();
    raw.project.events = [
      {
        floor: "fixture-job",
        months: [2],
        text: "EVENT-DOWNSTAIRS",
        project: { real: "worse" },
      },
    ];
    const content = parseContent(raw);
    const first = startRun({ seed: 3, content });
    playMonth(first);
    const upstairs = giveJob(first, content, "manager");
    playMonth(upstairs);
    playMonth(upstairs);

    expect(upstairs.view().project.news).toEqual([]);
    const back = giveJob(upstairs, content, "fixture-job");
    playMonth(back);

    expect(back.view().project.news.map((n) => n.text)).toEqual([
      "EVENT-DOWNSTAIRS",
    ]);
  });
});
