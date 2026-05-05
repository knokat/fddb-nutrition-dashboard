// js/helpers.js — Date utilities, formatting, macro calculations

// ── Date Helpers ──

const WEEKDAYS = ['SO.', 'MO.', 'DI.', 'MI.', 'DO.', 'FR.', 'SA.'];
const WEEKDAYS_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function today() {
  return fmtDate(new Date());
}

export function fmtDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekStart(d) {
  // Mealplan-Woche: Samstag bis Freitag
  const dt = d instanceof Date ? new Date(d) : parseDate(d);
  const day = dt.getDay();
  const diff = day === 6 ? 0 : -(day + 1);
  dt.setDate(dt.getDate() + diff);
  return fmtDate(dt);
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

export function getWeekDates(saturdayStr) {
  return Array.from({ length: 7 }, (_, i) => addDays(saturdayStr, i));
}

export function weekdayShort(dateStr) {
  return WEEKDAYS[parseDate(dateStr).getDay()];
}

export function weekdayLong(dateStr) {
  return WEEKDAYS_LONG[parseDate(dateStr).getDay()];
}

export function formatDateDisplay(dateStr) {
  const d = parseDate(dateStr);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

export function formatDateFull(dateStr) {
  const d = parseDate(dateStr);
  return `${weekdayLong(dateStr)}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function isToday(dateStr) {
  return dateStr === today();
}

export function isFuture(dateStr) {
  return dateStr > today();
}

export function getKW(dateStr) {
  const d = parseDate(dateStr);
  const onejan = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d - onejan) / 86400000);
  return Math.ceil((days + onejan.getDay() + 1) / 7);
}

// ── Default Day Type ──

export function defaultDayType(dateStr) {
  const dow = parseDate(dateStr).getDay();
  if (dow === 5) return 'friday';
  if (dow === 6) return 'workout'; // Samstag = Gym
  if (dow === 0) return 'rest';
  // Mo=1, Di=2, Mi=3, Do=4
  if (dow === 1 || dow === 3) return 'workout';
  return 'rest';
}

// ── Meal Slot Config ──

// Slots mit festen Labels (nicht mehr Rezeptnamen)
export const SLOT_CONFIG = {
  workout: [
    { key: 'breakfast',    label: 'Frühstück',    icon: '🥣' },
    { key: 'snack1',       label: 'Snack 1',      icon: '🍎' },
    { key: 'lunch',        label: 'Mittagessen',   icon: '🍽️' },
    { key: 'snack2',       label: 'Snack 2',      icon: '☕' },
    { key: 'preworkout',   label: 'Pre-Workout',  icon: '⚡' },
    { key: 'postworkout',  label: 'Post-Workout', icon: '🥤' },
    { key: 'dinner',       label: 'Abendessen',   icon: '🍞' },
    { key: 'snack3',       label: 'Snack 3',      icon: '🍫' },
  ],
  // Samstag: andere Reihenfolge (Gym morgens)
  workout_saturday: [
    { key: 'breakfast',    label: 'Frühstück',    icon: '🥣' },
    { key: 'postworkout',  label: 'Post-Workout', icon: '🥤' },
    { key: 'lunch',        label: 'Mittagessen',   icon: '🍽️' },
    { key: 'snack2',       label: 'Snack 2',      icon: '☕' },
    { key: 'dinner',       label: 'Abendessen',   icon: '🍞' },
    { key: 'snack3',       label: 'Snack 3',      icon: '🍫' },
  ],
  rest: [
    { key: 'breakfast',    label: 'Frühstück',    icon: '🥣' },
    { key: 'snack1',       label: 'Snack 1',      icon: '🍎' },
    { key: 'lunch',        label: 'Mittagessen',   icon: '🍽️' },
    { key: 'snack2',       label: 'Snack 2',      icon: '☕' },
    { key: 'dinner',       label: 'Abendessen',   icon: '🍞' },
    { key: 'snack3',       label: 'Snack 3',      icon: '🍫' },
  ],
  friday: [
    { key: 'breakfast',    label: 'Frühstück',    icon: '🥣' },
    { key: 'snack1',       label: 'Snack 1',      icon: '🍎' },
    { key: 'lunch',        label: 'Mittagessen',   icon: '🍽️' },
    { key: 'snack2',       label: 'Snack 2',      icon: '☕' },
    { key: 'dinner',       label: 'Abendessen',   icon: '🍞' },
    { key: 'snack3',       label: 'Snack 3',      icon: '🍫' },
  ],
};

export function getSlotsForType(dayType, dateStr) {
  // Samstag + Workout = spezielle Reihenfolge
  if (dayType === 'workout' && dateStr) {
    const dow = parseDate(dateStr).getDay();
    if (dow === 6) return SLOT_CONFIG.workout_saturday;
  }
  return SLOT_CONFIG[dayType] || SLOT_CONFIG.rest;
}

// ── Macro Helpers ──

export function sumMacros(entries) {
  return entries.reduce((acc, e) => ({
    kcal: acc.kcal + (Number(e.kcal) || 0),
    protein: acc.protein + (Number(e.protein) || 0),
    carbs: acc.carbs + (Number(e.carbs) || 0),
    fat: acc.fat + (Number(e.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

export function macroPercent(actual, target) {
  if (!target || target === 0) return 0;
  return Math.round((actual / target) * 100);
}

export function kcalColor(percent) {
  if (percent <= 100) return '#205781';
  if (percent <= 110) return '#623c6d';
  return '#A42059';
}

// Prozentuale Makro-Verteilung (IST)
export function macroDistribution(kcal, protein, carbs, fat) {
  if (!kcal || kcal === 0) return null;
  return {
    protein: Math.round((protein * 4 / kcal) * 100),
    carbs: Math.round((carbs * 4 / kcal) * 100),
    fat: Math.round((fat * 9 / kcal) * 100),
  };
}

export const MACRO_COLORS = {
  kcal: '#205781',
  protein: '#006D77',
  carbs: '#4F959D',
  fat: '#7AB2B2',
};

export const DAYTYPE_COLORS = {
  workout: '#A42059',
  rest: '#7AB2B2',
  friday: '#205781',
};

export const DAYTYPE_LABELS = {
  workout: 'Workout',
  rest: 'Rest Day',
  friday: 'Friday',
};

// ── Number Formatting ──

export function n0(v) { return Math.round(v || 0); }
export function n1(v) { return (v || 0).toFixed(1); }
