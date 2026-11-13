import { panelText } from "../content";
import type { PlayerView, ResultView } from "../engine";
import { Reaction } from "./Panel";

type Answer = Extract<ResultView, { kind: "answer" }>;
type Happened = Exclude<ResultView, Answer>;
type Told = Answer["then"];

/** Says plainly that the place is spent, and what is left. */
function spentLine(place: string, actions: PlayerView["actions"]): string {
  const written =
    actions.remaining > 0 ? panelText.resultSpent : panelText.resultSpentLast;
  return written
    .replaceAll("{place}", place)
    .replaceAll("{actions}", actions.label);
}

/**
 * The one look for what came of the player's own action on the floor: a desk,
 * the kitchen, a meeting, going over the boss's head, or a claim heard.
 */
export function HappenedCard({
  result,
  actions,
}: {
  result: Happened;
  actions: PlayerView["actions"];
}) {
  return (
    <div className="happened" data-testid="result" data-kind={result.kind}>
      <h3 className="happened-title" data-testid="result-title">
        {result.title}
      </h3>
      {result.kind === "claim" ? (
        <p className="callout" data-testid="claim-text">
          {result.text}
        </p>
      ) : (
        <>
          <p data-testid="result-body">{result.body}</p>
          <Reaction text={result.reaction} />
          {result.verdict !== undefined && (
            <p className="callout" data-testid="boss-verdict">
              {result.verdict}
            </p>
          )}
        </>
      )}
      {result.spent !== null && (
        <p className="happened-spent" data-testid="result-spent">
          {spentLine(result.spent, actions)}
        </p>
      )}
    </div>
  );
}

/** What an answer led to, as it is said back under the answer. */
function ToldBack({ then }: { then: Told }) {
  if (then.kind === "dialog") {
    return (
      <>
        <p className="told-title">{then.title}</p>
        {then.lines.map((line) => (
          <p key={line.text}>
            {line.speaker !== undefined && <strong>{line.speaker}: </strong>}
            {line.text}
          </p>
        ))}
        {then.learned.map((word) => (
          <p key={word.id} className="callout" data-testid="learned">
            <strong>{panelText.learnedLabel}: </strong>
            {word.term}. {word.meaning}
          </p>
        ))}
        <Reaction text={then.reaction} />
      </>
    );
  }
  return (
    <>
      <p className="told-title">{then.title}</p>
      <p>{then.body}</p>
      <Reaction text={then.reaction} />
      {then.verdict !== undefined && (
        <p className="callout" data-testid="boss-verdict">
          {then.verdict}
        </p>
      )}
    </>
  );
}

/**
 * A Notification answered, kept with the e-mail it answers: who it was from,
 * its subject, the answer chosen and, under it, what came of it.
 */
export function AnsweredMail({ result }: { result: Answer }) {
  return (
    <div className="answered" data-testid="answered">
      <p className="answered-subject">
        <span className="answered-from">{result.from}</span>
        <strong>{result.subject}</strong>
      </p>
      <p className="answered-answer" data-testid="answer-chosen">
        <span className="answered-label">{panelText.answerLabel}</span>
        {result.answer}
      </p>
      <div className="answered-result" data-testid="answer-result">
        <ToldBack then={result.then} />
      </div>
    </div>
  );
}

/** What the player's last choice led to, in its own look. */
export function ResultBody({
  result,
  actions,
}: {
  result: ResultView;
  actions: PlayerView["actions"];
}) {
  return result.kind === "answer" ? (
    <AnsweredMail result={result} />
  ) : (
    <HappenedCard result={result} actions={actions} />
  );
}
