import { panelText } from "../content";
import type { Choice, PlayerView, StepView } from "../engine";
import { FindOutPanel } from "./FindOutPanel";
import { ConfidentialStamp, type Look, type Sent } from "./Intranet";
import { Continue, Panel, Reaction, Stakes } from "./Panel";
import { ResultsPanel } from "./ResultsPanel";
import { ScenePanel } from "./ScenePanel";
import { StandingBar } from "./StandingBar";

/** The official story, as that month's issue of the staff newsletter. */
function StoryPanel({
  step,
  month,
  onChoose,
}: {
  step: Extract<StepView, { kind: "story" }>;
  month: number;
  onChoose: (choice: Choice) => void;
}) {
  return (
    <Panel testId="panel-story" title={step.title} look={{ issue: month }}>
      <div className="story-reported" data-testid="story-reported">
        {step.reportedHeading !== undefined && <h3>{step.reportedHeading}</h3>}
        {step.reported.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {step.gauges.map((line) => (
        <p key={line} className="signs" data-testid="story-gauge">
          {line}
        </p>
      ))}
      {step.happened.length > 0 && (
        <>
          <ConfidentialStamp />
          <div className="callout story-happened" data-testid="story-happened">
            {step.happenedHeading !== undefined && (
              <h3>{step.happenedHeading}</h3>
            )}
            {step.happened.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </>
      )}
      <Continue onChoose={onChoose} />
    </Panel>
  );
}

type DecidedView = NonNullable<
  Extract<StepView, { kind: "notice" }>["decided"]
>;

/** A vacancy decided: Official standing, beside who really decided and why. */
function Decided({ decided }: { decided: DecidedView }) {
  const { onPaper, inFact } = decided;
  return (
    <div className="callout" data-testid="decided">
      {onPaper && (
        <p data-testid="decided-on-paper">
          <strong>{panelText.decidedOnPaper}: </strong>
          {onPaper.label}{" "}
          <StandingBar standing={onPaper} testId="decided-standing-bar" />{" "}
          {onPaper.band}. {onPaper.text}
        </p>
      )}
      <p data-testid="decided-in-fact">
        <strong>{panelText.decidedInFact}: </strong>
        {inFact}
      </p>
    </div>
  );
}

interface StepPanelProps {
  view: PlayerView;
  onChoose: (choice: Choice) => void;
}

/** The panel for the current step of the month, if it needs one. */
export function StepPanel({ view, onChoose }: StepPanelProps) {
  const { step } = view;
  /** An e-mail to the player, by their job title. */
  const mail = (sent: Sent): Look => ({ sent, to: view.job.title });
  switch (step.kind) {
    case "actions":
      return null;
    case "notification":
      return (
        <Panel
          testId="panel-notification"
          eyebrow={step.from}
          title={step.subject}
          look={mail("notification")}
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
      return <ScenePanel step={step} onChoose={onChoose} />;
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
        <Panel testId="panel-dialog" title={step.title} look={mail("dialog")}>
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
        <Panel testId="panel-notice" title={step.title} look={mail("notice")}>
          <p>{step.body}</p>
          <Reaction text={step.reaction} />
          {step.decided && <Decided decided={step.decided} />}
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
        <Panel
          testId="panel-move"
          eyebrow={step.from}
          title={step.title}
          look={mail("move")}
        >
          <p>{step.body}</p>
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "event":
      return (
        <Panel
          testId="panel-event"
          eyebrow={step.from}
          title={step.title}
          look={mail("event")}
        >
          <p>{step.body}</p>
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "story":
      return <StoryPanel step={step} month={view.month} onChoose={onChoose} />;
    case "win":
      return (
        <Panel testId="panel-win" title={step.title}>
          {step.lines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
          <Continue onChoose={onChoose} />
        </Panel>
      );
    case "results":
      return <ResultsPanel step={step} orgChart={view.orgChart} />;
  }
}
