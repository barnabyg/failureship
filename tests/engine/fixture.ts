import { parseContent, type Content } from "../../src/engine";

interface RawOption {
  id: string;
  label: string;
  cost?: string;
  dialog?: string;
  learns?: string[];
  sets?: string[];
  opinion?: number;
  result?: { title: string; body: string };
  approach?: string;
  project?: { real?: string; reported?: string };
}

interface RawNotification {
  id: string;
  from: string;
  subject: string;
  body: string;
  options: RawOption[];
  months?: number[];
}

type RawCondition = Record<string, unknown>;

interface RawSceneOption {
  id: string;
  label: string;
  about?: string;
  requires?: RawCondition;
  results: {
    when?: RawCondition;
    body: string;
    sets?: string[];
    opinion?: number;
    approach?: string;
    reaction?: { believer: string; incompetent: string; practitioner: string };
    factAt?: string;
    factNote?: string;
    project?: { real?: string; reported?: string };
  }[];
}

interface RawScene {
  id: string;
  title: string;
  location: string;
  narration: string[];
  cast: string[];
  signs: { label: string; text: string }[];
  options: RawSceneOption[];
  script?: string;
  months?: number[];
  verdict?: { warm: string; neutral: string; cold: string };
}

interface RawMove {
  id: string;
  from: string;
  title: string;
  body: string;
  when?: RawCondition;
  priority?: boolean;
  sets?: string[];
  months?: number[];
}

interface RawStoryEntry {
  when?: RawCondition;
  reported?: string;
  happened?: string;
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
      monthsPerRun: 2,
      actionCosts: { standard: 1, report: 1, pub: 1 } as Record<string, number>,
      signsMisleadChance: 0,
      opinion: { warmAt: 1, coldAt: -1 },
    },
    boss: {
      character: "ana",
      signs: [] as {
        id: string;
        text: string;
        likelihood: { warm: number; neutral: number; cold: number };
      }[],
      approaches: [] as {
        id: string;
        shift: { believer: number; incompetent: number; practitioner: number };
        reaction: {
          believer: string[];
          incompetent: string[];
          practitioner: string[];
        };
        overdone?: {
          after: number;
          shift: Partial<Record<string, number>>;
          reaction: Partial<Record<string, string[]>>;
        };
      }[],
    },
    sources: sourcesRaw(),
    notebook: {
      events: [] as {
        id: string;
        when: RawCondition;
        source: string;
        text: string;
        verdict: string;
      }[],
    },
    project: {
      name: "PROJECT-NAME",
      owner: "PROJECT-OWNER",
      statuses: [
        { id: "good", label: "STATUS-GOOD", colour: "#00ff00" },
        { id: "fair", label: "STATUS-FAIR", colour: "#ffaa00" },
        { id: "bad", label: "STATUS-BAD", colour: "#ff0000" },
      ],
      start: { real: "fair", reported: "good" },
      events: [] as {
        months: number[];
        text: string;
        project?: { real?: string; reported?: string };
      }[],
      flagged: undefined as
        { at: string; scene: string; cost: string } | undefined,
      input: undefined as
        | {
            character: string;
            chance: {
              believer: number;
              incompetent: number;
              practitioner: number;
            };
            sets: string;
          }
        | undefined,
    },
    hiddenTruth: {
      kinds: {
        believer: { label: "KIND-BELIEVER", weight: 1 },
        incompetent: { label: "KIND-INCOMPETENT", weight: 1 },
        practitioner: { label: "KIND-PRACTITIONER", weight: 1 },
      },
      minPractitioners: 1,
      charactersWithFact: 2,
      facts: [
        { id: "fact-a", text: "SECRET-ALPHA about {name}" },
        { id: "fact-b", text: "SECRET-BRAVO about {name}" },
        { id: "fact-c", text: "SECRET-CHARLIE about {name}" },
      ] as { id: string; text: string; characters?: string[] }[],
    },
    characters: [
      { id: "ana", name: "Ana Abel", title: "Boss" },
      { id: "ben", name: "Ben Bird", title: "Analyst", reportsTo: "ana" },
      { id: "cal", name: "Cal Cope", title: "Clerk", reportsTo: "ana" },
    ] as {
      id: string;
      name: string;
      title: string;
      reportsTo?: string;
      role?: string;
      called?: string;
    }[],
    behaviours: [] as {
      id: string;
      text: string;
      roles?: string[];
      likelihood: {
        believer: number;
        incompetent: number;
        practitioner: number;
      };
    }[],
    scenes: [] as RawScene[],
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
    moves: [] as RawMove[],
    officialStory: {
      title: "Official story",
      entries: [{ reported: "All is well." }] as RawStoryEntry[],
    },
    floor: { rooms: ["kettle", "desk", "copier", "plant"].map(room) },
    ui: {
      hints: {
        notification: "Answer the Notification.",
        dialog: "Press continue.",
        actions: "Click the floor. You have {actions} left.",
        scene: "Watch the room, then choose.",
        "find-out": "Pick a source.",
        claim: "This is what you were told.",
        notice: "Press continue.",
        move: "Something has happened to you.",
        story: "The month has closed.",
        results: "The run is over.",
      },
      actionCount: { one: "1 action", other: "{n} actions" },
      claimTitle: "{source} says",
      clueVerdicts: {
        held: "VERDICT-HELD",
        wrong: "VERDICT-FALSE",
        idle: "VERDICT-IRRELEVANT",
      },
      costLabel: "Costs {actions}",
      freeLabel: "Costs nothing",
      bossLanded: {
        warmer: "LANDED-WARMER",
        cooler: "LANDED-COOLER",
        unmoved: "LANDED-UNMOVED",
      },
      results: { title: "The end", intro: "Here is who was who." },
    },
  };
}

const NO_CHANGE = { true: 0, mistaken: 0, outOfDate: 0, false: 0 };

export function sourcesRaw() {
  return {
    methods: [
      {
        id: "ask",
        title: "Ask around",
        prompt: "Whom do you ask?",
        sources: ["ana", "ben", "cal"],
        someoneThere: false,
        frames: ["{said}"],
        topics: { kind: 1, influence: 1, fact: 1 },
      },
    ],
    influentialCount: 2,
    reliability: {
      believer: { true: 8, mistaken: 2, outOfDate: 2, false: 0 },
      incompetent: { true: 2, mistaken: 8, outOfDate: 2, false: 0 },
      practitioner: { true: 3, mistaken: 0, outOfDate: 1, false: 8 },
    },
    motives: [
      { id: "no-reason", text: "{name} had no reason.", adjust: NO_CHANGE },
    ],
    claims: {
      kind: {
        believer: ["{subject} SAID-BELIEVER"],
        incompetent: ["{subject} SAID-INCOMPETENT"],
        practitioner: ["{subject} SAID-PRACTITIONER"],
      },
      influence: { high: ["{subject} SAID-HIGH"], low: ["{subject} SAID-LOW"] },
      fact: ["HEARD: {fact}"],
    },
    verdicts: {
      true: { label: "VERDICT-TRUE", note: "It was so." },
      mistaken: { label: "VERDICT-MISTAKEN", note: "They believed it." },
      outOfDate: { label: "VERDICT-OLD", note: "It used to be so." },
      false: { label: "VERDICT-FALSE", note: "They knew it was not." },
    },
  };
}

/** A month with no Notifications and a Find Out action on the floor. */
export function findOutFixtureRaw() {
  const raw = emptyMonthRaw();
  const ask = {
    ...action("copier"),
    result: undefined,
    findOut: "ask",
    oncePerMonth: true,
  };
  return {
    ...raw,
    actions: [ask, action("kettle"), action("desk"), action("plant")],
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
    x: index * 3,
    z: 0,
    width: 2,
    depth: 2,
    height: 1,
    colour: "#888888",
  };
}

/** A month with no Notifications and a meeting Scene on the floor. */
export function sceneFixtureRaw() {
  const raw = emptyMonthRaw();
  raw.scenes.push({
    id: "meeting",
    title: "The meeting",
    location: "Floor 1",
    narration: ["Everyone sits down."],
    cast: ["ana", "ben", "cal"],
    signs: [
      {
        label: "Who interrupts whom",
        text: "{holder} talks over {ignored}.",
      },
      {
        label: "Who everyone looks at",
        text: "Everyone glances at {holder} before answering.",
      },
      { label: "Who gets ignored", text: "Nobody responds to {ignored}." },
    ],
    options: [
      {
        id: "back-ana",
        label: "Agree with Ana",
        results: [
          { when: { holderIs: "ana" }, body: "BACKED-RIGHT: {holder} nods." },
          { body: "BACKED-WRONG: {holder} does not look up." },
        ],
      },
      {
        id: "stay-quiet",
        label: "Say nothing",
        results: [{ body: "You are minuted as present." }],
      },
    ],
  });
  return {
    ...raw,
    actions: [
      {
        ...action("meeting"),
        result: undefined,
        scene: "meeting",
        oncePerMonth: true,
      },
      ...raw.actions,
    ],
    floor: { rooms: [...raw.floor.rooms, room("meeting", 9)] },
  };
}

export function sceneFixture(): Content {
  return parseContent(sceneFixtureRaw());
}

/** The whole month so far: the Notification, then a Scene with a gated option. */
export function buzzwordFixtureRaw() {
  const raw = sceneFixtureRaw();
  raw.scenes[0]?.options.push({
    id: "use-word",
    label: "Say FIXTURE-TERM",
    requires: { hasBuzzword: "fixture-word" },
    results: [{ body: "WORD-LANDED" }],
  });
  return { ...raw, notifications: fixtureRaw().notifications };
}

export function buzzwordFixture(): Content {
  return parseContent(buzzwordFixtureRaw());
}

/** The whole month: choices leave flags that the Move and the story read. */
export function closingFixtureRaw() {
  const raw = buzzwordFixtureRaw();
  const [report, pub] = raw.notifications[0]?.options ?? [];
  if (report) report.sets = ["filed"];
  if (pub) pub.sets = ["pub"];
  const scene = raw.scenes[0];
  const backAna = scene?.options.find((o) => o.id === "back-ana");
  const quiet = scene?.options.find((o) => o.id === "stay-quiet");
  const word = scene?.options.find((o) => o.id === "use-word");
  if (backAna) {
    backAna.results = [
      { when: { holderIs: "ana" }, body: "Right.", sets: ["backed-right"] },
      { body: "Wrong.", sets: ["backed-wrong"] },
    ];
  }
  if (quiet) quiet.results = [{ body: "Quiet.", sets: ["quiet"] }];
  if (word) word.results = [{ body: "WORD-LANDED", sets: ["used-word"] }];
  raw.moves = [
    {
      id: "credit",
      from: "Ben Bird",
      title: "MOVE-CREDIT",
      body: "Ben takes the credit.",
    },
    {
      id: "steal",
      from: "Cal Cope",
      title: "MOVE-STEAL",
      body: "Cal steals your stapler.",
    },
    {
      id: "word-stolen",
      from: "Cal Cope",
      title: "MOVE-WORD",
      body: "Cal uses your word.",
      when: { flag: "used-word" },
      sets: ["word-stolen"],
    },
  ];
  raw.officialStory.entries = [
    { reported: "The team met its objectives." },
    {
      when: { flag: "filed" },
      reported: "REPORTED-FILED",
      happened: "HAPPENED-FILED",
    },
    {
      when: { flag: "pub" },
      reported: "REPORTED-PUB",
      happened: "HAPPENED-PUB",
    },
    { when: { flag: "backed-right" }, reported: "REPORTED-RIGHT" },
    { when: { flag: "backed-wrong" }, reported: "REPORTED-WRONG" },
    { when: { flag: "quiet" }, reported: "REPORTED-QUIET" },
    {
      when: { all: [{ flag: "used-word" }, { not: { flag: "word-stolen" } }] },
      reported: "REPORTED-WORD-KEPT",
    },
    { when: { flag: "word-stolen" }, happened: "HAPPENED-WORD-STOLEN" },
  ];
  return raw;
}

export function closingFixture(): Content {
  return parseContent(closingFixtureRaw());
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
