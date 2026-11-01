import actions from "../../content/actions.json";
import balance from "../../content/balance.json";
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
import { parseContent } from "../engine";

const { hints, actionCount, costLabel, freeLabel, ...presentation } = ui;

export const gameContent = parseContent({
  balance,
  hiddenTruth,
  characters,
  scenes,
  notifications,
  dialogs,
  buzzwords,
  actions,
  moves,
  officialStory,
  floor,
  ui: { hints, actionCount, costLabel, freeLabel },
});

/** Words used only by the panels, such as button labels. */
export const panelText = presentation;
