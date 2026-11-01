import type { Content } from "./content";
import type { State } from "./state";

/** What a choice or an event can say about the Project. */
export interface ProjectChange {
  real?: string | undefined;
  reported?: string | undefined;
}

export function moveProject(
  state: State,
  content: Content,
  change: ProjectChange = {},
): void {
  const { statuses } = content.project;
  const { project } = state;
  const moved = (from: string, to: string | undefined): string => {
    const index = statuses.findIndex((s) => s.id === from);
    if (to === "better") return statuses[Math.max(index - 1, 0)]?.id ?? from;
    if (to === "worse") {
      return statuses[Math.min(index + 1, statuses.length - 1)]?.id ?? from;
    }
    if (to === "real") return project.real;
    return to ?? from;
  };
  project.real = moved(project.real, change.real);
  const was = project.reported;
  project.reported = moved(was, change.reported);
  const at = content.project.flagged?.at;
  if (project.reported === at && was !== at) project.flagged = true;
}
