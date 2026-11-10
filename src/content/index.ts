import actions from "../../content/actions.json";
import balance from "../../content/balance.json";
import behaviours from "../../content/behaviours.json";
import boss from "../../content/boss.json";
import buzzwords from "../../content/buzzwords.json";
import changing from "../../content/changing.json";
import orgChart from "../../content/characters.json";
import deals from "../../content/deals.json";
import demands from "../../content/demands.json";
import dialogs from "../../content/dialogs.json";
import events from "../../content/events.json";
import families from "../../content/families.json";
import floors from "../../content/floors.json";
import gauges from "../../content/gauges.json";
import grandPlans from "../../content/grand-plans.json";
import hiddenTruth from "../../content/hidden-truth.json";
import mistakes from "../../content/mistakes.json";
import moves from "../../content/moves.json";
import notebook from "../../content/notebook.json";
import notifications from "../../content/notifications.json";
import officialStory from "../../content/official-story.json";
import overHead from "../../content/over-head.json";
import project from "../../content/project.json";
import promises from "../../content/promises.json";
import reputation from "../../content/reputation.json";
import risks from "../../content/risks.json";
import rivals from "../../content/rivals.json";
import scenes from "../../content/scenes.json";
import sources from "../../content/sources.json";
import standing from "../../content/standing.json";
import threads from "../../content/threads.json";
import ui from "../../content/ui.json";
import vacancies from "../../content/vacancies.json";
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
  gaugeTitles: writtenGaugeTitles,
  ...presentation
} = ui;

export const gameContent = parseContent({
  balance,
  boss,
  overHead,
  mistakes,
  reputation,
  promises,
  deals,
  changing,
  gauges,
  standing,
  families,
  hiddenTruth,
  rivals,
  sources,
  notebook,
  project,
  demands,
  grandPlans,
  vacancies,
  characters: orgChart.characters,
  you: orgChart.you,
  places: orgChart.places,
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
  floors,
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
      "goal",
      "jobHeading",
      "monthHeading",
      "monthLabel",
      "actionsHeading",
      "actionsLeft",
      "buzzwordsHeading",
      "learnedLabel",
      "buzzwordsMore",
      "buzzwordsListHeading",
      "continueLabel",
      "doneLabel",
      "unavailableLabel",
      "whatNext",
      "tooNarrowHeading",
      "tooNarrowText",
      "intranetLabel",
      "mailToLabel",
      "mailSubjectLabel",
      "mailDisclaimer",
      "stampUrgent",
      "stampConfidential",
      "stampAllStaff",
      "newsletterName",
      "newsletterTagline",
      "newsletterIssue",
      "castHeading",
      "signsHeading",
      "withYouLabel",
      "optionsHeading",
      "seedLabel",
      "runMenuLabel",
      "orgChartHeading",
      "projectHeading",
      "projectOwnerLabel",
      "projectRealLabel",
      "projectReportedLabel",
      "openDemandsHeading",
      "grandPlanHeading",
      "powerMapHeading",
      "closeLabel",
      "standingHeading",
      "finalWarningLabel",
      "promisesHeading",
      "promisesEmpty",
      "promisesCount",
      "dealsHeading",
      "favoursHeading",
      "gaugesHeading",
      "gaugesNoMoves",
      "milestonesHeading",
      "resultsStandingHeading",
      "resultsMilestonesHeading",
      "resultsNoMilestones",
      "resultsRivalsHeading",
      "resultsNoRivals",
      "resultsRivalSince",
      "resultsGrandPlansHeading",
      "resultsNoGrandPlans",
      "resultsChangedHeading",
      "resultsDealsHeading",
      "resultsFavoursHeading",
      "resultsPromisesHeading",
      "resultsPromiseHeardBy",
      "resultsPromiseHeardByNobody",
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
      "resultsVacanciesHeading",
      "resultsRouteHeading",
      "decidedOnPaper",
      "decidedInFact",
      "liftRideTitle",
      "liftRideBody",
      "liftRideStepOut",
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

/**
 * What each Gauge is, by its id in gauges.json, for its tooltip in the header.
 * A Gauge with nothing said fails loudly at start-up.
 */
export function parseGaugeTitles(
  raw: unknown,
  gauges: readonly { id: string }[] = [],
): Record<string, string> {
  const schema = z.strictObject(
    Object.fromEntries(gauges.map((g) => [g.id, z.string().min(1)])),
  );
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ContentError(z.prettifyError(parsed.error));
  return parsed.data;
}

export const gaugeTitles = parseGaugeTitles(
  writtenGaugeTitles,
  gameContent.gauges,
);
