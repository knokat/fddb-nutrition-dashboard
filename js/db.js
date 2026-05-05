// js/db.js — Supabase Client & DB Functions for fddb tables

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://qxbnjemssqjczexevnff.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4Ym5qZW1zc3FqY3pleGV2bmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjUyMDYsImV4cCI6MjA5MTQwMTIwNn0.dZLv-Cgar7FaSSbyZBFcWq1JGQrp-v8UQ-CNjN3Fm2Y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth ──

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session?.user || null));
}

// ── Targets (SOLL-Werte) ──

export async function getTargets(userId) {
  const { data, error } = await supabase
    .from('fddb_targets')
    .select('*')
    .eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function updateTarget(id, updates) {
  const { error } = await supabase
    .from('fddb_targets')
    .update(updates)
    .eq('id', id);
  if (error) throw error;
}

// ── Day Config (Tagestyp + Notizen) ──

export async function getDayConfigs(userId, dates) {
  const { data, error } = await supabase
    .from('fddb_day_config')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates);
  if (error) throw error;
  return data || [];
}

export async function upsertDayConfig(userId, date, dayType, notes) {
  const { data, error } = await supabase
    .from('fddb_day_config')
    .upsert({
      user_id: userId,
      date,
      day_type: dayType,
      notes: notes || '',
    }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDayType(userId, date, newType) {
  // Try update first
  const { data, error } = await supabase
    .from('fddb_day_config')
    .upsert({
      user_id: userId,
      date,
      day_type: newType,
      notes: '',
    }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDayNotes(userId, date, notes) {
  const { error } = await supabase
    .from('fddb_day_config')
    .update({ notes })
    .eq('user_id', userId)
    .eq('date', date);
  if (error) throw error;
}

// ── fddb Entries ──

export async function getEntriesForDates(userId, dates) {
  const { data, error } = await supabase
    .from('fddb_entries')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates)
    .order('date')
    .order('time');
  if (error) throw error;
  return data || [];
}

export async function getEntriesForDate(userId, date) {
  const { data, error } = await supabase
    .from('fddb_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .order('time');
  if (error) throw error;
  return data || [];
}

export async function importEntries(userId, entries) {
  // Group by date
  const byDate = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }

  let totalImported = 0;
  const dates = Object.keys(byDate);

  for (const date of dates) {
    // Delete existing auto-assigned entries for this date
    const { error: delErr } = await supabase
      .from('fddb_entries')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .eq('slot_auto', true);
    if (delErr) throw delErr;

    // Insert new entries
    const rows = byDate[date].map(e => ({
      user_id: userId,
      date: e.date,
      time: e.time,
      food_name: e.food_name,
      fddb_id: e.fddb_id,
      amount_label: e.amount_label,
      kcal: e.kcal,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      slot: e.slot,
      slot_auto: e.slot_auto !== false,
    }));

    const { error: insErr } = await supabase
      .from('fddb_entries')
      .upsert(rows, { onConflict: 'user_id,date,time,fddb_id' });
    if (insErr) throw insErr;

    totalImported += rows.length;
  }

  return { totalImported, dates };
}

// ── Slot Rules ──

export async function getSlotRules(userId) {
  const { data, error } = await supabase
    .from('fddb_slot_rules')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Leander ──

export async function getLeanderForDates(userId, dates) {
  const { data, error } = await supabase
    .from('fddb_leander')
    .select('*')
    .eq('user_id', userId)
    .in('date', dates);
  if (error) throw error;
  return data || [];
}

export async function upsertLeander(userId, date, description) {
  const { data, error } = await supabase
    .from('fddb_leander')
    .upsert({
      user_id: userId,
      date,
      description,
    }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
