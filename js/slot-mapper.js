// js/slot-mapper.js — Maps fddb entries to meal slots

// fddb Zeitfenster → App-Slots
// fddb Standard-Uhrzeiten bei reiner Slot-Auswahl (ohne manuelle Uhrzeit):
//   00:00       = fddb "Snack 3" Overflow → gehört zum VORTAG als snack3
//   06:30       = Frühstück
//   12:00       = Snack 1 (Skyr/Joghurt)
//   14:00       = Mittagessen (Every Bowl)
//   16:30       = Snack 2 (enthält Pre-Workout + Nachmittagssnack, Split per Produkterkennung)
//   20:00       = Abendessen (Brot, Gemüse, Aufschnitt, Ei)
//   22:00+      = Snack 3 / Post-Workout Shake
//
// Die Zeitfenster sind großzügig gewählt, damit auch leicht abweichende
// Uhrzeiten (z.B. 16:44 Milchschnitte, 19:53 manuelles Abendessen) korrekt landen.
const TIME_SLOT_MAP = [
  // 00:00 wird separat behandelt (→ Vortag snack3)
  { start: '00:01', end: '04:59', slot: 'snack3' },
  { start: '05:00', end: '09:59', slot: 'breakfast' },
  { start: '10:00', end: '13:29', slot: 'snack1' },
  { start: '13:30', end: '15:59', slot: 'lunch' },
  { start: '16:00', end: '17:59', slot: 'snack2' },
  { start: '18:00', end: '20:59', slot: 'dinner' },
  { start: '21:00', end: '23:59', slot: 'snack3' },
];

function timeToSlot(timeStr) {
  // 00:00 = fddb "Snack 3" Overflow: fddb's Snack-3-Slot geht bis 00:00,
  // aber der CSV-Export schreibt 00:00 auf den NÄCHSTEN Kalendertag.
  // Diese Items gehören zum Vortag → werden in parseFddbCsv umgehängt.
  // Hier als snack3 taggen (das Datum wird vorher korrigiert).
  if (timeStr === '00:00') return 'snack3';

  for (const { start, end, slot } of TIME_SLOT_MAP) {
    if (timeStr >= start && timeStr <= end) return slot;
  }
  return 'snack3'; // fallback
}

// Parse fddb CSV
export function parseFddbCsv(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Skip header
  const entries = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse semicolon-separated, handle quoted fields
    const fields = parseCsvLine(line);
    if (fields.length < 8) continue;

    const dateTimeStr = fields[0]; // "DD.MM.YYYY HH:MM"
    const bezeichnung = fields[1];
    const interneId = fields[2];
    const kj = parseGermanNumber(fields[3]);
    // fields[4] = kj_aktivitaeten (skip)
    const fat = parseGermanNumber(fields[5]);
    const carbs = parseGermanNumber(fields[6]);
    const protein = parseGermanNumber(fields[7]);

    // Parse date + time
    const dtMatch = dateTimeStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
    if (!dtMatch) continue;

    const [, dd, mm, yyyy, hh, mi] = dtMatch;
    let date = `${yyyy}-${mm}-${dd}`;
    const time = `${hh}:${mi}`;

    // 00:00 Einträge gehören zum Vortag: fddb's Snack-3-Slot (20:00–00:00)
    // exportiert Mitternacht-Items als 00:00 am Folgetag.
    if (time === '00:00') {
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      d.setDate(d.getDate() - 1);
      const py = d.getFullYear();
      const pm = String(d.getMonth() + 1).padStart(2, '0');
      const pd = String(d.getDate()).padStart(2, '0');
      date = `${py}-${pm}-${pd}`;
    }

    // kJ → kcal
    const kcal = Math.round((kj / 4.184) * 10) / 10;

    entries.push({
      date,
      time,
      food_name: bezeichnung,
      fddb_id: interneId || null,
      amount_label: bezeichnung, // full label like "150 g Banane, frisch"
      kcal,
      protein,
      carbs,
      fat,
    });
  }

  return entries;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) fields.push(current.trim());
  return fields;
}

function parseGermanNumber(str) {
  if (!str) return 0;
  // "2,3" → 2.3
  return parseFloat(str.replace(',', '.')) || 0;
}

// Assign slots to parsed entries
export function assignSlots(entries, dayConfigs, slotRules) {
  // dayConfigs: { 'YYYY-MM-DD': { day_type: 'workout'|'rest'|'friday' } }
  // slotRules: [{ pattern, target_slot, priority }]

  return entries.map(entry => {
    const dayConfig = dayConfigs[entry.date];
    const isWorkout = dayConfig?.day_type === 'workout';

    // Step 1: Assign by time window
    let slot = timeToSlot(entry.time);

    // Step 2: On workout days, split the snack2 block (16:00-17:59) using product rules.
    // fddb puts Pre-Workout (Reiswaffel, Banane) and Nachmittagssnack (Espresso, Schoko)
    // all on the same time (16:30). Product rules identify pre/post-workout items.
    if (isWorkout && slot === 'snack2' && slotRules.length > 0) {
      const matchedRule = findMatchingRule(entry.food_name, slotRules);
      if (matchedRule) {
        slot = matchedRule.target_slot;
      }
    }

    // Step 3: On workout days, split the snack3 block (21:00+) using product rules.
    // Post-Workout Shake (Whey, Casein) tracked as Snack 3 → should become postworkout.
    if (isWorkout && slot === 'snack3' && slotRules.length > 0) {
      const matchedRule = findMatchingRule(entry.food_name, slotRules);
      if (matchedRule) {
        slot = matchedRule.target_slot;
      }
    }

    return { ...entry, slot, slot_auto: true };
  });
}

// Apply time-block logic: if a lead product is found, pull companions
// Only applies to postworkout: all items at the same timestamp as a Whey/Casein
// should become postworkout (e.g. Hafermilch + Honig in the Shake).
// Does NOT apply to preworkout: the 16:30 block mixes Pre-Workout and Snack 2 items,
// and they should stay in their individually assigned slots.
export function applyTimeBlockLogic(entries) {
  // Group entries by date + time
  const groups = {};
  entries.forEach((entry, idx) => {
    const key = `${entry.date}_${entry.time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(idx);
  });

  const result = [...entries];
  for (const indices of Object.values(groups)) {
    if (indices.length <= 1) continue;

    // Only look for postworkout leads (not preworkout)
    let hasPostworkout = false;
    for (const idx of indices) {
      if (result[idx].slot === 'postworkout') {
        hasPostworkout = true;
        break;
      }
    }

    // If any entry in this block is postworkout, assign all to postworkout
    if (hasPostworkout) {
      for (const idx of indices) {
        result[idx] = { ...result[idx], slot: 'postworkout' };
      }
    }
  }

  return result;
}

function findMatchingRule(foodName, rules) {
  const nameLower = foodName.toLowerCase();
  let bestMatch = null;

  for (const rule of rules) {
    if (nameLower.includes(rule.pattern.toLowerCase())) {
      if (!bestMatch || rule.priority > bestMatch.priority) {
        bestMatch = rule;
      }
    }
  }

  return bestMatch;
}

// Full pipeline: parse CSV → filter by date → deduplicate → assign slots → apply time-block logic
const IMPORT_MIN_DATE = '2026-05-01';

export function processImport(csvText, dayConfigs, slotRules) {
  const parsed = parseFddbCsv(csvText);
  const filtered = parsed.filter(e => e.date >= IMPORT_MIN_DATE);

  // Deduplicate by (date, time, fddb_id) — keep last occurrence
  const seen = new Map();
  for (const entry of filtered) {
    const key = `${entry.date}_${entry.time}_${entry.fddb_id}`;
    seen.set(key, entry);
  }
  const unique = [...seen.values()];

  const withSlots = assignSlots(unique, dayConfigs, slotRules);
  const final = applyTimeBlockLogic(withSlots);
  return final;
}
