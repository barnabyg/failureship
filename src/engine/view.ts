/** Everything the player can do. The view lists which of these are legal now. */
export type Choice =
  { type: "continue" } | { type: "action"; actionId: string };

export interface Hotspot {
  id: string;
  label: string;
  description: string;
  place: string;
  costLabel: string;
  state: "available" | "done" | "unavailable";
}

export type StepView =
  | { kind: "actions" }
  | { kind: "notice"; title: string; body: string }
  | { kind: "story"; title: string; reported: string[] };

/** Only what the player is entitled to see. It never holds undiscovered truth. */
export interface PlayerView {
  seed: number;
  month: number;
  actions: { total: number; spent: number; remaining: number; label: string };
  hotspots: Hotspot[];
  step: StepView;
  hint: string;
  choices: Choice[];
}
