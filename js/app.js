// js/app.js — Main App Component
import { html, render, useState, useEffect, useRef } from 'https://unpkg.com/htm/preact/standalone.module.js';
import {
  today, getWeekStart, getWeekDates, addDays, formatDateDisplay,
  isToday, getKW, weekdayShort, defaultDayType,
  getSlotsForType, sumMacros, macroPercent, macroDistribution, n0,
  MACRO_COLORS, DAYTYPE_COLORS, DAYTYPE_LABELS,
} from './helpers.js';
import {
  supabase, signIn, signOut, getUser, onAuthChange,
  getTargets, getDayConfigs, upsertDayConfig, updateDayType, updateDayNotes,
  getEntriesForDates, getEntriesForDate, importEntries,
  getSlotRules, getLeanderForDates, upsertLeander,
} from './db.js';
import { processImport } from './slot-mapper.js';
import {
  Icons, WeekStrip, MacroBars, SegmentedPicker,
  SlotCard, LeanderSection, BottomNav, LoginScreen,
} from './components.js';

// ── Day Type Picker Options ──
const DAYTYPE_OPTIONS = [
  { value: 'workout', label: 'Workout' },
  { value: 'rest',    label: 'Rest Day' },
  { value: 'friday',  label: 'Friday' },
];

// ── Today Screen ──

function TodayScreen({ user, targets, onSettings }) {
  const [selectedDate, setSelectedDate] = useState(today());
  const [weekStart, setWeekStart] = useState(getWeekStart(today()));
  const [weekDates, setWeekDates] = useState(getWeekDates(getWeekStart(today())));
  const [dayConfigs, setDayConfigs] = useState({});    // { date: { day_type, notes } }
  const [dayTotals, setDayTotals] = useState({});      // { date: { kcal, protein, carbs, fat, day_type } }
  const [entries, setEntries] = useState([]);           // entries for selected date
  const [leanderData, setLeanderData] = useState({});   // { date: description }
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const notesTimer = useRef(null);

  // Load week data
  useEffect(() => { loadWeek(weekStart); }, [weekStart, user]);

  // Load day entries when selected date changes
  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, dayConfigs]);

  async function loadWeek(start) {
    setLoading(true);
    try {
      const dates = getWeekDates(start);

      // Load day configs
      const configs = await getDayConfigs(user.id, dates);
      const configMap = {};
      for (const d of dates) {
        const cfg = configs.find(c => String(c.date).slice(0, 10) === d);
        configMap[d] = cfg || { day_type: defaultDayType(d), notes: '' };
      }
      setDayConfigs(configMap);

      // Load all entries for the week
      const allEntries = await getEntriesForDates(user.id, dates);

      // Calculate totals per day
      const totals = {};
      for (const d of dates) {
        const dayEntries = allEntries.filter(e => String(e.date).slice(0, 10) === d);
        const sums = sumMacros(dayEntries);
        totals[d] = { ...sums, day_type: configMap[d].day_type };
      }
      setDayTotals(totals);

      // Load Leander data
      const leander = await getLeanderForDates(user.id, dates);
      const lMap = {};
      for (const l of leander) {
        lMap[String(l.date).slice(0, 10)] = l.description;
      }
      setLeanderData(lMap);

    } catch (e) {
      console.error('loadWeek error:', e);
    }
    setLoading(false);
  }

  async function loadDay(dateStr) {
    try {
      const dayEntries = await getEntriesForDate(user.id, dateStr);
      setEntries(dayEntries);
      setNotes(dayConfigs[dateStr]?.notes || '');
    } catch (e) {
      console.error('loadDay error:', e);
      setEntries([]);
    }
  }

  function selectDate(dateStr) {
    setSelectedDate(dateStr);
    const newStart = getWeekStart(dateStr);
    if (newStart !== weekStart) {
      setWeekStart(newStart);
      setWeekDates(getWeekDates(newStart));
    }
  }

  function shiftWeek(dir) {
    const newStart = addDays(weekStart, dir * 7);
    setWeekStart(newStart);
    setWeekDates(getWeekDates(newStart));
    setSelectedDate(dir > 0 ? newStart : addDays(newStart, 6));
  }

  async function changeDayType(newType) {
    try {
      await updateDayType(user.id, selectedDate, newType);
      const updated = { ...dayConfigs, [selectedDate]: { ...dayConfigs[selectedDate], day_type: newType } };
      setDayConfigs(updated);
      setDayTotals({ ...dayTotals, [selectedDate]: { ...dayTotals[selectedDate], day_type: newType } });
    } catch (e) {
      console.error('changeDayType error:', e);
    }
  }

  function handleNotesChange(value) {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      try {
        // Ensure day config exists
        await upsertDayConfig(user.id, selectedDate, dayConfigs[selectedDate]?.day_type || defaultDayType(selectedDate), value);
        setDayConfigs({ ...dayConfigs, [selectedDate]: { ...dayConfigs[selectedDate], notes: value } });
      } catch (e) {
        console.error('saveNotes error:', e);
      }
    }, 800);
  }

  async function handleEditLeander() {
    const current = leanderData[selectedDate] || '';
    const newValue = prompt('Leander Mittagessen:', current);
    if (newValue === null) return; // cancelled
    try {
      await upsertLeander(user.id, selectedDate, newValue);
      setLeanderData({ ...leanderData, [selectedDate]: newValue });
    } catch (e) {
      console.error('editLeander error:', e);
    }
  }

  const dayType = dayConfigs[selectedDate]?.day_type || defaultDayType(selectedDate);
  const slots = getSlotsForType(dayType, selectedDate);
  const targetsMap = targets ? Object.fromEntries(targets.map(t => [t.day_type, t])) : {};
  const dayTargets = targetsMap[dayType] || null;

  // Sum all entries for the day
  const actual = sumMacros(entries);

  // Group entries by slot
  const entriesBySlot = {};
  for (const e of entries) {
    if (!entriesBySlot[e.slot]) entriesBySlot[e.slot] = [];
    entriesBySlot[e.slot].push(e);
  }

  const isSelectedToday = isToday(selectedDate);
  const headerTitle = isSelectedToday ? 'Heute' : weekdayShort(selectedDate).replace('.', '');
  const headerDate = formatDateDisplay(selectedDate);

  return html`
    <div class="screen today-screen">
      <!-- Sticky Header -->
      <div class="sticky-header">
        <div class="header-top">
          <div class="header-title-group">
            <h1 class="header-title">${headerTitle}</h1>
            <span class="header-date">${headerDate}</span>
          </div>
          <div class="header-actions">
            <div class="header-nav-arrows">
              <div class="nav-arrow" onclick=${() => shiftWeek(-1)}>${Icons.chevLeft}</div>
              <span class="kw-label">KW ${getKW(selectedDate)}</span>
              <div class="nav-arrow" onclick=${() => shiftWeek(1)}>${Icons.chevRight}</div>
            </div>
            <div class="nav-arrow settings-gear" onclick=${onSettings}>${Icons.settings}</div>
          </div>
        </div>

        <${WeekStrip}
          dates=${weekDates}
          dayTotals=${dayTotals}
          selectedDate=${selectedDate}
          onSelect=${selectDate}
          targets=${targetsMap}
        />

        <${MacroBars} actual=${actual} targets=${dayTargets}/>
      </div>

      <!-- Body -->
      <div class="screen-body">
        <${SegmentedPicker}
          value=${dayType}
          options=${DAYTYPE_OPTIONS}
          onChange=${changeDayType}
        />

        <!-- Notes -->
        <div class="day-notes">
          <textarea
            class="day-notes-input"
            placeholder="Notizen zum Tag..."
            value=${notes}
            onInput=${e => handleNotesChange(e.target.value)}
            rows="2"
          />
        </div>

        <!-- Meal Slots -->
        <div class="meals-list">
          ${loading
            ? html`<div class="loading-state">Laden...</div>`
            : slots.map(slot => html`
                <${SlotCard}
                  key=${slot.key}
                  slot=${slot}
                  entries=${entriesBySlot[slot.key] || []}
                />
              `)
          }
        </div>

        <!-- Day Total -->
        ${!loading && entries.length > 0 && html`
          <div class="day-total">
            <span class="day-total-label">Gesamt</span>
            <div class="day-total-macros">
              <span style="color:${MACRO_COLORS.kcal}">${n0(actual.kcal)} kcal</span>
              <span style="color:${MACRO_COLORS.protein}">P ${n0(actual.protein)}</span>
              <span style="color:${MACRO_COLORS.carbs}">C ${n0(actual.carbs)}</span>
              <span style="color:${MACRO_COLORS.fat}">F ${n0(actual.fat)}</span>
            </div>
          </div>
        `}

        <!-- Leander -->
        <${LeanderSection}
          lunch=${leanderData[selectedDate] || ''}
          onEditLunch=${handleEditLeander}
        />
      </div>
    </div>
  `;
}

// ── Week Screen ──

function WeekScreen({ user, targets }) {
  const [weekStart, setWeekStart] = useState(getWeekStart(today()));
  const [weekDates, setWeekDates] = useState(getWeekDates(getWeekStart(today())));
  const [dayConfigs, setDayConfigs] = useState({});
  const [dayTotals, setDayTotals] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadWeekData(weekStart); }, [weekStart, user]);

  async function loadWeekData(start) {
    setLoading(true);
    try {
      const dates = getWeekDates(start);
      const configs = await getDayConfigs(user.id, dates);
      const configMap = {};
      for (const d of dates) {
        const cfg = configs.find(c => String(c.date).slice(0, 10) === d);
        configMap[d] = cfg || { day_type: defaultDayType(d), notes: '' };
      }
      setDayConfigs(configMap);

      const allEntries = await getEntriesForDates(user.id, dates);
      const totals = {};
      for (const d of dates) {
        const dayEntries = allEntries.filter(e => String(e.date).slice(0, 10) === d);
        const sums = sumMacros(dayEntries);
        totals[d] = { ...sums, day_type: configMap[d].day_type };
      }
      setDayTotals(totals);
    } catch (e) { console.error('WeekScreen loadWeek error:', e); }
    setLoading(false);
  }

  function shiftWeek(dir) {
    const s = addDays(weekStart, dir * 7);
    setWeekStart(s);
    setWeekDates(getWeekDates(s));
  }

  const targetsMap = targets ? Object.fromEntries(targets.map(t => [t.day_type, t])) : {};

  const daysWithTargets = weekDates.map(d => {
    const tot = dayTotals[d] || { kcal: 0, protein: 0, carbs: 0, fat: 0, day_type: 'rest' };
    const dt = dayConfigs[d]?.day_type || defaultDayType(d);
    const t = targetsMap[dt] || { target_kcal: 2200, target_protein: 140, target_carbs: 253, target_fat: 70 };
    return { date: d, ...tot, day_type: dt, targets: t };
  });

  const filledDays = daysWithTargets.filter(d => d.kcal > 0);
  const numFilled = filledDays.length || 1;

  const totalActual = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const totalTarget = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  daysWithTargets.forEach(d => {
    totalActual.kcal += d.kcal || 0;
    totalActual.protein += d.protein || 0;
    totalActual.carbs += d.carbs || 0;
    totalActual.fat += d.fat || 0;
    totalTarget.kcal += d.targets.target_kcal;
    totalTarget.protein += d.targets.target_protein;
    totalTarget.carbs += d.targets.target_carbs;
    totalTarget.fat += d.targets.target_fat;
  });

  const avgActual = {
    kcal: Math.round(totalActual.kcal / numFilled),
    protein: Math.round(totalActual.protein / numFilled),
    carbs: Math.round(totalActual.carbs / numFilled),
    fat: Math.round(totalActual.fat / numFilled),
  };
  const avgTarget = {
    kcal: Math.round(totalTarget.kcal / 7),
    protein: Math.round(totalTarget.protein / 7),
    carbs: Math.round(totalTarget.carbs / 7),
    fat: Math.round(totalTarget.fat / 7),
  };

  const maxKcal = Math.max(
    ...daysWithTargets.map(d => Math.max(d.kcal || 0, d.targets.target_kcal)),
    1
  );

  // Weekly macro distribution
  const weekDist = macroDistribution(totalActual.kcal, totalActual.protein, totalActual.carbs, totalActual.fat);

  const dateRange = `${formatDateDisplay(weekDates[0])} – ${formatDateDisplay(weekDates[6])}`;

  return html`
    <div class="screen">
      <div class="week-screen">
        <!-- Header -->
        <div class="week-header">
          <div class="week-header-top">
            <h1 class="header-title">Woche</h1>
            <span class="header-date">KW ${getKW(weekDates[3])}</span>
          </div>
          <div class="week-nav">
            <div class="nav-arrow" onclick=${() => shiftWeek(-1)}>${Icons.chevLeft}</div>
            <span class="week-range">${dateRange}</span>
            <div class="nav-arrow" onclick=${() => shiftWeek(1)}>${Icons.chevRight}</div>
          </div>
        </div>

        ${loading ? html`<div class="loading-state">Laden...</div>` : html`
          <!-- Summary Cards -->
          <div class="week-summary">
            ${[
              { key: 'kcal', label: 'KCAL', color: MACRO_COLORS.kcal, actual: totalActual.kcal, target: totalTarget.kcal, avg: avgActual.kcal, avgT: avgTarget.kcal },
              { key: 'protein', label: 'PROT', color: MACRO_COLORS.protein, actual: totalActual.protein, target: totalTarget.protein, avg: avgActual.protein, avgT: avgTarget.protein },
              { key: 'carbs', label: 'CARB', color: MACRO_COLORS.carbs, actual: totalActual.carbs, target: totalTarget.carbs, avg: avgActual.carbs, avgT: avgTarget.carbs },
              { key: 'fat', label: 'FETT', color: MACRO_COLORS.fat, actual: totalActual.fat, target: totalTarget.fat, avg: avgActual.fat, avgT: avgTarget.fat },
            ].map(m => {
              const pct = Math.min(Math.round((m.actual / (m.target || 1)) * 100), 100);
              return html`
                <div class="summary-card">
                  <div class="summary-label" style="color:${m.color}">${m.label}</div>
                  <div class="summary-values">
                    <span class="summary-actual">${n0(m.actual)}</span>
                    <span class="summary-target">/ ${n0(m.target)}</span>
                  </div>
                  <div class="summary-bar-track">
                    <div class="summary-bar-fill" style="width:${pct}%;background:${m.color}"/>
                  </div>
                  <div class="summary-avg">⌀ ${n0(m.avg)} / Tag (Ziel: ${n0(m.avgT)})</div>
                </div>
              `;
            })}
          </div>

          <!-- Weekly Macro Distribution -->
          ${weekDist && html`
            <div class="week-macro-dist">
              <span style="color:${MACRO_COLORS.protein}">P ${weekDist.protein}%</span>
              <span class="macro-dist-dot">·</span>
              <span style="color:${MACRO_COLORS.carbs}">C ${weekDist.carbs}%</span>
              <span class="macro-dist-dot">·</span>
              <span style="color:${MACRO_COLORS.fat}">F ${weekDist.fat}%</span>
            </div>
          `}

          <!-- Daily Bars -->
          <div class="week-daily">
            <div class="week-daily-title">Kalorien pro Tag</div>
            ${daysWithTargets.map(d => {
              const kcal = d.kcal || 0;
              const target = d.targets.target_kcal;
              const barW = Math.round((kcal / maxKcal) * 100);
              const targetW = Math.round((target / maxKcal) * 100);
              const dtColor = DAYTYPE_COLORS[d.day_type] || '#999';
              const isTodayDate = isToday(d.date);
              const barColor = kcal > target * 1.1 ? '#A42059' : kcal > target ? '#623c6d' : MACRO_COLORS.kcal;

              return html`
                <div class="daily-row ${isTodayDate ? 'today-row' : ''}">
                  <div class="daily-label">
                    <div class="dt-dot" style="background:${dtColor}"/>
                    <span class="daily-day">${weekdayShort(d.date)}</span>
                  </div>
                  <div class="daily-bar-container">
                    <div class="daily-bar-track">
                      <div class="daily-bar-fill" style="width:${barW}%;background:${barColor}"/>
                      <div class="daily-target-line" style="left:${targetW}%"/>
                    </div>
                    <span class="daily-kcal">${kcal > 0 ? n0(kcal) : '–'}</span>
                  </div>
                </div>
              `;
            })}

            <!-- Legend -->
            <div class="week-legend">
              <span class="legend-item"><span class="dt-dot" style="background:${DAYTYPE_COLORS.workout}"/>Workout</span>
              <span class="legend-item"><span class="dt-dot" style="background:${DAYTYPE_COLORS.rest}"/>Rest Day</span>
              <span class="legend-item"><span class="dt-dot" style="background:${DAYTYPE_COLORS.friday}"/>Friday</span>
              <span class="legend-item"><span class="target-line-legend"/>Ziel</span>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

// ── Settings Screen ──

function SettingsScreen({ user, targets, onLogout, onImportDone }) {
  const [showImport, setShowImport] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [showTargets, setShowTargets] = useState(false);
  const [editTargets, setEditTargets] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (targets && !editTargets) {
      const map = {};
      for (const t of targets) {
        map[t.day_type] = { ...t };
      }
      setEditTargets(map);
    }
  }, [targets]);

  const clearCacheAndReload = async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    window.location.reload(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFileName(file.name);
      setImportStatus('');
      setImportMsg('');
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImportStatus('loading');
    setImportMsg('');
    try {
      // Read file content as text
      const csvText = await file.text();
      if (!csvText.trim()) throw new Error('Datei ist leer');

      // Load slot rules and day configs for the dates in the CSV
      const slotRules = await getSlotRules(user.id);

      // Parse to get dates first
      const { parseFddbCsv } = await import('./slot-mapper.js');
      const parsed = parseFddbCsv(csvText);
      if (parsed.length === 0) throw new Error('Keine Einträge im CSV gefunden');

      const dates = [...new Set(parsed.map(e => e.date))];
      const configs = await getDayConfigs(user.id, dates);

      // Build config map, creating defaults for missing dates
      const configMap = {};
      for (const d of dates) {
        const cfg = configs.find(c => String(c.date).slice(0, 10) === d);
        if (cfg) {
          configMap[d] = cfg;
        } else {
          // Create day config with default type
          const newCfg = await upsertDayConfig(user.id, d, defaultDayType(d), '');
          configMap[d] = newCfg;
        }
      }

      // Process: assign slots
      const processed = processImport(csvText, configMap, slotRules);

      // Import into DB
      const result = await importEntries(user.id, processed);

      setImportStatus('success');
      setImportMsg(`${result.totalImported} Einträge für ${result.dates.length} Tage importiert.`);
      setImportFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Notify parent to refresh
      if (onImportDone) onImportDone();
    } catch (e) {
      setImportStatus('error');
      setImportMsg(e.message);
    }
  };

  const handleSaveTargets = async () => {
    if (!editTargets) return;
    try {
      const { updateTarget } = await import('./db.js');
      for (const dt of ['workout', 'rest', 'friday']) {
        const t = editTargets[dt];
        if (t && t.id) {
          await updateTarget(t.id, {
            target_kcal: Number(t.target_kcal),
            target_protein: Number(t.target_protein),
            target_carbs: Number(t.target_carbs),
            target_fat: Number(t.target_fat),
          });
        }
      }
      alert('Zielwerte gespeichert!');
    } catch (e) {
      alert('Fehler: ' + e.message);
    }
  };

  function updateTargetField(dayType, field, value) {
    setEditTargets({
      ...editTargets,
      [dayType]: { ...editTargets[dayType], [field]: value },
    });
  }

  return html`
    <div class="screen">
      <div class="settings-screen">
        <h1 class="settings-title">Einstellungen</h1>

        <div class="settings-section">
          <div class="settings-label">Account</div>
          <div class="settings-card">
            <div class="settings-row">
              <span>Email</span>
              <span class="settings-value">${user?.email}</span>
            </div>
          </div>
        </div>

        <!-- fddb Import -->
        <div class="settings-section">
          <div class="settings-label">Daten</div>
          <div class="settings-card">
            <div class="settings-row clickable" onclick=${() => setShowImport(!showImport)}>
              <span>fddb Tagebuch importieren</span>
              <span class="settings-arrow">${showImport ? '↑' : '→'}</span>
            </div>
            ${showImport && html`
              <div class="import-section">
                <div class="import-file-area" onclick=${() => fileInputRef.current?.click()}>
                  <input type="file" accept=".csv" ref=${fileInputRef}
                    onChange=${handleFileSelect} style="display:none"/>
                  ${importFileName
                    ? html`<span class="import-file-name">📄 ${importFileName}</span>`
                    : html`<span class="import-file-placeholder">CSV-Datei auswählen...</span>`
                  }
                </div>
                <div class="import-actions">
                  <div class="sheet-btn save ${!importFileName || importStatus === 'loading' ? 'disabled' : ''}"
                    onclick=${handleImport}>
                    ${importStatus === 'loading' ? 'Importiere...' : 'Importieren'}
                  </div>
                </div>
                ${importMsg && html`
                  <div class="import-msg ${importStatus}">${importMsg}</div>
                `}
              </div>
            `}
          </div>
        </div>

        <!-- SOLL-Werte -->
        <div class="settings-section">
          <div class="settings-label">Zielwerte</div>
          <div class="settings-card">
            <div class="settings-row clickable" onclick=${() => setShowTargets(!showTargets)}>
              <span>SOLL-Werte konfigurieren</span>
              <span class="settings-arrow">${showTargets ? '↑' : '→'}</span>
            </div>
            ${showTargets && editTargets && html`
              <div class="targets-section">
                ${['workout', 'rest', 'friday'].map(dt => html`
                  <div class="target-block">
                    <div class="target-block-label" style="color:${DAYTYPE_COLORS[dt]}">${DAYTYPE_LABELS[dt]}</div>
                    <div class="target-fields">
                      <div class="target-field">
                        <span class="target-field-label">kcal</span>
                        <input type="number" class="target-input" value=${editTargets[dt]?.target_kcal || ''}
                          onInput=${e => updateTargetField(dt, 'target_kcal', e.target.value)}/>
                      </div>
                      <div class="target-field">
                        <span class="target-field-label">Protein</span>
                        <input type="number" class="target-input" value=${editTargets[dt]?.target_protein || ''}
                          onInput=${e => updateTargetField(dt, 'target_protein', e.target.value)}/>
                      </div>
                      <div class="target-field">
                        <span class="target-field-label">Carbs</span>
                        <input type="number" class="target-input" value=${editTargets[dt]?.target_carbs || ''}
                          onInput=${e => updateTargetField(dt, 'target_carbs', e.target.value)}/>
                      </div>
                      <div class="target-field">
                        <span class="target-field-label">Fett</span>
                        <input type="number" class="target-input" value=${editTargets[dt]?.target_fat || ''}
                          onInput=${e => updateTargetField(dt, 'target_fat', e.target.value)}/>
                      </div>
                    </div>
                  </div>
                `)}
                <div class="import-actions">
                  <div class="sheet-btn save" onclick=${handleSaveTargets}>Speichern</div>
                </div>
              </div>
            `}
          </div>
        </div>

        <!-- App -->
        <div class="settings-section">
          <div class="settings-label">App</div>
          <div class="settings-card">
            <div class="settings-row clickable" onclick=${clearCacheAndReload}>
              <span>App aktualisieren</span>
              <span class="settings-arrow">→</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-card">
            <div class="settings-row clickable danger" onclick=${onLogout}>
              <span>Abmelden</span>
            </div>
          </div>
        </div>

        <div class="settings-version">Nutrition Dashboard v1.0</div>
      </div>
    </div>
  `;
}

// ── Main App ──

function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState('today');
  const [targets, setTargets] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getUser().then(u => {
      setUser(u);
      setAuthChecked(true);
    });
    const { data: { subscription } } = onAuthChange(u => setUser(u));
    return () => subscription?.unsubscribe();
  }, []);

  // Load targets once authenticated
  useEffect(() => {
    if (user) {
      getTargets(user.id).then(t => setTargets(t)).catch(console.error);
    }
  }, [user]);

  async function handleLogin(email, pw) {
    await signIn(email, pw);
  }

  async function handleLogout() {
    await signOut();
    setUser(null);
    setShowSettings(false);
  }

  function handleImportDone() {
    // Force refresh of screens by changing key
    setRefreshKey(k => k + 1);
    setShowSettings(false);
    setTab('today');
  }

  if (!authChecked) {
    return html`<div class="splash"><img class="splash-logo" src="icons/apple-touch-icon.png" alt=""/></div>`;
  }

  if (!user) {
    return html`<${LoginScreen} onLogin=${handleLogin}/>`;
  }

  if (showSettings) {
    return html`
      <div class="app-container">
        <${SettingsScreen}
          user=${user}
          targets=${targets}
          onLogout=${handleLogout}
          onImportDone=${handleImportDone}
        />
        <${BottomNav} active="settings" onNav=${key => {
          setShowSettings(false);
          setTab(key);
        }}/>
      </div>
    `;
  }

  const screens = {
    today: html`<${TodayScreen} key=${refreshKey} user=${user} targets=${targets} onSettings=${() => setShowSettings(true)}/>`,
    week: html`<${WeekScreen} key=${refreshKey} user=${user} targets=${targets}/>`,
  };

  return html`
    <div class="app-container">
      ${screens[tab] || screens.today}
      <${BottomNav} active=${tab} onNav=${key => {
        if (key === 'settings') {
          setShowSettings(true);
        } else {
          setTab(key);
          setShowSettings(false);
        }
      }}/>
    </div>
  `;
}

// ── Mount ──
render(html`<${App}/>`, document.getElementById('app'));
