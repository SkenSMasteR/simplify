(function (exports) {
  'use strict';

  const HIDDEN_CLASSES = [
    "main-view-container__scroll-node-child",
    "bl1InWV_jfGCXZVygaOG",
    "HI1XTDyQDUuYadSC1QdR",
    "iHJ6_yPvPOWhaNcXElNZ",
    "main-globalNav-historyButtonsWrapper",
    "ma3NlSAkRjOsqGl2KnyA",
    "mKbEys6Ta3c3b_RZlVo6",
    "HuKs8FZg6Y75cV9Lh0Kk",
    "_qEwikUlZSIdhG1eHl6y",
    "abo3lmX4A73ipyjul1Zd",
  ];

  const CONTAINER_SELECTOR = ".main-view-container__scroll-node";
  const OVERLAY_ID = "simplify-overlay";

  let overlay = null;
  let observer = null;

  function ensureOverlay() {
    const container = document.querySelector(CONTAINER_SELECTOR);
    if (!container) return null;

    if (container.style.position !== "relative") {
      container.style.position = "relative";
    }

    let el = container.querySelector(`#${OVERLAY_ID}`);
    if (!el) {
      el = document.createElement("div");
      el.id = OVERLAY_ID;
      el.style.cssText =
        "position:absolute;inset:0;z-index:9999;pointer-events:auto;";
      container.appendChild(el);
    }
    overlay = el;
    return el;
  }

  function watch$1() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      if (!document.getElementById(OVERLAY_ID)) ensureOverlay();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function getOverlay() {
    return overlay || ensureOverlay();
  }

  ensureOverlay();
  watch$1();

  const HINT_KEY = "simplify.navHintCount";
  const MODE_KEY = "simplify.arrows";
  const HINT_MAX = 3;
  const SAVE_PREFIX = "simplify.";

  function getHintCount() {
    const v = parseInt(localStorage.getItem(HINT_KEY) || "0", 10);
    return isNaN(v) ? 0 : v;
  }

  function getArrowMode() {
    return localStorage.getItem(MODE_KEY) || "auto";
  }

  function setArrowMode(mode) {
    localStorage.setItem(MODE_KEY, mode);
  }

  function bumpHint() {
    if (getArrowMode() !== "auto") return;
    const c = getHintCount();
    if (c >= HINT_MAX) return;
    localStorage.setItem(HINT_KEY, String(c + 1));
  }

  function arrowsVisible() {
    const mode = getArrowMode();
    if (mode === "on") return true;
    if (mode === "off") return false;
    return getHintCount() < HINT_MAX;
  }

  function clearSaves() {
    Object.keys(localStorage)
      .filter((k) => k.indexOf(SAVE_PREFIX) === 0)
      .forEach((k) => localStorage.removeItem(k));
  }

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
  let lastSrc = "";
  let lastAvg = null;
  let djMode = false;
  let pendingTimer = null;

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

  const DRAG_THRESHOLD = 60;

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
    let dragging = false;
    let moved = false;

    el.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = false;
      downX = e.clientX;
      el.setPointerCapture(e.pointerId);
      if (!djMode) el.style.cursor = "grabbing";
      el.style.transition = "none";
    });

    el.addEventListener("pointermove", (e) => {
      if (!dragging || djMode) return;
      const dx = e.clientX - downX;
      if (Math.abs(dx) > 6) moved = true;
      el.style.transform = `translateX(${dx}px) rotate(${dx * 0.03}deg)`;
    });

    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      el.style.cursor = djMode ? "default" : "grab";
      el.style.transition = "transform 0.25s ease";
      el.style.transform = "";
      const dx = e.clientX - downX;
      if (!moved) {
        playerToggle();
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

  function build$1() {
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
      "padding:28px",
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
    artWrap.appendChild(visual);
    root.appendChild(artWrap);
    overlay.appendChild(root);
    attachGestures(visual);
    applyArrows();
    return root;
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

  function setLoading(on) {
    if (!loaderWrap || !img) return;
    loaderWrap.style.display = on ? "flex" : "none";
    img.style.visibility = on || djMode ? "hidden" : "visible";
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
    if (!build$1()) return;
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

  const BTN_ID = "simplify-settings-btn";
  const PANEL_ID = "simplify-settings-panel";

  const GEAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

  let btn = null;
  let panel = null;

  function setPanel(open) {
    if (panel) panel.classList.toggle("open", open);
  }

  function build() {
    const overlay = getOverlay();
    if (!overlay) return;

    if (!overlay.querySelector("#" + PANEL_ID)) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;

      const head = document.createElement("div");
      head.className = "simplify-settings-head";
      head.textContent = "Simplify Settings";

      const row = document.createElement("div");
      row.className = "simplify-row";
      const label = document.createElement("span");
      label.className = "simplify-row-label";
      label.textContent = "Hover arrows";
      const sw = document.createElement("button");
      sw.className = "simplify-switch";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", String(arrowsVisible()));
      sw.innerHTML = '<span class="simplify-switch-thumb"></span>';
      sw.addEventListener("click", () => {
        const on = sw.getAttribute("aria-checked") !== "true";
        sw.setAttribute("aria-checked", String(on));
        setArrowMode(on ? "on" : "off");
        applyArrows();
      });
      row.appendChild(label);
      row.appendChild(sw);

      const clearBtn = document.createElement("button");
      clearBtn.className = "simplify-clear-btn";
      clearBtn.textContent = "Clear saved data";
      clearBtn.addEventListener("click", () => {
        clearSaves();
        clearBtn.textContent = "Cleared";
        sw.setAttribute("aria-checked", String(arrowsVisible()));
        applyArrows();
        setTimeout(() => {
          clearBtn.textContent = "Clear saved data";
          setPanel(false);
        }, 900);
      });

      panel.appendChild(head);
      panel.appendChild(row);
      panel.appendChild(clearBtn);
      overlay.appendChild(panel);
    }

    if (!overlay.querySelector("#" + BTN_ID)) {
      btn = document.createElement("button");
      btn.id = BTN_ID;
      btn.setAttribute("aria-label", "Simplify Settings");
      btn.innerHTML = GEAR_SVG;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setPanel(!panel.classList.contains("open"));
      });
      overlay.appendChild(btn);
    }
  }

  function watch() {
    new MutationObserver(() => {
      if (
        !document.getElementById(BTN_ID) ||
        !document.getElementById(PANEL_ID)
      ) {
        build();
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("click", (e) => {
    if (!panel || !panel.classList.contains("open")) return;
    if (panel.contains(e.target) || (btn && btn.contains(e.target))) return;
    setPanel(false);
  });

  build();
  watch();

  const STYLE_ID = "simplify-hidden";

  function applyHidden() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = HIDDEN_CLASSES.map(
      (c) => `.${c}{display:none !important;}`
    ).join("\n");
  }

  applyHidden();

  exports.HIDDEN_CLASSES = HIDDEN_CLASSES;
  exports.applyHidden = applyHidden;
  exports.getOverlay = getOverlay;

  return exports;

})({});
