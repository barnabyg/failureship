import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

export interface RoomModel {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  colour: string;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

const FLOOR_WIDTH = 16;
const FLOOR_DEPTH = 8;
const STOREY_HEIGHT = 4.2;
const STOREYS = 10;

/**
 * A blocked-out cutaway of the tower seen from a fixed camera. It knows about
 * rooms and clicks, and nothing about the rules of the game.
 */
export class Tower {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.1, 200);
  private readonly raycaster = new Raycaster();
  private readonly rooms = new Map<
    string,
    Mesh<BoxGeometry, MeshLambertMaterial>
  >();
  private readonly tops = new Map<string, Vector3>();
  private readonly renderer: WebGLRenderer | null;
  private clickable = new Set<string>();
  private hovered: string | null = null;

  constructor(
    private readonly container: HTMLElement,
    rooms: readonly RoomModel[],
    private readonly onRoomClick: (roomId: string) => void,
  ) {
    this.buildShell();
    for (const room of rooms) this.addRoom(room);
    this.scene.background = new Color("#20262b");
    this.scene.add(new AmbientLight("#ffffff", 1.6));
    const sun = new DirectionalLight("#ffffff", 1.8);
    sun.position.set(-6, 14, 10);
    this.scene.add(sun);
    this.camera.position.set(0, 9.5, 20);
    this.camera.lookAt(0, 2.6, 0);

    this.renderer = createRenderer();
    if (this.renderer) {
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
    for (const [id, mesh] of this.rooms) {
      const lit = clickable.has(id);
      mesh.material.emissive.set(lit ? "#39465a" : "#000000");
      mesh.material.color.set(mesh.userData.colour as string);
      if (done.has(id)) mesh.material.color.multiplyScalar(0.55);
    }
    this.updateHover(this.hovered);
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
        (object.geometry as BoxGeometry).dispose();
        (object.material as MeshLambertMaterial).dispose();
      }
    });
  }

  private buildShell(): void {
    const slab = new BoxGeometry(FLOOR_WIDTH, 0.3, FLOOR_DEPTH);
    const wallColour = "#51585e";
    for (let storey = 0; storey < STOREYS; storey++) {
      const y = storey * STOREY_HEIGHT;
      const ground = new Mesh(
        slab,
        new MeshLambertMaterial({
          color: storey === 0 ? "#5b5f58" : "#3a4045",
        }),
      );
      ground.position.set(0, y - 0.15, 0);
      this.scene.add(ground);
      const back = new Mesh(
        new BoxGeometry(FLOOR_WIDTH, STOREY_HEIGHT, 0.2),
        new MeshLambertMaterial({
          color: storey === 0 ? wallColour : "#2c3236",
        }),
      );
      back.position.set(0, y + STOREY_HEIGHT / 2, -FLOOR_DEPTH / 2);
      this.scene.add(back);
    }
  }

  private addRoom(room: RoomModel): void {
    const mesh = new Mesh(
      new BoxGeometry(room.width, room.height, room.depth),
      new MeshLambertMaterial({ color: room.colour }),
    );
    mesh.position.set(room.x, room.height / 2, room.z);
    mesh.userData = { roomId: room.id, colour: room.colour };
    this.scene.add(mesh);
    this.rooms.set(room.id, mesh);
    this.tops.set(room.id, new Vector3(room.x, room.height, room.z));
  }

  private roomAt(event: MouseEvent): string | null {
    const canvas = event.target as HTMLCanvasElement;
    const bounds = canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const [hit] = this.raycaster.intersectObjects([...this.rooms.values()]);
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
    if (this.hovered !== null) {
      const previous = this.rooms.get(this.hovered);
      previous?.material.emissive.set(
        this.clickable.has(this.hovered) ? "#39465a" : "#000000",
      );
    }
    this.hovered = id !== null && this.clickable.has(id) ? id : null;
    if (this.hovered !== null) {
      this.rooms.get(this.hovered)?.material.emissive.set("#6a7f9c");
    }
    if (this.renderer) {
      this.renderer.domElement.style.cursor =
        this.hovered !== null ? "pointer" : "default";
    }
  }

  private render(): void {
    this.renderer?.render(this.scene, this.camera);
  }
}

/** Without WebGL the labels still work, so the game stays playable. */
function createRenderer(): WebGLRenderer | null {
  try {
    return new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
}
