import { useState } from "react";
import { gaugeTitles, panelText } from "../content";
import type { Buzzword, PlayerView } from "../engine";
import { notebookLabel } from "./Notebook";
import { RunControls } from "./RunControls";
import { StandingBar } from "./StandingBar";

export function monthText(view: PlayerView): string {
  return panelText.monthLabel
    .replace("{n}", String(view.month))
    .replace("{total}", String(view.totalMonths));
}

/** The player's Project on one line, always in view, since the gap in it is the game. */
function ProjectLine({
  view,
  onOpen,
}: {
  view: PlayerView;
  onOpen: () => void;
}) {
  const { project } = view;
  return (
    <button
      type="button"
      className="status-card-part status-card-project"
      data-testid="open-project"
      title={panelText.projectHeading}
      onClick={onOpen}
    >
      <strong>{project.name}</strong>
      <ProjectStatus
        label={panelText.projectRealLabel}
        status={project.real}
        colour={project.realColour}
        testId="card-real"
      />
      <ProjectStatus
        label={panelText.projectReportedLabel}
        status={project.reported}
        colour={project.reportedColour}
        testId="card-reported"
      />
    </button>
  );
}

/** How many Buzzwords the header has room for. The rest are behind "+N more". */
const latestShown = 3;

/**
 * The latest Buzzwords learned, newest first. One learned while the player
 * watches stands out briefly, and none does on a reload.
 */
function LatestBuzzwords({
  buzzwords,
  onOpen,
}: {
  buzzwords: readonly Buzzword[];
  onOpen: () => void;
}) {
  const [learnedBefore] = useState(() => new Set(buzzwords.map((b) => b.id)));
  if (buzzwords.length === 0) return null;
  const rest = buzzwords.length - latestShown;
  const latest = buzzwords.slice(-latestShown).reverse();
  return (
    <div className="status-buzzwords" data-testid="buzzwords">
      <dt>{panelText.buzzwordsHeading}</dt>
      <dd>
        <ul title={latest.map((word) => word.term).join(", ")}>
          {latest.map((word) => (
            <li
              key={word.id}
              className={
                learnedBefore.has(word.id) ? undefined : "buzzword-new"
              }
              data-testid="buzzword"
            >
              {word.term}
            </li>
          ))}
        </ul>
        {rest > 0 && (
          <button
            type="button"
            className="status-link"
            data-testid="open-buzzwords"
            onClick={onOpen}
          >
            {panelText.buzzwordsMore.replace("{n}", String(rest))}
          </button>
        )}
      </dd>
    </div>
  );
}

/** How the player would fare on paper, always in view, and not opened. */
function StandingLine({
  standing,
}: {
  standing: NonNullable<PlayerView["standing"]>;
}) {
  return (
    <div
      className="status-card-line"
      title={standing.title}
      data-testid="standing-card"
    >
      <span className="status-card-label">{standing.label}</span>
      <StandingBar standing={standing} testId="standing" />
      <strong>{standing.band}</strong>
    </div>
  );
}

/**
 * What is open: the boss's Grand Plan, Demands not yet heard the last of, and
 * the player's own word given. A part with nothing in it is left out, but Your
 * word given is always there, being free to look at.
 */
function OpenLine({
  view,
  onOpenProject,
  onOpenWord,
}: {
  view: PlayerView;
  onOpenProject: () => void;
  onOpenWord: () => void;
}) {
  const { grandPlan, openDemands } = view;
  return (
    <div className="status-card-line">
      {grandPlan && (
        <button
          type="button"
          className="status-card-part"
          data-testid="grand-plan-card"
          title={`${panelText.grandPlanHeading}: ${grandPlan.title}. ${grandPlan.what}`}
          onClick={onOpenProject}
        >
          <span className="status-card-label">
            {panelText.grandPlanShortLabel}
          </span>{" "}
          {grandPlan.status}
        </button>
      )}
      {openDemands.length > 0 && (
        <button
          type="button"
          className="status-card-part"
          data-testid="open-demands"
          onClick={onOpenProject}
        >
          <span className="status-card-label">
            {panelText.openDemandsHeading}
          </span>{" "}
          {openDemands.length}
        </button>
      )}
      <button
        type="button"
        className="status-card-part"
        data-testid="open-word"
        onClick={onOpenWord}
      >
        <span className="status-card-label">{panelText.promisesHeading}</span>{" "}
        <span data-testid="word-count">
          {panelText.promisesCount.replace(
            "{n}",
            String(view.promises.length + view.deals.length),
          )}
        </span>
      </button>
    </div>
  );
}

function ProjectStatus(props: {
  label: string;
  status: string;
  colour: string;
  testId: string;
}) {
  return (
    <span className="status-card-status">
      <span className="status-card-label">{props.label}</span>
      <span
        className="status-card-dot"
        style={{ backgroundColor: props.colour }}
      />
      <strong data-testid={props.testId}>{props.status}</strong>
    </span>
  );
}

/** The Gauges, whose values each open the list of what moved them. */
function Gauges({
  gauges,
  onOpen,
}: {
  gauges: PlayerView["gauges"];
  onOpen: () => void;
}) {
  return gauges.map((gauge) => (
    <div key={gauge.id} data-testid={`gauge-${gauge.id}`}>
      <dt>{gauge.label}</dt>
      <dd>
        <button
          type="button"
          className="status-link"
          data-testid={`open-gauge-${gauge.id}`}
          title={gaugeTitles[gauge.id]}
          onClick={onOpen}
        >
          {gauge.value}
        </button>
      </dd>
    </div>
  ));
}

/** The header along the top, and the buttons in it that stay up at every step. */
export function Header(props: {
  view: PlayerView;
  /** Each run's header starts afresh, even on the same seed. */
  runNumber: number;
  onOpenGauges: () => void;
  onOpenBuzzwords: () => void;
  onOpenOrgChart: () => void;
  onOpenNotebook: () => void;
  onNewRun: () => void;
  onRestart: (seed: number) => void;
  onRefused: (typed: string) => void;
}) {
  const { view } = props;
  return (
    <header className="status">
      <div className="status-title">
        <h1>{panelText.title}</h1>
        <p className="tagline">
          <span>{panelText.tagline}</span>
        </p>
      </div>
      <dl>
        <div>
          <dt>{panelText.jobHeading}</dt>
          <dd data-testid="job-title">{view.job.title}</dd>
        </div>
        <div data-testid="month">
          <dt>{panelText.monthHeading}</dt>
          <dd>{monthText(view)}</dd>
        </div>
        {view.step.kind !== "results" && (
          <div data-testid="actions-left">
            <dt>{panelText.actionsHeading}</dt>
            <dd>
              {panelText.actionsLeft.replace("{actions}", view.actions.label)}
            </dd>
          </div>
        )}
        {view.finalWarning && (
          <div className="status-warning" data-testid="final-warning">
            <dt>{panelText.standingHeading}</dt>
            <dd>{panelText.finalWarningLabel}</dd>
          </div>
        )}
        <Gauges gauges={view.gauges} onOpen={props.onOpenGauges} />
        <LatestBuzzwords
          key={props.runNumber}
          buzzwords={view.buzzwords}
          onOpen={props.onOpenBuzzwords}
        />
      </dl>
      <RunControls
        seed={view.seed}
        onNewRun={props.onNewRun}
        onRestart={props.onRestart}
        onRefused={props.onRefused}
      >
        <button
          type="button"
          data-testid="open-org-chart"
          onClick={props.onOpenOrgChart}
        >
          {panelText.orgChartHeading}
        </button>
        <button
          type="button"
          data-testid="open-notebook"
          onClick={props.onOpenNotebook}
        >
          {notebookLabel(view.notebook)}
        </button>
      </RunControls>
    </header>
  );
}

/**
 * The status card under the header: the Project, Official standing and what is
 * open, a line each. The run's end has no use for it.
 */
export function HeaderCards(props: {
  view: PlayerView;
  /** Why a seed the player gave was refused, if one was. */
  message: string | null;
  onOpenProject: () => void;
  onOpenWord: () => void;
}) {
  const { view, message } = props;
  return (
    <div className="top-left">
      {message !== null && (
        <p className="seed-message" role="alert" data-testid="seed-message">
          {message}
        </p>
      )}
      {view.step.kind !== "results" && (
        <div className="status-card" data-testid="status-card">
          <ProjectLine view={view} onOpen={props.onOpenProject} />
          {view.standing && <StandingLine standing={view.standing} />}
          <OpenLine
            view={view}
            onOpenProject={props.onOpenProject}
            onOpenWord={props.onOpenWord}
          />
        </div>
      )}
    </div>
  );
}
