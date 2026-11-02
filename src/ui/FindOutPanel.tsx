import { useState } from "react";
import { panelText } from "../content";
import type { Choice, StepView } from "../engine";
import { Panel } from "./Panel";

export function FindOutPanel({
  step,
  onChoose,
}: {
  step: Extract<StepView, { kind: "find-out" }>;
  onChoose: (choice: Choice) => void;
}) {
  const [only] = step.sources.length === 1 ? step.sources : [];
  const [source, setSource] = useState<string | null>(only?.id ?? null);
  return (
    <Panel testId="panel-find-out" title={step.title}>
      <p data-testid="find-out-prompt">{step.prompt}</p>
      {only === undefined && (
        <>
          <h3>{panelText.findOutSourceHeading}</h3>
          <div className="options">
            {step.sources.map((person) => (
              <button
                key={person.id}
                type="button"
                className={person.id === source ? "option primary" : "option"}
                aria-pressed={person.id === source}
                data-testid={`source-${person.id}`}
                onClick={() => {
                  setSource(person.id);
                }}
              >
                <span>{person.title}</span>
                <span className="option-cost">{person.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {source !== null && (
        <>
          <h3 className="find-out-subject">
            {panelText.findOutSubjectHeading}
          </h3>
          <div className="options">
            {step.subjects
              .filter((person) => person.id !== source)
              .map((person) => (
                <button
                  key={person.id}
                  type="button"
                  className="option"
                  data-testid={`subject-${person.id}`}
                  onClick={() => {
                    onChoose({
                      type: "find-out",
                      sourceId: source,
                      subjectId: person.id,
                    });
                  }}
                >
                  <span>{person.title}</span>
                  <span className="option-cost">{person.name}</span>
                </button>
              ))}
          </div>
        </>
      )}
    </Panel>
  );
}
