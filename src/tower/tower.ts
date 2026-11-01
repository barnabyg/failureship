import {
  AmbientLight,
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  IcosahedronGeometry,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { fittingsFor, type Fittings, type Part } from "./fittings";
import { floorScenery } from "./scenery";

export interface RoomModel {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  colour: string;
  fittings?: Fittings | undefined;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

type PartMesh = Mesh<BufferGeometry, MeshLambertMaterial>;

const FLOOR_WIDTH = 16;
const FLOOR_DEPTH = 8;
const WALL_HEIGHT = 4.2;
const NO_GLOW = "#000000";
const LIT_GLOW = "#39465a";
const HOVER_GLOW = "#6a7f9c";
const DONE_DIMMING = 0.55;

/**
 * A cutaway of the current floor seen from a fixed camera. It knows about rooms
 * and clicks, and nothing about the rules of the game.
 */
export class Tower {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.1, 200);
  private readonly raycaster = new Raycaster();
  private readonly geometries: Record<Part["shape"], BufferGeometry> = {
    box: new BoxGeometry(1, 1, 1),
    cylinder: new CylinderGeometry(0.5, 0.5, 1, 20),
    cone: new ConeGeometry(0.5, 1, 3),
    blob: new IcosahedronGeometry(0.5, 1),
  };
  /** The solid boxes that clicks land on, so furniture never changes a target. */
  private readonly clickBoxes = new Map<string, Mesh>();
  private readonly furnishings = new Map<string, PartMesh[]>();
  private readonly tops = new Map<string, Vector3>();
  private readonly renderer: WebGLRenderer | null;
  private clickable = new Set<string>();
  private done = new Set<string>();
  private hovered: string | null = null;

  constructor(
    private readonly container: HTMLElement,
    rooms: readonly RoomModel[],
    private readonly onRoomClick: (roomId: string) => void,
  ) {
    this.addParts(floorScenery(FLOOR_WIDTH, FLOOR_DEPTH, WALL_HEIGHT), 0, 0);
    for (const room of rooms) this.addRoom(room);
    this.scene.background = new Color("#20262b");
    this.scene.add(new AmbientLight("#ffffff", 1.5));
    this.scene.add(createSun());
    this.camera.position.set(0, 8.5, 18);
    this.camera.lookAt(0, 2.8, 0);

    this.renderer = createRenderer();
    if (this.renderer) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFShadowMap;
      // Nothing on the floor moves, so the shadows are only drawn once.
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
      container.appendChild(this.renderer.domElement);
      const canvas = this.renderer.domElement;
      canvas.addEventListener("click", this.handleClick);
      canvas.addEventListener("pointermove", this.handleMove);
      canvas.addEventListener("pointerleave", this.handleLeave);
    }
    this.resize();
  }

  /** Sets which rooms respond to the mouse, and how the rest are shown. */
  setRooms(clickable: ReadonlySet<string>, done: ReadonlySet<string>): void {
    this.clickable = new Set(clickable);
    this.done = new Set(done);
    this.updateHover(this.hovered);
    for (const id of this.furnishings.keys()) this.paintRoom(id);
    this.render();
  }

  /** The screen position just above each room, for its label. */
  projectRooms(): Map<string, ScreenPoint> {
    const { clientWidth: width, clientHeight: height } = this.container;
    const points = new Map<string, ScreenPoint>();
    for (const [id, top] of this.tops) {
      const p = top.clone().project(this.camera);
      points.set(id, {
        x: ((p.x + 1) / 2) * width,
        y: ((1 - p.y) / 2) * height,
      });
    }
    return points;
  }

  resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setPixelRatio(window.devicePixelRatio);
    this.renderer?.setSize(width, height);
    this.render();
  }

  dispose(): void {
    if (this.renderer) {
      const canvas = this.renderer.domElement;
      canvas.removeEventListener("click", this.handleClick);
      canvas.removeEventListener("pointermove", this.handleMove);
      canvas.removeEventListener("pointerleave", this.handleLeave);
      canvas.remove();
      this.renderer.dispose();
    }
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        (object.geometry as BufferGeometry).dispose();
        (object.material as Material).dispose();
      }
    });
  }

  /** Builds parts from their data, sharing a material between identical ones. */
  private addParts(parts: readonly Part[], x: number, z: number): PartMesh[] {
    const materials = new Map<string, MeshLambertMaterial>();
    return parts.map((part) => {
      const look = `${part.colour}|${part.glow ?? ""}|${String(part.opacity)}`;
      let material = materials.get(look);
      if (!material) {
        material = new MeshLambertMaterial({
          color: part.colour,
          emissive: part.glow ?? NO_GLOW,
          transparent: part.opacity !== undefined,
          opacity: part.opacity ?? 1,
        });
        material.userData = { colour: part.colour, glow: part.glow ?? NO_GLOW };
        materials.set(look, material);
      }
      const mesh = new Mesh(this.geometries[part.shape], material);
      mesh.scale.set(...part.size);
      mesh.position.set(part.at[0] + x, part.at[1], part.at[2] + z);
      const solid = part.opacity === undefined && part.glow === undefined;
      mesh.castShadow = solid && part.size[1] > 0.03;
      mesh.receiveShadow = part.opacity === undefined;
      this.scene.add(mesh);
      return mesh;
    });
  }

  private addRoom(room: RoomModel): void {
    this.furnishings.set(
      room.id,
      this.addParts(fittingsFor(room), room.x, room.z),
    );
    const clickBox = new Mesh(
      new BoxGeometry(room.width, room.height, room.depth),
      new MeshBasicMaterial(),
    );
    clickBox.position.set(room.x, room.height / 2, room.z);
    clickBox.visible = false;
    clickBox.userData = { roomId: room.id };
    this.scene.add(clickBox);
    this.clickBoxes.set(room.id, clickBox);
    this.tops.set(room.id, new Vector3(room.x, room.height, room.z));
  }

  /** Shows a room as clickable, hovered or done, over its parts' own colours. */
  private paintRoom(id: string): void {
    const glow = new Color(
      id === this.hovered
        ? HOVER_GLOW
        : this.clickable.has(id)
          ? LIT_GLOW
          : NO_GLOW,
    );
    const dimming = this.done.has(id) ? DONE_DIMMING : 1;
    for (const { material } of this.furnishings.get(id) ?? []) {
      const { colour, glow: own } = material.userData as {
        colour: string;
        glow: string;
      };
      material.color.set(colour).multiplyScalar(dimming);
      material.emissive.set(own).multiplyScalar(dimming).add(glow);
    }
  }

  private roomAt(event: MouseEvent): string | null {
    const canvas = event.target as HTMLCanvasElement;
    const bounds = canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const [hit] = this.raycaster.intersectObjects([
      ...this.clickBoxes.values(),
    ]);
    const id = hit?.object.userData.roomId as string | undefined;
    return id !== undefined && this.clickable.has(id) ? id : null;
  }

  private readonly handleClick = (event: MouseEvent) => {
    const id = this.roomAt(event);
    if (id !== null) this.onRoomClick(id);
  };

  private readonly handleMove = (event: MouseEvent) => {
    this.updateHover(this.roomAt(event));
    this.render();
  };

  private readonly handleLeave = () => {
    this.updateHover(null);
    this.render();
  };

  private updateHover(id: string | null): void {
    const previous = this.hovered;
    this.hovered = id !== null && this.clickable.has(id) ? id : null;
    if (previous !== null) this.paintRoom(previous);
    if (this.hovered !== null) this.paintRoom(this.hovered);
    if (this.renderer) {
      this.renderer.domElement.style.cursor =
        this.hovered !== null ? "pointer" : "default";
    }
  }

  private render(): void {
    this.renderer?.render(this.scene, this.camera);
  }
}

function createSun(): DirectionalLight {
  const sun = new DirectionalLight("#fff6e6", 1.9);
  sun.position.set(-6, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  const reach = 14;
  sun.shadow.camera.left = -reach;
  sun.shadow.camera.right = reach;
  sun.shadow.camera.top = reach;
  sun.shadow.camera.bottom = -reach;
  sun.shadow.camera.far = 40;
  return sun;
}

/** Without WebGL the labels still work, so the game stays playable. */
function createRenderer(): WebGLRenderer | null {
  try {
    return new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
}
