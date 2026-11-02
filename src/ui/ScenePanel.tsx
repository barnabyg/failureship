import { panelText } from "../content";
import type { Choice, StepView } from "../engine";
import { Panel, Stakes } from "./Panel";

export function ScenePanel({
  step,
  onChoose,
}: {
  step: Extract<StepView, { kind: "scene" }>;
  onChoose: (choice: Choice) => void;
}) {
  return (
    <Panel testId="panel-scene" eyebrow={step.location} title={step.title} wide>
      <div className="scene-columns">
        <div>
          {step.narration.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <h3>{panelText.castHeading}</h3>
          <ul className="cast">
            {step.cast.map((person) => (
              <li key={person.name}>
                <strong>{person.title}</strong>, {person.name}
              </li>
            ))}
          </ul>
          <h3>{panelText.signsHeading}</h3>
          <dl className="signs">
            {step.signs.map((sign) => (
              <div key={sign.label} data-testid="sign">
                <dt>{sign.label}</dt>
                <dd>{sign.text}</dd>
              </div>
            ))}
          </dl>
          {step.behaviours.length + step.regard.length > 0 && (
            <>
              <h3>{panelText.behavioursHeading}</h3>
              <ul className="signs behaviours">
                {step.behaviours.map((shown) => (
                  <li key={shown.who} data-testid="behaviour">
                    {shown.text}
                  </li>
                ))}
                {step.regard.map((shown) => (
                  <li key={`regard-${shown.who}`} data-testid="regard">
                    {shown.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div>
          {step.treatment !== null && (
            <>
              <h3>{panelText.treatmentHeading}</h3>
              <p className="signs" data-testid="treatment">
                {step.treatment}
              </p>
            </>
          )}
          {step.headTreatment !== null && (
            <>
              <h3>{panelText.headTreatmentHeading}</h3>
              <p className="signs" data-testid="head-treatment">
                {step.headTreatment}
              </p>
            </>
          )}
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
