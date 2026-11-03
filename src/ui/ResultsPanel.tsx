import { panelText } from "../content";
import type { ChartEntry, StepView } from "../engine";
import { Chart } from "./Chart";
import { monthLabel } from "./Notebook";
import { Panel } from "./Panel";
import { StandingBar } from "./StandingBar";

export function ResultsPanel({
  step,
  orgChart,
}: {
  step: Extract<StepView, { kind: "results" }>;
  orgChart: readonly ChartEntry[];
}) {
  return (
    <Panel testId="panel-results" title={step.title} wide>
      <p>{step.intro}</p>
      {step.ending.text !== null && (
        <p className="callout" data-testid="results-ending">
          {step.ending.text}
        </p>
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
        <div data-testid="result-vacancies">
          <h3>{panelText.resultsVacanciesHeading}</h3>
          {step.vacancies.map((vacancy) => (
            <p key={vacancy.month} data-testid="result-vacancy">
              {vacancy.text} <strong>{panelText.decidedOnPaper}: </strong>
              {vacancy.onPaper}. <strong>{panelText.decidedInFact}: </strong>
              {vacancy.inFact}
            </p>
          ))}
        </div>
      )}
      <h3>{panelText.resultsMilestonesHeading}</h3>
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
      {step.mistakes.length > 0 && (
        <>
          <h3>{panelText.resultsMistakesHeading}</h3>
          <ul>
            {step.mistakes.map((row, index) => (
              <li key={index} data-testid="result-mistake">
                <strong>{monthLabel(row.month)}. </strong>
                {row.choice}
              </li>
            ))}
          </ul>
        </>
      )}
      {step.promises.length > 0 && (
        <div className="callout" data-testid="results-promises">
          <h3>{panelText.resultsPromisesHeading}</h3>
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
      )}
      <div className="callout" data-testid="results-grand-plans">
        <h3>{panelText.resultsGrandPlansHeading}</h3>
        {step.grandPlans.length === 0 && <p>{panelText.resultsNoGrandPlans}</p>}
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
      <div className="callout" data-testid="results-rivals">
        <h3>{panelText.resultsRivalsHeading}</h3>
        {step.rivals.length === 0 && <p>{panelText.resultsNoRivals}</p>}
        {step.rivals.map((row) => (
          <div key={row.name} data-testid="result-rival">
            <p>
              <strong>
                {row.title}, {row.name}.{" "}
              </strong>
              {row.competed.join(". ")}.{" "}
              <span className="results-title">
                {panelText.resultsRivalSince.replace("{n}", String(row.since))}
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
      {step.changed.length > 0 && (
        <div className="callout" data-testid="results-changed">
          <h3>{panelText.resultsChangedHeading}</h3>
          {step.changed.map((row) => (
            <p key={row.name} data-testid="result-changed">
              <strong>{monthLabel(row.month)}. </strong>
              {row.title}, {row.name}: {row.from}. {row.to}.{" "}
              <span className="results-title">{row.why.join(" ")}</span>
            </p>
          ))}
        </div>
      )}
      {step.deals.length + step.favours.length > 0 && (
        <div className="callout" data-testid="results-deals">
          {step.deals.length > 0 && <h3>{panelText.resultsDealsHeading}</h3>}
          {step.deals.map((row, index) => (
            <p key={index} data-testid="result-deal">
              <strong>{monthLabel(row.month)}. </strong>
              {row.with}: {row.what}. {row.status}. {row.worth}
            </p>
          ))}
          {step.favours.length > 0 && (
            <h3>{panelText.resultsFavoursHeading}</h3>
          )}
          {step.favours.map((line) => (
            <p key={line} data-testid="result-favour">
              {line}
            </p>
          ))}
        </div>
      )}
      {step.threads.length > 0 && (
        <div className="callout" data-testid="results-threads">
          <h3>{panelText.resultsThreadsHeading}</h3>
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
      )}
      {step.risks.length > 0 && (
        <div className="callout" data-testid="results-risks">
          <h3>{panelText.resultsRisksHeading}</h3>
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
      )}
      <h3>{panelText.resultsWhoHeading}</h3>
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
      {step.played.length > 0 && (
        <>
          <h3>{panelText.resultsPlayedHeading}</h3>
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
        </>
      )}
      <h3>{panelText.resultsMarksHeading}</h3>
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
      <div className="callout" data-testid="results-boss">
        <h3>{panelText.resultsBossHeading}</h3>
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
      {step.boss.head !== null && (
        <div className="callout" data-testid="results-head">
          <h3>{panelText.resultsHeadHeading}</h3>
          <p>
            {step.boss.head.title}, {step.boss.head.name}:{" "}
            <strong data-testid="result-head-kind">
              {step.boss.head.kind}
            </strong>
          </p>
          <p data-testid="result-head-verdict">{step.boss.head.verdict}</p>
        </div>
      )}
      {step.factEvents.length > 0 && (
        <div className="callout" data-testid="results-fact-events">
          <h3>{panelText.resultsFactEventsHeading}</h3>
          {step.factEvents.map((event, index) => (
            <p key={index} data-testid="result-fact-event">
              <strong>{monthLabel(event.month)}. </strong>
              {event.note}
              {event.fact !== null && ` ${event.fact}`}
            </p>
          ))}
        </div>
      )}
      <h3>{panelText.resultsClaimsHeading}</h3>
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
      {step.clues.length > 0 && (
        <>
          <h3>{panelText.resultsCluesHeading}</h3>
          <table className="results">
            <tbody>
              {step.clues.map((clue, index) => (
                <tr key={index} data-testid="result-clue">
                  <th scope="row">
                    {clue.source}
                    <span className="results-title">
                      {monthLabel(clue.month)}
                    </span>
                  </th>
                  <td>{clue.text}</td>
                  <td className="results-kind">{clue.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
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
      {step.beliefs.length > 0 && (
        <>
          <h3>{panelText.resultsBeliefsHeading}</h3>
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
        </>
      )}
      {step.changes.length > 0 && (
        <div className="callout" data-testid="results-changes">
          <h3>{panelText.resultsChangesHeading}</h3>
          {step.changes.map((row, index) => (
            <p key={index} data-testid="result-change">
              <strong>{monthLabel(row.month)}. </strong>
              {row.changed}
            </p>
          ))}
        </div>
      )}
    </Panel>
  );
}
