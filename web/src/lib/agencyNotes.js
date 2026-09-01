import { supabase } from './supabase';

const deskKey = (id) => `turquz.deskNotes.v1.${id}`;
const empKey = (agencyId, employerId) => `turquz.empNotes.v1.${agencyId}.${employerId}`;

function missingTable(err) {
  const m = `${err?.message || ''} ${err?.code || ''} ${err?.details || ''}`;
  return /schema cache|does not exist|agency_desk_notes|agency_employer_notes|42P01|PGRST205/i.test(m);
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeLocal(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify((rows || []).slice(0, 40)));
  } catch { /* ignore quota */ }
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
    writeLocal(deskKey(agencyId), rows);
    return rows;
  }
  console.warn('desk notes:', error.message);
  return readLocal(deskKey(agencyId));
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
    writeLocal(deskKey(agencyId), [data, ...readLocal(deskKey(agencyId)).filter((n) => n.id !== data.id)]);
    return data;
  }
  if (error) console.warn('desk note insert:', error.message);
  const row = localRow(text);
  writeLocal(deskKey(agencyId), [row, ...readLocal(deskKey(agencyId))]);
  return row;
}

export async function removeDeskNote(agencyId, noteId) {
  if (!agencyId || !noteId) return;
  writeLocal(deskKey(agencyId), readLocal(deskKey(agencyId)).filter((n) => n.id !== noteId));
  if (String(noteId).startsWith('local-')) return;
  const { error } = await supabase
    .from('agency_desk_notes')
    .delete()
    .eq('agency_id', agencyId)
    .eq('id', noteId);
  if (error && !missingTable(error)) throw error;
}

export async function listEmployerNotes(agencyId, employerId) {
  if (!agencyId || !employerId) return [];
  const key = empKey(agencyId, employerId);
  const { data, error } = await supabase
    .from('agency_employer_notes')
    .select('id, body, created_at')
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (!error) {
    const rows = data || [];
    writeLocal(key, rows);
    return rows;
  }
  console.warn('employer notes:', error.message);
  return readLocal(key);
}

export async function addEmployerNote(agencyId, employerId, body) {
  const text = String(body || '').trim().slice(0, 400);
  if (!agencyId || !employerId || !text) return null;
  const key = empKey(agencyId, employerId);
  const { data, error } = await supabase
    .from('agency_employer_notes')
    .insert({ agency_id: agencyId, employer_id: employerId, body: text })
    .select('id, body, created_at')
    .single();
  if (!error && data) {
    writeLocal(key, [data, ...readLocal(key).filter((n) => n.id !== data.id)]);
    return data;
  }
  if (error) console.warn('employer note insert:', error.message);
  const row = localRow(text);
  writeLocal(key, [row, ...readLocal(key)]);
  return row;
}

export async function removeEmployerNote(agencyId, employerId, noteId) {
  if (!agencyId || !employerId || !noteId) return;
  const key = empKey(agencyId, employerId);
  writeLocal(key, readLocal(key).filter((n) => n.id !== noteId));
  if (String(noteId).startsWith('local-')) return;
  const { error } = await supabase
    .from('agency_employer_notes')
    .delete()
    .eq('agency_id', agencyId)
    .eq('employer_id', employerId)
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
