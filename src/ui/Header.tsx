import { useState } from "react";
import { panelText } from "../content";
import type { Buzzword, PlayerView } from "../engine";
import { RunControls } from "./RunControls";
import { StandingBar } from "./StandingBar";

export function monthText(view: PlayerView): string {
  return panelText.monthLabel
    .replace("{n}", String(view.month))
    .replace("{total}", String(view.totalMonths));
}

/** The player's Project, always in view, since the gap in it is the game. */
function ProjectCard({
  view,
  onOpen,
}: {
  view: PlayerView;
  onOpen: () => void;
}) {
  const { project, openDemands } = view;
  return (
    <button
      type="button"
      className="project-card"
      data-testid="open-project"
      onClick={onOpen}
    >
      <span className="project-card-heading">{panelText.projectHeading}</span>
      <strong>{project.name}</strong>
      <span className="project-card-statuses">
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
      </span>
      {openDemands.length > 0 && (
        <span data-testid="open-demands">
          {panelText.openDemandsHeading}: {openDemands.length}
        </span>
      )}
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

/**
 * How the player would fare on paper, always in view. It sits beside the Project
 * rather than in the header, which has no room left for it.
 */
function StandingCard({
  standing,
}: {
  standing: NonNullable<PlayerView["standing"]>;
}) {
  return (
    <div
      className="project-card standing-card"
      title={standing.title}
      data-testid="standing-card"
    >
      <span className="project-card-heading">{standing.label}</span>
      <span className="project-card-status">
        <StandingBar standing={standing} testId="standing" />
        <span>{standing.band}</span>
      </span>
    </div>
  );
}

/** The player's own commitments, always in view, and free to look at. */
function WordCard({ view, onOpen }: { view: PlayerView; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="project-card"
      data-testid="open-word"
      onClick={onOpen}
    >
      <span className="project-card-heading">{panelText.promisesHeading}</span>
      <span data-testid="word-count">
        {panelText.promisesCount.replace(
          "{n}",
          String(view.promises.length + view.deals.length),
        )}
      </span>
    </button>
  );
}

function ProjectStatus(props: {
  label: string;
  status: string;
  colour: string;
  testId: string;
}) {
  return (
    <span>
      <span className="project-card-label">{props.label}</span>
      <span className="project-card-status">
        <span
          className="project-card-dot"
          style={{ backgroundColor: props.colour }}
        />
        <span data-testid={props.testId}>{props.status}</span>
      </span>
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
          title={panelText.gaugesHeading}
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
        <p className="tagline" title={panelText.tagline}>
          {panelText.tagline}
        </p>
      </div>
      <dl>
        <div>
          <dt>{panelText.jobHeading}</dt>
          <dd data-testid="job-title">{panelText.jobTitle}</dd>
        </div>
        <div data-testid="month">
          <dt>{panelText.monthHeading}</dt>
          <dd>{monthText(view)}</dd>
        </div>
        <div data-testid="actions-left">
          <dt>{panelText.actionsHeading}</dt>
          <dd>
            {panelText.actionsLeft.replace("{actions}", view.actions.label)}
          </dd>
        </div>
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
          {panelText.notebookHeading} ({view.notebook.clues.length})
        </button>
      </RunControls>
    </header>
  );
}

/** The cards beside the header: the Project, Official standing and Your word given. */
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
      <ProjectCard view={view} onOpen={props.onOpenProject} />
      {view.standing && <StandingCard standing={view.standing} />}
      <WordCard view={view} onOpen={props.onOpenWord} />
    </div>
  );
}
