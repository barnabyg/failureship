import actions from "../../content/actions.json";
import balance from "../../content/balance.json";
import behaviours from "../../content/behaviours.json";
import boss from "../../content/boss.json";
import buzzwords from "../../content/buzzwords.json";
import characters from "../../content/characters.json";
import demands from "../../content/demands.json";
import dialogs from "../../content/dialogs.json";
import events from "../../content/events.json";
import families from "../../content/families.json";
import floor from "../../content/floor-1.json";
import hiddenTruth from "../../content/hidden-truth.json";
import mistakes from "../../content/mistakes.json";
import moves from "../../content/moves.json";
import notebook from "../../content/notebook.json";
import notifications from "../../content/notifications.json";
import officialStory from "../../content/official-story.json";
import overHead from "../../content/over-head.json";
import project from "../../content/project.json";
import reputation from "../../content/reputation.json";
import risks from "../../content/risks.json";
import scenes from "../../content/scenes.json";
import sources from "../../content/sources.json";
import threads from "../../content/threads.json";
import ui from "../../content/ui.json";
import { z } from "zod";
import { ContentError, parseContent } from "../engine";

const {
  hints,
  actionCount,
  claimTitle,
  clueVerdicts,
  costLabel,
  freeLabel,
  bossLanded,
  results,
  ...presentation
} = ui;

export const gameContent = parseContent({
  balance,
  boss,
  overHead,
  mistakes,
  reputation,
  families,
  hiddenTruth,
  sources,
  notebook,
  project,
  demands,
  characters,
  behaviours,
  scenes,
  notifications,
  dialogs,
  buzzwords,
  actions,
  moves,
  threads,
  risks,
  events,
  officialStory,
  floor,
  ui: {
    hints,
    actionCount,
    claimTitle,
    clueVerdicts,
    costLabel,
    freeLabel,
    bossLanded,
    results,
  },
});

/** The names of the kinds, for marking suspicions. Nothing about who is which. */
export const kindLabels = {
  believer: gameContent.hiddenTruth.kinds.believer.label,
  incompetent: gameContent.hiddenTruth.kinds.incompetent.label,
  practitioner: gameContent.hiddenTruth.kinds.practitioner.label,
};

const panelSchema = z.strictObject(
  Object.fromEntries(
    [
      "title",
      "tagline",
      "jobHeading",
      "jobTitle",
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
      "headTreatmentHeading",
      "optionsHeading",
      "seedLabel",
      "orgChartHeading",
      "projectHeading",
      "projectOwnerLabel",
      "projectRealLabel",
      "projectReportedLabel",
      "openDemandsHeading",
      "powerMapHeading",
      "closeLabel",
      "standingHeading",
      "finalWarningLabel",
      "resultsMistakesHeading",
      "resultsThreadsHeading",
      "resultsRisksHeading",
      "resultsChangesHeading",
      "resultsBeliefsHeading",
      "resultsHeardNothing",
      "resultsWhoHeading",
      "resultsNoFact",
      "findOutSourceHeading",
      "findOutSubjectHeading",
      "notebookHeading",
      "notebookMarksHeading",
      "notebookCluesHeading",
      "notebookEmpty",
      "notebookNoMark",
      "resultsMarksHeading",
      "resultsMarkRight",
      "resultsMarkWrong",
      "resultsCluesHeading",
      "resultsFactEventsHeading",
      "resultsBossHeading",
      "resultsBossNoChoices",
      "resultsHeadHeading",
      "resultsPlayedHeading",
      "resultsClaimsHeading",
      "resultsNoClaims",
      "resultsMonthLabel",
      "seedInputLabel",
      "seedRefused",
      "restartLabel",
      "newRunLabel",
      "leaveTitle",
      "leaveBody",
      "leaveConfirm",
      "leaveCancel",
      "saveLostTitle",
      "saveLostBody",
      "saveLostConfirm",
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
