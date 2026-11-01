import { useEffect, useRef, useState, type ReactNode } from "react";
import { panelText } from "../content";
import type { ChartEntry, Choice, PlayerView, StepView } from "../engine";
import { Chart } from "./Chart";
import { monthLabel } from "./Notebook";

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

/** How the boss took a choice, kept apart from what happened in the room. */
function Reaction({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p className="signs" data-testid="boss-reaction">
      {text}
    </p>
  );
}

/** Said before a choice that could end the run on the spot. */
function Stakes({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <span className="option-stakes" data-testid="stakes">
      {text}
    </span>
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

function FindOutPanel({
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

function ResultsPanel({
  step,
  orgChart,
}: {
  step: Extract<StepView, { kind: "results" }>;
  orgChart: readonly ChartEntry[];
}) {
  return (
    <Panel testId="panel-results" title={step.title} wide>
      <p>{step.intro}</p>
      {step.ending.text !== null && (
        <p className="callout" data-testid="results-ending">
          {step.ending.text}
        </p>
      )}
      {step.mistakes.length > 0 && (
        <>
          <h3>{panelText.resultsMistakesHeading}</h3>
          <ul>
            {step.mistakes.map((row, index) => (
              <li key={index} data-testid="result-mistake">
                <strong>{monthLabel(row.month)}. </strong>
                {row.choice}
              </li>
            ))}
          </ul>
        </>
      )}
      {step.threads.length > 0 && (
        <div className="callout" data-testid="results-threads">
          <h3>{panelText.resultsThreadsHeading}</h3>
          {step.threads.map((row, index) => (
            <div key={index} data-testid="result-thread">
              <p>
                <strong>{monthLabel(row.startedIn)}. </strong>
                {row.started}
              </p>
              <p>
                <strong>{monthLabel(row.playedIn)}. </strong>
                {row.playedOut}
              </p>
            </div>
          ))}
        </div>
      )}
      {step.risks.length > 0 && (
        <div className="callout" data-testid="results-risks">
          <h3>{panelText.resultsRisksHeading}</h3>
          {step.risks.map((row, index) => (
            <p key={index} data-testid="result-risk">
              <strong>{monthLabel(row.addedIn)}. </strong>
              {row.note} {row.fate}
              {row.cameOutIn !== null && (
                <span className="results-title">{row.motive}</span>
              )}
            </p>
          ))}
        </div>
      )}
      <h3>{panelText.resultsWhoHeading}</h3>
      <table className="results">
        <tbody>
          {step.characters.map((person) => (
            <tr key={person.name} data-testid="result-character">
              <th scope="row">
                {person.title}
                <span className="results-title">{person.name}</span>
              </th>
              <td className="results-kind">{person.kind}</td>
              <td>{person.fact ?? panelText.resultsNoFact}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {step.played.length > 0 && (
        <>
          <h3>{panelText.resultsPlayedHeading}</h3>
          <table className="results">
            <tbody>
              {step.played.map((row) => (
                <tr key={row.family} data-testid="result-family">
                  <th scope="row">{row.family}</th>
                  <td className="results-kind">{row.count}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>{panelText.resultsMarksHeading}</h3>
      <table className="results">
        <tbody>
          {step.marks.map((row) => (
            <tr key={row.name} data-testid="result-mark">
              <th scope="row">
                {row.title}
                <span className="results-title">{row.name}</span>
              </th>
              <td>{row.mark ?? panelText.notebookNoMark}</td>
              <td>{row.truth}</td>
              <td className="results-kind">
                {row.mark === null
                  ? ""
                  : row.correct
                    ? panelText.resultsMarkRight
                    : panelText.resultsMarkWrong}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="callout" data-testid="results-boss">
        <h3>{panelText.resultsBossHeading}</h3>
        <p>
          {step.boss.title}, {step.boss.name}:{" "}
          <strong data-testid="result-boss-kind">{step.boss.kind}</strong>
        </p>
        {step.boss.verdict !== null && (
          <p data-testid="result-boss-verdict">{step.boss.verdict}</p>
        )}
        {step.boss.choices.length === 0 ? (
          <p>{panelText.resultsBossNoChoices}</p>
        ) : (
          <table className="results">
            <tbody>
              {step.boss.choices.map((row, index) => (
                <tr key={index} data-testid="result-boss-choice">
                  <th scope="row">
                    {row.choice}
                    <span className="results-title">
                      {monthLabel(row.month)}
                    </span>
                  </th>
                  <td className="results-kind">{row.landed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {step.boss.head !== null && (
        <div className="callout" data-testid="results-head">
          <h3>{panelText.resultsHeadHeading}</h3>
          <p>
            {step.boss.head.title}, {step.boss.head.name}:{" "}
            <strong data-testid="result-head-kind">
              {step.boss.head.kind}
            </strong>
          </p>
          <p data-testid="result-head-verdict">{step.boss.head.verdict}</p>
        </div>
      )}
      {step.factEvents.length > 0 && (
        <div className="callout" data-testid="results-fact-events">
          <h3>{panelText.resultsFactEventsHeading}</h3>
          {step.factEvents.map((event, index) => (
            <p key={index} data-testid="result-fact-event">
              <strong>{monthLabel(event.month)}. </strong>
              {event.note}
              {event.fact !== null && ` ${event.fact}`}
            </p>
          ))}
        </div>
      )}
      <h3>{panelText.resultsClaimsHeading}</h3>
      {step.claims.length === 0 ? (
        <p data-testid="results-no-claims">{panelText.resultsNoClaims}</p>
      ) : (
        <table className="results">
          <tbody>
            {step.claims.map((claim, index) => (
              <tr key={index} data-testid="result-claim">
                <th scope="row">
                  {claim.source}
                  <span className="results-title">
                    {monthLabel(claim.month)}
                  </span>
                </th>
                <td>
                  {claim.text}
                  <span className="results-title">{claim.motive}</span>
                </td>
                <td className="results-kind">
                  {claim.verdict}
                  <span className="results-title">{claim.note}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {step.clues.length > 0 && (
        <>
          <h3>{panelText.resultsCluesHeading}</h3>
          <table className="results">
            <tbody>
              {step.clues.map((clue, index) => (
                <tr key={index} data-testid="result-clue">
                  <th scope="row">
                    {clue.source}
                    <span className="results-title">
                      {monthLabel(clue.month)}
                    </span>
                  </th>
                  <td>{clue.text}</td>
                  <td className="results-kind">{clue.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <div className="results-charts">
        <div data-testid="results-org-chart">
          <h3>{panelText.orgChartHeading}</h3>
          <Chart entries={orgChart} />
        </div>
        <div data-testid="results-power-map">
          <h3>{panelText.powerMapHeading}</h3>
          <Chart entries={step.powerMap} />
        </div>
      </div>
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
                <Stakes text={option.stakes} />
              </button>
            ))}
          </div>
        </Panel>
      );
    case "scene":
      return (
        <Panel
          testId="panel-scene"
          eyebrow={step.location}
          title={step.title}
          wide
        >
          <div className="scene-columns">
            <div>
              {step.narration.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <h3>{panelText.castHeading}</h3>
              <ul className="cast">
                {step.cast.map((person) => (
                  <li key={person.name}>
                    <strong>{person.title}</strong>, {person.name}
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
              {step.behaviours.length > 0 && (
                <>
                  <h3>{panelText.behavioursHeading}</h3>
                  <ul className="signs behaviours">
                    {step.behaviours.map((shown) => (
                      <li key={shown.who} data-testid="behaviour">
                        {shown.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div>
              {step.treatment !== null && (
                <>
                  <h3>{panelText.treatmentHeading}</h3>
                  <p className="signs" data-testid="treatment">
                    {step.treatment}
                  </p>
                </>
              )}
              {step.headTreatment !== null && (
                <>
                  <h3>{panelText.headTreatmentHeading}</h3>
                  <p className="signs" data-testid="head-treatment">
                    {step.headTreatment}
                  </p>
                </>
              )}
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
                    <Stakes text={option.stakes} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      );
    case "find-out":
      return <FindOutPanel step={step} onChoose={onChoose} />;
    case "claim":
      return (
        <Panel testId="panel-claim" title={step.title}>
          <p className="callout" data-testid="claim-text">
            {step.text}
          </p>
          <Continue onChoose={onChoose} />
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
          <Reaction text={step.reaction} />
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "notice":
      return (
        <Panel testId="panel-notice" title={step.title}>
          <p>{step.body}</p>
          <Reaction text={step.reaction} />
          {step.verdict !== undefined && (
            <p className="callout" data-testid="boss-verdict">
              {step.verdict}
            </p>
          )}
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
      return <ResultsPanel step={step} orgChart={view.orgChart} />;
  }
}
