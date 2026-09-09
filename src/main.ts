import "./style.css";
import {
  createIcons,
  House,
  Box,
  ArrowUpRight,
  ArrowDownToLine,
  Layers3,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  Move,
  Orbit,
  Footprints,
  ChevronRight,
  ChevronLeft,
  Camera,
  Check,
  FileText,
  X,
  Info,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Menu,
  PanelRightClose,
  Expand,
  ExternalLink,
  LoaderCircle,
  MoveUpRight,
  RotateCw,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Undo2,
} from "lucide";
import { HouseViewer } from "./viewer";
import { views } from "./views";
import type { House as HouseData, Layout, Element, View } from "./types";
const icons = {
  House,
  Box,
  ArrowUpRight,
  ArrowDownToLine,
  Layers3,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  Move,
  Orbit,
  Footprints,
  ChevronRight,
  ChevronLeft,
  Camera,
  Check,
  FileText,
  X,
  Info,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Menu,
  PanelRightClose,
  Expand,
  ExternalLink,
  LoaderCircle,
  MoveUpRight,
  RotateCw,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Undo2,
};
const icon = (name: string) =>
  `<i data-lucide="${name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}" aria-hidden="true"></i>`;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const all = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelectorAll<T>(selector);
const paintIcons = () => createIcons({ icons, attrs: { "stroke-width": 1.6 } });
let viewer: HouseViewer | null = null;
let activeView = views[0];
let page = "explorer";
let planLevel = 1;
let planZoom = 1;
let modelReady = false;
$("#app").innerHTML = `
 <header class="topbar">
  <a href="#" class="brand" aria-label="5476 Maryland home">${icon("House")}<span><strong>5476</strong><span class="brand-name"> MARYLAND</span><small>THE HOUSE EXPLORER</small></span></a>
  <nav class="main-nav" aria-label="Main navigation"><button data-page="explorer" aria-label="3D explorer" class="active">${icon("Box")}<span>3D explorer</span></button><button data-page="plans" aria-label="Floor plans">${icon("Layers3")}<span>Floor plans</span></button></nav>
 </header>
 <main class="workspace">
  <section class="stage" aria-label="Property viewer">
   <div id="viewport"></div>
   <div class="stage-heading" id="stage-heading"><div class="eyebrow"><span class="status-dot"></span>5476 S MARYLAND PARKWAY</div><h1 id="view-title">The whole picture.</h1><p id="view-subtitle">Two levels. One home.</p></div>
   <div class="view-tag" id="view-tag">${icon("Box")} EXISTING CONDITIONS <span>V9.4</span></div>
   <div id="loading" role="status"><div class="loading-icon">${icon("Box")}</div><h2>Opening the house.</h2><p>Loading the V9.4 model and materials <span id="loading-percent"></span></p><div class="loading-track indeterminate" id="loading-track"><div id="loading-fill"></div></div></div>
   <div id="viewer-error" hidden role="alert"></div>
   <div class="floor-switch" id="floor-switch" role="group" aria-label="Floor view"><button data-layout="both" class="active">Both floors</button><button data-layout="ground">Ground</button><button data-layout="upper">Upper</button><button data-layout="assembled" title="Both floors in their source positions">${icon("Layers3")} Assembled</button></div>
   <div class="layout-caption" id="layout-caption"><span class="tiny-line"></span> FLOORS SHOWN SIDE BY SIDE <span class="caption-detail">Upper floor offset for inspection</span></div>
   <div class="viewer-bottom" id="viewer-bottom">
    <div class="gesture-hint"><span class="mouse-icon"></span><span id="gesture-text">Drag to orbit <span>·</span> Scroll to zoom<br><small>Right-drag to pan · Click an object to inspect</small></span></div>
    <div class="tools-wrap"><div class="mode-tools" role="group" aria-label="Navigation mode"><button data-mode="orbit" class="active">${icon("Orbit")} Orbit</button><button data-mode="pan">${icon("Move")} Pan</button><button data-mode="walk">${icon("Footprints")} Walk</button></div><div class="camera-tools"><button id="turn-left" title="Turn left" aria-label="Turn left">${icon("RotateCcw")}</button><button id="turn-right" title="Turn right" aria-label="Turn right">${icon("RotateCw")}</button><button id="tilt-up" title="Tilt up" aria-label="Tilt up">${icon("ChevronUp")}</button><button id="tilt-down" title="Tilt down" aria-label="Tilt down">${icon("ChevronDown")}</button><span class="divider"></span><button id="zoom-out" title="Zoom out" aria-label="Zoom out">${icon("Minus")}</button><button id="zoom-in" title="Zoom in" aria-label="Zoom in">${icon("Plus")}</button><span class="divider"></span><button id="reset" title="Reset viewpoint" aria-label="Reset viewpoint">${icon("Undo2")}</button><span class="divider"></span><button id="capture" title="Save current view as PNG" aria-label="Save current view as PNG">${icon("Camera")}</button><button id="fullscreen" title="Fullscreen viewer" aria-label="Fullscreen viewer">${icon("Maximize")}</button></div></div>
   </div>
   <div id="walk-pad" hidden><button data-step="forward" aria-label="Walk forward">${icon("ArrowUp")}</button><div><button data-step="left" aria-label="Walk left">${icon("ArrowLeft")}</button><button data-step="backward" aria-label="Walk backward">${icon("ArrowDown")}</button><button data-step="right" aria-label="Walk right">${icon("ArrowRight")}</button></div><div class="walk-vertical"><button data-step="down" aria-label="Move down a level">${icon("ChevronDown")} Down</button><button data-step="up" aria-label="Move up a level">${icon("ChevronUp")} Up</button></div><span>Drag to look · WASD to move · Q/E up &amp; down</span></div>
   <div id="selection" hidden><button id="close-selection" aria-label="Close object details">${icon("X")}</button><span class="eyebrow">MODEL DETAIL</span><h3 id="object-name"></h3><p id="object-meta"></p><p id="object-note"></p><small id="object-source"></small></div>
   <section id="plans-panel" hidden aria-label="Dimensioned floor plans"><div class="content-heading"><span class="eyebrow">THE DRAWINGS</span><h1>A plan for every level.</h1><p>Original V9.4 dimensioned plans, directly from the handover.</p></div><div class="plan-toolbar"><div class="segmented"><button data-plan="1" class="active">01 Ground floor</button><button data-plan="2">02 Upper floor</button></div><div class="plan-zoom"><button id="plan-minus" aria-label="Zoom out plan">${icon("Minus")}</button><button id="plan-fit">Fit</button><button id="plan-plus" aria-label="Zoom in plan">${icon("Plus")}</button></div></div><div class="plan-scroll"><img id="plan-image" src="/plans/level-1.png" alt="V9.4 dimensioned ground floor plan with garage, kitchen, powder room, stairs, living area and patio"/></div><p class="plan-footnote">Dimensions retain the handover’s provisional status. Use the source PDF for the drawing scale.</p></section>
  </section>
  <aside class="sidebar" id="sidebar" aria-label="Explore the house">
   <div class="sidebar-top"><div><span class="eyebrow">MAKE YOURSELF AT HOME</span><h2>Explore the house.</h2></div><button id="close-sidebar" class="mobile-only" aria-label="Close spaces menu">${icon("X")}</button></div>
   <div class="sidebar-tabs" role="group" aria-label="Sidebar section"><button class="active" data-side="spaces">Spaces <span>13</span></button><button data-side="about">About the model</button></div>
   <div id="spaces-content"><div class="spaces-list">${views.map((v, i) => `${i === 1 ? '<div class="list-label">01 / GROUND FLOOR</div>' : i === 6 ? '<div class="list-label">02 / UPPER FLOOR</div>' : i === 12 ? '<div class="list-label">03 / OUTSIDE</div>' : ""}<button class="space-row ${i === 0 ? "active" : ""}" data-view="${v.id}" aria-pressed="${i === 0}"><span class="space-index">${i === 0 ? icon("House") : String(i).padStart(2, "0")}</span><span>${i === 0 ? "Whole house" : v.title}</span>${icon("ArrowUpRight")}</button>`).join("")}</div></div>
   <div id="about-content" hidden><h3>Built from the handover.</h3><p id="about-source">The viewer uses the current model’s vertices, materials and room cameras.</p><div class="about-metric"><strong id="about-source-count">—</strong><span>objects in the native source</span></div><div class="about-metric"><strong id="about-web-count">—</strong><span>current existing-condition objects in this viewer</span></div><div id="revision-note" class="revision-note" hidden></div><p>Historical geometry, superseded details, temporary staging and unbuilt shower glass are excluded.</p><h3>What remains approximate</h3><p>Shell depth, stair rise/run, floor registration, some bathroom dimensions and the hall recess position require field confirmation. Finishes and presentation lighting are illustrative.</p></div>
   <div class="display-controls" id="display-controls"><div class="control-label">DISPLAY</div><label class="toggle-row on">${icon("Box")}<span>Cutaway walls</span><input type="checkbox" id="cutaway" checked/><span class="switch"></span></label><label class="toggle-row">${icon("Layers3")}<span>Show ceilings</span><input type="checkbox" id="ceilings"/><span class="switch"></span></label><label class="toggle-row">${icon("Orbit")}<span>Auto rotate</span><input type="checkbox" id="auto"/><span class="switch"></span></label></div>
   <div class="sidebar-bottom"><div class="property-facts"><div><strong>02</strong><span>Levels</span></div><div><strong>02</strong><span>Bedrooms</span></div><div><strong>V9.4</strong><span>Handover</span></div></div><p id="view-note">${views[0].note}</p><button class="source-note" id="model-note">${icon("Info")} Provisional existing conditions ${icon("ArrowUpRight")}</button></div>
  </aside>
 </main>
 <footer class="footer"><span><span class="status-dot"></span> 5476 S MARYLAND PKWY <span class="footer-divider">/</span> EXISTING HOUSE</span><span class="footer-middle">A closer look at the place you call home.</span><button id="footer-files">VIEW FLOOR PLANS ${icon("ArrowUpRight")}</button></footer>
 <button class="mobile-spaces" id="mobile-spaces">${icon("Menu")} Explore spaces <span>13</span></button>

 <div id="toast" role="status" hidden></div>`;
paintIcons();
function setPage(next: string) {
  page = next;
  all("[data-page]").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
    b.setAttribute("aria-current", b.dataset.page === page ? "page" : "false");
  });
  $("#plans-panel").hidden = page !== "plans";
  for (const id of [
    "viewport",
    "stage-heading",
    "view-tag",
    "floor-switch",
    "layout-caption",
    "viewer-bottom",
    "display-controls",
  ])
    $("#" + id).hidden = page !== "explorer";
  $("#loading").hidden = page !== "explorer" || modelReady;
  $("#selection").hidden = true;
  $("#walk-pad").hidden = true;
  if (viewer) {
    viewer.toggleAuto(false);
    $<HTMLInputElement>("#auto").checked = false;
    if (page === "explorer") syncControls();
  }
  $("#sidebar").classList.remove("open");
}
function syncControls() {
  if (!viewer) return;
  for (const [id, value] of [
    ["cutaway", viewer.cutaway],
    ["ceilings", viewer.ceilings],
    ["auto", viewer.auto],
  ] as const)
    $<HTMLInputElement>("#" + id).checked = value;
  all("[data-layout]").forEach((b) => {
    b.classList.toggle("active", b.dataset.layout === viewer!.layout);
    b.setAttribute("aria-pressed", String(b.dataset.layout === viewer!.layout));
  });
  all("[data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === viewer!.mode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === viewer!.mode));
  });
  // Walk mode takes the display toggles over, so the switches have to follow
  // the viewer rather than only the other way round.
  const toggles: [string, boolean][] = [
    ["cutaway", viewer.cutaway],
    ["ceilings", viewer.ceilings],
    ["auto", viewer.auto],
  ];
  for (const [id, on] of toggles) {
    const input = $<HTMLInputElement>("#" + id);
    input.checked = on;
    const row = input.closest(".toggle-row");
    row?.classList.toggle("on", on);
    if (id === "auto") continue;
    const held =
      viewer.mode === "walk" || (id === "cutaway" && !!activeView.interior);
    row?.classList.toggle("locked", held);
    input.disabled = held;
  }
  $("#floor-switch").hidden =
    page !== "explorer" || activeView.id !== "overview";
  $("#walk-pad").hidden = page !== "explorer" || viewer.mode !== "walk";
  const both = activeView.id === "overview" && viewer.layout === "both";
  $("#layout-caption").innerHTML =
    `<span class="tiny-line"></span> ${activeView.interior ? "INTERIOR VIEW" : both ? "FLOORS SHOWN SIDE BY SIDE" : viewer.layout === "assembled" ? "ASSEMBLED HOUSE" : "MODEL VIEW"} <span class="caption-detail">${both ? "Upper floor offset for inspection" : viewer.cutaway ? "Walls cut at 1.10 m for visibility" : viewer.ceilings ? "Ceilings on" : "Ceilings hidden"}</span>`;
  $("#gesture-text").innerHTML =
    viewer.mode === "walk"
      ? "Drag to look <span>·</span> WASD to move<br><small>Q/E change level · Shift to move faster · Walls block you</small>"
      : viewer.mode === "pan"
        ? "Drag to pan <span>·</span> Scroll to zoom<br><small>Click an object to inspect its source details</small>"
        : "Drag to orbit <span>·</span> Scroll to zoom<br><small>Right-drag to pan · Click an object to inspect</small>";
}
function chooseView(view: View) {
  activeView = view;
  setPage("explorer");
  $(".stage").classList.toggle("interior", !!view.interior);
  $("#view-title").textContent = view.title;
  $("#view-subtitle").textContent = view.subtitle;
  $("#view-note").textContent = view.note;
  all("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view.id);
    b.setAttribute("aria-pressed", String(b.dataset.view === view.id));
  });
  viewer?.setView(view);
  syncControls();
  $("#sidebar").classList.remove("open");
  const url = new URL(location.href);
  url.searchParams.set("space", view.id);
  history.replaceState(null, "", url);
}
all("[data-page]").forEach((b) =>
  b.addEventListener("click", () => setPage(b.dataset.page!)),
);
all("[data-view]").forEach((b) =>
  b.addEventListener("click", () =>
    chooseView(views.find((v) => v.id === b.dataset.view)!),
  ),
);
all("[data-layout]").forEach((b) =>
  b.addEventListener("click", () => {
    viewer?.setView(views[0], b.dataset.layout as Layout);
    syncControls();
  }),
);
all("[data-mode]").forEach((b) =>
  b.addEventListener("click", () => {
    if (!viewer) return;
    const mode = b.dataset.mode as "orbit" | "pan" | "walk";
    // Walking the exterior overview drops you outside a model split in two,
    // so start the walk from the entry instead.
    if (mode === "walk" && !activeView.interior) {
      chooseView(views.find((v) => v.id === "living") || activeView);
      toast("Walk starts at the entry");
    }
    viewer.setMode(mode);
    viewer.toggleAuto(false);
    syncControls();
    viewer.renderer.domElement.focus();
  }),
);
for (const id of ["cutaway", "ceilings", "auto"])
  $("#" + id).addEventListener("change", () => {
    if (!viewer) return;
    const checked = $<HTMLInputElement>("#" + id).checked;
    // The cutaway clips walls to 1.10 m above their own floor so the house can
    // be read from outside. Inside a room the eye sits at 1.78 m, so the same
    // clip decapitates every wall and the room reads as having none at all.
    if (id === "cutaway" && activeView.interior) {
      syncControls();
      toast("Interior views keep their walls");
      return;
    }
    if (id === "auto") {
      if (checked) viewer.setMode("orbit");
      viewer.toggleAuto(checked);
    } else {
      viewer[id as "cutaway" | "ceilings"] = checked;
      viewer.rebuild();
    }
    syncControls();
  });
$("#reset").onclick = () => {
  viewer?.reset();
  toast("Viewpoint reset");
};
$("#zoom-in").onclick = () => viewer?.zoom(0.85);
$("#zoom-out").onclick = () => viewer?.zoom(1.18);
// Pointer-free camera control, for touch, trackpads and keyboard users.
const NUDGE = Math.PI / 18;
$("#turn-left").onclick = () => viewer?.orbitBy(-NUDGE, 0);
$("#turn-right").onclick = () => viewer?.orbitBy(NUDGE, 0);
$("#tilt-up").onclick = () => viewer?.orbitBy(0, -NUDGE);
$("#tilt-down").onclick = () => viewer?.orbitBy(0, NUDGE);
all("[data-step]").forEach((b) =>
  b.addEventListener("click", () => {
    const step = b.dataset.step!;
    viewer?.move(step, step === "up" || step === "down" ? 0.6 : 0.4);
  }),
);
$("#capture").onclick = () => {
  if (!viewer) return;
  const a = document.createElement("a");
  a.href = viewer.screenshot();
  a.download = `5476-Maryland-${activeView.id}-V9.4.png`;
  a.click();
  toast("View saved as PNG");
};
$("#fullscreen").onclick = async () => {
  const stage = $(".stage");
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  if (stage.classList.contains("expanded")) {
    stage.classList.remove("expanded");
    return;
  }
  try {
    await stage.requestFullscreen();
  } catch {
    stage.classList.add("expanded");
  }
};
function showObject(e: Element | null) {
  if (!e) {
    $("#selection").hidden = true;
    return;
  }
  $("#selection").hidden = false;
  $("#object-name").textContent = e.name;
  $("#object-meta").textContent = [
    e.zone || e.level,
    e.category,
    e.status?.replaceAll("_", " "),
  ]
    .filter(Boolean)
    .join(" · ");
  $("#object-note").textContent =
    e.note ||
    "Part of the V9.4 existing-condition model. Local details and placement may be approximate.";
  $("#object-source").textContent = e.evidence_refs?.length
    ? "Source references: " + e.evidence_refs.join(", ")
    : "Source: V9.4 shared model";
}
$("#close-selection").onclick = () => {
  viewer?.clearSelection();
  showObject(null);
};
$("#footer-files").onclick = () => setPage("plans");
$(".brand").onclick = (e) => {
  e.preventDefault();
  chooseView(views[0]);
};
function setSide(side: string) {
  all("[data-side]").forEach((b) =>
    b.classList.toggle("active", b.dataset.side === side),
  );
  $("#spaces-content").hidden = side !== "spaces";
  $("#about-content").hidden = side !== "about";
}
all("[data-side]").forEach((b) =>
  b.addEventListener("click", () => setSide(b.dataset.side!)),
);
$("#model-note").onclick = () => setSide("about");
$("#mobile-spaces").onclick = () => $("#sidebar").classList.toggle("open");
$("#close-sidebar").onclick = () => $("#sidebar").classList.remove("open");
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $(".stage").classList.remove("expanded");
    $("#sidebar").classList.remove("open");
    showObject(null);
    viewer?.clearSelection();
  }
});
all("[data-plan]").forEach((b) =>
  b.addEventListener("click", () => {
    planLevel = Number(b.dataset.plan);
    all("[data-plan]").forEach((x) => x.classList.toggle("active", x === b));
    $<HTMLImageElement>("#plan-image").src = `/plans/level-${planLevel}.png`;
    $<HTMLImageElement>("#plan-image").alt =
      `V9.4 dimensioned ${planLevel === 1 ? "ground" : "upper"} floor plan`;
    planZoom = 1;
    applyPlanZoom();
  }),
);
function applyPlanZoom() {
  const image = $<HTMLImageElement>("#plan-image");
  const panel = $(".plan-scroll");
  if (!image.naturalWidth || !panel.clientWidth || !panel.clientHeight) return;
  const fit = Math.min(
    (panel.clientWidth - 24) / image.naturalWidth,
    (panel.clientHeight - 24) / image.naturalHeight,
  );
  image.style.width = `${image.naturalWidth * fit * planZoom}px`;
  image.style.maxWidth = "none";
  $("#plan-fit").textContent =
    planZoom === 1 ? "Fit" : `${Math.round(planZoom * 100)}%`;
}
$<HTMLImageElement>("#plan-image").addEventListener("load", applyPlanZoom);
new ResizeObserver(applyPlanZoom).observe($(".plan-scroll"));
$("#plan-plus").onclick = () => {
  planZoom = Math.min(3, planZoom + 0.25);
  applyPlanZoom();
};
$("#plan-minus").onclick = () => {
  planZoom = Math.max(1, planZoom - 0.25);
  applyPlanZoom();
};
$("#plan-fit").onclick = () => {
  planZoom = 1;
  applyPlanZoom();
};
let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 3500);
}
function failure(message: string) {
  modelReady = true;
  $("#loading").hidden = true;
  $("#viewer-error").hidden = false;
  $("#viewer-error").textContent = message;
}
$("#viewport").addEventListener("viewer-error", (e) =>
  failure((e as CustomEvent).detail),
);
/** Drive the load bar; null means the length is unknown, so stay indeterminate. */
function setProgress(fraction: number | null) {
  $("#loading-track").classList.toggle("indeterminate", fraction === null);
  if (fraction === null) return;
  const percent = Math.round(Math.max(0, Math.min(fraction, 1)) * 100);
  $("#loading-fill").style.width = percent + "%";
  $("#loading-percent").textContent = percent + "%";
}
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(resolve));
/** Read the model with progress when the server declares a length. */
async function loadModel(): Promise<HouseData> {
  const response = await fetch("/model/house.json");
  if (!response.ok) throw Error("Model download failed");
  const total = Number(response.headers.get("content-length"));
  if (!total || !response.body) {
    setProgress(null);
    return response.json();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    // Compressed transfers report the encoded length, so this can run ahead;
    // the download is only ever part of the wait, hence the 0.8 ceiling.
    setProgress(Math.min(received / total, 1) * 0.8);
  }
  const merged = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) {
    merged.set(chunk, at);
    at += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(merged));
}
/** The plans and the interactive model can be ahead of the downloadable natives,
 *  which need SketchUp and Blender to reissue. Say so rather than implying one
 *  revision covers everything. */
async function describeRevision(data: HouseData) {
  const n = (v: number) => v.toLocaleString("en-US");
  $("#about-source-count").textContent = n(data.source_object_count);
  $("#about-web-count").textContent = n(data.elements.length);
  try {
    const m = await (await fetch("/model/manifest.json")).json();
    $("#about-source").textContent =
      `Source: ${m.model_revision}. The viewer uses the current model’s vertices, materials and room cameras.`;
    if (m.native_status === "PENDING_REBUILD") {
      $("#revision-note").hidden = false;
      $("#revision-note").innerHTML =
        `${icon("Info")}<div><strong>This viewer is ahead of the downloadable files.</strong><p>Interactive model and dimensioned plans: <b>${m.model_revision}</b>. Downloadable SketchUp and Blender files: <b>${m.native_revision}</b> — reissue pending.</p></div>`;
      paintIcons();
    }
  } catch {
    /* the panel still shows the counts taken from the model itself */
  }
}
async function boot() {
  try {
    const data = await loadModel();
    setProgress(0.85);
    await nextFrame();
    viewer = new HouseViewer($("#viewport"), data);
    viewer.onSelect = showObject;
    viewer.onChange = syncControls;
    modelReady = true;
    void describeRevision(data);
    setProgress(1);
    $("#loading").hidden = true;
    const wanted = new URL(location.href).searchParams.get("space");
    chooseView(views.find((v) => v.id === wanted) || activeView);
    Object.assign(window, {
      houseExplorer: {
        stats: () => viewer?.stats(),
        source: () => ({
          sha256: data.source_sha256,
          objects: data.elements.length,
          version: data.version,
        }),
      },
    });
  } catch (error) {
    console.error(error);
    failure(
      "The 3D model could not load. Your browser needs WebGL 2. You can still explore the dimensioned floor plans. Reload to try again.",
    );
  }
}
boot();
