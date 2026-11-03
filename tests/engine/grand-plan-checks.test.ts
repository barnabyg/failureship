import { describe, expect, it } from "vitest";
import { ContentError, parseContent, type Kind } from "../../src/engine";
import { raw } from "./grand-plan-fixture";

type Raw = ReturnType<typeof raw>;

const refused = (change: (r: Raw) => void) => {
  const written = raw();
  change(written);
  return () => parseContent(written);
};
const firstPlan = (r: Raw) => {
  const [first] = r.grandPlans.plans;
  if (!first) throw new Error("No Plan.");
  return first;
};
/** really, on-paper, with-them and wrong-figures, in that order. */
const way = (r: Raw, i: number) => {
  const found = firstPlan(r).ways[i];
  if (!found) throw new Error("No way.");
  return found;
};

describe("Grand Plans in the data", () => {
  it("accept the fixture's", () => {
    expect(() => parseContent(raw())).not.toThrow();
  });

  it("refuse a Plan completed in appearance that adds no hidden risk", () => {
    expect(
      refused((r) => {
        way(r, 1).sets = ["completed-plan"];
      }),
    ).toThrow(/appearance.*hidden risk/);
  });

  it("refuse a Plan completed in reality that adds one", () => {
    expect(
      refused((r) => {
        way(r, 0).sets = ["completed-plan", "hollow-plan"];
      }),
    ).toThrow(/reality.*hidden risk/);
  });

  it("refuse a Plan that cannot be completed both ways", () => {
    expect(
      refused((r) => {
        const plan = firstPlan(r);
        plan.ways = plan.ways.filter((w) => w.how === "reality");
      }),
    ).toThrow(/in appearance/);
  });

  it("refuse a way of completing it that reads the hidden truth", () => {
    expect(
      refused((r) => {
        way(r, 0).when = { bossIs: "believer" } as unknown as { did: string };
      }),
    ).toThrow(/hidden truth/);
  });

  it("refuse a way that every kind of boss takes alike", () => {
    expect(
      refused((r) => {
        way(r, 0).belief = { believer: 1, incompetent: 1, practitioner: 1 };
      }),
    ).toThrow(/alike/);
  });

  it("refuse a Plan that some kind of boss never counts done, or that every kind counts alike", () => {
    expect(
      refused((r) => {
        for (const w of firstPlan(r).ways) {
          w.counts = w.counts.filter((k) => k !== "believer");
          if (w.counts.length === 0) w.counts = ["incompetent"];
        }
      }),
    ).toThrow(/believer boss counts/);
    const every: Kind[] = ["believer", "incompetent", "practitioner"];
    expect(
      refused((r) => {
        for (const w of firstPlan(r).ways) w.counts = every;
      }),
    ).toThrow(/counted done alike/);
  });

  it("refuse a reaction that names a kind", () => {
    expect(
      refused((r) => {
        way(r, 0).reaction.believer = "Very KIND-BELIEVER of you.";
      }),
    ).toThrow(/names a kind/);
  });

  it("refuse a Plan heard of somewhere that does not exist", () => {
    expect(
      refused((r) => {
        firstPlan(r).heardIn = ["nowhere"];
      }),
    ).toThrow(/nowhere/);
  });

  it("refuse a Plan that lasts less than several months, or longer than the run", () => {
    for (const lasts of [1, 5]) {
      expect(
        refused((r) => {
          firstPlan(r).lasts = lasts;
        }),
      ).toThrow(/lasts/);
    }
  });

  it("refuse a condition that names an unknown Plan", () => {
    expect(
      refused((r) => {
        const told = r.notifications.find((n) => n.id === "next-told");
        if (told) told.when = { planRunning: "no-such-plan" };
      }),
    ).toThrow(ContentError);
  });

  it("refuse a failure Bill that names a place, since the player may have moved on", () => {
    expect(
      refused((r) => {
        firstPlan(r).failed.onPlayer.body = "{boss} blames you.";
      }),
    ).toThrow(/names a place/);
  });

  it("refuse a way that needs someone with nothing to fall back on, or falls back on a way done for real", () => {
    expect(
      refused((r) => {
        delete (way(r, 2) as { otherwise?: string }).otherwise;
      }),
    ).toThrow(/otherwise/);
    expect(
      refused((r) => {
        way(r, 2).otherwise = "really";
      }),
    ).toThrow(/must be a way in appearance/);
  });

  it("refuse a fall-back that puts something else on the official record", () => {
    expect(
      refused((r) => {
        way(r, 3).sets = ["hollow-plan"];
      }),
    ).toThrow(/same on the official record/);
  });

  it("refuse a way with no when that nothing falls back on", () => {
    expect(
      refused((r) => {
        delete (way(r, 1) as { when?: unknown }).when;
      }),
    ).toThrow(/nothing falls back on it/);
  });

  it("refuse a need from someone unknown", () => {
    expect(
      refused((r) => {
        const need = firstPlan(r).needs.from[0];
        if (need) need.character = "nobody";
      }),
    ).toThrow(/unknown Character "nobody"/);
  });
});
