// Baum mit Farbwechsel (grün → rot → gelb → pink → weiß) und kontinuierlichem Wachstum
// - Pro Kalendertag einmal gießen => growth +1 und Farbindex +1 (zyklisch)
// - 3 verpasste Tage => tot
// - Start: klein; wächst bei jedem Gießen per Skalierung (Stamm + Krone)

const STORAGE_KEY = 'treeState.v5';

// Datumshilfen (Kalendertage, lokal)
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

// Farben in Reihenfolge
const COLORS = ['green', 'red', 'yellow', 'pink', 'white'];

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        lastWateredDate: null, // 'YYYY-MM-DD'
        growth: 0,             // Wachstumsschritte
        colorIndex: 0,         // zeigt auf COLORS
        dead: false,
        missedDays: 0,
        createdDate: todayKey(),
        version: 5
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
  state.colorIndex = (state.colorIndex + 1) % COLORS.length; // Farbe weiterschalten
  state.missedDays = 0;
  state.dead = false;
  saveState(state);
  return state;
}

// Wachstumsdarstellung: kontinuierliche Skalierung
// Basisskalen (klein starten), Wachstum pro Gießen: +6% Größe bis Max
function computeScales(growth) {
  const baseTrunk = 1.0;    // Stamm-Basis
  const baseCrown = 1.0;    // Krone-Basis
  const step = 0.06;        // pro Gießen 6% größer
  const maxScale = 2.2;     // obere Grenze
  const trunkScale = Math.min(maxScale, baseTrunk + growth * step);
  const crownScale = Math.min(maxScale, baseCrown + growth * step);
  return { trunkScale, crownScale };
}

function applyColorClass(treeEl, colorIndex) {
  // alle Farbklassen entfernen, neue hinzufügen
  const classes = ['color-green','color-red','color-yellow','color-pink','color-white'];
  classes.forEach(c => treeEl.classList.remove(c));
  const cname = `color-${COLORS[colorIndex]}`;
  treeEl.classList.add(cname);
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

  // Farbe anwenden
  applyColorClass(tree, state.colorIndex);

  // Größe anwenden (Skalierung Stamm + Krone)
  const { trunkScale, crownScale } = computeScales(state.growth);
  // Setze CSS-Varianten via style.transform auf den ::before/::after-Elementen:
  // Wir nutzen CSS-Variablen durch Inline-Styles tricksen? Pseudo-Elemente nehmen kein Inline-Style an.
  // Lösung: setze transform auf den Container und kompensiere Position.
  // Besser: wir steuern beide Pseudo-Elemente über CSS-Variablen.
  tree.style.setProperty('--trunk-scale', trunkScale);
  tree.style.setProperty('--crown-scale', crownScale);

  // Da Pseudo-Elemente keine Inline-Styles lesen, definieren wir diese Variablen in CSS via transform: scale(var(--...))
  // (siehe unten in ensureScaleStyles())

  streakEl.textContent = `Gieß-Zähler: ${state.growth}`;
  lastEl.textContent = `Zuletzt gegossen: ${state.lastWateredDate ? state.lastWateredDate : '–'}`;
  daysEl.textContent = `Tage seit letztem Gießen: ${state.lastWateredDate ? state.missedDays : '–'}`;
}

function ensureScaleStyles() {
  // Fügt einmalig CSS ein, damit ::before/::after die Skalierung aus Variablen lesen.
  if (document.getElementById('dynamic-scale-style')) return;
  const style = document.createElement('style');
  style.id = 'dynamic-scale-style';
  style.textContent = `
    #tree::before { transform: translateX(-50%) scale(var(--trunk-scale, 1)); }
    #tree::after  { transform: translateX(-50%) scale(var(--crown-scale, 1)); }
  `;
  document.head.appendChild(style);
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
  ensureScaleStyles();

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

  // Über Nacht Status aktualisieren
  setInterval(() => {
    let s = loadState();
    s = updateMissedDays(s);
    saveState(s);
    render(s);
  }, 60000);
});
