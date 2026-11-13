import { useContext, useState } from "react";
import { panelText } from "../content";
import type {
  Choice,
  InboxItemView,
  LandedView,
  MailView,
  NoticeView,
  PlayerView,
  StepView,
} from "../engine";
import { FindOutPanel } from "./FindOutPanel";
import { ConfidentialStamp, type Look, type Sent } from "./Intranet";
import {
  Continue,
  ContinueButton,
  InboxHead,
  Panel,
  Reaction,
  Stakes,
  StepTag,
} from "./Panel";
import { ResultBody } from "./Result";
import { ResultsPanel } from "./ResultsPanel";
import { ScenePanel } from "./ScenePanel";
import { StandingBar } from "./StandingBar";

const landedLabels: Record<LandedView["kind"], string> = {
  event: panelText.landedEvent,
  move: panelText.landedMove,
  notice: panelText.landedNotice,
};

/** Something that landed as the month closed, as a section of the official story. */
function Landed({ landed }: { landed: LandedView }) {
  return (
    <section className="landed" data-testid="landed" data-kind={landed.kind}>
      <p className="landed-kind">{landedLabels[landed.kind]}</p>
      {landed.kind !== "notice" && <p className="eyebrow">{landed.from}</p>}
      <h3 className="landed-title" data-testid="landed-title">
        {landed.title}
      </h3>
      <p>{landed.body}</p>
      {landed.kind === "notice" && <NoticeExtras notice={landed} />}
    </section>
  );
}

/**
 * The official story, as that month's issue of the staff newsletter: what
 * landed as the month closed, then the official story beside what happened.
 */
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
      {step.landed.length > 0 && (
        <div className="landed-list" data-testid="landed-list">
          <h3>{panelText.landedHeading}</h3>
          {step.landed.map((landed, index) => (
            <Landed key={index} landed={landed} />
          ))}
        </div>
      )}
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

type DecidedView = NonNullable<NoticeView["decided"]>;

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

/** How the boss took a notice, any vacancy it decided, and any last verdict. */
function NoticeExtras({ notice }: { notice: NoticeView }) {
  return (
    <>
      <Reaction text={notice.reaction} />
      {notice.decided && <Decided decided={notice.decided} />}
      {notice.verdict !== undefined && (
        <p className="callout" data-testid="boss-verdict">
          {notice.verdict}
        </p>
      )}
    </>
  );
}

/**
 * A Notification as an e-mail with its answers. One answered in an earlier
 * month, such as the Monthly Status Report, is shown by its subject and
 * answers, with its full text a click away.
 */
function MailPanel({
  mail,
  look,
  onChoose,
}: {
  mail: MailView;
  look: Look;
  onChoose: (choice: Choice) => void;
}) {
  const [full, setFull] = useState(false);
  const short = mail.short && !full;
  return (
    <Panel
      testId="panel-notification"
      eyebrow={mail.from}
      title={mail.subject}
      look={look}
    >
      {short ? null : <p data-testid="mail-body">{mail.body}</p>}
      {mail.short && (
        <button
          type="button"
          className="status-link"
          data-testid="mail-read-full"
          aria-expanded={full}
          onClick={() => {
            setFull(!full);
          }}
        >
          {full ? panelText.readLess : panelText.readInFull}
        </button>
      )}
      <div className="options">
        {mail.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="option"
            data-testid={`option-${option.id}`}
            disabled={!option.affordable}
            onClick={() => {
              onChoose({
                type: "notification",
                notificationId: mail.id,
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
      {mail.options.every((o) => !o.affordable) && (
        <p className="signs" data-testid="mail-no-answer">
          {panelText.inboxNoAnswer}
        </p>
      )}
    </Panel>
  );
}

/** Each thing in the inbox's own key, which stays the same while it waits. */
export function inboxKey(item: InboxItemView, index: number): string {
  switch (item.kind) {
    case "notification":
      return `mail:${item.id}`;
    case "escape":
      return `escape:${item.id}`;
    case "notice":
      return `note:${String(index)}:${item.title}`;
  }
}

/** Whether a thing in the inbox must be answered before the month can close. */
function toAnswer(item: InboxItemView): boolean {
  return item.kind === "escape"
    ? item.escapes.length > 0
    : item.kind === "notification" && item.options.some((o) => o.affordable);
}

/** The inbox's list: each thing in it, the one open marked, and a way to close it. */
function InboxList({
  items,
  open,
  onOpen,
  onHide,
}: {
  items: InboxItemView[];
  open: string | null;
  onOpen: (key: string) => void;
  /** Closes what is open, back to the list, if anything is. */
  onHide?: (() => void) | undefined;
}) {
  return (
    <nav className="inbox" aria-label={panelText.inboxHeading}>
      <ul className="inbox-list" data-testid="inbox-list">
        {items.map((item, index) => {
          const key = inboxKey(item, index);
          const title =
            item.kind === "notification" ? item.subject : item.title;
          return (
            <li key={key}>
              <button
                type="button"
                className="inbox-item"
                data-testid="inbox-item"
                data-key={key}
                data-to-answer={toAnswer(item)}
                aria-current={key === open}
                onClick={() => {
                  onOpen(key);
                }}
              >
                {item.kind === "notice" && (
                  <span className="inbox-to-read">
                    {panelText.inboxToRead}:{" "}
                  </span>
                )}
                {title}
              </button>
            </li>
          );
        })}
      </ul>
      {onHide && (
        <button
          type="button"
          className="status-link inbox-hide"
          data-testid="inbox-hide"
          onClick={onHide}
        >
          {panelText.inboxHide}
        </button>
      )}
    </nav>
  );
}

/**
 * Whatever is open in the inbox: what the player opened, while it waits, or
 * else whatever is at the top of it, so that answering one goes on to the next.
 */
function openInInbox(view: PlayerView, opened: string | null): string | null {
  const keys = view.inbox.items.map(inboxKey);
  if (opened !== null && keys.includes(opened)) return opened;
  const { step } = view;
  if (step.kind === "notification") return `mail:${step.id}`;
  if (step.kind === "escape") return `escape:${step.id}`;
  return null;
}

interface StepPanelProps {
  view: PlayerView;
  onChoose: (choice: Choice) => void;
  /** Starts a new run on a seed, without asking: only offered once a run is over. */
  onRestart: (seed: number) => void;
  onNewRun: () => void;
  /** Whether the player has opened the inbox, which is otherwise just its list. */
  inboxOpen: boolean;
  /** Whatever the player opened in the inbox, by `inboxKey`. */
  opened: string | null;
  onOpen: (key: string) => void;
  onHideInbox: () => void;
  /** Whether what the player's last choice led to is still to be read. */
  resultOpen: boolean;
  onResultRead: () => void;
}

/**
 * What the player's last choice led to, on its own, so that the player reads
 * one thing at a time: nothing else shows, and the floor waits, until Continue.
 */
function ResultPanel({
  view,
  onContinue,
}: {
  view: PlayerView;
  onContinue: () => void;
}) {
  const { result, actions, inbox } = view;
  if (result === null) return null;
  return (
    <Panel testId="panel-result" title={panelText.resultHeading}>
      <ResultBody result={result} actions={actions} />
      {result.kind === "answer" && inbox.toAnswer === 0 && (
        <p className="inbox-count" data-testid="inbox-count">
          {panelText.inboxEmpty}
        </p>
      )}
      <ContinueButton onClick={onContinue} />
    </Panel>
  );
}

/**
 * The inbox closed: only its list, small along the top, clear of the places
 * on the floor, so that the floor is the player's from the start of the month.
 */
function InboxClosed({
  view,
  onOpen,
}: {
  view: PlayerView;
  onOpen: (key: string) => void;
}) {
  const tag = useContext(StepTag);
  return (
    <section
      className="panel panel-inbox panel-inbox-closed"
      data-testid="panel-inbox"
      aria-label={panelText.inboxHeading}
    >
      {tag !== null && (
        <p className="step-tag" data-testid="step-tag">
          {tag}
        </p>
      )}
      <InboxList items={view.inbox.items} open={null} onOpen={onOpen} />
    </section>
  );
}

/**
 * The panel for the current step of the month, if it needs one, once what the
 * player's last choice led to has been read. On the floor, it is the inbox,
 * which waits for nothing: closed, it is only its list.
 */
export function StepPanel(props: StepPanelProps) {
  const { view } = props;
  const { inbox } = view;
  if (props.resultOpen && view.result !== null) {
    return <ResultPanel view={view} onContinue={props.onResultRead} />;
  }
  if (!view.waiting) {
    const open = props.inboxOpen ? openInInbox(view, props.opened) : null;
    const index = inbox.items.findIndex(
      (item, i) => inboxKey(item, i) === open,
    );
    const item = inbox.items[index];
    if (open === null || item === undefined) {
      return inbox.items.length > 0 ? (
        <InboxClosed view={view} onOpen={props.onOpen} />
      ) : null;
    }
    return (
      <InboxHead.Provider
        value={
          <InboxList
            items={inbox.items}
            open={open}
            onOpen={props.onOpen}
            onHide={props.onHideInbox}
          />
        }
      >
        <StepBody {...props} view={{ ...view, step: asStep(item) }} />
      </InboxHead.Provider>
    );
  }
  return <StepBody {...props} />;
}

/** A thing in the inbox, shown in the panel its kind of step has. */
function asStep(item: InboxItemView): StepView {
  return item.kind === "notification" ? { ...item, waiting: 0 } : item;
}

function StepBody({ view, onChoose, onRestart, onNewRun }: StepPanelProps) {
  const { step } = view;
  /** An e-mail to the player, by their job title. */
  const mail = (sent: Sent): Look => ({ sent, to: view.job.title });

  switch (step.kind) {
    case "actions":
      return null;
    case "notification":
      return (
        <MailPanel
          key={step.id}
          mail={step}
          look={mail("notification")}
          onChoose={onChoose}
        />
      );
    case "scene":
      return <ScenePanel step={step} onChoose={onChoose} />;
    case "find-out":
      return <FindOutPanel step={step} onChoose={onChoose} />;
    case "notice":
      return (
        <Panel
          testId={view.waiting ? "panel-notice" : "panel-note"}
          title={step.title}
          look={mail("notice")}
        >
          <p>{step.body}</p>
          <NoticeExtras notice={step} />
          {view.waiting && <Continue onChoose={onChoose} />}
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
