import { panelText } from "../content";
import type { Choice, ScenePerson, SceneSign, StepView } from "../engine";
import { Panel, Stakes } from "./Panel";

/** A sign from What you notice: the only thing in the Scene in a grey box. */
function Sign({ sign }: { sign: SceneSign }) {
  return (
    <div className="scene-sign" data-testid="sign">
      <span className="scene-sign-label">{sign.label}</span> {sign.text}
    </div>
  );
}

const WITH_YOU_TEST_ID = {
  boss: "treatment",
  head: "head-treatment",
} as const;

/**
 * Everything seen of one Character, led by their role, with the name smaller:
 * one line, with how they are with you folded in, except for the bosses, who
 * say it on a line of its own.
 */
function PersonRow({ person }: { person: ScenePerson }) {
  const { behaviour, withYou, place } = person;
  const regard = place === null && withYou !== null && (
    <span data-testid="regard">{withYou}</span>
  );
  return (
    <li
      className={place ? "scene-person scene-boss" : "scene-person"}
      data-testid="person"
    >
      <div className="scene-person-who">
        <strong>{person.title}</strong>
        <span className="scene-person-name">{person.name}</span>
      </div>
      <div className="scene-person-seen">
        {behaviour !== null ? (
          <p data-testid="behaviour">
            {behaviour}
            {regard && <> {regard}</>}
          </p>
        ) : (
          regard && <p>{regard}</p>
        )}
        {place && withYou !== null && (
          <p data-testid={WITH_YOU_TEST_ID[place]}>
            <span className="scene-with-you">{panelText.withYouLabel}</span>{" "}
            {withYou}
          </p>
        )}
        {person.signs.map((sign) => (
          <Sign key={sign.label} sign={sign} />
        ))}
      </div>
    </li>
  );
}

/** Someone with nothing telling to show this time has no row. */
function shows(person: ScenePerson): boolean {
  return (
    person.behaviour !== null ||
    person.withYou !== null ||
    person.signs.length > 0
  );
}

export function ScenePanel({
  step,
  onChoose,
}: {
  step: Extract<StepView, { kind: "scene" }>;
  onChoose: (choice: Choice) => void;
}) {
  return (
    <Panel testId="panel-scene" eyebrow={step.location} title={step.title} wide>
      <div className="scene">
        <div className="scene-body">
          {step.narration.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {step.signs.length > 0 && (
            <>
              <h3>{panelText.signsHeading}</h3>
              <div className="scene-signs">
                {step.signs.map((sign) => (
                  <Sign key={sign.label} sign={sign} />
                ))}
              </div>
            </>
          )}
          <h3>{panelText.castHeading}</h3>
          <ul className="scene-people">
            {step.people.filter(shows).map((person) => (
              <PersonRow key={person.name} person={person} />
            ))}
          </ul>
        </div>
        <div className="scene-choices">
          <h3>{panelText.optionsHeading}</h3>
          <div className="options">
            {step.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="option"
                data-testid={`scene-option-${option.id}`}
                onClick={() => {
                  onChoose({
                    type: "scene",
                    sceneId: step.id,
                    optionId: option.id,
                  });
                }}
              >
                {option.label}
                <Stakes text={option.stakes} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
