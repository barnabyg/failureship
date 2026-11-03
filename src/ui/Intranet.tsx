import type { ReactNode } from "react";
import { panelText } from "../content";
import type { StepView } from "../engine";

/** The steps that arrive like Notifications: each is an e-mail on the intranet. */
export type Sent = Extract<
  StepView["kind"],
  "notification" | "dialog" | "notice" | "move" | "event"
>;

/** An e-mail, sent to the player by their job title, or an issue of the newsletter. */
export type Look = { sent: Sent; to: string } | { issue: number };

/** What each kind of e-mail is stamped, if anything. A Company Event goes to all staff. */
const stamps: Partial<Record<Sent, string>> = {
  notification: panelText.stampUrgent,
  move: panelText.stampConfidential,
  event: panelText.stampAllStaff,
};

/** The company's logo: a ship, listing. */
function Logo({ size }: { size: number }) {
  return (
    <svg
      className="logo"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="23" fill="#ffffff" />
      <g transform="rotate(-12 24 26)">
        <path d="M24 8 L24 28" stroke="#0b3d6e" strokeWidth="2.4" />
        <path d="M25 10 L36 24 L25 24 Z" fill="#f39c12" />
        <path d="M23 13 L14 24 L23 24 Z" fill="#2fa3d8" />
        <path d="M9 28 L39 28 L34 35 L14 35 Z" fill="#0b3d6e" />
      </g>
      <path
        d="M5 37 Q10 34 15 37 T25 37 T35 37 T45 37"
        stroke="#2fa3d8"
        strokeWidth="2.4"
        fill="none"
      />
    </svg>
  );
}

/** "From: someone" as a label and a value, so that the labels line up. */
function MailRow({ text }: { text: string }) {
  const match = /^([A-Za-z]{2,8}:)\s*(.*)$/.exec(text);
  return (
    <p className="mail-row">
      {match ? (
        <>
          <span className="mail-label">{match[1]}</span>
          <span>{match[2]}</span>
        </>
      ) : (
        <span>{text}</span>
      )}
    </p>
  );
}

/** An e-mail on the company intranet: letterhead, who it is from and to, and its subject. */
export function MailHead({
  sent,
  to,
  from,
  subject,
}: {
  sent: Sent;
  to: string;
  from: string | undefined;
  subject: ReactNode;
}) {
  const stamp = stamps[sent];
  return (
    <>
      <div className="letterhead">
        <Logo size={30} />
        <span className="letterhead-company">{panelText.title}</span>
        <span className="letterhead-place">{panelText.intranetLabel}</span>
      </div>
      <div className={stamp === undefined ? "mailhead" : "mailhead stamped"}>
        {from !== undefined && <MailRow text={from} />}
        <p className="mail-row">
          <span className="mail-label">{panelText.mailToLabel}</span>
          <span>{to}</span>
        </p>
        <div className="mail-row mail-subject">
          <span className="mail-label">{panelText.mailSubjectLabel}</span>
          {subject}
        </div>
        {stamp !== undefined && (
          <span className="stamp" aria-hidden="true">
            {stamp}
          </span>
        )}
      </div>
    </>
  );
}

export function MailFoot() {
  return <p className="mail-disclaimer">{panelText.mailDisclaimer}</p>;
}

/** The official story's masthead: the staff newsletter, one issue a month. */
export function Masthead({ issue }: { issue: number }) {
  return (
    <div className="masthead">
      <Logo size={52} />
      <div>
        <p className="masthead-name">{panelText.newsletterName}</p>
        <p className="masthead-sub">
          {panelText.newsletterTagline} · {panelText.title}
        </p>
      </div>
      <span className="masthead-issue">
        <small>{panelText.newsletterIssue}</small>
        {issue}
      </span>
    </div>
  );
}

/** Stamped across what really happened, which was not for the newsletter. */
export function ConfidentialStamp() {
  return (
    <span className="happened-stamp" aria-hidden="true">
      <span className="stamp">{panelText.stampConfidential}</span>
    </span>
  );
}
