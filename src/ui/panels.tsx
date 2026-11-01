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
