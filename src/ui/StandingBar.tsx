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
  // An image, not a meter, since a meter has to say its number aloud.
  return (
    <span
      className="standing-bar"
      role="img"
      aria-label={`${standing.label}: ${standing.band}`}
      data-testid={testId}
    >
      <span
        className="standing-marker"
        style={{ left: `${String(percent)}%` }}
      />
    </span>
  );
}
