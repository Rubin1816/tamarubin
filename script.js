// Gieß-Logik: bis zu 10x pro Stunde (rolling window 60 Minuten)
// Bei jedem Gießen: Farbwechsel (grün→rot→gelb→pink→weiß→grün), sichtbares Wachstum
// "Tod": nach 3 Stunden ohne Gießen (kannst du leicht anpassen) → Demonstrationszweck
// Wenn du wieder Kalendertage willst, sag Bescheid – ich stelle die Schwelle zurück.

const STORAGE_KEY = 'treeState.v6';

const COLORS = ['green', 'red', 'yellow', 'pink', 'white'];
const HOUR_MS = 60 * 60 * 1000;
const MAX_WATERS_PER_HOUR = 10;
const HOURS_TO_DEAD = 3; // nach 3 Stunden ohne Gießen stirbt der Baum (fürs Testen schneller sichtbar)

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
        waterLog: [], // Zeitstempel der letzten Gießvorgänge
        version: 6
      };
    }
    const s = JSON.parse(raw);
    // Fallbacks
    s.waterLog = Array.isArray(s.waterLog) ? s.waterLog : [];
    if (typeof s.growth !== 'number') s.growth = 0;
    if (typeof s.colorIndex !== 'number') s.colorIndex = 0;
    if (typeof s.dead !== 'boolean') s.dead = false;
    return s;
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
function updateAliveState(state) {
  // Wenn seit dem letzten Gießen mehr als HOURS_TO_DEAD Stunden vergangen sind → tot
  if (state.lastWateredTs == null) {
    state.dead = false; // vor dem ersten Gießen nicht tot
    return state;
  }
  const elapsed = now() - state.lastWateredTs;
  state.dead = elapsed >= HOURS_TO_DEAD * HOUR_MS;
  return state;
}

// Wachstum: pro Gießen +7% Größe, begrenzt auf 250%
function computeScales(growth) {
  const step = 0.07;
  const maxScale = 2.5;
  const scale = Math.min(maxScale, 1 + growth * step);
  // Stamm darf etwas langsamer wachsen, für schönere Proportionen
  const trunkScale = Math.min(maxScale, 1 + growth * (step * 0.85));
  const crownScale = scale;
  return { trunkScale, crownScale };
}

function applyColorClass(treeEl, idx) {
  const classes = ['color-green','color-red','color-yellow','color-pink','color-white'];
  classes.forEach(c => treeEl.classList.remove(c));
  treeEl.classList.add(`color-${COLORS[idx]}`);
}

function render(state) {
  const container = document.querySelector('.container');
  const badge = document.getElementById('healthBadge');
  const streakEl = document.getElementById('streak');
  const lastEl = document.getElementById('lastWatered');
  const daysEl = document.getElementById('daysSince');
  const tree = document.getElementById('tree');
  const waterBtn = document.getElementById('waterBtn');

  container.classList.remove('alive', 'warning', 'dead');

  const watersThisHour = (pruneWaterLog(state), state.waterLog.length);

  if (state.dead) {
    container.classList.add('dead');
    badge.textContent = 'Status: Tot 🌧️';
    waterBtn.disabled = true;
  } else if (watersThisHour >= MAX_WATERS_PER_HOUR - 2) {
    container.classList.add('warning');
    badge.textContent = 'Status: Fast Limit ⏳';
    waterBtn.disabled = !canWaterNow(state);
  } else {
    container.classList.add('alive');
    badge.textContent = 'Status: Gesund 🌿';
    waterBtn.disabled = !canWaterNow(state);
  }

  // Farbe anwenden
  applyColorClass(tree, state.colorIndex);

  // Größe anwenden via CSS-Variablen
  const { trunkScale, crownScale } = computeScales(state.growth);
  tree.style.setProperty('--trunk-scale', trunkScale);
  tree.style.setProperty('--crown-scale', crownScale);

  streakEl.textContent = `Gieß-Zähler: ${state.growth}`;
  lastEl.textContent = `Zuletzt gegossen: ${state.lastWateredTs ? new Date(state.lastWateredTs).toLocaleTimeString() : '–'}`;
  daysEl.textContent = `Gießvorgänge in dieser Stunde: ${watersThisHour} / ${MAX_WATERS_PER_HOUR}`;
}

function rainEffect() {
  const area = document.getElementById('treeArea');
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

  const waterBtn = document.getElementById('waterBtn');
  const tree = document.getElementById('tree');

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
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }

  waterBtn.addEventListener('click', tryWater);
  tree.addEventListener('click', tryWater);

  document.getElementById('resetBtn').addEventListener('click', resetAll);

  // Regelmäßige Aktualisierung: Limit-Fenster und "Tod" überwachen
  setInterval(() => {
    let s = loadState();
    s = pruneWaterLog(s);
    s = updateAliveState(s);
    saveState(s);
    render(s);
  }, 5000);
});
