// Baum-Logik (robuste, geprüfte Version):
// - Bis zu 40x pro rollierender Stunde gießen
// - Bei jedem Gießen: Farbwechsel (grün→rot→gelb→pink→weiß→…)
// - Sichtbares Wachstum (Stamm + Krone skalieren via CSS-Variablen)
// - Abendrot bei jedem 10. Gießen für 3 Sekunden
// - "Tod" nach 3 Stunden ohne Gießen (Demo; leicht anpassbar)

const STORAGE_KEY = 'treeState.v8';

const COLORS = ['green', 'red', 'yellow', 'pink', 'white'];
const HOUR_MS = 60 * 60 * 1000;
const MAX_WATERS_PER_HOUR = 40;
const HOURS_TO_DEAD = 3;

const $ = (sel) => document.querySelector(sel);
function now() { return Date.now(); }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        lastWateredTs: null,
        growth: 0,
        colorIndex: 0,
        dead: false,
        waterLog: [],
        version: 8
      };
    }
    const s = JSON.parse(raw);
    return {
      lastWateredTs: typeof s.lastWateredTs === 'number' ? s.lastWateredTs : null,
      growth: Number.isFinite(s.growth) ? s.growth : 0,
      colorIndex: Number.isFinite(s.colorIndex) ? s.colorIndex % COLORS.length : 0,
      dead: !!s.dead,
      waterLog: Array.isArray(s.waterLog) ? s.waterLog.filter(t => typeof t === 'number') : [],
      version: 8
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return loadState();
  }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function pruneWaterLog(state) {
  const cutoff = now() - HOUR_MS;
  state.waterLog = state.waterLog.filter(t => t >= cutoff);
  return state;
}

function canWaterNow(state) {
  if (state.dead) return false;
  pruneWaterLog(state);
  return state.waterLog.length < MAX_WATERS_PER_HOUR;
}

function updateAliveState(state) {
  if (state.lastWateredTs == null) {
    state.dead = false; // vor dem ersten Gießen lebt er
    return state;
  }
  const elapsed = now() - state.lastWateredTs;
  state.dead = elapsed >= HOURS_TO_DEAD * HOUR_MS;
  return state;
}

function water(state) {
  if (!canWaterNow(state)) return state;
  const t = now();
  state.lastWateredTs = t;
  state.waterLog.push(t);
  state.growth += 1;
  state.colorIndex = (state.colorIndex + 1) % COLORS.length;
  state.dead = false;
  pruneWaterLog(state);
  saveState(state);
  return state;
}

// Wachstum: pro Gießen ~6.5%, Max Krone 2.4x / Stamm 2.2x
function computeScales(growth) {
  const step = 0.065;
  const crownMax = 2.4;
  const trunkMax = 2.2;
  const crownScale = Math.min(crownMax, 1 + growth * step);
  const trunkScale = Math.min(trunkMax, 1 + growth * (step * 0.9));
  return { trunkScale, crownScale };
}

function applyColorClass(treeEl, idx) {
  const classes = ['color-green','color-red','color-yellow','color-pink','color-white'];
  classes.forEach(c => treeEl.classList.remove(c));
  treeEl.classList.add(`color-${COLORS[idx]}`);
}

function triggerEveningIfMilestone(state) {
  if (state.growth > 0 && state.growth % 10 === 0) {
    const area = $('#treeArea');
    area.classList.add('evening');
    setTimeout(() => area.classList.remove('evening'), 3000);
  }
}

function render(state) {
  const container = $('.container');
  const badge = $('#healthBadge');
  const streakEl = $('#streak');
  const lastEl = $('#lastWatered');
  const hourEl = $('#hourInfo');
  const tree = $('#tree');
  const waterBtn = $('#waterBtn');

  // Status/Buttons
  container.classList.remove('alive', 'warning', 'dead');

  const watersThisHour = (pruneWaterLog(state), state.waterLog.length);

  if (state.dead) {
    container.classList.add('dead');
    badge.textContent = 'Status: Tot 🌧️';
    waterBtn.disabled = true;
  } else if (watersThisHour >= MAX_WATERS_PER_HOUR - 5) {
    container.classList.add('warning');
    badge.textContent = 'Status: Fast Limit ⏳';
    waterBtn.disabled = !canWaterNow(state);
  } else {
    container.classList.add('alive');
    badge.textContent = 'Status: Gesund 🌿';
    waterBtn.disabled = !canWaterNow(state);
  }

  // Farbe
  applyColorClass(tree, state.colorIndex);

  // Größe über CSS-Variablen
  const { trunkScale, crownScale } = computeScales(state.growth);
  tree.style.setProperty('--trunk-scale', trunkScale);
  tree.style.setProperty('--crown-scale', crownScale);

  // Texte
  streakEl.textContent = `Gieß-Zähler: ${state.growth}`;
  lastEl.textContent = `Zuletzt gegossen: ${state.lastWateredTs ? new Date(state.lastWateredTs).toLocaleTimeString() : '–'}`;
  hourEl.textContent = `Gießvorgänge in dieser Stunde: ${watersThisHour} / ${MAX_WATERS_PER_HOUR}`;
}

function rainEffect() {
  const area = $('#treeArea');
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
  render(updateAliveState(init));
}

document.addEventListener('DOMContentLoaded', () => {
  let state = loadState();
  state = pruneWaterLog(state);
  state = updateAliveState(state);
  saveState(state);
  render(state);

  const waterBtn = $('#waterBtn');
  const tree = $('#tree');

  function tryWater() {
    let s = loadState();
    s = pruneWaterLog(s);
    s = updateAliveState(s);
    if (!canWaterNow(s)) {
      render(s);
      return;
    }
    s = water(s);
    rainEffect();
    triggerEveningIfMilestone(s);
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }

  waterBtn.addEventListener('click', tryWater);
  tree.addEventListener('click', tryWater);

  $('#resetBtn').addEventListener('click', resetAll);

  // Regelmäßig Status aktualisieren (Limitfenster/Tod)
  setInterval(() => {
    let s = loadState();
    s = pruneWaterLog(s);
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }, 5000);
});
