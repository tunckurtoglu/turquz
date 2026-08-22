import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const localKey = (id) => `turquz.deskNotes.v1.${id}`;

function missingTable(err) {
  const m = `${err?.message || ''} ${err?.code || ''} ${err?.details || ''}`;
  return /schema cache|does not exist|agency_desk_notes|42P01|PGRST205/i.test(m);
}

async function readLocal(agencyId) {
  try {
    const raw = await AsyncStorage.getItem(localKey(agencyId));
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function writeLocal(agencyId, rows) {
  await AsyncStorage.setItem(localKey(agencyId), JSON.stringify((rows || []).slice(0, 40)));
}

function localRow(body) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    body,
    created_at: new Date().toISOString(),
  };
}

export async function listDeskNotes(agencyId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('agency_desk_notes')
    .select('id, body, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (!error) {
    const rows = data || [];
    writeLocal(agencyId, rows).catch(() => {});
    return rows;
  }
  console.warn('desk notes:', error.message);
  return readLocal(agencyId);
}

export async function addDeskNote(agencyId, body) {
  const text = String(body || '').trim().slice(0, 400);
  if (!agencyId || !text) return null;
  const { data, error } = await supabase
    .from('agency_desk_notes')
    .insert({ agency_id: agencyId, body: text })
    .select('id, body, created_at')
    .single();
  if (!error && data) {
    const prev = await readLocal(agencyId);
    writeLocal(agencyId, [data, ...prev.filter((n) => n.id !== data.id)]).catch(() => {});
    return data;
  }
  if (error) console.warn('desk note insert:', error.message);
  const row = localRow(text);
  const prev = await readLocal(agencyId);
  await writeLocal(agencyId, [row, ...prev]);
  return row;
}

export async function removeDeskNote(agencyId, noteId) {
  if (!agencyId || !noteId) return;
  const prev = await readLocal(agencyId);
  writeLocal(agencyId, prev.filter((n) => n.id !== noteId)).catch(() => {});
  if (String(noteId).startsWith('local-')) return;
  const { error } = await supabase
    .from('agency_desk_notes')
    .delete()
    .eq('agency_id', agencyId)
    .eq('id', noteId);
  if (error && !missingTable(error)) throw error;
}

export function formatNoteDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} · ${hh}:${mi}`;
}
