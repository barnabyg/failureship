import { useCallback, useEffect, useState } from "react";
import { gameContent, panelText } from "../content";
import {
  parseSeed,
  startRun,
  type Choice,
  type PlayerView,
  type Run,
} from "../engine";
import { Chart } from "./Chart";
import { Modal } from "./Modal";
import { Notebook, monthLabel } from "./Notebook";
import { StepPanel } from "./panels";
import { RunControls } from "./RunControls";
import { TowerStage } from "./TowerStage";

function refusedMessage(typed: string): string {
  return panelText.seedRefused.replace("{seed}", typed.trim());
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function begin(seed: number): { run: Run; view: PlayerView } {
  const run = startRun({ seed, content: gameContent });
  return { run, view: run.view() };
}

/** The first run: the address's seed, or a new one and a message saying why. */
function beginFromAddress() {
  const written = new URLSearchParams(window.location.search).get("seed");
  const seed = written === null ? null : parseSeed(written);
  return {
    game: begin(seed ?? randomSeed()),
    refused: written !== null && seed === null ? refusedMessage(written) : null,
  };
}

function monthText(view: PlayerView): string {
  return panelText.monthLabel
    .replace("{n}", String(view.month))
    .replace("{total}", String(view.totalMonths));
}

export function App() {
  const [first] = useState(beginFromAddress);
  const [{ run, view }, setGame] = useState(first.game);
  const [message, setMessage] = useState(first.refused);
  const [leavingFor, setLeavingFor] = useState<number | null>(null);
  const [orgChartOpen, setOrgChartOpen] = useState(false);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  // In an effect, because React may run a state initialiser twice in development.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(view.seed));
    window.history.replaceState(null, "", url);
  }, [view.seed]);

  const choose = useCallback(
    (choice: Choice) => {
      setGame({ run, view: run.choose(choice) });
    },
    [run],
  );

  const restart = (seed: number) => {
    setGame(begin(seed));
    setMessage(null);
    setLeavingFor(null);
  };

  /** Leaving a run still in play needs confirming. A finished one does not. */
  const leaveFor = (seed: number) => {
    setMessage(null);
    if (view.choices.length === 0) restart(seed);
    else setLeavingFor(seed);
  };

  return (
    <main className="game">
      <TowerStage
        rooms={gameContent.floor.rooms}
        hotspots={view.hotspots}
        legal={view.choices}
        onChoose={choose}
      />
      <header className="status">
        <div>
          <h1>{panelText.title}</h1>
          <p className="tagline">{panelText.tagline}</p>
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
          {view.buzzwords.length > 0 && (
            <div className="status-buzzwords" data-testid="buzzwords">
              <dt>{panelText.buzzwordsHeading}</dt>
              <dd>{view.buzzwords.map((b) => b.term).join(", ")}</dd>
            </div>
          )}
        </dl>
        <RunControls
          seed={view.seed}
          onNewRun={() => {
            leaveFor(randomSeed());
          }}
          onRestart={leaveFor}
          onRefused={(typed) => {
            setMessage(refusedMessage(typed));
          }}
        >
          <button
            type="button"
            data-testid="open-org-chart"
            onClick={() => {
              setOrgChartOpen(true);
            }}
          >
            {panelText.orgChartHeading}
          </button>
          <button
            type="button"
            data-testid="open-project"
            onClick={() => {
              setProjectOpen(true);
            }}
          >
            {panelText.projectHeading}
          </button>
          <button
            type="button"
            data-testid="open-notebook"
            onClick={() => {
              setNotebookOpen(true);
            }}
          >
            {panelText.notebookHeading} ({view.notebook.clues.length})
          </button>
        </RunControls>
      </header>
      {message !== null && (
        <p className="seed-message" role="alert" data-testid="seed-message">
          {message}
        </p>
      )}
      <aside className="next" aria-live="polite">
        <h2>{panelText.whatNext}</h2>
        <p data-testid="hint">{view.hint}</p>
      </aside>
      <StepPanel view={view} onChoose={choose} />
      {orgChartOpen && (
        <Modal
          testId="org-chart"
          title={panelText.orgChartHeading}
          onClose={() => {
            setOrgChartOpen(false);
          }}
        >
          <Chart entries={view.orgChart} />
          <button
            type="button"
            data-testid="close-org-chart"
            onClick={() => {
              setOrgChartOpen(false);
            }}
          >
            {panelText.closeLabel}
          </button>
        </Modal>
      )}
      {projectOpen && (
        <Modal
          testId="project"
          title={view.project.name}
          onClose={() => {
            setProjectOpen(false);
          }}
        >
          <dl className="signs">
            <div>
              <dt>{panelText.projectOwnerLabel}</dt>
              <dd data-testid="project-owner">{view.project.owner}</dd>
            </div>
            <div>
              <dt>{panelText.projectRealLabel}</dt>
              <dd data-testid="project-real">{view.project.real}</dd>
            </div>
            <div>
              <dt>{panelText.projectReportedLabel}</dt>
              <dd data-testid="project-reported">{view.project.reported}</dd>
            </div>
          </dl>
          {view.project.news.map((item) => (
            <p key={item.month} data-testid="project-news">
              <strong>{monthLabel(item.month)}. </strong>
              {item.text}
            </p>
          ))}
          <button
            type="button"
            data-testid="close-project"
            onClick={() => {
              setProjectOpen(false);
            }}
          >
            {panelText.closeLabel}
          </button>
        </Modal>
      )}
      {notebookOpen && (
        <Modal
          testId="notebook"
          title={panelText.notebookHeading}
          wide
          onClose={() => {
            setNotebookOpen(false);
          }}
        >
          <Notebook
            notebook={view.notebook}
            locked={view.choices.length === 0}
            onMark={(character, kind) => {
              setGame({ run, view: run.mark(character, kind) });
            }}
          />
          <button
            type="button"
            data-testid="close-notebook"
            onClick={() => {
              setNotebookOpen(false);
            }}
          >
            {panelText.closeLabel}
          </button>
        </Modal>
      )}
      {leavingFor !== null && (
        <Modal
          testId="confirm-leave"
          title={panelText.leaveTitle}
          onClose={() => {
            setLeavingFor(null);
          }}
        >
          <p>{panelText.leaveBody.replace("{month}", monthText(view))}</p>
          <div className="panel-actions">
            <button
              type="button"
              className="primary"
              data-testid="confirm-leave-yes"
              onClick={() => {
                restart(leavingFor);
              }}
            >
              {panelText.leaveConfirm}
            </button>
            <button
              type="button"
              data-testid="confirm-leave-no"
              onClick={() => {
                setLeavingFor(null);
              }}
            >
              {panelText.leaveCancel}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
