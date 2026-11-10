import { useCallback, useEffect, useState } from "react";
import { gameContent, panelText } from "../content";
import {
  floorOf,
  parseSeed,
  resumeRun,
  startRun,
  UnusableSaveError,
  type Choice,
  type PlayerView,
  type Run,
} from "../engine";
import { Chart } from "./Chart";
import { Header, HeaderCards, monthText } from "./Header";
import { LiftRide, readRide, writeRide, type Ride } from "./LiftRide";
import { endsAfter, playToMonth } from "./later-month";
import { Modal } from "./Modal";
import { Notebook, monthLabel } from "./Notebook";
import { StepPanel } from "./panels";
import { readSavedRun, writeSavedRun } from "./saved-run";
import { TowerStage } from "./TowerStage";

function refusedMessage(typed: string): string {
  return panelText.seedRefused.replace("{seed}", typed.trim());
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/**
 * Only Playwright's build reads `&last=N`, which ends a run as month N closes.
 * Every other build drops it, with later-month.ts, which
 * tests/engine/later-month.test.ts checks.
 */
const ending =
  import.meta.env.MODE === "e2e"
    ? endsAfter(window.location.search, gameContent)
    : undefined;

function begin(seed: number): { run: Run; view: PlayerView } {
  const run = startRun({ seed, content: gameContent, endsAfter: ending });
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
    const run = resumeRun({ save, content: gameContent, endsAfter: ending });
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
    game.view = playToMonth(
      game.run,
      address.get("month"),
      address.get("choose"),
    );
  }
  return {
    game,
    saveLost: saved.saveLost,
    refused: written !== null && seed === null ? refusedMessage(written) : null,
  };
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
  const [wordOpen, setWordOpen] = useState(false);
  const [gaugesOpen, setGaugesOpen] = useState(false);
  const [buzzwordsOpen, setBuzzwordsOpen] = useState(false);
  // A change of floor is a ride in the lift, taken once its news has been read.
  const [ride, setRide] = useState<Ride | null>(() => {
    const saved = readRide();
    return saved?.to === first.game.view.job.id ? saved : null;
  });
  // Each run's header starts afresh, even on the same seed.
  const [runNumber, setRunNumber] = useState(0);

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

  useEffect(() => {
    writeRide(ride);
  }, [ride]);

  const choose = useCallback(
    (choice: Choice) => {
      const next = run.choose(choice);
      const from = view.job.id;
      setRide((current) => {
        // The run's end has no floor to ride to.
        if (next.step.kind === "results") return null;
        if (current && !current.riding) return { ...current, riding: true };
        if (next.job.id !== from) {
          return { from, to: next.job.id, riding: false };
        }
        return current;
      });
      setGame({ run, view: next });
    },
    [run, view.job.id],
  );

  const restart = (seed: number) => {
    setGame(begin(seed));
    setRunNumber((n) => n + 1);
    setMessage(null);
    setLeavingFor(null);
    setRide(null);
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
        rooms={floorOf(gameContent, ride?.from ?? view.job.id).rooms}
        hotspots={view.hotspots}
        legal={view.choices}
        onChoose={choose}
      />
      <Header
        view={view}
        runNumber={runNumber}
        onOpenGauges={() => {
          setGaugesOpen(true);
        }}
        onOpenBuzzwords={() => {
          setBuzzwordsOpen(true);
        }}
        onOpenOrgChart={() => {
          setOrgChartOpen(true);
        }}
        onOpenNotebook={() => {
          setNotebookOpen(true);
        }}
        onNewRun={() => {
          leaveFor(randomSeed());
        }}
        onRestart={leaveFor}
        onRefused={(typed) => {
          setMessage(refusedMessage(typed));
        }}
      />
      <HeaderCards
        view={view}
        message={message}
        onOpenProject={() => {
          setProjectOpen(true);
        }}
        onOpenWord={() => {
          setWordOpen(true);
        }}
      />
      {/* The goal in full in month 1, and after that only in the tooltip. */}
      <aside
        className="next"
        aria-live="polite"
        title={view.step.kind === "results" ? undefined : panelText.goal}
      >
        {view.month === 1 && view.step.kind !== "results" && (
          <p className="goal" data-testid="goal">
            {panelText.goal}
          </p>
        )}
        <div className="next-line">
          <h2>{panelText.whatNext}</h2>
          <p data-testid="hint">{view.hint}</p>
        </div>
      </aside>
      <StepPanel view={view} onChoose={choose} />
      <div className="too-narrow" role="alert" data-testid="too-narrow">
        <h2>{panelText.tooNarrowHeading}</h2>
        <p>{panelText.tooNarrowText}</p>
      </div>
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
          {view.grandPlan && (
            <div data-testid="grand-plan">
              <h3>{panelText.grandPlanHeading}</h3>
              <p>
                <strong>{view.grandPlan.title}. </strong>
                {view.grandPlan.what}
              </p>
              <p data-testid="grand-plan-status">{view.grandPlan.status}</p>
            </div>
          )}
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
      {gaugesOpen && (
        <Modal
          testId="gauges"
          title={panelText.gaugesHeading}
          onClose={() => {
            setGaugesOpen(false);
          }}
        >
          {view.gauges.map((gauge) => (
            <div key={gauge.id} data-testid={`gauge-card-${gauge.id}`}>
              <h3>
                {gauge.label}: {gauge.value}
              </h3>
              {gauge.moves.length === 0 && <p>{panelText.gaugesNoMoves}</p>}
              <ul>
                {gauge.moves.map((move, index) => (
                  <li key={index} data-testid="gauge-move">
                    <strong>{monthLabel(move.month)}. </strong>
                    {move.by > 0 ? `+${String(move.by)}` : move.by}. {move.note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {view.milestones.length > 0 && (
            <>
              <h3>{panelText.milestonesHeading}</h3>
              <ul>
                {view.milestones.map((row) => (
                  <li key={row.title} data-testid="milestone">
                    {row.title}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            data-testid="close-gauges"
            onClick={() => {
              setGaugesOpen(false);
            }}
          >
            {panelText.closeLabel}
          </button>
        </Modal>
      )}
      {buzzwordsOpen && (
        <Modal
          testId="buzzword-list"
          title={panelText.buzzwordsListHeading}
          onClose={() => {
            setBuzzwordsOpen(false);
          }}
        >
          <dl className="buzzword-list">
            {view.buzzwords.map((word) => (
              <div key={word.id} data-testid="buzzword-learned">
                <dt>{word.term}</dt>
                <dd>{word.meaning}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            data-testid="close-buzzwords"
            onClick={() => {
              setBuzzwordsOpen(false);
            }}
          >
            {panelText.closeLabel}
          </button>
        </Modal>
      )}
      {wordOpen && (
        <Modal
          testId="word"
          title={panelText.promisesHeading}
          onClose={() => {
            setWordOpen(false);
          }}
        >
          {view.promises.length + view.deals.length === 0 && (
            <p>{panelText.promisesEmpty}</p>
          )}
          <ul>
            {view.promises.map((item) => (
              <li key={item.what} data-testid="word-promise">
                <strong>{monthLabel(item.month)}. </strong>
                {item.to}: {item.what}. {item.status}.
              </li>
            ))}
          </ul>
          {view.deals.length > 0 && (
            <>
              <h3>{panelText.dealsHeading}</h3>
              <ul>
                {view.deals.map((item) => (
                  <li key={item.what} data-testid="word-deal">
                    <strong>{monthLabel(item.month)}. </strong>
                    {item.with}: {item.what}. {item.status}.
                  </li>
                ))}
              </ul>
            </>
          )}
          {view.favours.length > 0 && (
            <>
              <h3>{panelText.favoursHeading}</h3>
              <ul>
                {view.favours.map((line) => (
                  <li key={line} data-testid="word-favour">
                    {line}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            data-testid="close-word"
            onClick={() => {
              setWordOpen(false);
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
      {ride?.riding && (
        <LiftRide
          ride={ride}
          onStepOut={() => {
            setRide(null);
          }}
        />
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
