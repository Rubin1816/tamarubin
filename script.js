// Einfache Tamagotchi-Baum-Logik mit localStorage
// Regeln:
// - Pro Kalendertag genau einmal gießen
// - Tage ohne Gießen addieren sich; ab 3 Tagen = tot
// - Wachstum steigt um 1 pro Gießtag

const STORAGE_KEY = 'treeState.v1';

// Hilfsfunktionen für Datum ohne Uhrzeit (lokales Datum)
function todayKey(d = new Date()) {
  // YYYY-MM-DD (lokal)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function daysBetween(dateA, dateB) {
  // Nur Datum (Mitternacht local) vergleichen
  const a = new Date(dateA);
  const b = new Date(dateB);
  a.setHours(0,0,0,0);
  b.setHours(0,0,0,0);
  const diffMs = b - a;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      lastWateredDate: null, // 'YYYY-MM-DD'
      growth: 0,
      dead: false,
      missedDays: 0,
      createdDate: todayKey(),
      version: 1
    };
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Fallback bei korrupten Daten
    localStorage.removeItem(STORAGE_KEY);
    return loadState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateMissedDays(state) {
  const today = todayKey();
  // Wenn noch nie gegossen wurde, zählen verpasste Tage ab Erstellungsdatum
  const anchor = state.lastWateredDate || state.createdDate;
  const diff = daysBetween(anchor, today);
  // Wenn heute schon gegossen (anchor == today), diff = 0
  // Wenn z. B. anchor = vorgestern und heute = heute, diff = 2 => 1 Tag verpasst? Nein: 
  // Definition: Tage seit letztem Gießen (ohne den Gießtag). Also diff Tage.
  state.missedDays = Math.max(0, diff);
  if (state.missedDays >= 3) {
    state.dead = true;
  }
  return state;
}

function canWaterToday(state) {
  const today = todayKey();
  return !state.dead && state.lastWateredDate !== today;
}

function water(state) {
  if (!canWaterToday(state)) return state;

  const today = todayKey();
  state.lastWateredDate = today;
  state.growth = (state.growth || 0) + 1;
  state.missedDays = 0; // reset, weil heute gegossen
  state.dead = false;   // falls zuvor gewarnt, wieder gesund
  saveState(state);
  return state;
}

function growthStage(growth) {
  if (growth < 2) return 'tree-small';
  if (growth < 5) return 'tree-medium';
  if (growth < 10) return 'tree-large';
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

  // Klassen für Status
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

  // Baumgröße
  tree.className = ''; // reset
  tree.classList.add(growthStage(state.growth));

  streakEl.textContent = `Gieß-Tage: ${state.growth}`;
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
  // Beim Laden prüfen, ob Baum aufgrund verpasster Tage stirbt
  state = updateMissedDays(state);
  saveState(state);
  render(state);

  // Klick-Handler: Baum gießen
  const waterBtn = document.getElementById('waterBtn');
  const tree = document.getElementById('tree');
  function tryWater() {
    let s = loadState();
    if (!canWaterToday(s)) return;
    s = water(s);
    rainEffect();
    // Nach dem Gießen neu berechnen und rendern
    s = updateMissedDays(s);
    saveState(s);
    render(s);
  }
  waterBtn.addEventListener('click', tryWater);
  tree.addEventListener('click', tryWater);

  // Neustart
  document.getElementById('resetBtn').addEventListener('click', resetAll);
});
