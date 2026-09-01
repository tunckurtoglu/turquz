import { supabase } from './supabase';
import { candidateCode, maskedName } from '../../../lib/candidateCode';
import { activeStep } from '../../../lib/pipeline';

function asPayload(data) {
  if (!data) return null;
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return null; }
  }
  return typeof data === 'object' ? data : null;
}

function throwNoticeErr(payload, fallback) {
  const code = payload?.error || fallback || 'agency_notice_err';
  const err = new Error(code);
  err.code = code;
  err.detail = payload?.detail || '';
  throw err;
}

async function sessionToken() {
  const { data } = await supabase.auth.getSession();
  if (data?.session?.access_token) return data.session.access_token;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed?.session?.access_token || '';
}

async function call(body) {
  const token = await sessionToken();
  const { data, error } = await supabase.functions.invoke('agency-notice', {
    body: { ...body, accessToken: token || undefined },
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
  const payload = asPayload(data);
  if (payload?.error) throwNoticeErr(payload);
  if (error) {
    let extra = payload;
    if (!extra) {
      try {
        const ctx = error.context;
        if (ctx && typeof ctx.json === 'function') extra = await ctx.json();
        else if (ctx && typeof ctx === 'object' && ctx.error) extra = ctx;
      } catch { /* ignore */ }
    }
    throwNoticeErr(extra, error.message || 'agency_notice_err');
  }
  return data;
}

export async function sendAgencyNotice({ userIds, title, body, tone = 'info', targetKind = 'selected' }) {
  const ids = [...new Set((userIds || []).map((id) => String(id || '')).filter(Boolean))];
  if (ids.length > 1000) {
    const err = new Error('too_many');
    err.code = 'too_many';
    throw err;
  }
  return call({
    userIds: ids,
    title: String(title || '').trim(),
    body: String(body || '').trim(),
    tone,
    targetKind,
  });
}

export const NOTICE_BUCKETS = [
  { id: 'fav', labelKey: 'agency_notice_aud_fav' },
  { id: 'offered', labelKey: 'ops_funnel_offer' },
  { id: 'interview', labelKey: 'ops_funnel_interview' },
  { id: 'docs', labelKey: 'pipe_step_1' },
  { id: 'contract', labelKey: 'pipe_step_2' },
  { id: 'ref', labelKey: 'ops_funnel_ref' },
  { id: 'permit', labelKey: 'ops_funnel_permit' },
  { id: 'flight', labelKey: 'pipe_step_5' },
  { id: 'transfer', labelKey: 'ops_funnel_transfer' },
  { id: 'transit', labelKey: 'ops_transit' },
  { id: 'staff', labelKey: 'agency_notice_aud_staff' },
];

function photoOf(data) {
  const d = data || {};
  return d.photo || d.photoClose || d.photoFull || '';
}

function noticePerson(userId, p) {
  const data = p?.data || {};
  return {
    userId,
    code: candidateCode(p?.nationality, p?.reg_no),
    nationality: p?.nationality || '',
    title: p?.title || '',
    name: maskedName(data),
    photo: photoOf(data),
  };
}

async function fetchProfiles(ids) {
  const uniq = [...new Set((ids || []).filter(Boolean))];
  const prof = {};
  for (let i = 0; i < uniq.length; i += 200) {
    const slice = uniq.slice(i, i + 200);
    const [{ data: pool }, { data: hired }, { data: transit }] = await Promise.all([
      supabase.from('candidate_pool').select('user_id, reg_no, nationality, title, data').in('user_id', slice),
      supabase.from('candidate_hired').select('user_id, reg_no, nationality, title, data').in('user_id', slice),
      supabase.from('candidate_in_transit').select('user_id, reg_no, nationality, title, data').in('user_id', slice),
    ]);
    (pool || []).forEach((p) => { prof[p.user_id] = p; });
    (hired || []).forEach((p) => { if (!prof[p.user_id]) prof[p.user_id] = p; });
    (transit || []).forEach((p) => { if (!prof[p.user_id]) prof[p.user_id] = p; });
  }
  return prof;
}

export async function listNoticeAudienceBuckets(agencyId) {
  const aid = agencyId ? String(agencyId) : '';
  const [offered, process, hired, transit, ivs, favs] = await Promise.all([
    aid
      ? supabase.from('candidate_status').select('user_id').eq('accepted_by', aid).eq('status', 'offered')
        .then(({ data }) => data || [])
      : [],
    aid
      ? supabase.from('candidate_status').select('user_id').eq('accepted_by', aid).eq('status', 'accepted')
        .then(({ data }) => data || [])
      : [],
    aid
      ? supabase.from('candidate_hired').select('user_id').eq('accepted_by', aid)
        .then(({ data }) => data || [])
      : [],
    aid
      ? supabase.from('candidate_in_transit').select('user_id').eq('accepted_by', aid)
        .then(({ data }) => data || [])
      : [],
    aid
      ? supabase.from('interviews').select('user_id').eq('created_by', aid).in('status', ['proposed', 'scheduled'])
        .then(({ data }) => data || [])
      : [],
    aid
      ? supabase.from('agency_favorites').select('candidate_id').eq('agency_id', aid).order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.warn('notice favs:', error.message);
          return data || [];
        })
      : [],
  ]);

  // Personel statüsüne geçen aday artık favori hedef kitlesinde görünmemeli.
  const staffIds = new Set((hired || []).map((r) => r.user_id).filter(Boolean));
  const visibleFavs = (favs || []).filter((r) => r.candidate_id && !staffIds.has(r.candidate_id));
  const cardIds = [
    ...(offered || []), ...(process || []), ...(hired || []), ...(transit || []), ...(ivs || []),
  ].map((r) => r.user_id).concat(visibleFavs.map((r) => r.candidate_id));
  const prof = await fetchProfiles(cardIds);

  const buckets = {};
  NOTICE_BUCKETS.forEach((b) => { buckets[b.id] = []; });
  const add = (id, uid) => {
    if (!uid || !buckets[id]) return;
    buckets[id].push(noticePerson(uid, prof[uid]));
  };

  visibleFavs.forEach((r) => add('fav', r.candidate_id));
  (offered || []).forEach((r) => add('offered', r.user_id));
  (ivs || []).forEach((r) => add('interview', r.user_id));
  (transit || []).forEach((r) => add('transit', r.user_id));
  (hired || []).forEach((r) => add('staff', r.user_id));

  const processIds = (process || []).map((r) => r.user_id).filter(Boolean);
  if (processIds.length) {
    const { data: docs } = await supabase
      .from('user_documents')
      .select('user_id, kind, submitted_at')
      .in('user_id', processIds)
      .not('submitted_at', 'is', null);
    const byUser = {};
    (docs || []).forEach((d) => {
      if (!byUser[d.user_id]) byUser[d.user_id] = new Set();
      byUser[d.user_id].add(d.kind);
    });
    (process || []).forEach((st) => {
      const set = byUser[st.user_id] || new Set();
      const step = activeStep((k) => set.has(k));
      if (step === 1) add('docs', st.user_id);
      else if (step === 2) add('contract', st.user_id);
      else if (step === 3) add('ref', st.user_id);
      else if (step === 4) add('permit', st.user_id);
      else if (step === 5) add('flight', st.user_id);
      else add('transfer', st.user_id);
    });
  }

  const sortP = (a, b) => String(a.code || a.userId).localeCompare(String(b.code || b.userId));
  return NOTICE_BUCKETS.map((b) => {
    const seen = new Set();
    const people = (buckets[b.id] || []).filter((p) => {
      if (!p.userId || seen.has(p.userId)) return false;
      seen.add(p.userId);
      return true;
    });
    if (b.id !== 'fav') people.sort(sortP);
    return { ...b, people };
  });
}

export async function resolveNoticeAudience(agencyId, groups) {
  const want = new Set(groups || []);
  if (!want.size) return [];
  const buckets = await listNoticeAudienceBuckets(agencyId);
  const ids = new Set();
  buckets.forEach((b) => {
    if (want.has(b.id)) b.people.forEach((p) => ids.add(p.userId));
  });
  return [...ids];
}

export async function listAgencyNotices(limit = 30) {
  const { data, error } = await supabase
    .from('agency_notices')
    .select('id, tone, title, body, created_at, target_kind')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('agency notices:', error.message);
    return [];
  }
  const rows = data || [];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: recs, error: rErr } = await supabase
    .from('agency_notice_recipients')
    .select('notice_id, candidate_id, read_at')
    .in('notice_id', ids);
  if (rErr) console.warn('agency notice receipts:', rErr.message);
  const byNotice = {};
  (recs || []).forEach((r) => {
    if (!byNotice[r.notice_id]) byNotice[r.notice_id] = { sent: 0, read: 0 };
    byNotice[r.notice_id].sent += 1;
    if (r.read_at) byNotice[r.notice_id].read += 1;
  });
  return rows.map((r) => ({
    ...r,
    sentN: byNotice[r.id]?.sent || 0,
    readN: byNotice[r.id]?.read || 0,
  }));
}

export async function listNoticeReceipts(noticeId) {
  if (!noticeId) return [];
  const { data: recs, error } = await supabase
    .from('agency_notice_recipients')
    .select('candidate_id, read_at')
    .eq('notice_id', noticeId);
  if (error) {
    console.warn('notice receipts:', error.message);
    return [];
  }
  const rows = recs || [];
  const ids = rows.map((r) => r.candidate_id);
  const prof = await fetchProfiles(ids);
  return rows.map((r) => ({
    ...noticePerson(r.candidate_id, prof[r.candidate_id]),
    candidateId: r.candidate_id,
    readAt: r.read_at,
  })).sort((a, b) => Number(!!a.readAt) - Number(!!b.readAt) || String(a.code).localeCompare(String(b.code)));
}

export async function markAgencyNoticeRead(noticeId) {
  if (!noticeId) return;
  const { error } = await supabase.rpc('mark_agency_notice_read', { p_notice: noticeId });
  if (error) console.warn('mark agency notice:', error.message);
}

export function noticeErrorText(code, t, detail) {
  const map = {
    title_body_required: 'agency_notice_need_text',
    selected_required: 'agency_notice_need_people',
    daily_limit: 'agency_notice_daily',
    too_many: 'agency_notice_too_many',
    title_too_long: 'agency_notice_need_text',
    body_too_long: 'agency_notice_need_text',
    insert_failed: 'agency_notice_err',
    forbidden: 'agency_notice_err',
    unauthorized: 'agency_notice_err',
  };
  const key = map[code] || 'agency_notice_err';
  const base = t(key);
  if (key !== 'agency_notice_err') return base;
  const bits = [code, detail]
    .map((x) => String(x || '').trim())
    .filter((x) => x && x !== 'agency_notice_err');
  const extra = [...new Set(bits)].join(' — ');
  return extra ? `${base}\n${extra}` : base;
}

export function agencyNoticeFromLabel(payload, t) {
  const name = String(payload?.agencyName || '').trim();
  if (name) return t('agency_notice_from_named', { name });
  return t('agency_notice_from');
}
