const STORAGE_KEY = 'treeState.v3';
const CONFIG_KEY  = 'treeConfig.v2';
const DEFAULT_INTERVAL_MINUTES = 1440;

const qs  = (s) => document.querySelector(s);

function now() { return Date.now(); }

function loadConfig() {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || {};
    return { intervalMinutes: c.intervalMinutes || DEFAULT_INTERVAL_MINUTES };
  } catch { return { intervalMinutes: DEFAULT_INTERVAL_MINUTES }; }
}
function saveConfig(cfg) { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); }

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return s || { lastWateredTs: null, growth: 0, dead: false, missedIntervals: 0, createdTs: now(), version: 3 };
  } catch {
    return { lastWateredTs: null, growth: 0, dead: false, missedIntervals: 0, createdTs: now(), version: 3 };
  }
}
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function msPerInterval() { return loadConfig().intervalMinutes * 60 * 1000; }

function computeMissedIntervals(state) {
  const anchor = state.lastWateredTs ?? state.createdTs;
  const elapsed = Math.max(0, now() - anchor);
  return Math.floor(elapsed / msPerInterval());
}
function updateMissed(state) {
  state.missedIntervals = computeMissedIntervals(state);
  if (state.missedIntervals >= 3) state.dead = true;
  return state;
}
function canWaterNow(state) {
  if (state.dead) return false;
  if (state.lastWateredTs === null) return true;
  return computeMissedIntervals(state) >= 1;
}
function water(state) {
  if (!canWaterNow(state)) return state;
  state.lastWateredTs = now();
  state.growth = (state.growth || 0) + 1;
  state.missedIntervals = 0;
  state.dead = false;
  saveState(state);
  return state;
}

function growthStageClass(growth) {
  if (growth <= 0) return 'tree-seed';
  if (growth <= 1) return 'tree-sprout';
  if (growth <= 2) return 'tree-seedling';
  if (growth <= 3) return 'tree-sapling';
  if (growth <= 6) return 'tree-small';
  if (growth <= 11) return 'tree-medium';
  if (growth <= 17) return 'tree-large';
  return 'tree-giant';
}

function render(state) {
  const container = qs('.container');
  const badge = qs('#healthBadge');
  const streakEl = qs('#streak');
  const lastEl = qs('#lastWatered');
  const daysEl = qs('#daysSince');
  const tree = qs('#tree');
  const waterBtn = qs('#waterBtn');

  container.classList.remove('alive', 'warning', 'dead');

  if (state.dead) {
    container.classList.add('dead');
    badge.textContent = 'Status: Tot 🌧️';
    waterBtn.disabled = true;
  } else if (state.missedIntervals >= 2) {
    container.classList.add('warning');
    badge.textContent = 'Status: Kritisch! 🥀';
    waterBtn.disabled = !canWaterNow(state);
  } else {
    container.classList.add('alive');
    badge.textContent = 'Status: Gesund 🌿';
    waterBtn.disabled = !canWaterNow(state);
  }

  const mins = loadConfig().intervalMinutes;
  const lastStr = state.lastWateredTs ? new Date(state.lastWateredTs).toLocaleString() : '–';

  tree.className = '';
  tree.classList.add(growthStageClass(state.growth));

  streakEl.textContent = `Gieß-Zähler: ${state.growth}`;
  lastEl.textContent = `Zuletzt gegossen: ${lastStr}`;
  daysEl.textContent = `Verpasste Intervalle: ${state.lastWateredTs ? state.missedIntervals : '–'} (Intervall: ${mins} Min)`;
}

function rainEffect() {
  const area = qs('#treeArea');
  for (let i = 0; i < 12; i++) {
    const drop = document.createElement('div');
    drop.className = 'drop';
    drop.style.left = `${30 + Math.random()*40}%`;
    drop.style.animationDelay = `${i * 40}ms`;
    area.appendChild(drop);
    setTimeout(() => drop.remove(), 900);
  }
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  const init = loadState();
  saveState(init);
  render(updateMissed(init));
}

function initIntervalControls() {
  const slider = qs('#intervalMinutes');
  const label = qs('#intervalLabel');
  const cfg = loadConfig();
  slider.value = String(cfg.intervalMinutes);
  label.textContent = String(cfg.intervalMinutes);

  slider.addEventListener('input', (e) => {
    label.textContent = String(parseInt(e.target.value, 10));
  });
  slider.addEventListener('change', (e) => {
    const val = Math.max(1, parseInt(e.target.value, 10) || DEFAULT_INTERVAL_MINUTES);
    saveConfig({ intervalMinutes: val });
    let s = loadState();
    s = updateMissed(s);
    saveState(s);
    render(s);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initIntervalControls();

  let state = loadState();
  state = updateMissed(state);
  saveState(state);
  render(state);

  const waterBtn = qs('#waterBtn');
  const tree = qs('#tree');
  function tryWater() {
    let s = loadState();
    if (!canWaterNow(s)) return;
    s = water(s);
    rainEffect();
    s = updateMissed(s);
    saveState(s);
    render(s);
  }
  waterBtn.addEventListener('click', tryWater);
  tree.addEventListener('click', tryWater);

  qs('#resetBtn').addEventListener('click', resetAll);

  setInterval(() => {
    let s = loadState();
    s = updateMissed(s);
    saveState(s);
    render(s);
  }, 5000);
});
