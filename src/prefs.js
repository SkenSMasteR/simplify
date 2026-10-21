const HINT_KEY = "simplify.navHintCount";
const MODE_KEY = "simplify.arrows";
const BANNER_KEY = "simplify.autoBanner";
const HINT_MAX = 3;
const SAVE_PREFIX = "simplify.";

function getAutoBanner() {
  return localStorage.getItem(BANNER_KEY) === "1";
}

function setAutoBanner(on) {
  localStorage.setItem(BANNER_KEY, on ? "1" : "0");
}

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

export {
  getHintCount,
  getArrowMode,
  setArrowMode,
  bumpHint,
  arrowsVisible,
  clearSaves,
  getAutoBanner,
  setAutoBanner,
};
