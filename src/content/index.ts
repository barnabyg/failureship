import actions from "../../content/actions.json";
import balance from "../../content/balance.json";
import behaviours from "../../content/behaviours.json";
import boss from "../../content/boss.json";
import buzzwords from "../../content/buzzwords.json";
import characters from "../../content/characters.json";
import dialogs from "../../content/dialogs.json";
import floor from "../../content/floor-1.json";
import hiddenTruth from "../../content/hidden-truth.json";
import moves from "../../content/moves.json";
import notifications from "../../content/notifications.json";
import officialStory from "../../content/official-story.json";
import scenes from "../../content/scenes.json";
import ui from "../../content/ui.json";
import { z } from "zod";
import { ContentError, parseContent } from "../engine";

const { hints, actionCount, costLabel, freeLabel, results, ...presentation } =
  ui;

export const gameContent = parseContent({
  balance,
  boss,
  hiddenTruth,
  characters,
  behaviours,
  scenes,
  notifications,
  dialogs,
  buzzwords,
  actions,
  moves,
  officialStory,
  floor,
  ui: { hints, actionCount, costLabel, freeLabel, results },
});

const panelSchema = z.strictObject(
  Object.fromEntries(
    [
      "title",
      "tagline",
      "floorName",
      "floorRole",
      "monthHeading",
      "monthLabel",
      "actionsHeading",
      "actionsLeft",
      "buzzwordsHeading",
      "learnedLabel",
      "continueLabel",
      "doneLabel",
      "unavailableLabel",
      "whatNext",
      "castHeading",
      "signsHeading",
      "behavioursHeading",
      "treatmentHeading",
      "optionsHeading",
      "seedLabel",
      "orgChartHeading",
      "powerMapHeading",
      "closeLabel",
      "resultsWhoHeading",
      "resultsNoFact",
      "seedInputLabel",
      "seedRefused",
      "restartLabel",
      "newRunLabel",
      "leaveTitle",
      "leaveBody",
      "leaveConfirm",
      "leaveCancel",
    ].map((key) => [key, z.string().min(1)]),
  ),
);

/** Checks the panels' words, so that a missing one fails loudly at start-up. */
export function parsePanelText(raw: unknown): typeof presentation {
  const parsed = panelSchema.safeParse(raw);
  if (!parsed.success) throw new ContentError(z.prettifyError(parsed.error));
  return raw as typeof presentation;
}

/** Words used only by the panels, such as button labels. */
export const panelText = parsePanelText(presentation);
