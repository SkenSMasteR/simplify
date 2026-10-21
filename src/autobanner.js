import { getAutoBanner } from "./prefs.js";
import { isEnabled } from "./state.js";
import { OVERLAY_ID } from "./overlay.js";

let lastUri = "";
let lastHidden = null;

function artistPath(item) {
  const md = item.metadata || {};
  let uri = md.artist_uri || "";
  if (!uri && item.artists && item.artists.length) {
    uri = item.artists[0].uri || "";
  }
  uri = uri.split(",")[0].trim();
  if (uri.indexOf("spotify:artist:") === 0) {
    return "/artist/" + uri.slice("spotify:artist:".length);
  }
  return null;
}

function currentArtistPath() {
  const d = Spicetify.Player.data;
  if (!d || !d.item) return null;
  return artistPath(d.item);
}

function go(path) {
  if (path && Spicetify.Platform && Spicetify.Platform.History) {
    Spicetify.Platform.History.push(path);
  }
}

function loop() {
  if (!isEnabled() || !getAutoBanner()) {
    lastUri = "";
    lastHidden = null;
    return;
  }
  if (typeof Spicetify === "undefined" || !Spicetify.Player) return;

  const ov = document.getElementById(OVERLAY_ID);
  const hidden = ov ? ov.classList.contains("np-hidden") : false;
  if (hidden !== lastHidden) {
    const first = lastHidden === null;
    lastHidden = hidden;
    if (!first) {
      if (hidden) go("/");
      else go(currentArtistPath());
    }
  }

  const d = Spicetify.Player.data;
  const uri = (d && d.item && d.item.uri) || "";
  if (uri && uri !== lastUri) {
    lastUri = uri;
    if (!hidden) go(currentArtistPath());
  }
}

setInterval(loop, 500);
