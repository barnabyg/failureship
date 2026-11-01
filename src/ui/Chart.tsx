import type { ChartEntry } from "../engine";

function Branch({
  entries,
  above,
}: {
  entries: readonly ChartEntry[];
  above: string | null;
}) {
  const here = entries.filter((e) => e.reportsTo === above);
  if (here.length === 0) return null;
  return (
    <ul className="chart">
      {here.map((person) => (
        <li key={person.name}>
          <strong>{person.name}</strong>
          <span className="chart-title">{person.title}</span>
          <Branch entries={entries} above={person.name} />
        </li>
      ))}
    </ul>
  );
}

/** A hierarchy drawn as nested lists, for the Org Chart or the Power Map. */
export function Chart({ entries }: { entries: readonly ChartEntry[] }) {
  return <Branch entries={entries} above={null} />;
}
