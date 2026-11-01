import { useState, type ReactNode } from "react";
import { panelText } from "../content";
import { parseSeed } from "../engine";

interface Props {
  seed: number;
  onNewRun: () => void;
  onRestart: (seed: number) => void;
  onRefused: (typed: string) => void;
  /** Further buttons to sit beside the seed. */
  children?: ReactNode;
}

/** The seed in use, and the ways out of this run. Available at every step. */
export function RunControls({
  seed,
  onNewRun,
  onRestart,
  onRefused,
  children,
}: Props) {
  const [typed, setTyped] = useState("");
  return (
    <div className="run-controls">
      <div className="run-controls-row">
        <span>
          {panelText.seedLabel}: <strong data-testid="seed">{seed}</strong>
        </span>
        <button type="button" data-testid="new-run" onClick={onNewRun}>
          {panelText.newRunLabel}
        </button>
        {children}
      </div>
      <form
        className="run-controls-row"
        onSubmit={(event) => {
          event.preventDefault();
          const wanted = parseSeed(typed);
          if (wanted === null) {
            onRefused(typed);
            return;
          }
          setTyped("");
          onRestart(wanted);
        }}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={panelText.seedInputLabel}
          placeholder={panelText.seedInputLabel}
          data-testid="seed-input"
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
        />
        <button type="submit" data-testid="restart-seed">
          {panelText.restartLabel}
        </button>
      </form>
    </div>
  );
}
