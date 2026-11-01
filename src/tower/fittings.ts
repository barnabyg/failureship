/** The kinds of place a room can be furnished as. */
export type Fittings =
  | "meeting-room"
  | "kitchen"
  | "desk"
  | "cluttered-desk"
  | "photocopier"
  | "loading-bay"
  | "lift";

/** One solid in a model. Plain data, so the layout can be tested without WebGL. */
export interface Part {
  shape: "box" | "cylinder" | "cone" | "blob";
  /** Width, height and depth. */
  size: readonly [number, number, number];
  /** The centre of the part. */
  at: readonly [number, number, number];
  colour: string;
  /** Light of its own, such as a screen or a warning lamp. */
  glow?: string;
  /** Set for glass. */
  opacity?: number;
}

type Look = Pick<Part, "glow" | "opacity">;

/** A box whose underside is at height y, which is how furniture gets stacked. */
export const box = (
  size: readonly [number, number, number],
  [x, y, z]: readonly [number, number, number],
  colour: string,
  look: Look = {},
): Part => ({
  shape: "box",
  size,
  at: [x, y + size[1] / 2, z],
  colour,
  ...look,
});

/** An upright cylinder whose underside is at height y. */
export const cylinder = (
  diameter: number,
  height: number,
  [x, y, z]: readonly [number, number, number],
  colour: string,
  look: Look = {},
): Part => ({
  shape: "cylinder",
  size: [diameter, height, diameter],
  at: [x, y + height / 2, z],
  colour,
  ...look,
});

/** The same parts somewhere else. */
export const moved = (parts: readonly Part[], dx: number, dz: number): Part[] =>
  parts.map((part) => ({
    ...part,
    at: [part.at[0] + dx, part.at[1], part.at[2] + dz],
  }));

const METAL = "#7d8388";
const DARK_METAL = "#44494d";
const PLASTIC = "#2f3336";
const PAPER = "#ece9df";
const STICKY = "#e6cf5a";
const LEAF = "#55794a";
const POT = "#a0654a";
const SCREEN = "#a6cbe6";
const SCREEN_GLOW = "#4f7596";
const ALARM = "#d8402f";
const ALARM_GLOW = "#a81f12";
const AMBER = "#e0b040";
const AMBER_GLOW = "#6a4e10";

/** Faces the back wall, so its back is to the camera. */
export function officeChair(x: number, z: number): Part[] {
  return [
    cylinder(0.5, 0.04, [x, 0.02, z], PLASTIC),
    cylinder(0.07, 0.4, [x, 0.06, z], METAL),
    box([0.46, 0.07, 0.44], [x, 0.46, z], "#3f4d5c"),
    box([0.44, 0.5, 0.06], [x, 0.56, z + 0.22], "#3f4d5c"),
  ];
}

/** A worktop against the far edge of the room, with a chair pulled up to it. */
export function deskParts(
  width: number,
  depth: number,
  colour: string,
  screenOn: boolean,
): Part[] {
  const topDepth = Math.min(0.8, depth * 0.6);
  const topZ = -depth / 2 + topDepth / 2;
  const screenZ = topZ - topDepth / 2 + 0.16;
  const face = screenOn
    ? { colour: SCREEN, look: { glow: SCREEN_GLOW } }
    : { colour: "#1d2124", look: {} };
  return [
    box([width, 0.05, topDepth], [0, 0.7, topZ], colour),
    box([0.05, 0.7, topDepth - 0.06], [-width / 2 + 0.06, 0, topZ], METAL),
    box([0.05, 0.7, topDepth - 0.06], [width / 2 - 0.06, 0, topZ], METAL),
    box([width - 0.2, 0.36, 0.03], [0, 0.3, topZ - topDepth / 2 + 0.05], METAL),
    box([0.42, 0.58, topDepth - 0.1], [width / 2 - 0.32, 0, topZ], DARK_METAL),
    box([0.26, 0.02, 0.2], [0, 0.75, screenZ], PLASTIC),
    box([0.05, 0.16, 0.05], [0, 0.77, screenZ], PLASTIC),
    box([0.76, 0.46, 0.04], [0, 0.9, screenZ], PLASTIC),
    box([0.68, 0.38, 0.01], [0, 0.94, screenZ + 0.025], face.colour, face.look),
    box([0.48, 0.02, 0.15], [0, 0.75, topZ + 0.16], PLASTIC),
    box([0.06, 0.03, 0.09], [0.34, 0.75, topZ + 0.16], PLASTIC),
    ...officeChair(0, depth / 2 - 0.3),
  ];
}

const mug = (x: number, y: number, z: number, colour: string): Part =>
  cylinder(0.08, 0.1, [x, y, z], colour);

const paperPile = (x: number, y: number, z: number, height: number): Part =>
  box([0.3, height, 0.22], [x, y, z], PAPER);

export function pottedPlant(
  x: number,
  y: number,
  z: number,
  scale: number,
): Part[] {
  const leaves = (size: number, across: number, up: number): Part => ({
    shape: "blob",
    size: [size * scale, size * scale, size * scale],
    at: [x + across * scale, y + up * scale, z],
    colour: LEAF,
  });
  return [
    cylinder(0.16 * scale, 0.14 * scale, [x, y, z], POT),
    leaves(0.26, 0, 0.26),
    leaves(0.17, -0.07, 0.38),
    leaves(0.15, 0.08, 0.36),
  ];
}

/** Everything in its place: a plant, a photo and one neat stack of paper. */
function tidyDesk(room: RoomLike): Part[] {
  const top = 0.75;
  const z = -room.depth / 2 + 0.3;
  return [
    ...deskParts(room.width, room.depth, room.colour, true),
    ...pottedPlant(-room.width / 2 + 0.28, top, z, 1),
    box([0.16, 0.2, 0.02], [-0.62, top, z], "#b89a5e"),
    paperPile(room.width / 2 - 0.34, top, z + 0.2, 0.03),
  ];
}

/** Paper, cold coffee and sticky notes, the desk of someone being asked for things. */
function clutteredDesk(room: RoomLike): Part[] {
  const top = 0.75;
  const z = -room.depth / 2 + 0.26;
  return [
    ...deskParts(room.width, room.depth, room.colour, true),
    paperPile(-room.width / 2 + 0.3, top, z, 0.22),
    paperPile(-room.width / 2 + 0.34, top + 0.22, z + 0.03, 0.1),
    paperPile(-room.width / 2 + 0.34, top, z + 0.34, 0.06),
    paperPile(room.width / 2 - 0.3, top, z, 0.14),
    mug(0.62, top, z + 0.3, "#c9553f"),
    mug(0.76, top, z + 0.12, "#d9d4c5"),
    mug(-0.62, top, z + 0.34, "#5a7f94"),
    box([0.08, 0.08, 0.01], [-0.27, 1.26, z + 0.1], STICKY),
    box([0.08, 0.08, 0.01], [0.27, 1.28, z + 0.1], STICKY),
    box([0.08, 0.08, 0.01], [0.17, 1.3, z + 0.1], "#e59ab0"),
    box(
      [0.44, 0.3, 0.34],
      [-room.width / 2 + 0.3, 0, room.depth / 2 - 0.26],
      "#a98a5f",
    ),
  ];
}

function meetingRoom(room: RoomLike): Part[] {
  const { width: w, depth: d, height: h, colour } = room;
  const glass = { opacity: 0.22 };
  const pale = "#bcd4df";
  const sides = [-1, 1] as const;
  return [
    box([w, 0.01, d], [0, 0, 0], "#46525b"),
    box([w, h, 0.1], [0, 0, -d / 2 + 0.05], colour),
    box([0.1, h, d], [-w / 2 + 0.05, 0, 0], colour),
    box([0.05, h, d], [w / 2 - 0.03, 0, 0], pale, glass),
    box([w * 0.62, h, 0.05], [-w * 0.19, 0, d / 2 - 0.03], pale, glass),
    box([0.06, h, 0.06], [w * 0.12, 0, d / 2 - 0.03], METAL),
    box([0.06, h, 0.06], [w / 2 - 0.03, 0, d / 2 - 0.03], METAL),
    box([w - 0.1, 0.06, 0.06], [0.05, h - 0.06, d / 2 - 0.03], METAL),
    box([1.7, 0.86, 0.03], [0, 0.62, -d / 2 + 0.115], "#f2f1ec"),
    box([1.76, 0.04, 0.07], [0, 0.58, -d / 2 + 0.135], METAL),
    box([0.04, 0.3, 0.005], [-0.55, 0.8, -d / 2 + 0.133], "#3b6fb5"),
    box([0.04, 0.46, 0.005], [-0.3, 0.8, -d / 2 + 0.133], "#3b6fb5"),
    box([0.04, 0.6, 0.005], [-0.05, 0.8, -d / 2 + 0.133], ALARM),
    box([0.5, 0.03, 0.005], [0.45, 1.2, -d / 2 + 0.133], PLASTIC),
    box([0.42, 0.03, 0.005], [0.45, 1.1, -d / 2 + 0.133], PLASTIC),
    box([0.46, 0.03, 0.005], [0.45, 1, -d / 2 + 0.133], PLASTIC),
    box([2.5, 0.06, 1.1], [0, 0.68, 0.1], "#7a5a3f"),
    cylinder(0.12, 0.68, [-0.8, 0, 0.1], DARK_METAL),
    cylinder(0.12, 0.68, [0.8, 0, 0.1], DARK_METAL),
    cylinder(0.26, 0.04, [0, 0.74, 0.1], PLASTIC),
    paperPile(-0.7, 0.74, 0.28, 0.02),
    paperPile(0.68, 0.74, -0.1, 0.02),
    ...[-0.8, 0, 0.8].flatMap((x) =>
      sides.flatMap((side) => meetingChair(x, 0.1 + side * 0.82, side)),
    ),
  ];
}

function meetingChair(x: number, z: number, side: -1 | 1): Part[] {
  return [
    box([0.38, 0.05, 0.36], [x, 0.44, z], "#39424a"),
    box([0.06, 0.44, 0.06], [x, 0, z], METAL),
    box([0.38, 0.38, 0.05], [x, 0.49, z + side * 0.17], "#39424a"),
  ];
}

function kitchen(room: RoomLike): Part[] {
  const { width: w, depth: d, colour } = room;
  const backZ = -d / 2 + 0.33;
  const steel = "#aab0b3";
  const fridgeX = w / 2 - 0.38;
  const counterWidth = w - 0.8;
  const counterX = -w / 2 + counterWidth / 2;
  const unitWidth = counterWidth / 4;
  return [
    box([w, 0.01, d], [0, 0, 0], "#a39c84"),
    box([w, 2.2, 0.06], [0, 0, -d / 2 + 0.03], "#c7c0ab"),
    box([counterWidth, 0.85, 0.56], [counterX, 0, backZ], colour),
    box([counterWidth, 0.04, 0.6], [counterX, 0.85, backZ + 0.01], "#4e4a43"),
    ...[0, 1, 2, 3].map((i) =>
      box(
        [unitWidth - 0.04, 0.72, 0.01],
        [-w / 2 + unitWidth * (i + 0.5), 0.08, backZ + 0.285],
        "#c4b59b",
      ),
    ),
    box([counterWidth, 0.56, 0.3], [counterX, 1.5, -d / 2 + 0.21], colour),
    box([0.56, 0.015, 0.36], [-0.75, 0.885, backZ], steel),
    box([0.03, 0.2, 0.03], [-0.75, 0.89, backZ - 0.2], steel),
    box([0.03, 0.03, 0.14], [-0.75, 1.07, backZ - 0.14], steel),
    box([0.34, 0.5, 0.34], [-0.06, 0.89, backZ], PLASTIC),
    box([0.18, 0.2, 0.01], [-0.06, 1.09, backZ + 0.175], PAPER),
    cylinder(0.05, 0.05, [0.06, 1.3, backZ + 0.17], ALARM, {
      glow: ALARM_GLOW,
    }),
    box([0.48, 0.28, 0.34], [-1.22, 0.89, backZ], "#d8d6cf"),
    box([0.32, 0.2, 0.01], [-1.26, 0.93, backZ + 0.175], "#2b3034"),
    cylinder(0.16, 0.2, [0.3, 0.89, backZ], steel),
    mug(0.48, 0.89, backZ + 0.12, "#c9553f"),
    box([0.7, 1.85, 0.62], [fridgeX, 0, backZ - 0.02], "#e2e1da"),
    box([0.68, 0.015, 0.01], [fridgeX, 1.25, backZ + 0.3], DARK_METAL),
    box([0.03, 0.4, 0.03], [fridgeX - 0.26, 0.76, backZ + 0.31], METAL),
    box([0.03, 0.26, 0.03], [fridgeX - 0.26, 1.34, backZ + 0.31], METAL),
    box([0.12, 0.12, 0.01], [fridgeX + 0.1, 1.5, backZ + 0.3], STICKY),
    box([0.2, 0.14, 0.01], [fridgeX + 0.02, 1.0, backZ + 0.3], PAPER),
    cylinder(1, 0.04, [-0.45, 0.72, 0.6], "#d0c8b2"),
    cylinder(0.08, 0.72, [-0.45, 0, 0.6], METAL),
    cylinder(0.46, 0.03, [-0.45, 0, 0.6], METAL),
    mug(-0.6, 0.76, 0.5, "#5a7f94"),
    ...kitchenStool(-1.08, 0.72),
    ...kitchenStool(0.2, 0.74),
    cylinder(0.36, 0.5, [1.1, 0, 0.9], DARK_METAL),
  ];
}

function kitchenStool(x: number, z: number): Part[] {
  return [
    cylinder(0.32, 0.04, [x, 0.46, z], "#6f5a44"),
    cylinder(0.05, 0.46, [x, 0, z], METAL),
    cylinder(0.26, 0.02, [x, 0, z], METAL),
  ];
}

/** A copier with a jam, and the paper that came out before it gave up. */
function photocopier(room: RoomLike): Part[] {
  const { colour } = room;
  const x = -0.1;
  const z = -0.1;
  const front = z + 0.4;
  return [
    box([1.1, 0.78, 0.8], [x, 0, z], colour),
    box([1.14, 0.08, 0.84], [x, 0.78, z], "#6c7570"),
    box([1.12, 0.02, 0.8], [x, 0.86, z], DARK_METAL),
    box([0.34, 0.05, 0.16], [x + 0.32, 0.86, z + 0.26], PLASTIC),
    cylinder(0.04, 0.02, [x + 0.42, 0.91, z + 0.26], ALARM, {
      glow: ALARM_GLOW,
    }),
    box([0.98, 0.02, 0.01], [x, 0.24, front + 0.005], DARK_METAL),
    box([0.98, 0.02, 0.01], [x, 0.46, front + 0.005], DARK_METAL),
    box([0.2, 0.03, 0.02], [x, 0.34, front + 0.01], METAL),
    box([0.2, 0.03, 0.02], [x, 0.12, front + 0.01], METAL),
    box([0.26, 0.03, 0.44], [x + 0.68, 0.48, z], METAL),
    box([0.22, 0.04, 0.32], [x + 0.68, 0.51, z], PAPER),
    box([0.16, 0.12, 0.02], [x + 0.56, 0.6, z + 0.12], PAPER),
    box([0.34, 0.3, 0.26], [-0.6, 0, 0.4], "#a98a5f"),
    box([0.3, 0.02, 0.22], [0.5, 0, 0.44], PAPER),
    box([0.24, 0.02, 0.3], [0.32, 0, 0.42], PAPER),
  ];
}

/** Hazard tape around a pallet of things that came in and never left. */
function loadingBay(room: RoomLike): Part[] {
  const { width: w, depth: d, colour } = room;
  const pine = "#a58a62";
  const stripes: Part[] = [];
  const count = 10;
  for (let i = 0; i < count; i += 1) {
    const stripe = i % 2 === 0 ? AMBER : "#23262a";
    const across = w / count;
    const x = -w / 2 + across * (i + 0.5);
    stripes.push(box([across, 0.012, 0.1], [x, 0, -d / 2 + 0.05], stripe));
    stripes.push(box([across, 0.012, 0.1], [x, 0, d / 2 - 0.05], stripe));
  }
  return [
    ...stripes,
    box([1.2, 0.04, 1], [-0.25, 0, 0], pine),
    box([1.2, 0.05, 0.12], [-0.25, 0.04, -0.42], "#8e7350"),
    box([1.2, 0.05, 0.12], [-0.25, 0.04, 0], "#8e7350"),
    box([1.2, 0.05, 0.12], [-0.25, 0.04, 0.42], "#8e7350"),
    box([1.2, 0.03, 1], [-0.25, 0.09, 0], pine),
    box([0.55, 0.42, 0.46], [-0.54, 0.12, -0.2], colour),
    box([0.55, 0.42, 0.46], [0.04, 0.12, -0.2], "#a98a5f"),
    box([0.55, 0.42, 0.42], [-0.54, 0.12, 0.26], "#a98a5f"),
    box([0.56, 0.4, 0.46], [-0.4, 0.54, -0.2], "#b79a6d"),
    box([0.1, 0.01, 0.46], [-0.4, 0.94, -0.2], "#d9c9a0"),
    box([0.18, 0.12, 0.01], [0.04, 0.3, 0.035], PAPER),
    box([0.04, 1.05, 0.04], [0.68, 0, -0.1], DARK_METAL),
    box([0.04, 1.05, 0.04], [0.68, 0, 0.14], DARK_METAL),
    box([0.2, 0.03, 0.34], [0.58, 0, 0.02], DARK_METAL),
    cylinder(0.14, 0.05, [0.72, 0.02, -0.14], PLASTIC),
    cylinder(0.14, 0.05, [0.72, 0.02, 0.18], PLASTIC),
  ];
}

/** Doors, a floor indicator and a rope. The arrow points the way up. */
function lift(room: RoomLike): Part[] {
  const { width: w, depth: d, height: h, colour } = room;
  const shaftFront = d / 2 - 0.4;
  const shaftZ = -0.2;
  const doorHeight = 2.4;
  const doorWidth = 0.68;
  const frontZ = shaftFront + 0.03;
  const brushed = "#a9afb4";
  const brass = "#c9a24a";
  const rope = "#8f2b33";
  return [
    box([w, h - 0.12, d - 0.4], [0, 0, shaftZ], colour),
    box([w - 0.3, doorHeight + 0.14, 0.04], [0, 0, frontZ - 0.01], DARK_METAL),
    box(
      [doorWidth, doorHeight, 0.04],
      [-doorWidth / 2 - 0.01, 0, frontZ],
      brushed,
    ),
    box(
      [doorWidth, doorHeight, 0.04],
      [doorWidth / 2 + 0.01, 0, frontZ],
      brushed,
    ),
    box([0.7, 0.2, 0.04], [0, doorHeight + 0.2, frontZ], PLASTIC),
    box([0.14, 0.1, 0.01], [-0.2, doorHeight + 0.25, frontZ + 0.025], AMBER, {
      glow: AMBER_GLOW,
    }),
    box(
      [0.14, 0.03, 0.01],
      [0.15, doorHeight + 0.285, frontZ + 0.025],
      "#5c6166",
    ),
    box([0.1, 0.26, 0.03], [w / 2 - 0.08, 1, frontZ - 0.01], PLASTIC),
    cylinder(0.05, 0.015, [w / 2 - 0.08, 1.12, frontZ + 0.01], ALARM, {
      glow: ALARM_GLOW,
    }),
    {
      shape: "cone",
      size: [0.68, 0.6, 0.5],
      at: [0, doorHeight + 0.75, frontZ + 0.12],
      colour: AMBER,
      glow: AMBER_GLOW,
    },
    box([w, 0.12, d - 0.4], [0, h - 0.12, shaftZ], DARK_METAL),
    cylinder(0.28, 0.02, [-0.6, 0, d / 2 - 0.2], brass),
    cylinder(0.05, 0.86, [-0.6, 0, d / 2 - 0.2], brass),
    cylinder(0.09, 0.08, [-0.6, 0.86, d / 2 - 0.2], brass),
    cylinder(0.28, 0.02, [0.6, 0, d / 2 - 0.2], brass),
    cylinder(0.05, 0.86, [0.6, 0, d / 2 - 0.2], brass),
    cylinder(0.09, 0.08, [0.6, 0.86, d / 2 - 0.2], brass),
    box([1.2, 0.05, 0.05], [0, 0.72, d / 2 - 0.2], rope),
  ];
}

/** The size and colour that a room's fittings are built to. */
type RoomLike = {
  width: number;
  depth: number;
  height: number;
  colour: string;
};

const BUILDERS: Record<Fittings, (room: RoomLike) => Part[]> = {
  "meeting-room": meetingRoom,
  kitchen,
  desk: tidyDesk,
  "cluttered-desk": clutteredDesk,
  photocopier,
  "loading-bay": loadingBay,
  lift,
};

/**
 * What a room contains, centred on the middle of its footprint at floor level.
 * A room with no fittings stays a blocked-out box.
 */
export function fittingsFor(
  room: RoomLike & { fittings?: Fittings | undefined },
): Part[] {
  if (room.fittings) return BUILDERS[room.fittings](room);
  return [box([room.width, room.height, room.depth], [0, 0, 0], room.colour)];
}
