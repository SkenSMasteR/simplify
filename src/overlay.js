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

function watch() {
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
watch();

export { getOverlay, ensureOverlay, OVERLAY_ID };
