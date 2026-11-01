import {
  box,
  cylinder,
  deskParts,
  moved,
  pottedPlant,
  type Part,
} from "./fittings";

const SLAB = "#2f3230";
const TILE = "#62665d";
const TILE_WORN = "#5b5f57";
const WALL = "#6a7076";
const SIDE_WALL = "#5d6369";
const SKIRTING = "#3c4044";
const METAL = "#7d8388";
const DARK_METAL = "#44494d";
const PAPER = "#ece9df";
const STAIN = "#4a4b42";
const TUBE = "#f2f4ea";
const TUBE_GLOW = "#c9cdbd";

const TILE_SIZE = 2;
const GAP = 0.03;

/** Worn carpet tiles over a concrete slab, with a history you can see. */
function carpet(width: number, depth: number): Part[] {
  const parts: Part[] = [box([width, 0.28, depth], [0, -0.3, 0], SLAB)];
  for (let i = 0; i < width / TILE_SIZE; i += 1) {
    for (let j = 0; j < depth / TILE_SIZE; j += 1) {
      parts.push(
        box(
          [TILE_SIZE - GAP, 0.02, TILE_SIZE - GAP],
          [
            -width / 2 + TILE_SIZE * (i + 0.5),
            -0.02,
            -depth / 2 + TILE_SIZE * (j + 0.5),
          ],
          (i + j) % 2 === 0 ? TILE : TILE_WORN,
        ),
      );
    }
  }
  const stains: readonly (readonly [number, number, number])[] = [
    [1.1, 0.8, 0.9],
    [0.6, -3, 0.4],
    [0.9, 3.8, 0.6],
    [0.45, 1.9, 1.1],
    [0.7, -6.6, 3.2],
    [0.5, 4.9, 3.4],
  ];
  for (const [size, x, z] of stains) {
    parts.push(cylinder(size, 0.004, [x, 0, z], STAIN));
  }
  return parts;
}

function shell(width: number, depth: number, height: number): Part[] {
  const backZ = -depth / 2;
  const parts: Part[] = [
    box([width, height, 0.2], [0, 0, backZ], WALL),
    box([width, 0.16, 0.04], [0, 0, backZ + 0.12], SKIRTING),
    box([0.2, height, depth], [-width / 2, 0, 0], SIDE_WALL),
    box([0.2, height, depth], [width / 2, 0, 0], SIDE_WALL),
  ];
  for (const x of [-6.2, -3.2, 3.2, 6.2]) {
    parts.push(
      box([2.2, 2.1, 0.03], [x, 1.5, backZ + 0.11], "#3f4449"),
      box([2.06, 1.96, 0.02], [x, 1.57, backZ + 0.13], "#b6c7cf", {
        glow: "#4d5e66",
      }),
      box([0.06, 1.96, 0.03], [x, 1.57, backZ + 0.14], "#3f4449"),
      box([2.3, 0.05, 0.12], [x, 1.46, backZ + 0.16], SKIRTING),
    );
  }
  return parts;
}

/** Filing nobody has opened since the last restructure. */
function filingCabinets(x: number, z: number): Part[] {
  return [0, 1, 2].flatMap((i) => {
    const across = x + i * 0.62;
    return [
      box([0.58, 1.32, 0.56], [across, 0, z], i === 1 ? "#6f7a72" : "#7a7f77"),
      ...[0.28, 0.72, 1.1].map((y) =>
        box([0.2, 0.03, 0.03], [across, y, z + 0.29], METAL),
      ),
      ...[0.44, 0.88].map((y) =>
        box([0.54, 0.012, 0.01], [across, y, z + 0.285], DARK_METAL),
      ),
    ];
  });
}

function noticeBoard(x: number, y: number, z: number): Part[] {
  return [
    box([1.3, 0.9, 0.03], [x, y, z], "#a07f58"),
    box([0.34, 0.44, 0.01], [x - 0.36, y + 0.32, z + 0.02], PAPER),
    box([0.3, 0.3, 0.01], [x + 0.08, y + 0.48, z + 0.02], "#e6cf5a"),
    box([0.36, 0.26, 0.01], [x + 0.36, y + 0.14, z + 0.02], PAPER),
    box([0.28, 0.2, 0.01], [x - 0.02, y + 0.12, z + 0.02], "#e59ab0"),
  ];
}

function waterCooler(x: number, z: number): Part[] {
  return [
    box([0.34, 0.95, 0.34], [x, 0, z], "#d9d8d0"),
    box([0.2, 0.03, 0.14], [x, 0.56, z + 0.11], DARK_METAL),
    cylinder(0.3, 0.42, [x, 0.95, z], "#9cc7dd", { opacity: 0.65 }),
  ];
}

function bin(x: number, z: number): Part {
  return cylinder(0.32, 0.46, [x, 0, z], DARK_METAL);
}

/** Strip lights, one of them dead and nobody has reported it. */
function fluorescentTubes(height: number): Part[] {
  const tubes: readonly (readonly [number, number, boolean])[] = [
    [-5.2, -1.8, true],
    [-1.7, -1.8, true],
    [2.8, -1.8, false],
    [5.4, -1.8, true],
  ];
  return tubes.flatMap(([x, z, working]) => [
    box([1.5, 0.05, 0.22], [x, height, z], DARK_METAL),
    box(
      [1.4, 0.03, 0.14],
      [x, height - 0.03, z],
      working ? TUBE : "#6c6e66",
      working ? { glow: TUBE_GLOW } : {},
    ),
    box([0.02, 0.6, 0.02], [x - 0.5, height + 0.05, z], DARK_METAL),
    box([0.02, 0.6, 0.02], [x + 0.5, height + 0.05, z], DARK_METAL),
  ]);
}

/** Everything on the floor that is not a place the player can go. */
export function floorScenery(
  width: number,
  depth: number,
  height: number,
): Part[] {
  return [
    ...carpet(width, depth),
    ...shell(width, depth, height),
    ...filingCabinets(1.9, -3.55),
    ...noticeBoard(-1.8, 1.5, -3.88),
    ...waterCooler(-2.5, -3.5),
    ...pottedPlant(-1.1, 0, -3.45, 3),
    ...pottedPlant(7.4, 0, 0.5, 3.4),
    ...pottedPlant(-7.4, 0, 1.4, 3.4),
    bin(1.5, 0.9),
    bin(-2.75, 1.7),
    ...moved(deskParts(2, 1.2, "#8f8c80", false), -1.65, -0.4),
    ...moved(deskParts(2, 1.2, "#8f8c80", false), 2.9, 0.15),
    ...fluorescentTubes(3.7),
  ];
}
