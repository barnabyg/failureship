import { useState } from "react";
import { kindLabels, panelText } from "../content";
import { KINDS, type Kind, type PlayerView } from "../engine";

export function monthLabel(month: number): string {
  return panelText.resultsMonthLabel.replace("{n}", String(month));
}

/** The header button's words: how many clues are new, or else how many in all. */
export function notebookLabel(notebook: PlayerView["notebook"]): string {
  const count =
    notebook.unread > 0
      ? panelText.notebookNew.replace("{n}", String(notebook.unread))
      : String(notebook.clues.length);
  return `${panelText.notebookHeading} (${count})`;
}

function aboutLabel(who: string, count: number): string {
  return panelText.notebookAbout
    .replace("{who}", who)
    .replace("{n}", String(count));
}

interface Props {
  notebook: PlayerView["notebook"];
  /** How many of the latest clues were new when the Notebook was opened. */
  fresh: number;
  /** After the run has ended, marks can be read but not changed. */
  locked: boolean;
  onMark: (character: string, kind: Kind | null) => void;
}

/** What the player has picked up so far, with what they suspect of each person. */
export function Notebook({ notebook, fresh, locked, onMark }: Props) {
  // Whose clues are shown, or null for everyone's.
  const [about, setAbout] = useState<string | null>(null);
  const firstFresh = notebook.clues.length - fresh;
  const shown = notebook.clues
    .map((clue, index) => ({ ...clue, isNew: index >= firstFresh }))
    .filter((clue) => about === null || clue.about.includes(about))
    .toReversed();
  const months = [...new Set(shown.map((clue) => clue.month))];
  const countFor = (id: string) =>
    notebook.clues.filter((clue) => clue.about.includes(id)).length;

  return (
    <div className="notebook">
      <h3>{panelText.notebookMarksHeading}</h3>
      <button
        type="button"
        className="notebook-who"
        data-testid="about-all"
        aria-pressed={about === null}
        onClick={() => {
          setAbout(null);
        }}
      >
        {aboutLabel(panelText.notebookEveryone, notebook.clues.length)}
      </button>
      <ul className="notebook-marks">
        {notebook.marks.map((person) => (
          <li key={person.id}>
            <span>
              <button
                type="button"
                className="notebook-who"
                data-testid={`about-${person.id}`}
                aria-pressed={about === person.id}
                onClick={() => {
                  setAbout(person.id);
                }}
              >
                {aboutLabel(person.title, countFor(person.id))}
              </button>
              <span className="results-title">{person.name}</span>
            </span>
            <select
              id={`mark-${person.id}`}
              data-testid={`mark-${person.id}`}
              aria-label={person.title}
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
                  {kindLabels[kind]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <h3>{panelText.notebookCluesHeading}</h3>
      {shown.length === 0 ? (
        <p data-testid="notebook-empty">{panelText.notebookEmpty}</p>
      ) : (
        months.map((month, at) => {
          const inMonth = shown.filter((clue) => clue.month === month);
          const fresh = inMonth.filter((clue) => clue.isNew).length;
          const counts = [
            panelText.notebookMonthCount.replace("{n}", String(inMonth.length)),
            ...(fresh > 0
              ? [panelText.notebookNew.replace("{n}", String(fresh))]
              : []),
          ];
          return (
            // Keyed by whose clues are shown, so that a new choice folds afresh.
            <details
              key={`${about ?? ""}-${String(month)}`}
              className="notebook-month"
              data-testid="clue-month"
              open={at === 0}
            >
              <summary>
                {monthLabel(month)}
                <span className="results-title">{counts.join(", ")}</span>
              </summary>
              <ul className="notebook-clues">
                {inMonth.map((clue, index) => (
                  <li
                    key={index}
                    data-testid="clue"
                    className={clue.isNew ? "clue-new" : undefined}
                  >
                    {clue.isNew && (
                      <span className="clue-new-tag" data-testid="clue-new-tag">
                        {panelText.notebookNewClue}
                      </span>
                    )}
                    <span data-testid="clue-words">
                      <span className="results-title">{clue.source}</span>
                      {clue.text}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          );
        })
      )}
    </div>
  );
}
