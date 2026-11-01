/** Everything the player can do. The view lists which of these are legal now. */
export type Choice =
  | { type: "continue" }
  | { type: "action"; actionId: string }
  | { type: "notification"; notificationId: string; optionId: string }
  | { type: "scene"; sceneId: string; optionId: string };

export interface Hotspot {
  id: string;
  label: string;
  description: string;
  place: string;
  costLabel: string;
  state: "available" | "done" | "unavailable";
}

export interface Buzzword {
  id: string;
  term: string;
  meaning: string;
}

export interface NotificationOption {
  id: string;
  label: string;
  costLabel: string;
  affordable: boolean;
}

export interface DialogLine {
  speaker?: string | undefined;
  text: string;
}

/** One person in a hierarchy, and the name of the person above them. */
export interface ChartEntry {
  name: string;
  title: string;
  reportsTo: string | null;
}

export type StepView =
  | {
      kind: "notification";
      id: string;
      from: string;
      subject: string;
      body: string;
      options: NotificationOption[];
    }
  | {
      kind: "dialog";
      title: string;
      lines: DialogLine[];
      learned: Buzzword[];
    }
  | { kind: "actions" }
  | {
      kind: "scene";
      id: string;
      title: string;
      location: string;
      narration: string[];
      cast: { name: string; title: string }[];
      signs: { label: string; text: string }[];
      behaviours: { who: string; text: string }[];
      options: { id: string; label: string }[];
    }
  | { kind: "notice"; title: string; body: string }
  | { kind: "move"; from: string; title: string; body: string }
  | {
      kind: "story";
      title: string;
      reportedHeading?: string | undefined;
      happenedHeading?: string | undefined;
      reported: string[];
      happened: string[];
    }
  | {
      kind: "results";
      title: string;
      intro: string;
      characters: {
        name: string;
        title: string;
        kind: string;
        fact: string | null;
      }[];
      powerMap: ChartEntry[];
    };

/** Only what the player is entitled to see. It never holds undiscovered truth. */
export interface PlayerView {
  seed: number;
  month: number;
  totalMonths: number;
  actions: { total: number; spent: number; remaining: number; label: string };
  buzzwords: Buzzword[];
  orgChart: ChartEntry[];
  hotspots: Hotspot[];
  step: StepView;
  hint: string;
  choices: Choice[];
}
