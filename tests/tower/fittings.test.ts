import { describe, expect, it } from "vitest";
import { gameContent } from "../../src/content";
import { fittingsFor, type Part } from "../../src/tower/fittings";
import { floorScenery } from "../../src/tower/scenery";

const EDGE = 0.001;
const { rooms } = gameContent.floor;
const scenery = floorScenery(16, 8, 4.2);

const extent = (part: Part, axis: 0 | 1 | 2): [number, number] => [
  part.at[axis] - part.size[axis] / 2,
  part.at[axis] + part.size[axis] / 2,
];

describe("the furniture on the floor", () => {
  it("furnishes every room on Floor 1", () => {
    for (const room of rooms) {
      expect(room.fittings, room.id).toBeDefined();
    }
  });

  it.each(rooms.map((room) => [room.id, room] as const))(
    "keeps the %s inside the box that clicks land on",
    (_id, room) => {
      for (const part of fittingsFor(room)) {
        const [left, right] = extent(part, 0);
        const [bottom, top] = extent(part, 1);
        const [back, front] = extent(part, 2);
        expect(left).toBeGreaterThanOrEqual(-room.width / 2 - EDGE);
        expect(right).toBeLessThanOrEqual(room.width / 2 + EDGE);
        expect(back).toBeGreaterThanOrEqual(-room.depth / 2 - EDGE);
        expect(front).toBeLessThanOrEqual(room.depth / 2 + EDGE);
        expect(bottom).toBeGreaterThanOrEqual(-EDGE);
        expect(top).toBeLessThanOrEqual(room.height + EDGE);
      }
    },
  );

  it("keeps a room with no fittings as a plain box of its own colour", () => {
    const room = { width: 2, depth: 3, height: 1, colour: "#123456" };
    expect(fittingsFor(room)).toEqual([
      { shape: "box", size: [2, 1, 3], at: [0, 0.5, 0], colour: "#123456" },
    ]);
  });

  it("keeps standing scenery clear of every room", () => {
    const standing = scenery.filter(
      (part) => extent(part, 1)[1] > 0.01 && extent(part, 1)[0] < 3,
    );
    expect(standing.length).toBeGreaterThan(0);
    for (const part of standing) {
      const [left, right] = extent(part, 0);
      const [back, front] = extent(part, 2);
      for (const room of rooms) {
        const overlaps =
          left < room.x + room.width / 2 &&
          right > room.x - room.width / 2 &&
          back < room.z + room.depth / 2 &&
          front > room.z - room.depth / 2;
        expect(overlaps, `${room.id} at ${part.at.join(",")}`).toBe(false);
      }
    }
  });

  it("keeps the scenery inside the building", () => {
    for (const part of scenery) {
      expect(Math.abs(part.at[0]) + part.size[0] / 2).toBeLessThanOrEqual(8.1);
      expect(Math.abs(part.at[2]) + part.size[2] / 2).toBeLessThanOrEqual(4.1);
    }
  });
});
