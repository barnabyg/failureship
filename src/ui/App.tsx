import { useCallback, useEffect, useState } from "react";
import { gameContent, panelText } from "../content";
import {
  parseSeed,
  resumeRun,
  startRun,
  UnusableSaveError,
  type Choice,
  type PlayerView,
  type Run,
} from "../engine";
import { Chart } from "./Chart";
import { playToMonth } from "./later-month";
import { Modal } from "./Modal";
import { Notebook, monthLabel } from "./Notebook";
import { StepPanel } from "./panels";
import { RunControls } from "./RunControls";
import { readSavedRun, writeSavedRun } from "./saved-run";
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

/** The saved run, unless the address asks for another deal. */
function resumeSaved(seed: number | null): {
  game: { run: Run; view: PlayerView } | null;
  saveLost: boolean;
} {
  const save = readSavedRun();
  if (save === null) return { game: null, saveLost: false };
  try {
    const run = resumeRun({ save, content: gameContent });
    const view = run.view();
    return {
      game: seed === null || seed === view.seed ? { run, view } : null,
      saveLost: false,
    };
  } catch (error) {
    if (!(error instanceof UnusableSaveError)) throw error;
    return { game: null, saveLost: true };
  }
}

/**
 * The first run: the saved one, the address's seed, or a new one and a message
 * saying why. A different seed in the address is a new deal, and replaces the save.
 */
function beginFromAddress() {
  const address = new URLSearchParams(window.location.search);
  const written = address.get("seed");
  const seed = written === null ? null : parseSeed(written);
  const saved = resumeSaved(seed);
  const game = saved.game ?? begin(seed ?? randomSeed());
  // Only Playwright's build has this mode. Every other build drops this branch,
  // and later-month.ts with it, which tests/engine/later-month.test.ts checks.
  if (import.meta.env.MODE === "e2e") {
    game.view = playToMonth(game.run, address.get("month"));
  }
  return {
    game,
    saveLost: saved.saveLost,
    refused: written !== null && seed === null ? refusedMessage(written) : null,
  };
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

function monthText(view: PlayerView): string {
  return panelText.monthLabel
    .replace("{n}", String(view.month))
    .replace("{total}", String(view.totalMonths));
}

export function App() {
  const [first] = useState(beginFromAddress);
  const [{ run, view }, setGame] = useState(first.game);
  const [message, setMessage] = useState(first.refused);
  const [saveLost, setSaveLost] = useState(first.saveLost);
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

  // Every step, without the player doing anything, so that a reload re-rolls nothing.
  useEffect(() => {
    writeSavedRun(run.save());
  }, [run, view]);

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
          {view.finalWarning && (
            <div className="status-warning" data-testid="final-warning">
              <dt>{panelText.standingHeading}</dt>
              <dd>{panelText.finalWarningLabel}</dd>
            </div>
          )}
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
            data-testid="open-notebook"
            onClick={() => {
              setNotebookOpen(true);
            }}
          >
            {panelText.notebookHeading} ({view.notebook.clues.length})
          </button>
        </RunControls>
      </header>
      <div className="top-left">
        {message !== null && (
          <p className="seed-message" role="alert" data-testid="seed-message">
            {message}
          </p>
        )}
        <ProjectCard
          view={view}
          onOpen={() => {
            setProjectOpen(true);
          }}
        />
      </div>
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
          {view.openDemands.length > 0 && (
            <>
              <h3>{panelText.openDemandsHeading}</h3>
              <ul>
                {view.openDemands.map((item) => (
                  <li key={item.subject} data-testid="open-demand">
                    <strong>{monthLabel(item.month)}. </strong>
                    {item.subject}
                  </li>
                ))}
              </ul>
            </>
          )}
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
      {saveLost && (
        <Modal
          testId="save-lost"
          title={panelText.saveLostTitle}
          onClose={() => {
            setSaveLost(false);
          }}
        >
          <p>{panelText.saveLostBody}</p>
          <button
            type="button"
            className="primary"
            data-testid="save-lost-start-again"
            onClick={() => {
              setSaveLost(false);
            }}
          >
            {panelText.saveLostConfirm}
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
