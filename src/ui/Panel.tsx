import { useEffect, useRef, type ReactNode } from "react";
import { panelText } from "../content";
import type { Choice } from "../engine";
import { MailFoot, MailHead, Masthead, type Sent } from "./Intranet";

interface PanelProps {
  testId: string;
  eyebrow?: string;
  title: string;
  wide?: boolean;
  /** Arrives as an e-mail on the intranet, with the eyebrow as who sent it. */
  sent?: Sent;
  /** Reads as this issue of the staff newsletter. */
  issue?: number;
  children: ReactNode;
}

/** A panel over the tower. It takes focus, so the keyboard follows the month. */
export function Panel({
  testId,
  eyebrow,
  title,
  wide,
  sent,
  issue,
  children,
}: PanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  const h2 = (
    <h2 ref={heading} tabIndex={-1}>
      {title}
    </h2>
  );
  return (
    <section
      className={wide ? "panel panel-wide" : "panel"}
      data-testid={testId}
      data-kind={sent ?? (issue === undefined ? undefined : "story")}
      aria-label={title}
    >
      {sent !== undefined ? (
        <MailHead sent={sent} from={eyebrow} subject={h2} />
      ) : (
        <>
          {issue !== undefined && <Masthead issue={issue} />}
          {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
          {h2}
        </>
      )}
      {children}
      {sent !== undefined && <MailFoot />}
    </section>
  );
}

export function Continue({ onChoose }: { onChoose: (choice: Choice) => void }) {
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
export function Reaction({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p className="signs" data-testid="boss-reaction">
      {text}
    </p>
  );
}

/** Said before a choice that could end the run on the spot. */
export function Stakes({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <span className="option-stakes" data-testid="stakes">
      {text}
    </span>
  );
}
