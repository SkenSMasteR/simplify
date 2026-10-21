import { HIDDEN_CLASSES } from "./hidden.js";
import { getOverlay } from "./overlay.js";
import { isEnabled, onToggle } from "./state.js";
import "./nowplaying.js";
import "./lyrics.js";
import "./settings.js";

const STYLE_ID = "simplify-hidden";

function applyHidden() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = isEnabled()
    ? HIDDEN_CLASSES.map((c) => `.${c}{display:none !important;}`).join("\n")
    : "";
}

onToggle(applyHidden);
applyHidden();

export { HIDDEN_CLASSES, applyHidden, getOverlay };
