import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { House, Element, View, Vec3, Layout } from "./types";
const S = 0.0254;
/** Standing eye height in metres, for walk mode. */
const EYE_HEIGHT = 1.62;
/** How close a walker may get to a surface, in metres. */
const WALL_GAP = 0.32;
/** Walk controls: horizontal movement plus Q/E for changing level. */
const WALK_KEYS: Record<string, string> = {
  w: "forward",
  arrowup: "forward",
  s: "backward",
  arrowdown: "backward",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right",
  e: "up",
  q: "down",
};
export const toWorld = (v: Vec3) =>
  new T.Vector3(v[0] * S, v[2] * S, -v[1] * S);
type Batch = {
  positions: number[];
  normals: number[];
  uvs: number[];
  ids: string[];
  level: string;
  material: string;
  wall: boolean;
};
export class HouseViewer {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, 0.015, 200);
  controls: OrbitControls;
  model = new T.Group();
  materials = new Map<string, T.MeshStandardMaterial>();
  composer: EffectComposer;
  ao: SSAOPass;
  view!: View;
  layout: Layout = "both";
  cutaway = true;
  ceilings = false;
  auto = false;
  mode: "orbit" | "pan" | "walk" = "orbit";
  onSelect: (e: Element | null) => void = () => {};
  onChange: () => void = () => {};
  private lookup: Map<string, Element>;
  private meshes: T.Mesh[] = [];
  private floor: T.Mesh;
  private selection: T.Box3Helper | null = null;
  private dirty = true;
  private keys = new Set<string>();
  private drag: {
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null = null;
  private sun: T.DirectionalLight;
  private hemisphere: T.HemisphereLight;
  private prepared = new Map<string, Map<string, Batch>>();
  private frame = 0;
  private destroyed = false;
  private visibleCount = 0;
  private floorLabels: HTMLButtonElement[] = [];
  private lastFrame = performance.now();
  private walkRestore: {
    cutaway: boolean;
    ceilings: boolean;
    layout: Layout;
  } | null = null;
  constructor(
    private host: HTMLElement,
    public data: House,
  ) {
    this.lookup = new Map(data.elements.map((e) => [e.id, e]));
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setClearColor("#efeee9");
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D house. Drag to orbit, right-drag to pan, and scroll to zoom. Choose a room for an interior view.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.tabIndex = 0;
    host.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.25;
    this.controls.maxDistance = 90;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.addEventListener("change", () => {
      this.dirty = true;
    });
    this.controls.addEventListener("start", () => {
      this.auto = false;
      this.controls.autoRotate = false;
      this.onChange();
    });
    const pmrem = new T.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environmentIntensity = 0.45;
    this.hemisphere = new T.HemisphereLight(0xffffff, 0x9b927d, 1.3);
    this.scene.add(this.hemisphere);
    this.sun = new T.DirectionalLight(0xfff5df, 3.2);
    this.sun.position.set(-9, 25, -4);
    this.sun.target.position.set(6, 0, -8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -22,
      right: 22,
      top: 22,
      bottom: -22,
      near: 0.1,
      far: 70,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    const fill = new T.DirectionalLight(0xdfe9f4, 1);
    fill.position.set(15, 12, -20);
    this.scene.add(fill);
    this.floor = new T.Mesh(
      new T.PlaneGeometry(300, 300),
      new T.ShadowMaterial({ color: 0x536057, opacity: 0.14 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.14;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor, this.model);
    this.composer = new EffectComposer(
      this.renderer,
      new T.WebGLRenderTarget(1, 1, { samples: 4, type: T.HalfFloatType }),
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = new SSAOPass(this.scene, this.camera, 1, 1, 16);
    this.ao.kernelRadius = 0.22;
    this.ao.minDistance = 0.0005;
    this.ao.maxDistance = 0.12;
    this.composer.addPass(this.ao);
    this.composer.addPass(new OutputPass());
    const loader = new T.TextureLoader();
    for (const [key, spec] of Object.entries(data.materials)) {
      const mat = new T.MeshStandardMaterial({
        color: new T.Color().setRGB(
          spec.color[0] / 255,
          spec.color[1] / 255,
          spec.color[2] / 255,
          T.SRGBColorSpace,
        ),
        roughness: Math.max(0.2, spec.roughness),
        metalness: spec.metalness,
        side: T.DoubleSide,
        transparent: spec.opacity < 1,
        opacity: spec.opacity,
        depthWrite: spec.opacity >= 1,
      });
      if (spec.texture) {
        mat.color.set(0xffffff);
        mat.map = loader.load("/model/" + spec.texture, () => {
          this.dirty = true;
        });
        mat.map.colorSpace = T.SRGBColorSpace;
        mat.map.wrapS = mat.map.wrapT = T.RepeatWrapping;
        mat.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      }
      if (key.includes("light")) {
        mat.emissive = mat.color.clone();
        mat.emissiveIntensity = 0.35;
      }
      this.materials.set(key, mat);
    }
    for (const [layout, text] of [
      ["ground", "01 / GROUND FLOOR"],
      ["upper", "02 / UPPER FLOOR"],
    ] as const) {
      const label = document.createElement("button");
      label.className = "floor-label";
      label.textContent = text;
      label.setAttribute("aria-label", "View " + layout + " floor");
      label.onclick = () => {
        this.setView(this.view, layout);
        this.onChange();
      };
      host.append(label);
      this.floorLabels.push(label);
    }
    this.prepare();
    new ResizeObserver(() => this.resize()).observe(host);
    this.bind();
    this.resize();
    this.animate();
  }
  private prepare() {
    for (const e of this.data.elements) {
      const chunks = new Map<string, Batch>();
      const tall =
        Math.max(...e.vertices.map((v) => v[2])) -
          Math.min(...e.vertices.map((v) => v[2])) >
        40;
      const wall =
        [
          "Walls",
          "Openings",
          "Opening details",
          "Window treatments",
          "Door leaves",
          "Trim",
          "Finishes",
        ].includes(e.category) && tall;
      for (let fi = 0; fi < e.faces.length; fi++) {
        const face = e.faces[fi];
        const verts = face.map((i) => new T.Vector3(...e.vertices[i]));
        const n = new T.Vector3();
        // Newell normal remains stable for concave polygons and collinear first edges.
        for (let j = 0; j < verts.length; j++) {
          const a = verts[j],
            b = verts[(j + 1) % verts.length];
          n.x += (a.y - b.y) * (a.z + b.z);
          n.y += (a.z - b.z) * (a.x + b.x);
          n.z += (a.x - b.x) * (a.y + b.y);
        }
        n.normalize();
        const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)];
        const axis = abs.indexOf(Math.max(...abs));
        const axes = [0, 1, 2].filter((a) => a !== axis);
        const points = verts.map(
          (v) =>
            new T.Vector2(v.getComponent(axes[0]), v.getComponent(axes[1])),
        );
        const tris = T.ShapeUtils.triangulateShape(points, []);
        const material = e.face_materials?.[fi] ?? e.material;
        const spec = this.data.materials[material];
        if (!chunks.has(material))
          chunks.set(material, {
            positions: [],
            normals: [],
            uvs: [],
            ids: [],
            level: e.level,
            material,
            wall,
          });
        const batch = chunks.get(material)!;
        for (const tri of tris) {
          const a = verts[tri[0]],
            b = verts[tri[1]],
            c = verts[tri[2]];
          if (
            new T.Vector3()
              .subVectors(b, a)
              .cross(new T.Vector3().subVectors(c, a))
              .dot(n) < 0
          )
            [tri[1], tri[2]] = [tri[2], tri[1]];
          for (const i of tri) {
            const v = verts[i];
            batch.positions.push(v.x * S, v.z * S, -v.y * S);
            batch.normals.push(n.x, n.z, -n.y);
            batch.uvs.push(
              v.getComponent(axes[0]) / (spec?.repeat_inches || 48),
              v.getComponent(axes[1]) / (spec?.repeat_inches || 48),
            );
          }
          batch.ids.push(e.id);
        }
      }
      this.prepared.set(e.id, chunks);
    }
  }
  setView(view: View, layout: Layout = this.layout) {
    this.view = view;
    this.layout = layout;
    this.auto = false;
    this.controls.autoRotate = false;
    this.setMode("orbit");
    this.cutaway = !view.interior;
    this.ceilings = !!view.interior;
    this.rebuild();
    this.reset();
  }
  rebuild() {
    this.clearSelection();
    for (const mesh of this.meshes) {
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
    }
    this.model.clear();
    this.meshes = [];
    const current = this.data.scenes.find((s) => s.scope === this.view.scene);
    const allowed =
      this.view.id === "laundry" ? new Set(current?.visible_ids) : null;
    const batches = new Map<string, Batch>();
    this.visibleCount = 0;
    for (const e of this.data.elements) {
      if (allowed && !allowed.has(e.id)) continue;
      if (!this.view.interior && this.view.id !== "laundry") {
        if (this.layout === "ground" && e.level === "L2") continue;
        if (this.layout === "upper" && e.level !== "L2") continue;
      }
      if (!this.ceilings && ["Ceilings", "Ceiling detail"].includes(e.category))
        continue;
      if (this.cutaway && !this.view.interior && e.category === "Door leaves")
        continue;
      this.visibleCount++;
      for (const chunk of this.prepared.get(e.id)!.values()) {
        const key = [chunk.material, e.level, chunk.wall].join("|");
        if (!batches.has(key))
          batches.set(key, {
            positions: [],
            normals: [],
            uvs: [],
            ids: [],
            level: e.level,
            material: chunk.material,
            wall: chunk.wall,
          });
        const b = batches.get(key)!;
        // No rescaling: inspection view only translates the upper floor as a complete unit.
        const offset =
          this.layout === "both" &&
          !this.view.interior &&
          this.view.id !== "laundry" &&
          e.level === "L2";
        for (let i = 0; i < chunk.positions.length; i += 3)
          b.positions.push(
            chunk.positions[i] + (offset ? 9 : 0),
            chunk.positions[i + 1] -
              (offset ? this.data.derived.upper_floor_z * S : 0),
            chunk.positions[i + 2],
          );
        for (const v of chunk.normals) b.normals.push(v);
        for (const v of chunk.uvs) b.uvs.push(v);
        for (const id of chunk.ids) b.ids.push(id);
      }
    }
    for (const b of batches.values()) {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(b.positions, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(b.normals, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(b.uvs, 2));
      g.computeBoundingSphere();
      const mat = this.materials.get(b.material)!.clone();
      if (this.cutaway && b.wall) {
        const z =
          b.level === "L2" &&
          !(
            this.layout === "both" &&
            !this.view.interior &&
            this.view.id !== "laundry"
          )
            ? this.data.derived.upper_floor_z * S
            : 0;
        mat.clippingPlanes = [new T.Plane(new T.Vector3(0, -1, 0), z + 1.1)];
        mat.clipShadows = true;
      }
      const mesh = new T.Mesh(g, mat);
      mesh.onBeforeRender = (_r, _s, _c, _g, renderMaterial) => {
        if (renderMaterial === this.ao.normalMaterial) {
          renderMaterial.clippingPlanes = mat.clippingPlanes;
          renderMaterial.side = T.DoubleSide;
        }
      };
      mesh.userData.ids = b.ids;
      mesh.castShadow = mat.opacity === 1;
      mesh.receiveShadow = true;
      this.meshes.push(mesh);
      this.model.add(mesh);
    }
    this.floor.visible = !this.view.interior;
    this.hemisphere.intensity = this.view.interior ? 1.9 : 1.3;
    this.scene.environmentIntensity = this.view.interior ? 0.7 : 0.45;
    this.dirty = true;
  }
  reset() {
    const source = this.data.scenes.find((s) => s.scope === this.view.scene);
    if (this.view.interior || this.view.id === "laundry") {
      const eye = this.view.eye ?? source?.camera.eye;
      const target = this.view.target ?? source?.camera.target;
      if (eye && target) {
        this.camera.position.copy(toWorld(eye));
        this.controls.target.copy(toWorld(target));
        this.camera.fov = this.view.id === "bathroom1" ? 72 : 62;
        if (this.view.id === "laundry") {
          this.camera.position
            .sub(this.controls.target)
            .multiplyScalar(0.7)
            .add(this.controls.target);
          this.camera.fov = 42;
        }
      }
    } else {
      const bounds = new T.Box3().setFromObject(this.model);
      const target = bounds.getCenter(new T.Vector3());
      target.y = this.layout === "upper" ? 3.1 : 1;
      const size = bounds.getSize(new T.Vector3());
      const radius = Math.max(size.x * 0.56, size.z * 0.56, size.y * 0.7);
      const fov = (42 * Math.PI) / 180;
      const distance =
        (radius / Math.sin(fov / 2) / Math.min(1, this.camera.aspect)) * 1.13;
      const direction = new T.Vector3(-0.82, 1.08, -1).normalize();
      this.camera.position.copy(target).addScaledVector(direction, distance);
      this.controls.target.copy(target);
      this.camera.fov = 42;
    }
    this.controls.maxPolarAngle = this.view.interior
      ? Math.PI * 0.95
      : Math.PI * 0.49;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.dirty = true;
  }
  setMode(mode: "orbit" | "pan" | "walk") {
    const previous = this.mode;
    this.mode = mode;
    // The cutaway and hidden ceilings exist to inspect the house from outside.
    // Standing inside it needs the room actually enclosed, so walk mode takes
    // over both toggles and hands them back on the way out.
    if (mode === "walk" && previous !== "walk") {
      this.walkRestore = {
        cutaway: this.cutaway,
        ceilings: this.ceilings,
        layout: this.layout,
      };
      // Side-by-side inspection parks the upper floor 9 m away, so Q/E would
      // climb into empty air. Walking needs the house in its true positions.
      const changed =
        this.cutaway || !this.ceilings || this.layout !== "assembled";
      this.cutaway = false;
      this.ceilings = true;
      this.layout = "assembled";
      if (changed) this.rebuild();
      this.stepInside();
      this.standOnFloor();
      this.faceOpenDirection();
    } else if (mode !== "walk" && previous === "walk" && this.walkRestore) {
      const { cutaway, ceilings, layout } = this.walkRestore;
      this.walkRestore = null;
      const changed =
        cutaway !== this.cutaway ||
        ceilings !== this.ceilings ||
        layout !== this.layout;
      this.cutaway = cutaway;
      this.ceilings = ceilings;
      this.layout = layout;
      if (changed) this.rebuild();
    }
    this.controls.enabled = mode !== "walk";
    this.controls.mouseButtons.LEFT =
      mode === "pan" ? T.MOUSE.PAN : T.MOUSE.ROTATE;
    this.controls.touches.ONE = mode === "pan" ? T.TOUCH.PAN : T.TOUCH.ROTATE;
    this.renderer.domElement.style.cursor =
      mode === "walk" ? "crosshair" : "grab";
    this.dirty = true;
  }
  toggleAuto(on: boolean) {
    this.auto = on;
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 0.55;
    this.dirty = true;
  }
  zoom(amount: number) {
    if (this.mode === "walk") {
      this.move(amount > 1 ? "backward" : "forward");
      return;
    }
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(amount)
      .add(this.controls.target);
    this.controls.update();
    this.dirty = true;
  }
  /**
   * Stop a walking step short of whatever it would otherwise pass through.
   * A walker already inside geometry is let go, so a bad start cannot trap them.
   */
  private surfaceAhead(origin: T.Vector3, direction: T.Vector3, far: number) {
    return new T.Raycaster(origin, direction, 0.01, far).intersectObjects(
      this.meshes,
      false,
    )[0];
  }
  /**
   * Resolve a desired walking step against the geometry: stop short of a
   * surface, and when a step is fully blocked, slide along the wall rather than
   * sticking to it — otherwise a walker wedges into the first corner they meet.
   */
  private resolveWalk(desired: T.Vector3) {
    const origin = this.camera.position;
    const distance = desired.length();
    if (distance < 1e-6) return desired;
    const direction = desired.clone().divideScalar(distance);
    const hit = this.surfaceAhead(origin, direction, distance + WALL_GAP);
    // Already inside geometry: let them walk back out rather than trapping them.
    if (!hit || hit.distance < WALL_GAP * 0.5) return desired;
    const room = hit.distance - WALL_GAP;
    if (room > 1e-3) return direction.multiplyScalar(Math.min(distance, room));
    const normal = hit.face?.normal.clone();
    if (!normal) return new T.Vector3();
    normal.y = 0;
    if (normal.lengthSq() < 1e-6) return new T.Vector3();
    normal.normalize();
    const slide = desired
      .clone()
      .sub(normal.multiplyScalar(desired.dot(normal)));
    const slideLength = slide.length();
    if (slideLength < 1e-4) return new T.Vector3();
    const slideDirection = slide.divideScalar(slideLength);
    const blocked = this.surfaceAhead(
      origin,
      slideDirection,
      slideLength + WALL_GAP,
    );
    const slideRoom = blocked ? blocked.distance - WALL_GAP : slideLength;
    if (slideRoom <= 1e-3) return new T.Vector3();
    return slideDirection.multiplyScalar(Math.min(slideLength, slideRoom));
  }
  /** Unit vector for a horizontal movement direction, relative to the camera. */
  private heading(direction: string) {
    const forward = this.camera.getWorldDirection(new T.Vector3());
    forward.y = 0;
    forward.normalize();
    const right = new T.Vector3()
      .crossVectors(forward, new T.Vector3(0, 1, 0))
      .normalize();
    return direction === "forward"
      ? forward
      : direction === "backward"
        ? forward.negate()
        : direction === "right"
          ? right
          : right.negate();
  }
  /**
   * Step a walker to the next storey and stand them on it. Free vertical drift
   * just buries the camera in a floor slab, so the levels are discrete.
   */
  changeLevel(direction: number) {
    const levels = [0, this.upperFloorY];
    const standing = this.camera.position.y - EYE_HEIGHT;
    const next =
      direction > 0
        ? levels.find((level) => level > standing + 0.5)
        : [...levels].reverse().find((level) => level < standing - 0.5);
    if (next === undefined) return false;
    const dy = next + EYE_HEIGHT - this.camera.position.y;
    this.camera.position.y += dy;
    this.controls.target.y += dy;
    // The room directly above is rarely laid out like the one below, so the
    // old heading often arrives pointing into a wall.
    this.faceOpenDirection();
    this.dirty = true;
    return true;
  }
  /** Source elevation of the upper slab, in metres. */
  private get upperFloorY() {
    return this.data.derived.upper_floor_z * S;
  }
  /** Whichever slab the camera is currently above, so walking has a floor. */
  floorUnderCamera() {
    return this.camera.position.y > this.upperFloorY * 0.55
      ? this.upperFloorY
      : 0;
  }
  /**
   * Room cameras are framed from outside the wall, which reads correctly only
   * while the cutaway is on. Walking re-encloses the room, so advance along the
   * view direction until the walker is actually inside it.
   */
  private stepInside() {
    const CLEARANCE = 0.9;
    const direction = this.camera.getWorldDirection(new T.Vector3());
    direction.y = 0;
    direction.normalize();
    const toTarget = this.camera.position.distanceTo(this.controls.target);
    const ahead = new T.Raycaster(
      this.camera.position.clone(),
      direction,
      0.01,
      40,
    ).intersectObjects(this.meshes, false)[0];
    const room = ahead ? ahead.distance - CLEARANCE : toTarget * 0.62;
    const advance = Math.min(toTarget * 0.62, room);
    if (advance > 0.05) this.move("forward", advance);
    else if (ahead && ahead.distance < CLEARANCE)
      this.move("backward", CLEARANCE - ahead.distance);
  }
  /**
   * Room cameras look into a room from its edge, so standing at one and keeping
   * its heading puts a corner in your face. Sweep for the longest clear line and
   * face that instead, preferring the current heading when two are comparable.
   */
  private faceOpenDirection() {
    const origin = this.camera.position.clone();
    const heading = this.camera.getWorldDirection(new T.Vector3());
    heading.y = 0;
    heading.normalize();
    const CAP = 8;
    let best = { score: -1, dot: -1, direction: heading.clone() };
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const direction = new T.Vector3(Math.sin(angle), 0, Math.cos(angle));
      const hit = new T.Raycaster(origin, direction, 0.01, 40).intersectObjects(
        this.meshes,
        false,
      )[0];
      // Cap the reward for openness so a line straight out of the house does
      // not beat a long view down the room it is standing in.
      const score = Math.min(hit ? hit.distance : 40, CAP);
      const dot = direction.dot(heading);
      if (
        score > best.score + 0.3 ||
        (score > best.score - 0.3 && dot > best.dot)
      )
        best = { score, dot, direction };
    }
    this.controls.target.copy(origin).add(best.direction);
    this.camera.lookAt(this.controls.target);
    this.dirty = true;
  }
  /** Drop the camera to standing eye height without changing where it looks. */
  standOnFloor() {
    // Room cameras sit at inspection height, which is not a reliable clue about
    // which storey they belong to. The slab underfoot is, so look for it.
    const down = new T.Raycaster(
      this.camera.position.clone(),
      new T.Vector3(0, -1, 0),
      0.01,
      60,
    ).intersectObjects(this.meshes, false)[0];
    const y = (down ? down.point.y : this.floorUnderCamera()) + EYE_HEIGHT;
    this.controls.target.y += y - this.camera.position.y;
    this.camera.position.y = y;
    this.camera.lookAt(this.controls.target);
    this.dirty = true;
  }
  /** Nudge the view by a fixed amount, for the on-screen camera buttons. */
  orbitBy(azimuth: number, polar: number) {
    if (this.mode === "walk") {
      // Walking turns the head: swing the target around the camera.
      const dir = this.camera.getWorldDirection(new T.Vector3());
      const spherical = new T.Spherical().setFromVector3(dir);
      spherical.theta -= azimuth;
      spherical.phi = T.MathUtils.clamp(
        spherical.phi + polar,
        0.08,
        Math.PI - 0.08,
      );
      this.controls.target
        .copy(this.camera.position)
        .add(dir.setFromSpherical(spherical));
      this.camera.lookAt(this.controls.target);
    } else {
      const offset = this.camera.position.clone().sub(this.controls.target);
      const spherical = new T.Spherical().setFromVector3(offset);
      spherical.theta -= azimuth;
      spherical.phi = T.MathUtils.clamp(
        spherical.phi + polar,
        0.05,
        this.controls.maxPolarAngle,
      );
      this.camera.position
        .copy(this.controls.target)
        .add(offset.setFromSpherical(spherical));
      this.controls.update();
    }
    this.dirty = true;
  }
  move(direction: string, step = 0.25) {
    if (direction === "up" || direction === "down") {
      this.changeLevel(direction === "up" ? 1 : -1);
      return;
    }

    let move = this.heading(direction).multiplyScalar(step);
    if (this.mode === "walk") move = this.resolveWalk(move);
    if (move.lengthSq() < 1e-8) return;
    this.camera.position.add(move);
    this.controls.target.add(move);
    this.dirty = true;
  }
  private bind() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      };
      canvas.focus();
      if (this.mode === "walk") canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (this.mode !== "walk" || !this.drag) return;
      const dx = e.clientX - this.drag.x,
        dy = e.clientY - this.drag.y;
      const dir = this.camera.getWorldDirection(new T.Vector3());
      const spherical = new T.Spherical().setFromVector3(dir);
      spherical.theta -= dx * 0.004;
      spherical.phi = T.MathUtils.clamp(
        spherical.phi + dy * 0.004,
        0.08,
        Math.PI - 0.08,
      );
      dir.setFromSpherical(spherical);
      this.controls.target.copy(this.camera.position).add(dir);
      this.camera.lookAt(this.controls.target);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.dirty = true;
    });
    canvas.addEventListener("pointerup", (e) => {
      if (
        this.drag &&
        Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) <
          5 &&
        this.mode !== "walk"
      )
        this.pick(e.clientX, e.clientY);
      this.drag = null;
    });
    canvas.addEventListener("pointercancel", () => {
      this.drag = null;
    });
    canvas.addEventListener("keydown", (e) => {
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "q",
          "e",
          "Q",
          "E",
          "Shift",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.key)
      ) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        // Held keys accelerate through the animation loop, but a quick tap
        // releases before the next frame, so give the first press its own step.
        if (!this.keys.has(key) && this.mode === "walk" && WALK_KEYS[key])
          this.move(WALK_KEYS[key], 0.18);
        this.keys.add(key);
      }
    });
    canvas.addEventListener("keyup", (e) =>
      this.keys.delete(e.key.toLowerCase()),
    );
    canvas.addEventListener("blur", () => {
      this.keys.clear();
      this.drag = null;
    });
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.host.dispatchEvent(
        new CustomEvent("viewer-error", {
          detail:
            "The 3D graphics session was interrupted. Reload to restore the model; the floor plans remain available.",
        }),
      );
    });
  }
  private pick(x: number, y: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        (-(y - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hits = ray
      .intersectObjects(this.meshes)
      .filter(
        (h) =>
          !(
            h.object as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>
          ).material.clippingPlanes?.some(
            (p) => p.distanceToPoint(h.point) < 0,
          ),
      );
    if (!hits.length) {
      this.clearSelection();
      this.onSelect(null);
      return;
    }
    const h = hits[0];
    const id = h.object.userData.ids[h.faceIndex!];
    const e = this.lookup.get(id)!;
    this.clearSelection();
    const b = new T.Box3().setFromPoints(e.vertices.map(toWorld));
    if (
      this.layout === "both" &&
      !this.view.interior &&
      this.view.id !== "laundry" &&
      e.level === "L2"
    )
      b.translate(new T.Vector3(9, -this.data.derived.upper_floor_z * S, 0));
    this.selection = new T.Box3Helper(b, 0x617969);
    this.scene.add(this.selection);
    this.onSelect(e);
    this.dirty = true;
  }
  clearSelection() {
    if (this.selection) {
      this.scene.remove(this.selection);
      this.selection.geometry.dispose();
      (this.selection.material as T.Material).dispose();
      this.selection = null;
      this.dirty = true;
    }
  }
  private resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
  private animate = () => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.animate);
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.controls.update(dt);
    if (this.mode === "walk") {
      // Holding shift covers ground faster; Q/E change level, which is the
      // only way to reach the upper floor without stair collision.
      const pace = 1.8 * dt * (this.keys.has("shift") ? 2.6 : 1);
      for (const key of this.keys) {
        const direction = WALK_KEYS[key];
        if (direction) this.move(direction, pace);
      }
    }
    if (this.dirty || this.auto) {
      this.composer.render();
      this.positionLabels();
      this.dirty = false;
    }
  };
  private positionLabels() {
    this.floorLabels.forEach((label, i) => {
      const show = this.layout === "both" && this.view?.id === "overview";
      label.hidden = !show;
      if (!show) return;
      const point = new T.Vector3(3.1 + (i ? 9 : 0), 0.2, 0.6).project(
        this.camera,
      );
      label.hidden = point.z > 1 || point.z < -1;
      label.style.left = `${(point.x * 0.5 + 0.5) * this.host.clientWidth}px`;
      label.style.top = `${(-point.y * 0.5 + 0.5) * this.host.clientHeight}px`;
    });
  }
  screenshot() {
    this.composer.render();
    return this.renderer.domElement.toDataURL("image/png");
  }
  stats() {
    return {
      visibleObjects: this.visibleCount,
      meshes: this.meshes.length,
      triangles: this.meshes.reduce(
        (n, m) => n + m.geometry.attributes.position.count / 3,
        0,
      ),
      camera: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      layout: this.layout,
      cutaway: this.cutaway,
      ceilings: this.ceilings,
      view: this.view?.id,
      mode: this.mode,
    };
  }
}
