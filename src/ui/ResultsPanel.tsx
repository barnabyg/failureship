import type { ReactNode } from "react";
import { panelText } from "../content";
import type { ChartEntry, StepView } from "../engine";
import { Chart } from "./Chart";
import { monthLabel } from "./Notebook";
import { Panel } from "./Panel";
import { StandingBar } from "./StandingBar";

type Results = Extract<StepView, { kind: "results" }>;

/** A part of the results that folds, with a line in its title saying what is in it. */
function Section({
  testId,
  heading,
  summary,
  open = false,
  children,
}: {
  testId: string;
  heading: string;
  summary: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="results-section"
      data-testid={`results-section-${testId}`}
      open={open}
    >
      <summary>
        <span className="results-section-heading">{heading}</span>
        {summary !== "" && (
          <span className="results-section-summary">: {summary}</span>
        )}
      </summary>
      {children}
    </details>
  );
}

/** The names in a list, or the word for nobody. */
function names(list: readonly { name: string }[]): string {
  return list.length === 0
    ? panelText.resultsNobody
    : list.map((row) => row.name).join(", ");
}

function count(list: readonly unknown[]): string {
  return list.length === 0 ? panelText.resultsNone : String(list.length);
}

/** "You were told 42 things; 11 were false or misleading." */
function toldLine(told: Results["told"]): string {
  const things =
    told.count === 1
      ? panelText.resultsThingsOne
      : panelText.resultsThings.replace("{n}", String(told.count));
  const wrong =
    told.wrong === 1
      ? panelText.resultsWrongOne
      : panelText.resultsWrong.replace("{n}", String(told.wrong));
  return panelText.resultsTold
    .replace("{things}", things)
    .replace("{wrong}", wrong);
}

function monthsLabel(months: readonly number[]): string {
  return months.length === 1
    ? monthLabel(months[0] ?? 0)
    : panelText.resultsMonthsLabel.replace("{months}", months.join(", "));
}

export function ResultsPanel({
  step,
  orgChart,
  onPlayAgain,
  onNewRun,
}: {
  step: Results;
  orgChart: readonly ChartEntry[];
  onPlayAgain: () => void;
  onNewRun: () => void;
}) {
  const marked = step.marks.filter((row) => row.mark !== null);
  const kinds = new Map<string, number>();
  for (const person of step.characters) {
    kinds.set(person.kind, (kinds.get(person.kind) ?? 0) + 1);
  }
  return (
    <Panel testId="panel-results" title={step.title} wide>
      <p>{step.intro}</p>
      {step.ending.text !== null && (
        <p className="callout" data-testid="results-ending">
          {step.ending.text}
        </p>
      )}
      {step.route.length > 0 && (
        <div className="callout" data-testid="results-route">
          <h3>{panelText.resultsRouteHeading}</h3>
          {step.route.map((row, index) => (
            <p key={index} data-testid="result-route">
              {row.text}
            </p>
          ))}
        </div>
      )}
      {step.standing && (
        <div data-testid="result-standing">
          <h3>{panelText.resultsStandingHeading}</h3>
          <p>
            <strong>{step.standing.label}: </strong>
            <StandingBar
              standing={step.standing}
              testId="result-standing-bar"
            />{" "}
            {step.standing.band}. {step.standing.onPaper}
          </p>
          <p>
            {step.standing.decides}
            {step.standing.believes !== null && ` ${step.standing.believes}.`}
          </p>
        </div>
      )}
      {step.vacancies.length > 0 && (
        <Section
          testId="vacancies"
          heading={panelText.resultsVacanciesHeading}
          summary=""
          open
        >
          <div data-testid="result-vacancies">
            {step.vacancies.map((vacancy) => (
              <p key={vacancy.month} data-testid="result-vacancy">
                {vacancy.text}{" "}
                {vacancy.onPaper !== null && (
                  <>
                    <strong>{panelText.decidedOnPaper}: </strong>
                    {vacancy.onPaper}.{" "}
                  </>
                )}
                <strong>{panelText.decidedInFact}: </strong>
                {vacancy.inFact}
              </p>
            ))}
          </div>
        </Section>
      )}
      <p className="results-told" data-testid="results-told">
        {toldLine(step.told)}
      </p>
      <div className="panel-actions results-again">
        <button
          type="button"
          className="primary"
          data-testid="results-play-again"
          onClick={onPlayAgain}
        >
          {panelText.playAgainLabel}
        </button>
        <button type="button" data-testid="results-new-run" onClick={onNewRun}>
          {panelText.newRunLabel}
        </button>
      </div>
      <Section
        testId="rivals"
        heading={panelText.resultsRivalsHeading}
        summary={names(step.rivals)}
        open
      >
        <div data-testid="results-rivals">
          {step.rivals.length === 0 && <p>{panelText.resultsNoRivals}</p>}
          {step.rivals.map((row) => (
            <div key={row.name} data-testid="result-rival">
              <p>
                <strong>
                  {row.title}, {row.name}.{" "}
                </strong>
                {row.competed.join(". ")}.{" "}
                <span className="results-title">
                  {panelText.resultsRivalSince.replace(
                    "{n}",
                    String(row.since),
                  )}
                </span>
              </p>
              {row.didNothing !== null && <p>{row.didNothing}</p>}
              {row.did.length > 0 && (
                <ul>
                  {row.did.map((move, index) => (
                    <li key={index} data-testid="result-rival-move">
                      <strong>{monthLabel(move.month)}. </strong>
                      {move.text}
                      {move.family !== null && ` (${move.family})`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section
        testId="grand-plans"
        heading={panelText.resultsGrandPlansHeading}
        summary={
          step.grandPlans.length === 0
            ? panelText.resultsNone
            : step.grandPlans.map((row) => row.plan).join(", ")
        }
      >
        <div data-testid="results-grand-plans">
          {step.grandPlans.length === 0 && (
            <p>{panelText.resultsNoGrandPlans}</p>
          )}
          {step.grandPlans.map((row) => (
            <p key={row.plan} data-testid="result-grand-plan">
              <strong>{monthLabel(row.month)}. </strong>
              {row.title}, {row.name}: {row.plan}. {row.fate}
              {row.keeper !== null && (
                <span className="results-title">{row.keeper}</span>
              )}
            </p>
          ))}
        </div>
      </Section>
      {step.changed.length > 0 && (
        <Section
          testId="changed"
          heading={panelText.resultsChangedHeading}
          summary={names(step.changed)}
        >
          <div data-testid="results-changed">
            {step.changed.map((row) => (
              <p key={row.name} data-testid="result-changed">
                <strong>{monthLabel(row.month)}. </strong>
                {row.title}, {row.name}: {row.from}. {row.to}.{" "}
                <span className="results-title">{row.why.join(" ")}</span>
              </p>
            ))}
          </div>
        </Section>
      )}
      <Section
        testId="boss"
        heading={panelText.resultsBossHeading}
        summary={`${step.boss.name}, ${step.boss.kind}`}
      >
        <div data-testid="results-boss">
          <p>
            {step.boss.title}, {step.boss.name}:{" "}
            <strong data-testid="result-boss-kind">{step.boss.kind}</strong>
          </p>
          {step.boss.verdict !== null && (
            <p data-testid="result-boss-verdict">{step.boss.verdict}</p>
          )}
          {step.boss.choices.length === 0 ? (
            <p>{panelText.resultsBossNoChoices}</p>
          ) : (
            <table className="results">
              <tbody>
                {step.boss.choices.map((row, index) => (
                  <tr key={index} data-testid="result-boss-choice">
                    <th scope="row">
                      {row.choice}
                      <span className="results-title">
                        {monthLabel(row.month)}
                      </span>
                    </th>
                    <td className="results-kind">{row.landed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
      {step.boss.head !== null && (
        <Section
          testId="head"
          heading={panelText.resultsHeadHeading}
          summary={`${step.boss.head.name}, ${step.boss.head.kind}`}
        >
          <div data-testid="results-head">
            <p>
              {step.boss.head.title}, {step.boss.head.name}:{" "}
              <strong data-testid="result-head-kind">
                {step.boss.head.kind}
              </strong>
            </p>
            <p data-testid="result-head-verdict">{step.boss.head.verdict}</p>
          </div>
        </Section>
      )}
      <Section
        testId="who"
        heading={panelText.resultsWhoHeading}
        summary={[...kinds]
          .map(([kind, n]) => `${kind} ${String(n)}`)
          .join(", ")}
      >
        <table className="results">
          <tbody>
            {step.characters.map((person) => (
              <tr key={person.name} data-testid="result-character">
                <th scope="row">
                  {person.title}
                  <span className="results-title">{person.name}</span>
                </th>
                <td className="results-kind">{person.kind}</td>
                <td>{person.fact ?? panelText.resultsNoFact}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      {step.beliefs.length > 0 && (
        <Section
          testId="beliefs"
          heading={panelText.resultsBeliefsHeading}
          summary={String(step.beliefs.length)}
        >
          <table className="results">
            <tbody>
              {step.beliefs.map((person) => (
                <tr key={person.name} data-testid="result-belief">
                  <th scope="row">
                    {person.title}
                    <span className="results-title">{person.name}</span>
                  </th>
                  <td className="results-kind">{person.believes}</td>
                  <td>
                    {person.reached.length === 0
                      ? panelText.resultsHeardNothing
                      : person.reached.map((row, index) => (
                          <p key={index} data-testid="result-reached">
                            <strong>{monthLabel(row.month)}. </strong>
                            {row.text} {row.how}
                          </p>
                        ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      {step.promises.length > 0 && (
        <Section
          testId="promises"
          heading={panelText.resultsPromisesHeading}
          summary={count(step.promises)}
        >
          <div data-testid="results-promises">
            {step.promises.map((row, index) => (
              <p key={index} data-testid="result-promise">
                <strong>{monthLabel(row.month)}. </strong>
                {row.to}: {row.what}. {row.status}.{" "}
                <span className="results-title">
                  {row.heardBy.length > 0
                    ? `${panelText.resultsPromiseHeardBy} ${row.heardBy.join(", ")}.`
                    : panelText.resultsPromiseHeardByNobody}
                </span>
              </p>
            ))}
          </div>
        </Section>
      )}
      {step.deals.length + step.favours.length > 0 && (
        <Section
          testId="deals"
          heading={
            step.deals.length > 0
              ? panelText.resultsDealsHeading
              : panelText.resultsFavoursHeading
          }
          summary={String(step.deals.length + step.favours.length)}
        >
          <div data-testid="results-deals">
            {step.deals.length > 0 && step.favours.length > 0 && (
              <h3>{panelText.resultsDealsHeading}</h3>
            )}
            {step.deals.map((row, index) => (
              <p key={index} data-testid="result-deal">
                <strong>{monthLabel(row.month)}. </strong>
                {row.with}: {row.what}. {row.status}. {row.worth}
              </p>
            ))}
            {step.deals.length > 0 && step.favours.length > 0 && (
              <h3>{panelText.resultsFavoursHeading}</h3>
            )}
            {step.favours.map((line) => (
              <p key={line} data-testid="result-favour">
                {line}
              </p>
            ))}
          </div>
        </Section>
      )}
      {step.threads.length > 0 && (
        <Section
          testId="threads"
          heading={panelText.resultsThreadsHeading}
          summary={count(step.threads)}
        >
          <div data-testid="results-threads">
            {step.threads.map((row, index) => (
              <div key={index} data-testid="result-thread">
                <p>
                  <strong>{monthLabel(row.startedIn)}. </strong>
                  {row.started}
                </p>
                <p>
                  <strong>{monthLabel(row.playedIn)}. </strong>
                  {row.playedOut}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}
      {step.escapes.length > 0 && (
        <Section
          testId="escapes"
          heading={panelText.resultsEscapesHeading}
          summary={count(step.escapes)}
        >
          <div data-testid="results-escapes">
            {step.escapes.map((row, index) => (
              <p
                key={index}
                data-testid="result-escape"
                data-worked={row.worked}
              >
                <strong>{monthLabel(row.month)}. </strong>
                {row.title}: {row.label}.{" "}
                {row.worked
                  ? panelText.resultsEscapeWorked
                  : panelText.resultsEscapeFailed}{" "}
                {row.why.join(" ")}
                <span className="results-title">{row.kind}</span>
              </p>
            ))}
          </div>
        </Section>
      )}
      {step.risks.length > 0 && (
        <Section
          testId="risks"
          heading={panelText.resultsRisksHeading}
          summary={count(step.risks)}
        >
          <div data-testid="results-risks">
            {step.risks.map((row, index) => (
              <p key={index} data-testid="result-risk">
                <strong>{monthLabel(row.addedIn)}. </strong>
                {row.note} {row.fate}
                {row.cameOutIn !== null && (
                  <span className="results-title">{row.motive}</span>
                )}
              </p>
            ))}
          </div>
        </Section>
      )}
      {step.mistakes.length > 0 && (
        <Section
          testId="mistakes"
          heading={panelText.resultsMistakesHeading}
          summary={count(step.mistakes)}
        >
          <ul>
            {step.mistakes.map((row, index) => (
              <li key={index} data-testid="result-mistake">
                <strong>{monthLabel(row.month)}. </strong>
                {row.choice}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section
        testId="milestones"
        heading={panelText.resultsMilestonesHeading}
        summary={
          step.milestones.length === 0
            ? panelText.resultsNone
            : step.milestones.map((row) => row.title).join(", ")
        }
      >
        {step.milestones.length === 0 ? (
          <p>{panelText.resultsNoMilestones}</p>
        ) : (
          <ul>
            {step.milestones.map((row) => (
              <li key={row.title} data-testid="result-milestone">
                <strong>{monthLabel(row.month)}. </strong>
                {row.title}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {step.factEvents.length > 0 && (
        <Section
          testId="fact-events"
          heading={panelText.resultsFactEventsHeading}
          summary={count(step.factEvents)}
        >
          <div data-testid="results-fact-events">
            {step.factEvents.map((event, index) => (
              <p key={index} data-testid="result-fact-event">
                <strong>{monthLabel(event.month)}. </strong>
                {event.note}
                {event.fact !== null && ` ${event.fact}`}
              </p>
            ))}
          </div>
        </Section>
      )}
      {step.played.length > 0 && (
        <Section
          testId="played"
          heading={panelText.resultsPlayedHeading}
          summary={
            [...step.played].sort((a, b) => b.count - a.count)[0]?.family ?? ""
          }
        >
          <table className="results">
            <tbody>
              {step.played.map((row) => (
                <tr key={row.family} data-testid="result-family">
                  <th scope="row">{row.family}</th>
                  <td className="results-kind">{row.count}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <Section
        testId="marks"
        heading={panelText.resultsMarksHeading}
        summary={
          marked.length === 0
            ? panelText.resultsNone
            : panelText.resultsMarksRight
                .replace(
                  "{right}",
                  String(marked.filter((row) => row.correct).length),
                )
                .replace("{marked}", String(marked.length))
        }
      >
        <table className="results">
          <tbody>
            {step.marks.map((row) => (
              <tr key={row.name} data-testid="result-mark">
                <th scope="row">
                  {row.title}
                  <span className="results-title">{row.name}</span>
                </th>
                <td>{row.mark ?? panelText.notebookNoMark}</td>
                <td>{row.truth}</td>
                <td className="results-kind">
                  {row.mark === null
                    ? ""
                    : row.correct
                      ? panelText.resultsMarkRight
                      : panelText.resultsMarkWrong}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section
        testId="claims"
        heading={panelText.resultsClaimsHeading}
        summary={count(step.claims)}
      >
        {step.claims.length === 0 ? (
          <p data-testid="results-no-claims">{panelText.resultsNoClaims}</p>
        ) : (
          <table className="results">
            <tbody>
              {step.claims.map((claim, index) => (
                <tr key={index} data-testid="result-claim">
                  <th scope="row">
                    {claim.source}
                    <span className="results-title">
                      {monthLabel(claim.month)}
                    </span>
                  </th>
                  <td>
                    {claim.text}
                    <span className="results-title">{claim.motive}</span>
                  </td>
                  <td className="results-kind">
                    {claim.verdict}
                    <span className="results-title">{claim.note}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
      {step.clues.length > 0 && (
        <Section
          testId="clues"
          heading={panelText.resultsCluesHeading}
          summary={toldLine(step.told)}
        >
          <table className="results">
            <tbody>
              {step.clues.map((clue, index) => (
                <tr key={index} data-testid="result-clue">
                  <th scope="row">
                    {clue.source}
                    <span className="results-title">
                      {monthsLabel(clue.months)}
                    </span>
                  </th>
                  <td>{clue.text}</td>
                  <td className="results-kind">
                    {clue.verdict}
                    {clue.count > 1 && (
                      <span
                        className="results-title"
                        data-testid="result-clue-count"
                      >
                        {panelText.resultsTimesTold.replace(
                          "{n}",
                          String(clue.count),
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <Section
        testId="charts"
        heading={panelText.resultsChartsHeading}
        summary=""
      >
        <div className="results-charts">
          <div data-testid="results-org-chart">
            <h3>{panelText.orgChartHeading}</h3>
            <Chart entries={orgChart} />
          </div>
          <div data-testid="results-power-map">
            <h3>{panelText.powerMapHeading}</h3>
            <Chart entries={step.powerMap} />
          </div>
        </div>
      </Section>
      {step.changes.length > 0 && (
        <Section
          testId="changes"
          heading={panelText.resultsChangesHeading}
          summary={count(step.changes)}
        >
          <div data-testid="results-changes">
            {step.changes.map((row, index) => (
              <p key={index} data-testid="result-change">
                <strong>{monthLabel(row.month)}. </strong>
                {row.changed}
              </p>
            ))}
          </div>
        </Section>
      )}
    </Panel>
  );
}
