import { getOverlay } from "./overlay.js";
import { bumpHint, arrowsVisible } from "./prefs.js";
import { isEnabled, onToggle } from "./state.js";

const COVER_SELECTOR = '[data-testid="cover-art-button"] img';
const FALLBACK_COVER =
  '[data-testid="CoverSlotCollapsed__container"] img';

let root = null;
let glow = null;
let glowA = null;
let glowB = null;
let activeGlow = null;
let img = null;
let loaderWrap = null;
let svgWrap = null;
let visualEl = null;
let pullString = null;
let pulled = false;
let lastSrc = "";
let lastAvg = null;
let djMode = false;
let pendingTimer = null;
let revealTimer = null;

const DRAG_THRESHOLD = 60;
const PULL_THRESHOLD = 140;
const HIDDEN_TRANSFORM = "translateX(-50%) translateY(-100%)";
const PULL_REST = "translateX(-50%) translateY(-120%)";
const PULL_SHOWN = "translateX(-50%) translateY(0)";

const PULL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 200 100 800" width="22" height="160" preserveAspectRatio="xMidYMid meet"><path d="M 50 0 C 35 120, 65 200, 48 320 S 35 500, 52 620 S 65 800, 50 940" stroke="currentColor" stroke-width="3" fill="none"/><circle cx="50" cy="960" r="20" stroke="currentColor" stroke-width="3" fill="none"/></svg>`;

function applyArrows() {
  if (!visualEl) return;
  visualEl.classList.toggle("hints-off", !arrowsVisible());
}

const DJ_MARKER = "Your-DJ-Cover-Art";

const DJ_SVG = `<svg viewBox="-2 -2 20 20" width="100%" height="100%" overflow="visible" aria-hidden="true" fill="none" stroke="#ff8c42" stroke-width="0.45" stroke-linejoin="round" stroke-linecap="round"><path d="M7.813 14.497A6.5 6.5 0 0 1 1.5 8.016c.008-3.553 2.71-5.744 5.043-6.078.85-.121 1.288.037 1.564.246.312.238.553.639.822 1.276q.115.277.239.602c.451 1.167 1.05 2.717 2.505 3.81 1.01.76 1.46 1.529 1.592 2.209.13.679-.037 1.375-.468 2.03-.88 1.34-2.793 2.388-4.844 2.388zm-.037 1.5A8 8 0 1 0 0 8.032c0 4.34 3.464 7.87 7.776 7.965m6.666-7.124c-.358-.788-.979-1.532-1.868-2.2-1.082-.813-1.51-1.9-1.967-3.06a31 31 0 0 0-.296-.736 6.3 6.3 0 0 0-.605-1.151 6.53 6.53 0 0 1 4.39 4.01 6.5 6.5 0 0 1 .346 3.137"/></svg>`;

function isDJ(src) {
  return !!src && src.indexOf(DJ_MARKER) !== -1;
}

function avgColor(colors) {
  if (!colors.length) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  colors.forEach((c) => {
    const m = c.match(/\d+/g);
    if (m) {
      r += +m[0];
      g += +m[1];
      b += +m[2];
    }
  });
  const n = colors.length;
  return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
}

function makeArrow(side, label, path) {
  const el = document.createElement("div");
  el.className = `simplify-arrow ${side}`;
  el.innerHTML =
    `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>` +
    `<span class="simplify-arrow-label">${label}</span>`;
  return el;
}

function playerToggle() {
  const p = typeof Spicetify !== "undefined" && Spicetify.Player;
  if (!p) return;
  if (p.playPause) p.playPause();
  else if (p.toggle) p.toggle();
}

function playerNext() {
  if (typeof Spicetify !== "undefined" && Spicetify.Player?.next) {
    Spicetify.Player.next();
  }
}

function playerBack() {
  if (typeof Spicetify !== "undefined" && Spicetify.Player?.back) {
    Spicetify.Player.back();
  }
}

function attachGestures(el) {
  el.style.pointerEvents = "auto";
  el.style.cursor = "grab";
  el.style.touchAction = "none";
  el.style.userSelect = "none";
  el.style.transition = "transform 0.25s ease";

  let downX = 0;
  let downY = 0;
  let dragging = false;
  let moved = false;

  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    moved = false;
    downX = e.clientX;
    downY = e.clientY;
    el.setPointerCapture(e.pointerId);
    if (!djMode) el.style.cursor = "grabbing";
    el.style.transition = "none";
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging || djMode) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.abs(dx) > 6 || dy > 6) moved = true;
    if (dy > Math.abs(dx)) {
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    } else {
      el.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
    }
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = djMode ? "default" : "grab";
    el.style.transition = "transform 0.25s ease";
    el.style.transform = "";
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (!moved) {
      playerToggle();
    } else if (!djMode && dy > Math.abs(dx)) {
      if (dy >= PULL_THRESHOLD) dismiss();
    } else if (!djMode && Math.abs(dx) >= DRAG_THRESHOLD) {
      if (dx > 0) playerNext();
      else playerBack();
      bumpHint();
      applyArrows();
      beginLoading();
    }
  };

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function build() {
  if (!isEnabled()) {
    const ex = document.getElementById("simplify-np");
    if (ex) ex.remove();
    root = null;
    return null;
  }
  const overlay = getOverlay();
  if (!overlay) return null;
  if (overlay.querySelector("#simplify-np")) {
    return overlay.querySelector("#simplify-np");
  }

  root = document.createElement("div");
  root.id = "simplify-np";
  root.style.cssText = [
    "position:absolute",
    "top:0",
    "left:50%",
    "transform:translateX(-50%)",
    "height:54%",
    "padding:64px 28px 28px",
    "box-sizing:border-box",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "z-index:10000",
    "pointer-events:none",
  ].join(";");

  const artWrap = document.createElement("div");
  artWrap.style.cssText = [
    "position:relative",
    "height:100%",
    "max-width:100%",
    "aspect-ratio:1/1",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "transform:perspective(900px) rotateX(16deg)",
    "transform-origin:center center",
    "transform-style:preserve-3d",
  ].join(";");

  glow = document.createElement("div");
  glow.style.cssText = [
    "position:absolute",
    "inset:-7%",
    "z-index:0",
    "border-radius:18px",
    "filter:blur(45px) saturate(1.6)",
    "opacity:0.85",
    "transform:scale(1)",
    "transform-origin:center",
    "transition:opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.3,0.64,1)",
  ].join(";");

  const layerStyle = [
    "position:absolute",
    "inset:0",
    "border-radius:inherit",
    "opacity:0",
    "transition:opacity 0.6s ease",
  ].join(";");
  glowA = document.createElement("div");
  glowA.style.cssText = layerStyle;
  glowB = document.createElement("div");
  glowB.style.cssText = layerStyle;
  glow.appendChild(glowA);
  glow.appendChild(glowB);
  activeGlow = glowA;

  img = document.createElement("img");
  img.crossOrigin = "anonymous";
  img.style.cssText = [
    "position:relative",
    "z-index:2",
    "height:100%",
    "width:100%",
    "object-fit:cover",
    "border-radius:12px",
    "display:block",
    "box-shadow:0 20px 60px rgba(0,0,0,0.55)",
    "opacity:0",
    "transform:scale(0.4)",
    "transform-origin:center",
    "transition:opacity 0.4s ease, transform 0.5s cubic-bezier(0.34,1.3,0.64,1)",
  ].join(";");

  loaderWrap = document.createElement("div");
  loaderWrap.id = "simplify-np-loader";
  const spinner = document.createElement("div");
  spinner.className = "loader";
  loaderWrap.appendChild(spinner);

  svgWrap = document.createElement("div");
  svgWrap.style.cssText = [
    "position:absolute",
    "inset:0",
    "display:none",
    "align-items:center",
    "justify-content:center",
    "z-index:3",
    "pointer-events:none",
    "padding:6%",
    "box-sizing:border-box",
  ].join(";");
  svgWrap.innerHTML = DJ_SVG;

  const visual = document.createElement("div");
  visual.className = "simplify-visual";
  visual.style.cssText = [
    "position:relative",
    "width:100%",
    "height:100%",
    "pointer-events:auto",
  ].join(";");
  visualEl = visual;

  visual.appendChild(makeArrow("left", "previous", "M15 5l-7 7 7 7"));
  visual.appendChild(makeArrow("right", "next", "M9 5l7 7-7 7"));

  visual.appendChild(glow);
  visual.appendChild(img);
  visual.appendChild(svgWrap);
  visual.appendChild(loaderWrap);

  pullString = document.createElement("div");
  pullString.id = "simplify-pull";
  pullString.style.cssText = [
    "position:absolute",
    "top:88%",
    "left:50%",
    `transform:${PULL_REST}`,
    "z-index:4",
    "color:rgba(255,255,255,0.85)",
    "cursor:grab",
    "touch-action:none",
    "user-select:none",
    "pointer-events:none",
    "opacity:0",
    "filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
    "transition:transform 0.4s cubic-bezier(0.34,1.3,0.64,1)",
  ].join(";");
  pullString.innerHTML = PULL_SVG;
  visual.appendChild(pullString);
  attachPullString(pullString);

  artWrap.appendChild(visual);
  root.appendChild(artWrap);
  overlay.appendChild(root);

  attachGestures(visual);
  applyArrows();
  return root;
}

function showPullString() {
  if (!pullString) return;
  pullString.style.pointerEvents = "auto";
  pullString.style.opacity = "1";
  pullString.style.transform = PULL_SHOWN;
}

function hidePullString() {
  if (!pullString) return;
  pullString.style.pointerEvents = "none";
  pullString.style.opacity = "0";
  pullString.style.transform = PULL_REST;
}

function setHiddenClass(on) {
  const ov = getOverlay();
  if (ov) ov.classList.toggle("np-hidden", on);
}

function dismiss() {
  pulled = true;
  hidePullString();
  setHiddenClass(true);
  if (root) {
    root.style.transition = "transform 0.5s cubic-bezier(0.5,0,0.75,0)";
    root.style.transform = HIDDEN_TRANSFORM;
  }
  clearTimeout(revealTimer);
  revealTimer = setTimeout(showPullString, 520);
}

function restore() {
  pulled = false;
  clearTimeout(revealTimer);
  setHiddenClass(false);
  if (root) {
    root.style.transition = "transform 0.6s cubic-bezier(0.22,1.9,0.36,1)";
    root.style.transform = "translateX(-50%)";
  }
  hidePullString();
}

function attachPullString(el) {
  let downY = 0;
  let dragging = false;

  el.addEventListener("pointerdown", (e) => {
    if (!pulled) return;
    dragging = true;
    downY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = "grabbing";
    if (root) root.style.transition = "none";
    e.stopPropagation();
  });

  el.addEventListener("pointermove", (e) => {
    if (!dragging || !root) return;
    const dy = Math.max(0, e.clientY - downY);
    const h = root.offsetHeight || 1;
    let offset = -h + dy;
    if (offset > 0) offset *= 0.4;
    root.style.transform = `translateX(-50%) translateY(${offset}px)`;
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = "grab";
    const dy = e.clientY - downY;
    if (dy >= PULL_THRESHOLD) restore();
    else dismissSnap();
  };

  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

function dismissSnap() {
  if (root) {
    root.style.transition = "transform 0.35s cubic-bezier(0.34,1.3,0.64,1)";
    root.style.transform = HIDDEN_TRANSFORM;
  }
  showPullString();
}

function extractColors(src) {
  return new Promise((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = 40;
      c.height = 40;
      const ctx = c.getContext("2d");
      ctx.drawImage(im, 0, 0, 40, 40);
      let data;
      try {
        data = ctx.getImageData(0, 0, 40, 40).data;
      } catch (e) {
        resolve([]);
        return;
      }
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 125) continue;
        const key = `${r >> 5},${g >> 5},${b >> 5}`;
        const cur = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        cur.n++;
        cur.r += r;
        cur.g += g;
        cur.b += b;
        buckets.set(key, cur);
      }
      const colors = [...buckets.values()]
        .map((v) => ({
          n: v.n,
          r: Math.round(v.r / v.n),
          g: Math.round(v.g / v.n),
          b: Math.round(v.b / v.n),
        }))
        .filter((c) => {
          const mx = Math.max(c.r, c.g, c.b);
          const mn = Math.min(c.r, c.g, c.b);
          return mx - mn > 24 && mx > 40;
        })
        .sort((a, b) => b.n - a.n)
        .slice(0, 4)
        .map((c) => `rgb(${c.r},${c.g},${c.b})`);
      resolve(colors);
    };
    im.onerror = () => resolve([]);
    im.src = src;
  });
}

function applyGlow(colors) {
  if (!glowA || !glowB) return;
  const list = colors.length ? colors : ["rgb(80,80,80)"];
  const spots = [
    "30% 25%",
    "72% 35%",
    "45% 82%",
    "18% 65%",
  ];
  const bg = list
    .map(
      (col, i) =>
        `radial-gradient(circle at ${spots[i % spots.length]}, ${col}, transparent 62%)`
    )
    .join(",");
  const next = activeGlow === glowA ? glowB : glowA;
  next.style.background = bg;
  next.style.opacity = "1";
  if (activeGlow !== next) activeGlow.style.opacity = "0";
  activeGlow = next;
}

function readCoverFromDom() {
  const el =
    document.querySelector(COVER_SELECTOR) ||
    document.querySelector(FALLBACK_COVER);
  return el ? el.src : null;
}

function getAvgColor() {
  return lastAvg;
}

function setLoading(on) {
  if (!loaderWrap || !img) return;
  loaderWrap.style.display = on ? "flex" : "none";
  img.style.visibility = on || djMode ? "hidden" : "visible";
  img.style.opacity = on || djMode ? "0" : "1";
  img.style.transform = on ? "scale(0.4)" : "scale(1)";
  if (glow) {
    glow.style.opacity = on || djMode ? "0" : "0.85";
    glow.style.transform = on ? "scale(0.4)" : "scale(1)";
  }
}

function setDJMode(on) {
  djMode = on;
  if (visualEl) {
    visualEl.classList.toggle("nav-off", on);
    visualEl.style.cursor = on ? "default" : "grab";
  }
  if (!svgWrap) return;
  svgWrap.style.display = on ? "flex" : "none";
  if (on) {
    const svg = svgWrap.querySelector("svg");
    if (svg) svg.setAttribute("stroke", lastAvg || "#ff8c42");
    finishLoading();
  } else {
    setLoading(false);
  }
}

function beginLoading() {
  setLoading(true);
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => setLoading(false), 3000);
}

function finishLoading() {
  clearTimeout(pendingTimer);
  pendingTimer = null;
  setLoading(false);
}

function syncCover() {
  if (!build()) return;
  const src = readCoverFromDom();
  if (!src || src === lastSrc) return;
  lastSrc = src;
  if (isDJ(src)) {
    setDJMode(true);
    return;
  }
  setDJMode(false);
  img.onload = () => finishLoading();
  img.onerror = () => finishLoading();
  img.src = src;
  extractColors(src).then((colors) => {
    applyGlow(colors);
    lastAvg = avgColor(colors);
  });
}

function start() {
  syncCover();
  const boot = new MutationObserver(() => {
    if (root && root.isConnected) {
      const cover = document.querySelector(COVER_SELECTOR);
      if (cover) {
        new MutationObserver(syncCover).observe(cover, {
          attributes: true,
          attributeFilter: ["src"],
        });
      }
      boot.disconnect();
      return;
    }
    syncCover();
  });
  boot.observe(document.body, { childList: true, subtree: true });
  setInterval(syncCover, 1000);
}

start();

onToggle((on) => {
  if (on) {
    lastSrc = "";
    lastAvg = null;
    syncCover();
  } else {
    const ex = document.getElementById("simplify-np");
    if (ex) ex.remove();
    root = null;
  }
});

export { syncCover as updateNowPlaying, start as startNowPlaying, applyArrows as refreshArrows, getAvgColor };
