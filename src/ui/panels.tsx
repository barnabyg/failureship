import { useEffect, useRef, type ReactNode } from "react";
import { panelText } from "../content";
import type { Choice, PlayerView, StepView } from "../engine";

interface PanelProps {
  testId: string;
  eyebrow?: string;
  title: string;
  wide?: boolean;
  children: ReactNode;
}

/** A panel over the tower. It takes focus, so the keyboard follows the month. */
function Panel({ testId, eyebrow, title, wide, children }: PanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <section
      className={wide ? "panel panel-wide" : "panel"}
      data-testid={testId}
      aria-label={title}
    >
      {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
      <h2 ref={heading} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Continue({ onChoose }: { onChoose: (choice: Choice) => void }) {
  return (
    <button
      type="button"
      className="primary"
      data-testid="continue"
      onClick={() => {
        onChoose({ type: "continue" });
      }}
    >
      {panelText.continueLabel}
    </button>
  );
}

function StoryPanel({
  step,
  onChoose,
}: {
  step: Extract<StepView, { kind: "story" }>;
  onChoose: (choice: Choice) => void;
}) {
  return (
    <Panel testId="panel-story" title={step.title}>
      <div data-testid="story-reported">
        {step.reportedHeading !== undefined && <h3>{step.reportedHeading}</h3>}
        {step.reported.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {step.happened.length > 0 && (
        <div className="callout" data-testid="story-happened">
          {step.happenedHeading !== undefined && (
            <h3>{step.happenedHeading}</h3>
          )}
          {step.happened.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      <Continue onChoose={onChoose} />
    </Panel>
  );
}

function ResultsPanel({
  step,
}: {
  step: Extract<StepView, { kind: "results" }>;
}) {
  return (
    <Panel testId="panel-results" title={step.title} wide>
      <p>{step.intro}</p>
      <h3>{panelText.resultsWhoHeading}</h3>
      <table className="results">
        <tbody>
          {step.characters.map((person) => (
            <tr key={person.name} data-testid="result-character">
              <th scope="row">
                {person.name}
                <span className="results-title">{person.title}</span>
              </th>
              <td className="results-kind">{person.kind}</td>
              <td>{person.fact ?? panelText.resultsNoFact}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

interface StepPanelProps {
  view: PlayerView;
  onChoose: (choice: Choice) => void;
}

/** The panel for the current step of the month, if it needs one. */
export function StepPanel({ view, onChoose }: StepPanelProps) {
  const { step } = view;
  switch (step.kind) {
    case "actions":
      return null;
    case "notification":
      return (
        <Panel
          testId="panel-notification"
          eyebrow={step.from}
          title={step.subject}
        >
          <p>{step.body}</p>
          <div className="options">
            {step.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="option"
                data-testid={`option-${option.id}`}
                disabled={!option.affordable}
                onClick={() => {
                  onChoose({
                    type: "notification",
                    notificationId: step.id,
                    optionId: option.id,
                  });
                }}
              >
                <span>{option.label}</span>
                <span className="option-cost">{option.costLabel}</span>
              </button>
            ))}
          </div>
        </Panel>
      );
    case "scene":
      return (
        <Panel testId="panel-scene" eyebrow={step.location} title={step.title}>
          {step.narration.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <h3>{panelText.castHeading}</h3>
          <ul className="cast">
            {step.cast.map((person) => (
              <li key={person.name}>
                <strong>{person.name}</strong>, {person.title}
              </li>
            ))}
          </ul>
          <h3>{panelText.signsHeading}</h3>
          <dl className="signs">
            {step.signs.map((sign) => (
              <div key={sign.label} data-testid="sign">
                <dt>{sign.label}</dt>
                <dd>{sign.text}</dd>
              </div>
            ))}
          </dl>
          <h3>{panelText.optionsHeading}</h3>
          <div className="options">
            {step.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="option"
                data-testid={`scene-option-${option.id}`}
                onClick={() => {
                  onChoose({
                    type: "scene",
                    sceneId: step.id,
                    optionId: option.id,
                  });
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Panel>
      );
    case "dialog":
      return (
        <Panel testId="panel-dialog" title={step.title}>
          {step.lines.map((line) => (
            <p key={line.text}>
              {line.speaker !== undefined && <strong>{line.speaker}: </strong>}
              {line.text}
            </p>
          ))}
          {step.learned.map((word) => (
            <p key={word.id} className="callout" data-testid="learned">
              <strong>{panelText.learnedLabel}: </strong>
              {word.term}. {word.meaning}
            </p>
          ))}
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "notice":
      return (
        <Panel testId="panel-notice" title={step.title}>
          <p>{step.body}</p>
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "move":
      return (
        <Panel testId="panel-move" eyebrow={step.from} title={step.title}>
          <p>{step.body}</p>
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "story":
      return <StoryPanel step={step} onChoose={onChoose} />;
    case "results":
      return <ResultsPanel step={step} />;
  }
}
