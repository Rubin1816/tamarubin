// Stabil mit klarer Blüten-Schwelle und Fail-safes
const STORAGE_KEY = 'treeState.final.2';

const COLORS = ['green', 'red', 'yellow', 'pink', 'white'];
const HOUR_MS = 60 * 60 * 1000;
const MAX_WATERS_PER_HOUR = 40;
const HOURS_TO_DEAD = 3;

// Wachstums-Parameter
const CROWN_STEP = 0.06;        // pro Gießen ~6%
const TRUNK_FACTOR = 0.85;
const CROWN_MAX = 2.5;
const TRUNK_MAX = 2.3;
const BLOOM_THRESHOLD = 0.95;   // ab 95% der Max-Krone beginnt Blüte

// Blüten-Parameter
const BLOSSOM_START_SCALE = 0.6; // Startgröße bei erstmaliger Blüte
const BLOSSOM_STEP = 0.08;       // pro Gießen wächst die Blüte
const BLOSSOM_MAX = 2.0;         // Obergrenze

const $ = (sel) => document.querySelector(sel);
function now() { return Date.now(); }

function initBlossoms() {
  const blossoms = $('#blossoms');
  if (blossoms.children.length === 0) {
    for (let i = 1; i <= 8; i++) {
      const b = document.createElement('div');
      b.className = `b p${i}`;
      blossoms.appendChild(b);
    }
  }
}

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
        blossomGrowth: 0,
        version: 2
      };
    }
    const s = JSON.parse(raw);
    return {
      lastWateredTs: typeof s.lastWateredTs === 'number' ? s.lastWateredTs : null,
      growth: Number.isFinite(s.growth) ? s.growth : 0,
      colorIndex: Number.isFinite(s.colorIndex) ? (s.colorIndex % COLORS.length + COLORS.length) % COLORS.length : 0,
      dead: !!s.dead,
      waterLog: Array.isArray(s.waterLog) ? s.waterLog.filter(t => typeof t === 'number') : [],
      blossomGrowth: Number.isFinite(s.blossomGrowth) ? s.blossomGrowth : 0,
      version: 2
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
  if (state.lastWateredTs == null) { state.dead = false; return state; }
  const elapsed = now() - state.lastWateredTs;
  state.dead = elapsed >= HOURS_TO_DEAD * HOUR_MS;
  return state;
}

function crownScaleFromGrowth(growth) {
  return Math.min(CROWN_MAX, 1 + growth * CROWN_STEP);
}
function isBloomStage(state) {
  const crown = crownScaleFromGrowth(state.growth);
  const fraction = crown / CROWN_MAX;
  return fraction >= BLOOM_THRESHOLD - 1e-6;
}

function water(state) {
  if (!canWaterNow(state)) return state;
  const t = now();
  state.lastWateredTs = t;
  state.waterLog.push(t);
  state.colorIndex = (state.colorIndex + 1) % COLORS.length;

  if (!isBloomStage(state)) {
    state.growth += 1;  // Baum wächst
  } else {
    // Blüte aktiv: Krone/Stamm bleiben (nahe) Max, Blüten wachsen
    state.blossomGrowth = Math.max(1, state.blossomGrowth + 1);
  }

  state.dead = false;
  pruneWaterLog(state);
  saveState(state);
  return state;
}

// Skalen berechnen
function computeTreeScales(growth) {
  const crown = crownScaleFromGrowth(growth);
  const trunk = Math.min(TRUNK_MAX, 1 + growth * (CROWN_STEP * TRUNK_FACTOR));
  return { trunkScale: trunk, crownScale: crown };
}
function computeBlossomScale(state) {
  if (!isBloomStage(state)) return 0;
  if (state.blossomGrowth <= 0) return 0;
  const scale = BLOSSOM_START_SCALE + (state.blossomGrowth - 1) * BLOSSOM_STEP;
  return Math.min(BLOSSOM_MAX, scale);
}

function applyColorClass(treeEl, idx) {
  const classes = ['color-green','color-red','color-yellow','color-pink','color-white'];
  classes.forEach(c => treeEl.classList.remove(c));
  treeEl.classList.add(`color-${COLORS[idx]}`);
}

function triggerEveningIfMilestone(totalCount) {
  if (totalCount > 0 && totalCount % 10 === 0) {
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
  const debugEl = $('#debug');
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
  applyColorClass($('#tree'), state.colorIndex);

  // Baum-Skalen
  const { trunkScale, crownScale } = computeTreeScales(state.growth);
  $('#trunk').style.setProperty('--trunk-scale', trunkScale);
  $('#crown').style.setProperty('--crown-scale', crownScale);

  // Blüten
  const blossomScale = computeBlossomScale(state);
  const blossomsEl = $('#blossoms');
  if (blossomScale > 0) {
    $('#tree').classList.add('blooming');
    blossomsEl.style.setProperty('--blossom-scale', blossomScale);
    blossomsEl.style.opacity = '1';
  } else {
    $('#tree').classList.remove('blooming');
    blossomsEl.style.removeProperty('--blossom-scale');
    blossomsEl.style.opacity = '0';
  }

  // Texte
  const totalActions = state.growth + state.blossomGrowth;
  streakEl.textContent = `Gieß-Zähler: ${totalActions}`;
  lastEl.textContent = `Zuletzt gegossen: ${state.lastWateredTs ? new Date(state.lastWateredTs).toLocaleTimeString() : '–'}`;
  hourEl.textContent = `Gießvorgänge in dieser Stunde: ${watersThisHour} / ${MAX_WATERS_PER_HOUR}`;

  // Debug-Infos, um Blütenzustand zu prüfen
  const bloomPct = Math.round((crownScale / CROWN_MAX) * 100);
  debugEl.textContent = `Debug: crownScale=${crownScale.toFixed(2)} (${bloomPct}% von Max), blossomGrowth=${state.blossomGrowth}, blossomScale=${blossomScale.toFixed(2)}, bloomStage=${isBloomStage(state)}`;
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
  initBlossoms();

  let state = loadState();
  state = pruneWaterLog(state);
  state = updateAliveState(state);
  saveState(state);
  render(state);

  function tryWater() {
    let s = loadState();
    s = pruneWaterLog(s);
    s = updateAliveState(s);
    if (!canWaterNow(s)) { render(s); return; }
    s = water(s);
    rainEffect();
    const total = s.growth + s.blossomGrowth;
    triggerEveningIfMilestone(total);
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }

  $('#waterBtn').addEventListener('click', tryWater);
  $('#tree').addEventListener('click', tryWater);
  $('#resetBtn').addEventListener('click', resetAll);

  // Test-Button: Blüte erzwingen (setzt den Baum in Bloom-Stage und zeigt Blüten sofort)
  $('#forceBloomBtn').addEventListener('click', () => {
    let s = loadState();
    // Setze growth so, dass Krone knapp über die Schwelle kommt
    const neededGrowth = Math.ceil(((CROWN_MAX * BLOOM_THRESHOLD) - 1) / CROWN_STEP);
    s.growth = Math.max(s.growth, neededGrowth);
    s.blossomGrowth = Math.max(1, s.blossomGrowth);
    s.lastWateredTs = now();
    saveState(s);
    render(updateAliveState(s));
  });

  // Regelmäßige Aktualisierung
  setInterval(() => {
    let s = loadState();
    s = pruneWaterLog(s);
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }, 5000);
});
