// js/components.js — UI Components (Preact + htm)
import { html, useState, useRef, useEffect } from 'https://unpkg.com/htm/preact/standalone.module.js';
import {
  weekdayShort, formatDateDisplay, isToday,
  macroPercent, kcalColor, macroDistribution, n0,
  MACRO_COLORS, DAYTYPE_LABELS,
} from './helpers.js';

// ── Lucide-style SVG Icons (inline) ──

const Icons = {
  chevDown: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevUp: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
  chevLeft: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  chevRight: html`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
  todayIcon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  weekIcon: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  settings: html`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};
export { Icons };

// ── Progress Ring (SVG) ──

export function ProgressRing({ percent, size = 40, stroke = 3, isActive, dayNum, hasData }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(percent || 0, 150);
  const offset = circ - (pct / 100) * circ;
  const color = kcalColor(pct);

  if (isActive) {
    const bgColor = color;
    return html`
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r + stroke/2}" fill="${bgColor}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
          stroke="rgba(255,255,255,0.3)" stroke-width="${stroke}"/>
        ${hasData && html`
          <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
            stroke="#fff" stroke-width="${stroke}"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
            stroke-linecap="round"
            transform="rotate(-90 ${size/2} ${size/2})"
            style="transition: stroke-dashoffset 0.5s ease"/>
        `}
        <text x="${size/2}" y="${size/2}" text-anchor="middle" dy="0.35em"
          fill="#fff" font-size="13" font-weight="600">${dayNum}</text>
      </svg>
    `;
  }

  return html`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
        stroke="#ececea" stroke-width="${stroke}"/>
      ${hasData && html`
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none"
          stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
          stroke-linecap="round"
          transform="rotate(-90 ${size/2} ${size/2})"
          style="transition: stroke-dashoffset 0.5s ease"/>
      `}
      <text x="${size/2}" y="${size/2}" text-anchor="middle" dy="0.35em"
        fill="${hasData ? '#1a1a1a' : '#aaa'}" font-size="13" font-weight="500">${dayNum}</text>
    </svg>
  `;
}

// ── Week Strip ──

export function WeekStrip({ dates, dayTotals, selectedDate, onSelect, targets }) {
  return html`
    <div class="week-strip">
      ${dates.map(dateStr => {
        const totals = dayTotals[dateStr];
        const active = isToday(dateStr);
        const selected = dateStr === selectedDate;
        const hasData = totals && totals.kcal > 0;
        const dayType = totals?.day_type || 'rest';
        const target = targets?.[dayType]?.target_kcal || 2200;
        const pct = hasData ? macroPercent(totals.kcal, target) : 0;
        const dayNum = parseInt(dateStr.slice(8, 10), 10);

        return html`
          <div class="week-day ${selected ? 'selected' : ''}" onclick=${() => onSelect(dateStr)}>
            <span class="week-day-label ${active ? 'today-label' : ''}">
              ${active ? 'HEUTE' : weekdayShort(dateStr)}
            </span>
            <${ProgressRing} percent=${pct} isActive=${active} dayNum=${dayNum} hasData=${hasData}/>
          </div>
        `;
      })}
    </div>
  `;
}

// ── Macro Bar ──

export function MacroBar({ label, actual, target, color }) {
  const pct = macroPercent(actual, target);
  const barColor = label === 'KCAL' ? kcalColor(pct) : color;
  const barWidth = Math.min(pct, 100);

  return html`
    <div class="macro-bar">
      <div class="macro-bar-header">
        <span class="macro-label" style="color: ${color}">${label}</span>
        <span class="macro-values">${n0(actual)} / ${n0(target)}</span>
      </div>
      <div class="macro-bar-track">
        <div class="macro-bar-fill" style="width: ${barWidth}%; background: ${barColor}"/>
      </div>
    </div>
  `;
}

export function MacroBars({ actual, targets }) {
  if (!targets) return null;
  const dist = macroDistribution(actual.kcal, actual.protein, actual.carbs, actual.fat);

  return html`
    <div class="macro-bars">
      <${MacroBar} label="KCAL" actual=${actual.kcal} target=${targets.target_kcal} color=${MACRO_COLORS.kcal}/>
      <${MacroBar} label="PROT" actual=${actual.protein} target=${targets.target_protein} color=${MACRO_COLORS.protein}/>
      <${MacroBar} label="CARB" actual=${actual.carbs} target=${targets.target_carbs} color=${MACRO_COLORS.carbs}/>
      <${MacroBar} label="FETT" actual=${actual.fat} target=${targets.target_fat} color=${MACRO_COLORS.fat}/>
      ${dist && html`
        <div class="macro-distribution">
          <span style="color:${MACRO_COLORS.protein}">P ${dist.protein}%</span>
          <span class="macro-dist-dot">·</span>
          <span style="color:${MACRO_COLORS.carbs}">C ${dist.carbs}%</span>
          <span class="macro-dist-dot">·</span>
          <span style="color:${MACRO_COLORS.fat}">F ${dist.fat}%</span>
        </div>
      `}
    </div>
  `;
}

// ── Segmented Picker ──

export function SegmentedPicker({ value, options, onChange }) {
  const containerRef = useRef(null);
  const [pillStyle, setPillStyle] = useState({});

  useEffect(() => {
    if (!containerRef.current) return;
    const idx = options.findIndex(o => o.value === value);
    const items = containerRef.current.querySelectorAll('.seg-item');
    if (items[idx]) {
      const item = items[idx];
      setPillStyle({
        left: item.offsetLeft + 'px',
        width: item.offsetWidth + 'px',
      });
    }
  }, [value, options]);

  return html`
    <div class="seg-picker" ref=${containerRef}>
      <div class="seg-pill" style=${pillStyle}/>
      ${options.map((opt, i) => html`
        <div class="seg-item ${value === opt.value ? 'active' : ''}"
          onclick=${() => onChange(opt.value)}>
          ${opt.label}
        </div>
        ${i < options.length - 1 && html`
          <div class="seg-divider ${
            value === opt.value || value === options[i+1]?.value ? 'hidden' : ''
          }"/>
        `}
      `)}
    </div>
  `;
}

// ── Slot Card (replaces MealCard — read-only, shows fddb entries) ──

export function SlotCard({ slot, entries }) {
  const [open, setOpen] = useState(false);
  const hasEntries = entries && entries.length > 0;

  // Sum macros for this slot
  const totals = hasEntries
    ? entries.reduce((acc, e) => ({
        kcal: acc.kcal + (Number(e.kcal) || 0),
        protein: acc.protein + (Number(e.protein) || 0),
        carbs: acc.carbs + (Number(e.carbs) || 0),
        fat: acc.fat + (Number(e.fat) || 0),
      }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    : null;

  if (!hasEntries) return null; // Hide empty slots

  return html`
    <div class="meal-card">
      <div class="meal-card-header" onclick=${() => setOpen(!open)}>
        <div class="meal-icon-wrap">
          <span class="meal-icon">${slot.icon}</span>
        </div>
        <div class="meal-info">
          <div class="meal-name">${slot.label}</div>
          <div class="meal-macros-preview">
            <span>${n0(totals.kcal)} kcal</span>
            <span class="macro-dot">·</span>
            <span>P ${n0(totals.protein)}</span>
            <span class="macro-dot">·</span>
            <span>C ${n0(totals.carbs)}</span>
            <span class="macro-dot">·</span>
            <span>F ${n0(totals.fat)}</span>
          </div>
        </div>
        <div class="meal-chevron">${open ? Icons.chevUp : Icons.chevDown}</div>
      </div>
      ${open && html`
        <div class="meal-card-body">
          <div class="meal-items">
            ${entries.map(e => html`
              <div class="meal-item-row">
                <div class="item-left">
                  <span class="item-name">${e.amount_label || e.food_name}</span>
                </div>
                <div class="item-right">
                  <span class="item-kcal">${n0(e.kcal)}</span>
                  <span class="item-macros">P${n0(e.protein)} C${n0(e.carbs)} F${n0(e.fat)}</span>
                </div>
              </div>
            `)}
          </div>
        </div>
      `}
    </div>
  `;
}

// ── Leander Section ──

export function LeanderSection({ lunch, onEditLunch }) {
  const [showOats, setShowOats] = useState(false);

  const oatsIngredients = [
    '5g Flohsamenschalen',
    '25g Haferflocken',
    '3g Leinsamen',
    '31ml Hafermilch',
    '75g Joghurt 10%',
    '10g Whey',
    'Zimt',
  ];

  return html`
    <div class="leander-section">
      <div class="leander-header">
        <span class="leander-title">🧒 Leander</span>
      </div>

      <!-- Mittagessen -->
      <div class="leander-card">
        <div class="leander-meal-header">
          <span class="leander-meal-icon">🍽️</span>
          <span class="leander-meal-label">Mittagessen</span>
        </div>
        <div class="leander-meal-content" onclick=${onEditLunch}>
          ${lunch
            ? html`<span class="leander-meal-text">${lunch}</span>`
            : html`<span class="leander-meal-empty">+ Eintragen</span>`
          }
        </div>
      </div>

      <!-- Overnight Oats -->
      <div class="leander-card">
        <div class="leander-meal-header" onclick=${() => setShowOats(!showOats)} style="cursor:pointer">
          <span class="leander-meal-icon">🥣</span>
          <span class="leander-meal-label">Overnight Oats</span>
          <span class="leander-expand">${showOats ? '▾' : '▸'}</span>
        </div>
        ${showOats && html`
          <div class="leander-oats-items">
            ${oatsIngredients.map(item => html`
              <div class="leander-oats-item">${item}</div>
            `)}
          </div>
        `}
      </div>
    </div>
  `;
}

// ── Bottom Navigation ──

export function BottomNav({ active, onNav }) {
  const tabs = [
    { key: 'today', label: 'Heute',  icon: Icons.todayIcon },
    { key: 'week',  label: 'Woche',  icon: Icons.weekIcon },
  ];

  return html`
    <nav class="bottom-nav">
      ${tabs.map(t => html`
        <div class="nav-tab ${active === t.key ? 'active' : ''}"
          onclick=${() => onNav(t.key)}>
          <div class="nav-icon">${t.icon}</div>
          <span class="nav-label">${t.label}</span>
        </div>
      `)}
    </nav>
  `;
}

// ── Login Screen ──

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await onLogin(email, pw);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return html`
    <div class="login-screen">
      <div class="login-card">
        <img class="login-icon-img" src="icons/apple-touch-icon.png" alt="Nutrition Dashboard"/>
        <h1 class="login-title">Nutrition Dashboard</h1>
        <p class="login-subtitle">fddb · Makros · Kalorien</p>
        <div class="login-fields">
          <input type="email" placeholder="Email" value=${email}
            onInput=${e => setEmail(e.target.value)} class="login-input"/>
          <input type="password" placeholder="Passwort" value=${pw}
            onInput=${e => setPw(e.target.value)} class="login-input"
            onKeyDown=${e => e.key === 'Enter' && submit()}/>
        </div>
        ${error && html`<div class="login-error">${error}</div>`}
        <div class="login-btn ${loading ? 'loading' : ''}" onclick=${submit}>
          ${loading ? 'Laden...' : 'Anmelden'}
        </div>
      </div>
    </div>
  `;
}
