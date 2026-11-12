import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { panelText } from "../content";
import type { Choice, PlayerView } from "../engine";
import { MailFoot, MailHead, Masthead, type Look } from "./Intranet";

/** What the player did last, shown at the head of whatever panel comes next. */
export const ResultBefore = createContext<ReactNode>(null);

/**
 * What kind of step is waiting atop its panel, or, on the floor, that the
 * inbox's panel waits for nothing, and how much in it is left to answer.
 */
export const StepTag = createContext<string | null>(null);

/**
 * The inbox's list, atop the panel of whatever is open in it. A panel with one
 * is the inbox, which leaves the floor open.
 */
export const InboxHead = createContext<ReactNode>(null);

/** The tag for a step that waits for an answer, or for the inbox on the floor. */
export function stepTag(view: PlayerView): string | null {
  const { step, inbox } = view;
  if (!view.waiting) {
    if (inbox.items.length === 0) return null;
    return inbox.toAnswer > 0
      ? panelText.inboxTag.replaceAll("{n}", String(inbox.toAnswer))
      : panelText.inboxTagNone;
  }
  switch (step.kind) {
    case "actions":
    case "notification":
      return null;
    case "scene":
      return panelText.stepScene;
    case "find-out":
      return panelText.stepFindOut;
    case "notice":
      return panelText.stepNotice;
    case "escape":
      return panelText.stepEscape;
    case "story":
      return panelText.stepStory;
    case "win":
      return panelText.stepWin;
    case "results":
      return panelText.stepResults;
  }
}

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
  const tag = useContext(StepTag);
  const inbox = useContext(InboxHead);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  const h2 = (
    <h2 ref={heading} tabIndex={-1}>
      {title}
    </h2>
  );
  const classes = ["panel", wide && "panel-wide", inbox && "panel-inbox"];
  return (
    <section
      className={classes.filter(Boolean).join(" ")}
      data-testid={testId}
      data-look={look && ("sent" in look ? "mail" : "newsletter")}
      aria-label={title}
    >
      {tag !== null && (
        <p className="step-tag" data-testid="step-tag">
          {tag}
        </p>
      )}
      {inbox}
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
