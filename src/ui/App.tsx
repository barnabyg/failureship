import { useCallback, useState } from "react";
import { gameContent, panelText } from "../content";
import { startRun, type Choice, type PlayerView, type Run } from "../engine";
import { StepPanel } from "./panels";
import { TowerStage } from "./TowerStage";

function readSeed(): number {
  const raw = new URLSearchParams(window.location.search).get("seed");
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : randomSeed();
}

function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

function begin(seed: number): { run: Run; view: PlayerView } {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", String(seed));
  window.history.replaceState(null, "", url);
  const run = startRun({ seed, content: gameContent });
  return { run, view: run.view() };
}

export function App() {
  const [{ run, view }, setGame] = useState(() => begin(readSeed()));

  const choose = useCallback(
    (choice: Choice) => {
      setGame({ run, view: run.choose(choice) });
    },
    [run],
  );

  const restart = (seed: number) => {
    setGame(begin(seed));
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
            <dt>{panelText.floorName}</dt>
            <dd>{panelText.floorRole}</dd>
          </div>
          <div data-testid="month">
            <dt>{panelText.monthHeading}</dt>
            <dd>
              {panelText.monthLabel
                .replace("{n}", String(view.month))
                .replace("{total}", String(view.totalMonths))}
            </dd>
          </div>
          <div data-testid="actions-left">
            <dt>{panelText.actionsHeading}</dt>
            <dd>
              {panelText.actionsLeft.replace("{actions}", view.actions.label)}
            </dd>
          </div>
          {view.buzzwords.length > 0 && (
            <div data-testid="buzzwords">
              <dt>{panelText.buzzwordsHeading}</dt>
              <dd>{view.buzzwords.map((b) => b.term).join(", ")}</dd>
            </div>
          )}
        </dl>
      </header>
      <aside className="next" aria-live="polite">
        <h2>{panelText.whatNext}</h2>
        <p data-testid="hint">{view.hint}</p>
      </aside>
      <StepPanel
        view={view}
        onChoose={choose}
        onReplay={() => {
          restart(view.seed);
        }}
        onNewSeed={() => {
          restart(randomSeed());
        }}
      />
      <footer className="seed">
        {panelText.seedLabel}: <span data-testid="seed">{view.seed}</span>
      </footer>
    </main>
  );
}
