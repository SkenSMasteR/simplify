import { getOverlay } from "./overlay.js";
import { refreshArrows } from "./nowplaying.js";
import { clearSaves, arrowsVisible, setArrowMode } from "./prefs.js";
import { isEnabled, setEnabled } from "./state.js";

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

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "simplify-toggle-btn";
    toggleBtn.className = "simplify-clear-btn";
    const syncToggleLabel = () => {
      toggleBtn.textContent = isEnabled() ? "Disable theme" : "Enable theme";
    };
    syncToggleLabel();
    toggleBtn.addEventListener("click", () => {
      setEnabled(!isEnabled());
      syncToggleLabel();
    });

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
      refreshArrows();
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
      refreshArrows();
      setTimeout(() => {
        clearBtn.textContent = "Clear saved data";
        setPanel(false);
      }, 900);
    });

    panel.appendChild(head);
    panel.appendChild(toggleBtn);
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
