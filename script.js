// Erweiterte Baum-Logik:
// - Bis zu 40x pro rollierender Stunde gießen
// - Farbwechsel pro Gießen (grün→rot→gelb→pink→weiß→…)
// - Wachstum Stamm+Krone bis Max; danach wachsen rosa Blüten separat
// - Abendrot bei jedem 10. Gießen (kurz)
// - "Tod" nach 3 Stunden ohne Gießen (Demo)

const STORAGE_KEY = 'treeState.v9';

const COLORS = ['green', 'red', 'yellow', 'pink', 'white'];
const HOUR_MS = 60 * 60 * 1000;
const MAX_WATERS_PER_HOUR = 40;
const HOURS_TO_DEAD = 3;

// Wachstums-Parameter
const CROWN_STEP = 0.065;        // pro Gießen ~6.5%
const TRUNK_FACTOR = 0.9;
const CROWN_MAX = 2.4;           // Maximal-Skalierung Krone
const TRUNK_MAX = 2.2;           // Maximal-Skalierung Stamm

// Blüten-Parameter
const BLOSSOM_START_SCALE = 0.6; // Startgröße der Blüten, wenn Baum max erreicht
const BLOSSOM_STEP = 0.06;       // pro Gießen wachsen Blüten zusätzlich
const BLOSSOM_MAX = 1.8;         // Obergrenze für Blüten-Skalierung

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
        blossomGrowth: 0, // zusätzliche Wachstums-Schritte für Blüten nach Maxgröße
        version: 9
      };
    }
    const s = JSON.parse(raw);
    return {
      lastWateredTs: typeof s.lastWateredTs === 'number' ? s.lastWateredTs : null,
      growth: Number.isFinite(s.growth) ? s.growth : 0,
      colorIndex: Number.isFinite(s.colorIndex) ? s.colorIndex % COLORS.length : 0,
      dead: !!s.dead,
      waterLog: Array.isArray(s.waterLog) ? s.waterLog.filter(t => typeof t === 'number') : [],
      blossomGrowth: Number.isFinite(s.blossomGrowth) ? s.blossomGrowth : 0,
      version: 9
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
    state.dead = false;
    return state;
  }
  const elapsed = now() - state.lastWateredTs;
  state.dead = elapsed >= HOURS_TO_DEAD * HOUR_MS;
  return state;
}

function atMaxSize(state) {
  // Prüfe, ob Krone/Stamm bereits Max erreicht hätten
  const crownScale = Math.min(CROWN_MAX, 1 + state.growth * CROWN_STEP);
  return crownScale >= CROWN_MAX - 1e-6;
}

function water(state) {
  if (!canWaterNow(state)) return state;
  const t = now();
  state.lastWateredTs = t;
  state.waterLog.push(t);
  state.colorIndex = (state.colorIndex + 1) % COLORS.length;

  // Wenn Baum noch nicht max: normales Wachstum
  // Wenn Baum max: krone/stamm bleiben max, Blüten wachsen separat
  if (!atMaxSize(state)) {
    state.growth += 1;
  } else {
    state.blossomGrowth += 1;
  }

  state.dead = false;
  pruneWaterLog(state);
  saveState(state);
  return state;
}

// Skalen berechnen
function computeTreeScales(growth) {
  const crown = Math.min(CROWN_MAX, 1 + growth * CROWN_STEP);
  const trunk = Math.min(TRUNK_MAX, 1 + growth * (CROWN_STEP * TRUNK_FACTOR));
  return { trunkScale: trunk, crownScale: crown };
}
function computeBlossomScale(state) {
  if (!atMaxSize(state)) return 0; // solange nicht max, keine Blüten
  const scale = BLOSSOM_START_SCALE + state.blossomGrowth * BLOSSOM_STEP;
  return Math.min(BLOSSOM_MAX, scale);
}

function applyColorClass(treeEl, idx) {
  const classes = ['color-green','color-red','color-yellow','color-pink','color-white'];
  classes.forEach(c => treeEl.classList.remove(c));
  treeEl.classList.add(`color-${COLORS[idx]}`);
}

function ensureBlossomsExist() {
  const tree = $('#tree');
  let blossoms = tree.querySelector('.blossoms');
  if (!blossoms) {
    blossoms = document.createElement('div');
    blossoms.className = 'blossoms';
    // 8 kleine Blüten
    for (let i = 1; i <= 8; i++) {
      const b = document.createElement('div');
      b.className = `b p${i}`;
      blossoms.appendChild(b);
    }
    tree.appendChild(blossoms);
  }
  return blossoms;
}

function triggerEveningIfMilestone(state) {
  if ((state.growth + state.blossomGrowth) > 0 && (state.growth + state.blossomGrowth) % 10 === 0) {
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

  // Baum-Skalen
  const { trunkScale, crownScale } = computeTreeScales(state.growth);
  tree.style.setProperty('--trunk-scale', trunkScale);
  tree.style.setProperty('--crown-scale', crownScale);

  // Blüten-Logik
  const blossoms = ensureBlossomsExist();
  const blossomScale = computeBlossomScale(state);
  if (blossomScale > 0) {
    tree.classList.add('blooming');
    tree.style.setProperty('--blossom-scale', blossomScale);
  } else {
    tree.classList.remove('blooming');
    tree.style.removeProperty('--blossom-scale');
  }

  // Texte
  const totalActions = state.growth + state.blossomGrowth;
  streakEl.textContent = `Gieß-Zähler: ${totalActions}`;
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

  // Regelmäßige Aktualisierung
  setInterval(() => {
    let s = loadState();
    s = pruneWaterLog(s);
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }, 5000);
});
