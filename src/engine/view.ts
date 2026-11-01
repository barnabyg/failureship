/** Everything the player can do. The view lists which of these are legal now. */
export type Choice =
  | { type: "continue" }
  | { type: "action"; actionId: string }
  | { type: "notification"; notificationId: string; optionId: string };

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
  | { kind: "notice"; title: string; body: string }
  | { kind: "story"; title: string; reported: string[] };

/** Only what the player is entitled to see. It never holds undiscovered truth. */
export interface PlayerView {
  seed: number;
  month: number;
  actions: { total: number; spent: number; remaining: number; label: string };
  buzzwords: Buzzword[];
  hotspots: Hotspot[];
  step: StepView;
  hint: string;
  choices: Choice[];
}
