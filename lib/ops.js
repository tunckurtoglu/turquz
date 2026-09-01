// Acente operasyon masası: kuyruk + özet metrikler (300 kişilik desk).
import { supabase } from './supabase';
import { PIPELINE, activeStep, stepActor } from './pipeline';
import { listInterviewCandidates } from './roles';
import { attachEmployers } from './employerAttach';
import { parseArriveAt } from './flights';

const STEP1 = ['passport', 'diploma', 'criminal', 'health_report'];

function hasFromKinds(kindsSet) {
  return (k) => kindsSet.has(k);
}

function enrichPipeline(kindsSet) {
  const has = hasFromKinds(kindsSet);
  const step = activeStep(has);
  const def = PIPELINE.find((s) => s.step === step);
  const actor = def ? stepActor(def, has) : null;
  return { pipeStep: step, turn: actor, titleKey: def?.titleKey || null };
}

/** Süreçteki adaylara pipeline adımı + kimin sırası ekler. */
export async function enrichProcessProgress(rows) {
  const ids = (rows || []).map((r) => r.user_id).filter(Boolean);
  if (!ids.length) return rows || [];
  const { data: docs } = await supabase
    .from('user_documents')
    .select('user_id, kind, submitted_at')
    .in('user_id', ids)
    .not('submitted_at', 'is', null);
  const byUser = {};
  (docs || []).forEach((d) => {
    if (!byUser[d.user_id]) byUser[d.user_id] = new Set();
    byUser[d.user_id].add(d.kind);
  });
  return (rows || []).map((r) => {
    const set = byUser[r.user_id] || new Set();
    return { ...r, ...enrichPipeline(set) };
  });
}

/** Okunmamış chat bildirimlerini aday bazında grupla. */
export async function listUnreadChatThreads(agencyId, limit = 40) {
  if (!agencyId) return [];
  const { data: notifs } = await supabase
    .from('notifications')
    .select('id, ref_user, payload, created_at, read_at')
    .eq('user_id', agencyId)
    .eq('type', 'chat_message')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(120);
  const byCand = new Map();
  (notifs || []).forEach((n) => {
    const cid = n.payload?.candidateId || n.ref_user;
    if (!cid) return;
    const cur = byCand.get(cid);
    if (!cur) byCand.set(cid, { candidateId: cid, count: 1, lastAt: n.created_at });
    else {
      cur.count += 1;
      if (n.created_at > cur.lastAt) cur.lastAt = n.created_at;
    }
  });
  const threads = [...byCand.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)).slice(0, limit);
  if (!threads.length) return [];
  const ids = threads.map((t) => t.candidateId);
  const [{ data: pool }, { data: hired }, { data: transit }] = await Promise.all([
    supabase.from('candidate_pool').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', ids),
    supabase.from('candidate_hired').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', ids),
    supabase.from('candidate_in_transit').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', ids),
  ]);
  const byId = {};
  [...(pool || []), ...(hired || []), ...(transit || [])].forEach((p) => { byId[p.user_id] = p; });
  return threads.map((t) => ({ ...t, profile: byId[t.candidateId] || null })).filter((t) => t.profile);
}

function inboxPreviewBody(row, agencyId, viewLang) {
  if (!row?.body) return '';
  if (row.sender_id === agencyId) return row.body;
  const tr = row.translations || {};
  if (tr[viewLang]) return tr[viewLang];
  return row.body;
}

/** Süreç sohbeti thread’leri (okunmuş + okunmamış). count = okunmamış adedi. */
export async function listAgencyChatThreads(agencyId, limit = 120) {
  if (!agencyId) return [];
  const [{ data: chats }, { data: notifs }, { data: prefs }] = await Promise.all([
    supabase
      .from('process_chats')
      .select('id, candidate_id, last_message_at, closed_at')
      .eq('agency_id', agencyId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(limit),
    supabase
      .from('notifications')
      .select('id, ref_user, payload, created_at, read_at')
      .eq('user_id', agencyId)
      .eq('type', 'chat_message')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(400),
    supabase.from('agency_notif_prefs').select('preferred_lang').eq('user_id', agencyId).maybeSingle(),
  ]);

  const viewLang = prefs?.preferred_lang || 'tr';
  const chatIdByCand = new Map();
  (chats || []).forEach((c) => { chatIdByCand.set(c.candidate_id, c.id); });

  const unreadByCand = new Map();
  (notifs || []).forEach((n) => {
    const cid = n.payload?.candidateId || n.ref_user;
    if (!cid) return;
    unreadByCand.set(cid, (unreadByCand.get(cid) || 0) + 1);
  });

  let threads = (chats || []).map((c) => ({
    chatId: c.id,
    candidateId: c.candidate_id,
    count: c.closed_at ? 0 : (unreadByCand.get(c.candidate_id) || 0),
    lastAt: c.last_message_at || c.closed_at || null,
    closed: !!c.closed_at,
    lastPreview: '',
  }));

  // Bildirimde olup henüz chat satırı gelmeyenler (edge race) — yalnızca aktif
  unreadByCand.forEach((count, cid) => {
    if (!threads.some((t) => t.candidateId === cid)) {
      threads.push({ chatId: null, candidateId: cid, count, lastAt: null, closed: false, lastPreview: '' });
    }
  });

  threads = threads.sort((a, b) => {
    if (!!a.closed !== !!b.closed) return a.closed ? 1 : -1;
    if ((b.count > 0) !== (a.count > 0)) return b.count > 0 ? 1 : -1;
    const la = a.lastAt || '';
    const lb = b.lastAt || '';
    return la < lb ? 1 : la > lb ? -1 : 0;
  }).slice(0, limit);

  if (!threads.length) return [];

  const chatIds = threads.map((t) => t.chatId).filter(Boolean);
  if (chatIds.length) {
    const { data: previews } = await supabase.rpc('agency_chat_inbox_previews', { p_chat_ids: chatIds });
    const previewByChat = new Map((previews || []).map((p) => [p.chat_id, p]));
    threads = threads.map((t) => {
      const row = t.chatId ? previewByChat.get(t.chatId) : null;
      return { ...t, lastPreview: inboxPreviewBody(row, agencyId, viewLang) };
    });
  }

  const ids = threads.map((t) => t.candidateId);
  const [{ data: pool }, { data: hired }, { data: transit }] = await Promise.all([
    supabase.from('candidate_pool').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', ids),
    supabase.from('candidate_hired').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', ids),
    supabase.from('candidate_in_transit').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', ids),
  ]);
  const byId = {};
  [...(pool || []), ...(hired || []), ...(transit || [])].forEach((p) => { byId[p.user_id] = p; });
  const withProfile = threads.map((t) => ({ ...t, profile: byId[t.candidateId] || null })).filter((t) => t.profile);
  return attachEmployers(agencyId, withProfile, 'candidateId');
}

export async function unreadChatCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .is('read_at', null);
  if (error) return 0;
  return count || 0;
}

/**
 * Operasyon masası özeti + aksiyon kuyruğu.
 * Queue kinds: agency_turn | docs_overdue | interview_today | offered_wait | boarding | chat
 */
export async function loadAgencyOps(agencyId) {
  const empty = {
    metrics: {
      pool: 0, offered: 0, process: 0, hired: 0,
      interviewsToday: 0, agencyTurn: 0, docsOverdue: 0,
      boardingRisk: 0, chatUnread: 0,
    },
    queue: [],
  };
  if (!agencyId) return empty;

  const today = new Date();
  const ymd = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const todayStr = ymd(today);

  const [
    { data: allSt },
    { data: myProcess },
    { data: myHired },
    { data: myTransit },
    ivList,
    chatUnread,
    chatThreads,
    { data: boardingRows },
  ] = await Promise.all([
    supabase.from('candidate_status').select('user_id, status, docs_unlocked, accepted_by, docs_deadline_at, accepted_at, boarding_status, flight_depart_on, work_start_at'),
    supabase.from('candidate_status').select('user_id, docs_deadline_at, accepted_at, status').eq('accepted_by', agencyId).eq('status', 'accepted'),
    supabase.from('candidate_status').select('user_id').eq('accepted_by', agencyId).eq('status', 'hired'),
    supabase
      .from('candidate_status')
      .select('user_id, work_start_at, flight_depart_on, work_start_asked_at, work_start_remind_count, boarding_status')
      .eq('accepted_by', agencyId)
      .eq('status', 'in_transit'),
    listInterviewCandidates(agencyId),
    unreadChatCount(agencyId),
    listUnreadChatThreads(agencyId, 12),
    supabase
      .from('candidate_status')
      .select('user_id, boarding_status, flight_depart_on')
      .eq('accepted_by', agencyId)
      .in('status', ['hired', 'in_transit'])
      .in('boarding_status', ['pending', 'missed', 'no_response']),
  ]);

  const metrics = {
    pool: 0, offered: 0, process: 0, hired: 0, transit: 0,
    interviewsToday: 0, agencyTurn: 0, docsOverdue: 0,
    boardingRisk: 0, chatUnread: chatUnread || 0, startConfirm: 0,
    arrivalsSoon: 0, arrivalsMissing: 0,
  };

  const { count: poolCount } = await supabase
    .from('candidate_pool')
    .select('user_id', { count: 'exact', head: true });
  metrics.pool = poolCount || 0;
  metrics.process = (myProcess || []).length;
  metrics.hired = (myHired || []).length;
  metrics.transit = (myTransit || []).length;
  metrics.offered = (allSt || []).filter((s) => s.status === 'offered' && s.accepted_by === agencyId).length;

  const now = Date.now();
  const processIds = (myProcess || []).map((r) => r.user_id);
  let docsByUser = {};
  if (processIds.length) {
    const { data: docs } = await supabase
      .from('user_documents')
      .select('user_id, kind, submitted_at')
      .in('user_id', processIds)
      .not('submitted_at', 'is', null);
    (docs || []).forEach((d) => {
      if (!docsByUser[d.user_id]) docsByUser[d.user_id] = new Set();
      docsByUser[d.user_id].add(d.kind);
    });
  }

  const queue = [];
  const pushQ = (item) => { queue.push(item); };

  // Acente sırası + belge süresi
  const overdueIds = [];
  const agencyTurnIds = [];
  (myProcess || []).forEach((st) => {
    const set = docsByUser[st.user_id] || new Set();
    const info = enrichPipeline(set);
    if (info.turn === 'agency') agencyTurnIds.push({ id: st.user_id, ...info });
    const dl = st.docs_deadline_at || null;
    const step1Done = STEP1.every((k) => set.has(k));
    if (!step1Done && dl && new Date(dl).getTime() < now) overdueIds.push(st.user_id);
  });
  metrics.agencyTurn = agencyTurnIds.length;
  metrics.docsOverdue = overdueIds.length;

  // Funnel: süreç adımı envanteri (aksiyon kuyruğundan ayrı)
  metrics.funnelOffered = metrics.offered;
  metrics.funnelInterview = (ivList || []).filter((iv) => iv.ivStatus === 'scheduled').length;
  metrics.funnelDocs = 0;
  metrics.funnelContract = 0;
  metrics.funnelRef = 0;
  metrics.funnelPermit = 0;
  metrics.funnelFlight = 0;
  metrics.funnelTransfer = 0;
  metrics.funnelTransit = metrics.transit;
  (myProcess || []).forEach((st) => {
    const set = docsByUser[st.user_id] || new Set();
    const step = activeStep(hasFromKinds(set));
    if (step === 1) metrics.funnelDocs += 1;
    else if (step === 2) metrics.funnelContract += 1;
    else if (step === 3) metrics.funnelRef += 1;
    else if (step === 4) metrics.funnelPermit += 1;
    else if (step === 5) metrics.funnelFlight += 1;
    else if (step >= 6) metrics.funnelTransfer += 1;
  });

  // Bugünkü mülakatlar
  const interviewsToday = (ivList || []).filter((iv) => {
    if (iv.ivStatus !== 'scheduled' || !iv.ivSlot) return false;
    return String(iv.ivSlot).slice(0, 10) === todayStr;
  });
  metrics.interviewsToday = interviewsToday.length;
  interviewsToday.forEach((iv) => {
    pushQ({
      kind: 'interview_today',
      priority: 10,
      candidateId: iv.user_id,
      profile: iv,
      label: 'Bugün mülakat',
      detail: iv.ivSlot ? new Date(iv.ivSlot).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
    });
  });

  overdueIds.forEach((id) => {
    pushQ({ kind: 'docs_overdue', priority: 20, candidateId: id, label: 'Süresi geçmiş belgeler', detail: 'İlk belge paketi gecikti' });
  });
  agencyTurnIds.forEach((row) => {
    pushQ({
      kind: 'agency_turn',
      priority: 30,
      candidateId: row.id,
      label: 'Sıra sizde',
      detail: row.titleKey || `Adım ${row.pipeStep}`,
      titleKey: row.titleKey,
      pipeStep: row.pipeStep,
    });
  });

  // Transit: işe başlama onayı bekleyen
  const todayDate = todayStr;
  (myTransit || []).forEach((tr) => {
    const due = tr.work_start_at && String(tr.work_start_at).slice(0, 10) <= todayDate;
    if (due) {
      const startYmd = String(tr.work_start_at).slice(0, 10);
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 14);
      const stalled = startYmd <= ymd(cutoff);
      metrics.startConfirm += 1;
      pushQ({
        kind: 'start_confirm',
        priority: stalled ? 8 : 12,
        candidateId: tr.user_id,
        label: stalled ? 'Yolda takıldı — arayın' : (tr.work_start_asked_at ? 'İşe başlama onayı bekleniyor' : 'İşe başladı mı?'),
        detail: tr.work_start_at || '',
        openHireConfirm: true,
      });
    } else {
      pushQ({
        kind: 'transit',
        priority: 45,
        candidateId: tr.user_id,
        label: 'Yolda',
        detail: tr.work_start_at ? `İşe başlama ${tr.work_start_at}` : '',
      });
    }
  });

  // Boarding risk
  const board = boardingRows || [];
  metrics.boardingRisk = board.length;
  board.forEach((b) => {
    pushQ({
      kind: 'boarding',
      priority: b.boarding_status === 'missed' ? 13 : b.boarding_status === 'no_response' ? 14 : 40,
      candidateId: b.user_id,
      label: b.boarding_status === 'missed' ? 'Uçak kaçırıldı' : b.boarding_status === 'no_response' ? 'Uçuş cevabı yok' : 'Uçuş teyidi bekleniyor',
      detail: b.flight_depart_on || '',
      boarding: b.boarding_status,
    });
  });

  // Bugün / yarın varış (Yolda + Personel) — şoförsüz olanlar öne
  const staffIds = [
    ...(myHired || []).map((r) => r.user_id),
    ...(myTransit || []).map((r) => r.user_id),
  ].filter(Boolean);
  if (staffIds.length) {
    const tmr = new Date(today);
    tmr.setDate(tmr.getDate() + 1);
    const tomorrowStr = ymd(tmr);
    const { data: flightRows } = await supabase
      .from('flights')
      .select('user_id, arrive_at, pickup_name, pickup_phone, to_airport, flight_no')
      .in('user_id', staffIds);
    (flightRows || []).forEach((f) => {
      const p = parseArriveAt(f.arrive_at);
      if (!p || (p.ymd !== todayStr && p.ymd !== tomorrowStr)) return;
      const missing = !String(f.pickup_name || '').trim();
      metrics.arrivalsSoon += 1;
      if (missing) metrics.arrivalsMissing += 1;
      const when = [p.date, p.time].filter(Boolean).join(' ');
      pushQ({
        kind: 'arrival',
        priority: missing ? 14 : 18,
        candidateId: f.user_id,
        label: p.ymd === todayStr ? 'Bugün varış' : 'Yarın varış',
        detail: missing ? `${when} · şoför yok` : `${when} · ${f.pickup_name}`,
        missingDriver: missing,
      });
    });
  }

  // Chat
  chatThreads.forEach((th) => {
    pushQ({
      kind: 'chat',
      priority: 25,
      candidateId: th.candidateId,
      profile: th.profile,
      label: 'Okunmamış mesaj',
      detail: `${th.count} mesaj`,
      openChat: true,
      lastAt: th.lastAt,
    });
  });

  // Teklif bekleyen (bu acentenin)
  const { data: offeredMine } = await supabase
    .from('candidate_status')
    .select('user_id, offered_at')
    .eq('status', 'offered')
    .eq('accepted_by', agencyId)
    .order('offered_at', { ascending: false })
    .limit(15);
  (offeredMine || []).forEach((o) => {
    pushQ({
      kind: 'offered_wait',
      priority: 50,
      candidateId: o.user_id,
      label: 'Teklif yanıtı bekleniyor',
      detail: o.offered_at ? new Date(o.offered_at).toLocaleDateString('tr-TR') : '',
    });
  });

  // Profilleri doldur
  const needIds = [...new Set(queue.filter((q) => !q.profile).map((q) => q.candidateId))];
  if (needIds.length) {
    const [{ data: pool }, { data: hired }, { data: transit }] = await Promise.all([
      supabase.from('candidate_pool').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', needIds),
      supabase.from('candidate_hired').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', needIds),
      supabase.from('candidate_in_transit').select('user_id, title, data, reg_no, nationality, last_seen_at').in('user_id', needIds),
    ]);
    const byId = {};
    [...(pool || []), ...(hired || []), ...(transit || [])].forEach((p) => { byId[p.user_id] = p; });
    queue.forEach((q) => {
      if (!q.profile) q.profile = byId[q.candidateId] || null;
    });
  }

  queue.sort((a, b) => a.priority - b.priority || String(b.lastAt || '').localeCompare(String(a.lastAt || '')));

  const full = queue.filter((q) => q.profile);
  const byKind = {};
  full.forEach((q) => {
    if (!byKind[q.kind]) byKind[q.kind] = [];
    byKind[q.kind].push(q);
  });

  // Toplamlar metriklerden (liste kesilse bile doğru sayı)
  const countsByKind = {
    start_confirm: metrics.startConfirm || 0,
    docs_overdue: metrics.docsOverdue || 0,
    agency_turn: metrics.agencyTurn || 0,
    boarding: metrics.boardingRisk || 0,
    arrival: metrics.arrivalsSoon || 0,
    interview_today: metrics.interviewsToday || 0,
    chat: (byKind.chat || []).length,
    transit: metrics.transit || 0,
    offered_wait: metrics.offered || 0,
  };

  const PER = 50;
  const capped = [];
  Object.keys(byKind).forEach((k) => {
    capped.push(...byKind[k].slice(0, PER));
  });
  capped.sort((a, b) => a.priority - b.priority || String(b.lastAt || '').localeCompare(String(a.lastAt || '')));

  return { metrics, queue: capped, countsByKind };
}
