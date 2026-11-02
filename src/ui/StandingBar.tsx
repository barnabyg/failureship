import type { PlayerView } from "../engine";

type Standing = NonNullable<PlayerView["standing"]>;

/**
 * Official standing, as a bar from red through amber to green. It shows no
 * number, so that it is not a score to fill, and says only its band aloud.
 */
export function StandingBar({
  standing,
  testId,
}: {
  standing: Pick<Standing, "label" | "at" | "band">;
  testId: string;
}) {
  const percent = Math.round(standing.at * 100);
  return (
    <span
      className="standing-bar"
      role="meter"
      aria-label={standing.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={standing.band}
      data-testid={testId}
    >
      <span
        className="standing-marker"
        style={{ left: `${String(percent)}%` }}
      />
    </span>
  );
}
