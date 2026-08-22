import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { useLang } from '../i18n.jsx';
import { DAYS, monthOptions, FLIGHT_YEARS, IV_BANDS, ivBandIndex, ivClampToBand, ivDefaultInBand, ivBandOpen, ivEarliestInBand } from '../../../cv/options';
import {
  getInterview, proposeInterview, cancelInterview, markInterviewDone, agencyBusySlots, agencyScheduledCounts, notifyInterview,
  slotLabel, weekdayOf, weekdayOfParts, slotDateKey, slotTime, formatCountdown, toISO, fromISO, callWindow, getCallWindowOpts,
  forceScheduleForTest, slotConflictKind, conflictNeighborLabels, slotMs,
} from '../lib/interviews';
import { supabase } from '../lib/supabase';

const CallRoom = lazy(() => import('./CallRoom.jsx'));

const BAND_KEYS = ['t0', 't1', 't2'];
const BAND_TITLE_KEYS = ['iv_morning', 'iv_noon', 'iv_evening'];

const emptyForm = () => ({ d: '', m: '', y: '', t0: '', t1: '', t2: '' });
const openBandsOf = (g, nowMs = Date.now()) => {
  if (!(g.d && g.m && g.y)) return [0, 1, 2];
  return [0, 1, 2].filter((bi) => ivBandOpen(g.d, g.m, g.y, bi, nowMs));
};
const formReady = (g, nowMs = Date.now()) => {
  if (!(g.d && g.m && g.y)) return false;
  const open = openBandsOf(g, nowMs);
  if (!open.length) return false;
  return open.every((bi) => !!g[BAND_KEYS[bi]]);
};

function slotsToForm(slots) {
  const parsed = (slots || []).map(fromISO).filter(Boolean);
  if (!parsed.length) return emptyForm();
  const { d, m, y } = parsed[0];
  const times = parsed.filter((p) => p.d === d && p.m === m && p.y === y).map((p) => p.hhmm);
  const pick = (band) => times.find((tm) => ivBandIndex(tm) === band) || '';
  return { d, m, y, t0: pick(0), t1: pick(1), t2: pick(2) };
}

function Sel({ value, onChange, options, placeholder }) {
  return (
    <select className="ivSel" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export default function InterviewPanel({ candidate, agencyUserId }) {
  const { lang, t } = useLang();
  const userId = candidate.user_id;
  const [iv, setIv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [replan, setReplan] = useState(false);
  const [busySlots, setBusySlots] = useState([]);
  const [schedCounts, setSchedCounts] = useState({});
  const [callOpen, setCallOpen] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [callOpts, setCallOpts] = useState({ minutes: 10, extraSecs: 0 });

  const load = useCallback(async () => {
    let row = await getInterview(userId);
    let opts = { minutes: 10, extraSecs: 0 };
    if (row?.status === 'scheduled' && row.selectedSlot) {
      opts = await getCallWindowOpts(row);
      setCallOpts(opts);
    } else setCallOpts(opts);
    if (row?.status === 'scheduled' && row.selectedSlot && callWindow(row.selectedSlot, opts).ended) {
      try { await markInterviewDone(userId); } catch (e) { /* yoksay */ }
      row = await getInterview(userId);
    }
    setIv(row);
    setForm(row?.status === 'proposed' ? slotsToForm(row.slots) : emptyForm());
    const [busyList, counts] = await Promise.all([
      agencyBusySlots(agencyUserId, userId),
      agencyScheduledCounts(agencyUserId),
    ]);
    setBusySlots(busyList);
    setSchedCounts(counts);
    setLoading(false);
  }, [userId, agencyUserId]);

  useEffect(() => { setLoading(true); setReplan(false); load(); }, [load]);

  useEffect(() => {
    const ch = supabase.channel(`iv-web-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  useEffect(() => {
    if (iv?.status !== 'scheduled' || !iv?.selectedSlot) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iv?.status, iv?.selectedSlot]);

  const [bandTick, setBandTick] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setBandTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const updateForm = (key, v) => setForm((p) => {
    const next = { ...p, [key]: v };
    if (key === 'd' || key === 'm' || key === 'y') {
      [0, 1, 2].forEach((bi) => {
        if (!ivBandOpen(next.d, next.m, next.y, bi)) next[BAND_KEYS[bi]] = '';
      });
    }
    return next;
  });

  useEffect(() => {
    if (!form.d || !form.m || !form.y) return;
    setForm((p) => {
      let changed = false;
      const next = { ...p };
      [0, 1, 2].forEach((bi) => {
        if (!ivBandOpen(p.d, p.m, p.y, bi, bandTick) && next[BAND_KEYS[bi]]) {
          next[BAND_KEYS[bi]] = '';
          changed = true;
        }
      });
      return changed ? next : p;
    });
  }, [bandTick, form.d, form.m, form.y]);

  const openBands = openBandsOf(form, bandTick);
  const ruleOk = formReady(form, bandTick);

  const setBandTime = (bandIndex, raw) => {
    if (!raw) { updateForm(BAND_KEYS[bandIndex], ''); return; }
    updateForm(BAND_KEYS[bandIndex], ivClampToBand(raw, bandIndex));
  };

  const doPropose = async (slots) => {
    setBusy(true);
    try {
      await proposeInterview(userId, slots, agencyUserId);
      notifyInterview(userId, 'proposed');
      setReplan(false);
      await load();
    } catch (e) {
      const msg = String(e?.message || e || '');
      alert(msg.includes('candidate_passive')
        ? (t('iv_candidate_passive') || '')
        : (msg || t('err_generic') || ''));
    }
    finally { setBusy(false); }
  };

  const sendSlots = async () => {
    if (!(form.d && form.m && form.y)) { alert(t('iv_need_day') || ''); return; }
    if (!openBands.length) { alert(t('iv_past_slot') || ''); return; }
    const times = openBands.map((bi) => form[BAND_KEYS[bi]]).filter(Boolean);
    if (times.length !== openBands.length) { alert(t('iv_need_open_times') || ''); return; }
    if (new Set(times).size !== times.length) { alert(t('iv_times_distinct') || ''); return; }
    const slots = times.map((tm) => toISO(form.d, form.m, form.y, tm)).sort();
    if (slots.some((s) => !(slotMs(s) > Date.now() + 60 * 1000))) {
      alert(t('iv_past_slot') || '');
      return;
    }

    for (const s of slots) {
      const kind = slotConflictKind(s, busySlots);
      if (kind === 'near') {
        const n = conflictNeighborLabels(s, busySlots, lang);
        alert(t('iv_near_conflict', { conflict: n?.conflict || '', later: n?.later || '', earlier: n?.earlier || '' }) || '');
        return;
      }
      if (kind === 'exact' && (schedCounts[s] || 0) >= 3) {
        alert(t('iv_slot_full') || '');
        return;
      }
    }

    const exacts = slots.filter((s) => slotConflictKind(s, busySlots) === 'exact');
    if (exacts.length) {
      if (!confirm(t('iv_group_warn') || '')) return;
    }
    await doPropose(slots);
  };

  const doCancel = async () => {
    if (!confirm(t('iv_cancel_confirm') || '')) return;
    setBusy(true);
    try { await cancelInterview(userId); await load(); } catch (e) { alert(e?.message || t('err_generic') || ''); } finally { setBusy(false); }
  };

  const startTest = async () => {
    setBusy(true);
    try { await forceScheduleForTest(userId, agencyUserId); setIv(await getInterview(userId)); setCallOpen(true); }
    catch (e) { alert(e?.message || t('err_generic') || ''); } finally { setBusy(false); }
  };

  if (loading) return <div className="center pad"><div className="spinner" /></div>;
  const status = iv?.status;
  const months = monthOptions(lang);

  // Yalnızca geliştirme ortamında veya VITE_IV_TEST=1 ile görünür (prod'da yanlışlıkla force-schedule olmasın).
  const showTest = import.meta.env.DEV || import.meta.env.VITE_IV_TEST === '1';
  const testBar = showTest ? (
    <div className="ivTestBar">
      <div>{t('iv_test_mode') || ''}</div>
      <button className="ivJoinBtn sm" onClick={startTest} disabled={busy}>{t('iv_test_start') || ''}</button>
    </div>
  ) : null;
  const closeCall = useCallback(() => setCallOpen(false), []);
  const callModal = callOpen ? <Suspense fallback={null}><CallRoom candidateUserId={userId} candidateLabel={candidate.code || t('role_candidate') || ''} slotISO={iv?.selectedSlot || ''} onClose={closeCall} /></Suspense> : null;

  if (status === 'scheduled' && iv.selectedSlot && !callWindow(iv.selectedSlot, callOpts).ended) {
    const win = callWindow(iv.selectedSlot, callOpts);
    const joinable = win.joinable;
    const left = (win.base || 0) - nowTick;
    return (
      <div className="ivWrap">
        {testBar}
        <div className="ivSchedCard">
          <div className="ivSchedAccent" />
          <div className="ivSchedBadge">✓</div>
          <div className="ivSchedKicker">{t('iv_scheduled') || ''}</div>
          <div className="ivSchedDay">{weekdayOf(iv.selectedSlot, lang)}</div>
          <div className="ivSchedDate">{slotDateKey(iv.selectedSlot)}</div>
          <div className="ivSchedTime">🕒 {slotTime(iv.selectedSlot)}</div>
          {left > 0 ? <div className="ivSchedCountdown">⏱ {t('iv_countdown') || ''}: {formatCountdown(left)}</div> : null}
          <div className="ivSchedTz">🌍 {t('iv_localtime') || ''}</div>
        </div>
        {joinable
          ? <button className="ivJoinBtn" onClick={() => setCallOpen(true)}>🎥 {t('call_join') || ''}</button>
          : <div className="ivWaitNote">{t('iv_waiting_join') || ''}</div>}
        <div className="ivBtnRow">
          <button className="ghostBtn" onClick={() => { setReplan(true); setIv({ ...iv, status: 'proposed' }); setForm(slotsToForm(iv.slots?.length ? iv.slots : [iv.selectedSlot])); }}>{t('iv_replan') || ''}</button>
          <button className="dangerBtn" onClick={doCancel} disabled={busy}>{t('iv_cancel') || ''}</button>
        </div>
        {callModal}
      </div>
    );
  }

  if (status === 'proposed' && !replan) {
    const by = iv.respondBy ? new Date(iv.respondBy).getTime() : 0;
    const left = by - nowTick;
    const slaLine = !by ? null
      : (left <= 0 || iv.noResponseNotifiedAt)
        ? (t('iv_respond_overdue') || '')
        : (t('iv_waiting_sla', { left: formatCountdown(left) }) || '');
    return (
      <div className="ivWrap">
        {testBar}
        <div className="ivWaitBox">
          <div className="ivWaitTitle">⏳ {t('iv_waiting_candidate') || ''}</div>
          {slaLine ? <div className="ivWaitSla">{slaLine}</div> : null}
          <div className="ivChips">{iv.slots.map((s) => <span key={s} className="ivChip">{slotLabel(s, lang)}</span>)}</div>
        </div>
        <div className="ivBtnRow">
          <button className="ghostBtn" onClick={() => setReplan(true)}>{t('iv_replan') || ''}</button>
          <button className="dangerBtn" onClick={doCancel} disabled={busy}>{t('agency_cancel') || ''}</button>
        </div>
        {callModal}
      </div>
    );
  }

  return (
    <div className="ivWrap">
      {testBar}
      <div className="ivHint">{t('iv_rule_hint') || ''}</div>

      <div className="ivDayCard">
        <div className="ivDayHead">
          <span className="ivDayNo">1</span>
          <span className="ivDayTitle">{t('iv_day_title') || ''}</span>
          {form.d && form.m && form.y ? <span className="ivDayWeek">{weekdayOfParts(form.d, form.m, form.y, lang)}</span> : null}
        </div>
        <div className="ivLbl">{t('iv_date_label') || ''}</div>
        <div className="ivRow">
          <Sel value={form.d} onChange={(v) => updateForm('d', v)} options={DAYS} placeholder={t('iv_day') || t('f_day') || ''} />
          <Sel value={form.m} onChange={(v) => updateForm('m', v)} options={months} placeholder={t('f_month') || ''} />
          <Sel value={form.y} onChange={(v) => updateForm('y', v)} options={FLIGHT_YEARS} placeholder={t('f_year') || ''} />
        </div>
        <div className="ivLbl">{t('iv_times_free') || ''}</div>
        {BAND_KEYS.map((key, bi) => {
          const locked = !!(form.d && form.m && form.y) && !ivBandOpen(form.d, form.m, form.y, bi, bandTick);
          const earliest = locked ? '' : (ivEarliestInBand(form.d, form.m, form.y, bi, bandTick) || IV_BANDS[bi].min);
          return (
            <div key={key} className={`ivTimeBand${locked ? ' locked' : ''}`}>
              <label className="ivTimeBandLbl">{t(BAND_TITLE_KEYS[bi]) || ''}</label>
              {locked ? (
                <span className="ivTimeLocked">🔒 {t('iv_band_locked') || ''}</span>
              ) : (
                <input
                  type="time"
                  className="ivTimeInput"
                  step={60}
                  min={earliest}
                  max={IV_BANDS[bi].max}
                  value={form[key] || ''}
                  onChange={(e) => setBandTime(bi, e.target.value)}
                  onBlur={(e) => {
                    if (!e.target.value) return;
                    setBandTime(bi, e.target.value || earliest || ivDefaultInBand(bi));
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="ivBtnRow">
        <button className="goldBtn sm" onClick={sendSlots} disabled={busy || !ruleOk}>{busy ? '…' : (t('iv_send_slots') || '')}</button>
        {iv ? <button className="dangerBtn" onClick={doCancel} disabled={busy}>{t('agency_cancel') || ''}</button> : null}
      </div>
      {callModal}
    </div>
  );
}
