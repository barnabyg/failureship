import { useEffect, useRef, type ReactNode } from "react";
import { panelText } from "../content";
import type { Choice, PlayerView, StepView } from "../engine";

interface PanelProps {
  testId: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
}

/** A panel over the tower. It takes focus, so the keyboard follows the month. */
function Panel({ testId, eyebrow, title, children }: PanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <section className="panel" data-testid={testId} aria-label={title}>
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
  onReplay,
  onNewSeed,
}: {
  step: Extract<StepView, { kind: "story" }>;
  onReplay: () => void;
  onNewSeed: () => void;
}) {
  return (
    <Panel testId="panel-story" title={step.title}>
      {step.reported.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <div className="panel-actions">
        <button
          type="button"
          className="primary"
          data-testid="replay"
          onClick={onReplay}
        >
          {panelText.replayLabel}
        </button>
        <button type="button" data-testid="new-seed" onClick={onNewSeed}>
          {panelText.newSeedLabel}
        </button>
      </div>
    </Panel>
  );
}

interface StepPanelProps {
  view: PlayerView;
  onChoose: (choice: Choice) => void;
  onReplay: () => void;
  onNewSeed: () => void;
}

/** The panel for the current step of the month, if it needs one. */
export function StepPanel({
  view,
  onChoose,
  onReplay,
  onNewSeed,
}: StepPanelProps) {
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
    case "story":
      return (
        <StoryPanel step={step} onReplay={onReplay} onNewSeed={onNewSeed} />
      );
  }
}
