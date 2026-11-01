import { gameContent, panelText } from "../content";
import { KINDS, type Kind, type PlayerView } from "../engine";

export function monthLabel(month: number): string {
  return panelText.resultsMonthLabel.replace("{n}", String(month));
}

interface Props {
  notebook: PlayerView["notebook"];
  /** After the run has ended, marks can be read but not changed. */
  locked: boolean;
  onMark: (character: string, kind: Kind | null) => void;
}

/** What the player has picked up so far, with what they suspect of each person. */
export function Notebook({ notebook, locked, onMark }: Props) {
  return (
    <div className="notebook">
      <h3>{panelText.notebookMarksHeading}</h3>
      <ul className="notebook-marks">
        {notebook.marks.map((person) => (
          <li key={person.id}>
            <label htmlFor={`mark-${person.id}`}>
              {person.name}
              <span className="results-title">{person.title}</span>
            </label>
            <select
              id={`mark-${person.id}`}
              data-testid={`mark-${person.id}`}
              value={person.mark ?? ""}
              disabled={locked}
              onChange={(event) => {
                const chosen = KINDS.find((k) => k === event.target.value);
                onMark(person.id, chosen ?? null);
              }}
            >
              <option value="">{panelText.notebookNoMark}</option>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {gameContent.hiddenTruth.kinds[kind].label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <h3>{panelText.notebookCluesHeading}</h3>
      {notebook.clues.length === 0 ? (
        <p data-testid="notebook-empty">{panelText.notebookEmpty}</p>
      ) : (
        <ul className="notebook-clues">
          {notebook.clues.map((clue, index) => (
            <li key={index} data-testid="clue">
              <span className="results-title">
                {monthLabel(clue.month)}, {clue.source}
              </span>
              {clue.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
