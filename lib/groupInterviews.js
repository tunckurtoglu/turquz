// lib/groupInterviews.js
// Grup mülakatı: acente sabit saat + çok aday daveti. Bkz. 0025_group_interviews.sql
import { supabase } from './supabase';

// Grup oluştur + adayları davet et. slotISO = UTC ISO. Döner: groupId.
export async function createGroup(agencyId, slotISO, candidateIds, title) {
  const { data: g, error } = await supabase
    .from('interview_groups')
    .insert({ created_by: agencyId, slot: slotISO, title: title || null })
    .select('id')
    .single();
  if (error) throw error;
  const rows = (candidateIds || []).map((id) => ({ group_id: g.id, candidate_user_id: id }));
  if (rows.length) {
    const { error: e2 } = await supabase.from('interview_group_members').insert(rows);
    if (e2) throw e2;
  }
  return g.id;
}

// Acentenin grup oturumları (+ üye durumları).
export async function listAgencyGroups(agencyId) {
  if (!agencyId) return [];
  const { data, error } = await supabase
    .from('interview_groups')
    .select('id, slot, title, status, interview_group_members(candidate_user_id, status)')
    .eq('created_by', agencyId)
    .eq('status', 'scheduled')
    .order('slot', { ascending: true });
  if (error) { console.warn('Grup mülakatları okunamadı:', error.message); return []; }
  return data || [];
}

// Adayın davet edildiği grup oturumları (+ kendi durumu).
export async function listCandidateGroups(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('interview_group_members')
    .select('status, group:interview_groups(id, slot, title, status)')
    .eq('candidate_user_id', userId);
  if (error) { console.warn('Grup davetleri okunamadı:', error.message); return []; }
  return (data || [])
    .filter((r) => r.group && r.group.status === 'scheduled')
    .map((r) => ({ id: r.group.id, slot: r.group.slot, title: r.group.title, myStatus: r.status }));
}

// Aday: katılım durumunu güncelle (accepted | declined).
export async function setGroupMemberStatus(groupId, userId, status) {
  const { error } = await supabase
    .from('interview_group_members')
    .update({ status })
    .eq('group_id', groupId)
    .eq('candidate_user_id', userId);
  if (error) throw error;
}

// Grubu iptal et (acente).
export async function cancelGroup(groupId) {
  const { error } = await supabase.from('interview_groups').update({ status: 'cancelled' }).eq('id', groupId);
  if (error) throw error;
}
