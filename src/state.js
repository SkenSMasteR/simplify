let enabled = true;
const subs = [];

function isEnabled() {
  return enabled;
}

function setEnabled(v) {
  if (v === enabled) return;
  enabled = v;
  subs.forEach((f) => f(enabled));
}

function onToggle(f) {
  subs.push(f);
}

export { isEnabled, setEnabled, onToggle };
