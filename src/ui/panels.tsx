import { panelText } from "../content";
import type { Choice, PlayerView, StepView } from "../engine";
import { FindOutPanel } from "./FindOutPanel";
import { ConfidentialStamp, type Look, type Sent } from "./Intranet";
import { Continue, Panel, Reaction, ResultBefore, Stakes } from "./Panel";
import { AnsweredMail, InboxCount, ResultAtHead } from "./Result";
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
      <div className="story" data-testid="story">
        <div className="story-pair story-heads">
          <div className="story-reported">
            {step.reportedHeading !== undefined && (
              <h3>{step.reportedHeading}</h3>
            )}
          </div>
          <div className="story-happened">
            {step.happenedHeading !== undefined && (
              <h3>{step.happenedHeading}</h3>
            )}
            <ConfidentialStamp />
          </div>
        </div>
        {step.pairs.map(({ reported, happened }, index) => (
          // Each thing told of the month on one row: the gap where a side is missing is the joke.
          <div key={index} className="story-pair" data-testid="story-pair">
            <div className="story-reported">
              {reported !== undefined && (
                <p data-testid="story-reported">{reported}</p>
              )}
            </div>
            <div className="story-happened">
              {happened !== undefined && (
                <p data-testid="story-happened">{happened}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {step.gauges.map((line) => (
        <p key={line} className="signs" data-testid="story-gauge">
          {line}
        </p>
      ))}
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
  /** Starts a new run on a seed, without asking: only offered once a run is over. */
  onRestart: (seed: number) => void;
  onNewRun: () => void;
}

/**
 * The panel for the current step of the month, if it needs one, headed by what
 * the player's last choice led to. With the floor to use, that result stands
 * alone, and goes once the player chooses again.
 */
export function StepPanel(props: StepPanelProps) {
  const { view } = props;
  const { step, result, actions } = view;
  if (step.kind === "actions") {
    if (result === null) return null;
    // Small, and taking no focus, so that the floor stays the player's.
    return (
      <section
        className="panel panel-result"
        data-testid="panel-result"
        aria-label={panelText.resultHeading}
      >
        <ResultAtHead result={result} actions={actions} />
        {result.kind === "answer" && (
          <p className="inbox-count" data-testid="inbox-count">
            {panelText.inboxEmpty}
          </p>
        )}
      </section>
    );
  }
  const before =
    result === null ? null : step.kind === "notification" &&
      result.kind === "answer" ? (
      <>
        <AnsweredMail result={result} />
        <InboxCount step={step} answered />
      </>
    ) : (
      <ResultAtHead result={result} actions={actions} />
    );
  return (
    <ResultBefore.Provider value={before}>
      <StepBody {...props} />
    </ResultBefore.Provider>
  );
}

function StepBody({ view, onChoose, onRestart, onNewRun }: StepPanelProps) {
  const { step, result } = view;
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
          {result?.kind !== "answer" && (
            <InboxCount step={step} answered={false} />
          )}
        </Panel>
      );
    case "scene":
      return <ScenePanel step={step} onChoose={onChoose} />;
    case "find-out":
      return <FindOutPanel step={step} onChoose={onChoose} />;
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
    case "escape":
      return (
        <Panel
          testId="panel-escape"
          {...(step.from === "" ? {} : { eyebrow: step.from })}
          title={step.title}
          look={mail(step.from === "" ? "notice" : "move")}
        >
          <p>{step.body}</p>
          <h3>{panelText.escapeHeading}</h3>
          <div className="options">
            {step.escapes.map((escape) => (
              <button
                key={escape.id}
                type="button"
                className="option"
                data-testid={`escape-${escape.id}`}
                disabled={escape.needs !== undefined}
                onClick={() => {
                  onChoose({
                    type: "escape",
                    billId: step.id,
                    escapeId: escape.id,
                  });
                }}
              >
                <span>{escape.label}</span>
                {escape.needs && (
                  <span className="option-cost">
                    {panelText.escapeNeeds
                      .replace("{gauge}", escape.needs.label)
                      .replace("{at}", String(escape.needs.at))}
                  </span>
                )}
              </button>
            ))}
          </div>
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
      return (
        <ResultsPanel
          step={step}
          orgChart={view.orgChart}
          onPlayAgain={() => {
            onRestart(view.seed);
          }}
          onNewRun={onNewRun}
        />
      );
  }
}
