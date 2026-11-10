import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { panelText } from "../content";
import type { Choice } from "../engine";
import { MailFoot, MailHead, Masthead, type Look } from "./Intranet";

/** What the player did last, shown at the head of whatever panel comes next. */
export const ResultBefore = createContext<ReactNode>(null);

interface PanelProps {
  testId: string;
  eyebrow?: string;
  title: string;
  wide?: boolean;
  /** An e-mail, whose eyebrow says who sent it, or the staff newsletter. */
  look?: Look;
  children: ReactNode;
}

/** A panel over the tower. It takes focus, so the keyboard follows the month. */
export function Panel({
  testId,
  eyebrow,
  title,
  wide,
  look,
  children,
}: PanelProps) {
  const before = useContext(ResultBefore);
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
      data-look={look && ("sent" in look ? "mail" : "newsletter")}
      aria-label={title}
    >
      {before}
      {look && "sent" in look ? (
        <MailHead sent={look.sent} to={look.to} from={eyebrow} subject={h2} />
      ) : (
        <>
          {look && <Masthead issue={look.issue} />}
          {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
          {h2}
        </>
      )}
      {children}
      {look && "sent" in look && <MailFoot />}
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
