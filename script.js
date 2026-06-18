// Einfache Tageslogik ohne Regler: 1 Kalendertag pro "Tag"
// - Pro Tag einmal gießen -> growth +1
// - 3 verpasste Tage => tot
// - Wachstumsstufen von seed bis giant

const STORAGE_KEY = 'treeState.v4'; // neue Version, um alte Regler-Konfig zu ignorieren

// Hilfsfunktionen für Kalendertage (lokal)
function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  a.setHours(0,0,0,0);
  b.setHours(0,0,0,0);
  const diffMs = b - a;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        lastWateredDate: null, // 'YYYY-MM-DD'
        growth: 0,             // 0 = seed
        dead: false,
        missedDays: 0,
        createdDate: todayKey(),
        version: 4
      };
    }
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return loadState();
  }
}
function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function canWaterToday(state) {
  return !state.dead && state.lastWateredDate !== todayKey();
}

function updateMissedDays(state) {
  const today = todayKey();
  const anchor = state.lastWateredDate || state.createdDate;
  const diff = daysBetween(anchor, today);
  state.missedDays = Math.max(0, diff);
  if (state.missedDays >= 3) state.dead = true;
  return state;
}

function water(state) {
  if (!canWaterToday(state)) return state;
  state.lastWateredDate = todayKey();
  state.growth = (state.growth || 0) + 1;
  state.missedDays = 0;
  state.dead = false;
  saveState(state);
  return state;
}

// Wachstumsstufen: 0 seed, 1 sprout, 2 seedling, 3 sapling, 4-6 small, 7-11 medium, 12-17 large, 18+ giant
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
  const container = document.querySelector('.container');
  const badge = document.getElementById('healthBadge');
  const streakEl = document.getElementById('streak');
  const lastEl = document.getElementById('lastWatered');
  const daysEl = document.getElementById('daysSince');
  const tree = document.getElementById('tree');
  const waterBtn = document.getElementById('waterBtn');

  container.classList.remove('alive', 'warning', 'dead');

  if (state.dead) {
    container.classList.add('dead');
    badge.textContent = 'Status: Tot 🌧️';
    waterBtn.disabled = true;
  } else if (state.missedDays >= 2) {
    container.classList.add('warning');
    badge.textContent = 'Status: Kritisch! 🥀';
    waterBtn.disabled = !canWaterToday(state);
  } else {
    container.classList.add('alive');
    badge.textContent = 'Status: Gesund 🌿';
    waterBtn.disabled = !canWaterToday(state);
  }

  tree.className = '';
  tree.classList.add(growthStageClass(state.growth));

  streakEl.textContent = `Gieß-Zähler: ${state.growth}`;
  lastEl.textContent = `Zuletzt gegossen: ${state.lastWateredDate ? state.lastWateredDate : '–'}`;
  daysEl.textContent = `Tage seit letztem Gießen: ${state.lastWateredDate ? state.missedDays : '–'}`;
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
  render(updateMissedDays(init));
}

document.addEventListener('DOMContentLoaded', () => {
  let state = loadState();
  state = updateMissedDays(state);
  saveState(state);
  render(state);

  const waterBtn = document.getElementById('waterBtn');
  const tree = document.getElementById('tree');
  function tryWater() {
    let s = loadState();
    if (!canWaterToday(s)) return;
    s = water(s);
    rainEffect();
    s = updateMissedDays(s);
    saveState(s);
    render(s);
  }
  waterBtn.addEventListener('click', tryWater);
  tree.addEventListener('click', tryWater);

  document.getElementById('resetBtn').addEventListener('click', resetAll);

  // Einmal pro Minute neu bewerten (optional, für visuelle Aktualisierung über Mitternacht)
  setInterval(() => {
    let s = loadState();
    s = updateMissedDays(s);
    saveState(s);
    render(s);
  }, 60000);
});
