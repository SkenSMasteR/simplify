import { getOverlay } from "./overlay.js";
import { getAvgColor } from "./nowplaying.js";
import { isEnabled, onToggle } from "./state.js";

const API = "https://lrclib.net/api/get";
const SEARCH = "https://lrclib.net/api/search";
const NO_LYRICS = "¯\\_(ツ)_/¯";

let box = null;
let scroller = null;
let topSpacer = null;
let bottomSpacer = null;
let lines = [];
let lastUri = "";
let activeIdx = -1;
let fetchToken = 0;
let lastHidden = false;

function ensureBox() {
  if (!isEnabled()) return null;
  const overlay = getOverlay();
  if (!overlay) return null;

  if (!box || !box.isConnected) {
    box = document.createElement("div");
    box.id = "simplify-lyrics";

    scroller = document.createElement("div");
    scroller.id = "simplify-lyrics-scroll";

    topSpacer = document.createElement("div");
    topSpacer.className = "simplify-lyric-spacer";
    bottomSpacer = document.createElement("div");
    bottomSpacer.className = "simplify-lyric-spacer";
    scroller.appendChild(topSpacer);
    scroller.appendChild(bottomSpacer);
    box.appendChild(scroller);

    overlay.appendChild(box);
  }
  return scroller;
}

function parseLrc(text) {
  const out = [];
  const re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
  text.split(/\r?\n/).forEach((line) => {
    const stamps = [...line.matchAll(re)];
    if (!stamps.length) return;
    const content = line.replace(re, "").trim();
    if (!content) return;
    stamps.forEach((m) => {
      out.push({ t: +m[1] * 60 + parseFloat(m[2]), text: content });
    });
  });
  out.sort((a, b) => a.t - b.t);
  return out;
}

function pruneHistory(keepUri) {
  lines = lines.filter((l) => {
    if (l.uri === keepUri) return true;
    l.el.remove();
    return false;
  });
}

function appendLines(parsed, uri) {
  if (!ensureBox()) return;
  scroller.style.display = "block";
  parsed.forEach((l, i) => {
    const el = document.createElement("div");
    el.className = "simplify-lyric-line";
    if (i === 0 && lines.length) el.classList.add("song-start");
    el.textContent = l.text;
    scroller.insertBefore(el, bottomSpacer);
    lines.push({ t: l.t, el, uri });
  });
  activeIdx = -1;
}

function renderLrc(lrc, uri) {
  const parsed = parseLrc(lrc);
  if (!parsed.length) {
    renderNoLyrics(uri);
    return;
  }
  appendLines(parsed, uri);
}

function renderNoLyrics(uri) {
  appendLines([{ t: 0, text: NO_LYRICS }], uri);
}

function readMeta() {
  if (typeof Spicetify === "undefined" || !Spicetify.Player) return null;
  const d = Spicetify.Player.data;
  if (!d || !d.item) return null;
  const item = d.item;
  const md = item.metadata || {};
  const uri = item.uri || d.uri || "";

  const title = md.title || item.name || "";

  let artist = md.artist_name || "";
  if (!artist && item.artists) {
    if (Array.isArray(item.artists)) {
      artist = item.artists
        .map((a) => a && a.name)
        .filter(Boolean)
        .join(", ");
    } else if (item.artists.name) {
      artist = item.artists.name;
    }
  }

  const album = md.album_title_name || (item.album && item.album.name) || "";

  let duration = 0;
  if (md.duration) duration = +md.duration / 1000;
  else if (item.duration) duration = +item.duration / 1000;
  else if (typeof Spicetify.Player.getDuration === "function")
    duration = Spicetify.Player.getDuration() / 1000;

  return { uri, title, artist, album, duration };
}

async function loadLyrics(meta) {
  const token = ++fetchToken;
  let synced = null;

  try {
    const params = new URLSearchParams({
      artist_name: meta.artist,
      track_name: meta.title,
      duration: String(Math.round(meta.duration || 0)),
    });
    if (meta.album) params.set("album_name", meta.album);
    const res = await fetch(`${API}?${params}`);
    if (res.ok) {
      const data = await res.json();
      synced = data.syncedLyrics || null;
    }
  } catch (e) {
    synced = null;
  }

  if (!synced) {
    try {
      const q = encodeURIComponent(`${meta.artist} ${meta.title}`);
      const res = await fetch(`${SEARCH}?q=${q}`);
      if (res.ok) {
        const arr = await res.json();
        if (Array.isArray(arr) && arr.length) {
          const best = arr.find((x) => x.syncedLyrics) || arr[0];
          synced = best.syncedLyrics || null;
        }
      }
    } catch (e) {
      synced = null;
    }
  }

  if (token !== fetchToken) return;
  if (synced) renderLrc(synced, meta.uri);
  else renderNoLyrics(meta.uri);
}

function scrollToActive(instant) {
  if (activeIdx >= 0 && lines[activeIdx] && scroller) {
    const el = lines[activeIdx].el;
    const target =
      el.offsetTop - scroller.clientHeight / 2 + el.offsetHeight / 2;
    if (instant) {
      const prev = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = "auto";
      scroller.scrollTop = Math.max(0, target);
      scroller.style.scrollBehavior = prev;
    } else {
      scroller.scrollTop = Math.max(0, target);
    }
  }
}

function setActive(idx) {
  if (idx === activeIdx) return;
  activeIdx = idx;
  const color = getAvgColor() || "#ffffff";
  lines.forEach((l, i) => {
    const on = i === idx;
    l.el.classList.toggle("active", on);
    l.el.style.color = on ? color : "";
  });
  scrollToActive();
}

function updateActive() {
  if (!lines.length) return;
  const pos = Spicetify.Player.getProgress() / 1000;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].uri !== lastUri) continue;
    if (lines[i].t <= pos + 0.2) idx = i;
    else break;
  }
  setActive(idx);
  if (idx >= 0 && lines[idx]) {
    lines[idx].el.style.color = getAvgColor() || "#ffffff";
  }
}

function teardown() {
  if (box) box.remove();
  box = null;
  scroller = null;
  topSpacer = null;
  bottomSpacer = null;
  lines = [];
  activeIdx = -1;
}

function loop() {
  if (!isEnabled()) return;
  if (typeof Spicetify === "undefined" || !Spicetify.Player) return;

  const ov = getOverlay();
  const hidden = ov ? ov.classList.contains("np-hidden") : false;
  if (hidden !== lastHidden) {
    lastHidden = hidden;
    const t0 = performance.now();
    const track = (now) => {
      scrollToActive(true);
      if (now - t0 < 520) requestAnimationFrame(track);
    };
    requestAnimationFrame(track);
  }

  const meta = readMeta();
  if (meta && meta.uri && meta.uri !== lastUri) {
    const prevUri = lastUri;
    lastUri = meta.uri;
    activeIdx = -1;
    pruneHistory(prevUri);
    if (meta.title && meta.artist) {
      loadLyrics(meta);
    } else {
      renderNoLyrics(meta.uri);
    }
  }
  updateActive();
}

function start() {
  ensureBox();
  setInterval(loop, 250);
}

onToggle((on) => {
  if (on) {
    lastUri = "";
    ensureBox();
  } else {
    teardown();
  }
});

start();
