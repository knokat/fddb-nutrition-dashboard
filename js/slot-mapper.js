// js/slot-mapper.js — Maps fddb entries to meal slots

// fddb Zeitfenster → App-Slots
const TIME_SLOT_MAP = [
  { start: '00:00', end: '08:59', slot: 'breakfast' },
  { start: '09:00', end: '10:59', slot: 'snack1' },
  { start: '11:00', end: '12:59', slot: 'lunch' },
  { start: '13:00', end: '15:59', slot: 'snack2' },
  { start: '16:00', end: '19:59', slot: 'dinner' },
  { start: '20:00', end: '23:59', slot: 'snack3' },
];

function timeToSlot(timeStr) {
  // timeStr = "HH:MM"
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
    const date = `${yyyy}-${mm}-${dd}`;
    const time = `${hh}:${mi}`;

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

    // Step 2: If snack3 block (20:00-23:59) AND workout day → check rules
    if (slot === 'snack3' && isWorkout && slotRules.length > 0) {
      const matchedRule = findMatchingRule(entry.food_name, slotRules);
      if (matchedRule) {
        slot = matchedRule.target_slot;
      }
    }

    return { ...entry, slot, slot_auto: true };
  });
}

// Apply time-block logic: if a lead product is found, pull companions
export function applyTimeBlockLogic(entries) {
  // Group entries by date + time
  const groups = {};
  entries.forEach((entry, idx) => {
    const key = `${entry.date}_${entry.time}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(idx);
  });

  // For each time block: if any entry was assigned preworkout/postworkout,
  // assign all entries in the same time block to the same slot
  const result = [...entries];
  for (const indices of Object.values(groups)) {
    if (indices.length <= 1) continue;

    // Find if any entry in this block has a workout slot
    let workoutSlot = null;
    let highestPriority = -1;

    for (const idx of indices) {
      const e = result[idx];
      if (e.slot === 'preworkout' || e.slot === 'postworkout') {
        // Use the slot with highest priority if multiple
        if (!workoutSlot || (e._rulePriority || 0) > highestPriority) {
          workoutSlot = e.slot;
          highestPriority = e._rulePriority || 0;
        }
      }
    }

    // If found, assign all entries in this block to that slot
    if (workoutSlot) {
      for (const idx of indices) {
        result[idx] = { ...result[idx], slot: workoutSlot };
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

// Full pipeline: parse CSV → assign slots → apply time-block logic
export function processImport(csvText, dayConfigs, slotRules) {
  const parsed = parseFddbCsv(csvText);
  const withSlots = assignSlots(parsed, dayConfigs, slotRules);
  const final = applyTimeBlockLogic(withSlots);
  return final;
}
