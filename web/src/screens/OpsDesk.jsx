import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAgencyOps } from '../lib/ops';
import { addDeskNote, formatNoteDate, listDeskNotes, removeDeskNote } from '../lib/agencyNotes';
import {
  PENDING_ACTIONS, FUNNEL_TILES, QUEUE_SHOW,
  pendingTotal, urgentTotal, pickFocusFilter,
  activeFocusGroups, FOCUS_DEFS, countForFocus, opsFingerprint,
} from '../../../lib/opsUi';
import {
  seedFunnelSeen, funnelNewDeltas, clampFunnelSeen, markFunnelTileSeen,
} from '../../../lib/opsFunnelSeen';
import { loadFunnelSeen, saveFunnelSeen } from '../lib/opsFunnelSeenStore';
import { candidateCode, NATION_CODE } from '../../../lib/candidateCode';
import { useLang } from '../i18n.jsx';
import { Icon } from '../components/Icon.jsx';
import AgencyNoticeModal from '../components/AgencyNoticeModal.jsx';

const KIND_TONE = {
  interview_today: 'hot',
  docs_overdue: 'hot',
  boarding: 'warn',
  chat: 'info',
  agency_turn: 'act',
  offered_wait: 'muted',
  start_confirm: 'hot',
  transit: 'info',
  arrival: 'warn',
};

const flagUrl = (nat) => {
  const cc = NATION_CODE[nat];
  return cc && cc !== 'XX' ? `https://flagcdn.com/w40/${cc.toLowerCase()}.png` : '';
};

export default function OpsDesk({ agencyId, onOpen, onNavigateCat }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(null);
  const [busy, setBusy] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [flashKeys, setFlashKeys] = useState({});
  const [funnelSeen, setFunnelSeen] = useState(undefined);
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const prevMetrics = useRef(null);
  const userPicked = useRef(false);
  const fpRef = useRef('');

  const syncFunnelSeen = useCallback((m) => {
    setFunnelSeen((prev) => {
      if (prev === undefined) return prev;
      if (prev == null) {
        const seeded = seedFunnelSeen(m);
        saveFunnelSeen(agencyId, seeded);
        return seeded;
      }
      const clamped = clampFunnelSeen(prev, m);
      if (JSON.stringify(clamped) !== JSON.stringify(prev)) {
        saveFunnelSeen(agencyId, clamped);
        return clamped;
      }
      return prev;
    });
  }, [agencyId]);

  const loadNotes = useCallback(async () => {
    if (!agencyId) return;
    setNotes(await listDeskNotes(agencyId));
  }, [agencyId]);

  const load = useCallback(async (opts) => {
    if (!agencyId) return;
    const silent = !!opts?.silent;
    if (!silent) setBusy(true);
    try {
      const d = await loadAgencyOps(agencyId);
      const fp = opsFingerprint(d);
      if (fp === fpRef.current) return;
      fpRef.current = fp;
      const m = d?.metrics || {};
      const counts = d?.countsByKind || {};
      const prev = prevMetrics.current;
      if (prev) {
        const bumps = {};
        PENDING_ACTIONS.forEach((a) => {
          const n = Number(m[a.key]) || 0;
          const p = Number(prev[a.key]) || 0;
          if (n > p) bumps[a.key] = true;
        });
        if (Object.keys(bumps).length) {
          setFlashKeys((f) => ({ ...f, ...bumps }));
          setTimeout(() => {
            setFlashKeys((f) => {
              const copy = { ...f };
              Object.keys(bumps).forEach((k) => { delete copy[k]; });
              return copy;
            });
          }, 3500);
        }
      }
      prevMetrics.current = m;
      setData(d);
      syncFunnelSeen(m);
      setFilter((cur) => {
        if (userPicked.current && cur && countForFocus(cur, m, counts) > 0) return cur;
        const auto = pickFocusFilter(m, counts);
        if (!auto) userPicked.current = false;
        return auto;
      });
    } catch (e) {
      console.warn('ops:', e?.message);
      if (!silent) {
        setData({ metrics: {}, queue: [], countsByKind: {} });
        setFilter(null);
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }, [agencyId, syncFunnelSeen]);

  useEffect(() => {
    setFunnelSeen(undefined);
    setFunnelSeen(loadFunnelSeen(agencyId));
  }, [agencyId]);

  useEffect(() => {
    if (funnelSeen === undefined || !data?.metrics) return;
    syncFunnelSeen(data.metrics);
  }, [funnelSeen, data, syncFunnelSeen]);

  useEffect(() => { load(); loadNotes(); }, [load, loadNotes]);

  useEffect(() => {
    const tmr = setInterval(() => load({ silent: true }), 20000);
    return () => clearInterval(tmr);
  }, [load]);

  const addNote = async (e) => {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text || noteBusy) return;
    setNoteBusy(true);
    try {
      const row = await addDeskNote(agencyId, text);
      if (row) {
        setNotes((prev) => [row, ...prev.filter((n) => n.id !== row.id)]);
        setDraft('');
      }
    } catch (err) {
      console.warn('add note:', err?.message);
      window.alert(err?.message || t('ops_notes_err') || 'Not kaydedilemedi.');
    } finally {
      setNoteBusy(false);
    }
  };

  const dropNote = async (id) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await removeDeskNote(agencyId, id);
    } catch (err) {
      console.warn('remove note:', err?.message);
      loadNotes();
    }
  };

  const metrics = data?.metrics || {};
  const countsByKind = data?.countsByKind || {};
  const groups = activeFocusGroups(metrics, countsByKind);
  const focusDef = filter ? FOCUS_DEFS[filter] : null;
  const focusCount = filter ? countForFocus(filter, metrics, countsByKind) : 0;
  const allRows = (data?.queue || []).filter((q) => filter && q.kind === filter);
  const shownRows = allRows.slice(0, QUEUE_SHOW);
  const noticeIds = [...new Set(allRows.map((q) => q.candidateId).filter(Boolean))];
  const listMore = Math.max(0, focusCount - shownRows.length);
  const pendingN = pendingTotal(metrics);
  const urgentN = urgentTotal(metrics);
  const topFocus = pickFocusFilter(metrics, countsByKind);
  const activePending = PENDING_ACTIONS.filter((a) => (metrics[a.key] || 0) > 0);
  const clearPending = PENDING_ACTIONS.filter((a) => !(metrics[a.key] > 0));

  const selectFocus = (id) => {
    userPicked.current = true;
    setFilter(id);
  };

  const openRow = (q) => {
    if (!q?.profile) return;
    onOpen({
      c: q.profile,
      st: {
        ...(q.profile.st || {}),
        ...(q.openChat ? { _openChat: true } : {}),
        ...(q.openHireConfirm ? { _openHireConfirm: true } : {}),
      },
    });
  };

  const pickAction = (a) => {
    setSheetOpen(false);
    if (a.cat === 'messages' || a.filter === 'chat') {
      onNavigateCat?.('messages');
      return;
    }
    if (a.filter === 'arrival' || a.sub === 'arrivals') {
      onNavigateCat?.(a.webCat || 'hired', a.webSub || 'arrivals');
      return;
    }
    if (a.filter) selectFocus(a.filter);
  };

  const funnelDeltas = funnelNewDeltas(metrics, funnelSeen);

  const openFunnelTile = (tile) => {
    const nav = tile.nav || {};
    const next = markFunnelTileSeen(funnelSeen, metrics, tile.metricKey);
    setFunnelSeen(next);
    saveFunnelSeen(agencyId, next);
    onNavigateCat?.(nav.webCat || nav.cat, nav.webSub || nav.sub);
  };

  return (
    <div className="ops">
      <div className="opsHero">
        <div className="opsHeroText" />
        <button type="button" className="opsRefresh" onClick={load} disabled={busy}>
          {busy ? '…' : t('ops_refresh')}
        </button>
      </div>

      <div className={`opsFocusCard ${focusDef?.urgent && focusCount > 0 ? 'urgent' : ''} ${!(focusDef && focusCount > 0) ? 'clean' : ''}`}>
        {focusDef && focusCount > 0 ? (
          <>
            <div className="opsFocusTop">
              {flashKeys[focusDef?.key] ? <span className="opsLiveDot" /> : null}
              <span className="opsFocusKicker">{t('ops_focus_now')}</span>
            </div>
            <h2 className="opsFocusTitle">{t(focusDef.titleKey)}</h2>
            <p className="opsFocusHint">{t(focusDef.hintKey)}</p>
            <p className="opsFocusCount">{t('ops_people', { n: String(focusCount) })}</p>
            {filter === 'arrival' ? (
              <button type="button" className="opsFocusSend" onClick={() => onNavigateCat?.('hired', 'arrivals')}>
                {t('ops_go_arrivals')}
              </button>
            ) : null}
            {noticeIds.length ? (
              <button type="button" className="opsFocusSend" onClick={() => setNoticeOpen(true)}>
                {t('agency_notice_to_group', { n: String(noticeIds.length) })}
              </button>
            ) : null}
          </>
        ) : (
          <>
            <div className="opsFocusCleanRow">
              <span className="opsCalmCheck" aria-hidden="true">✓</span>
              <h2 className="opsFocusTitle">{t('ops_today_clean')}</h2>
            </div>
            <p className="opsFocusHint">{t('ops_today_clean_hint')}</p>
          </>
        )}
        <button type="button" className="opsFocusLink" onClick={() => setSheetOpen(true)}>
          {t('ops_all_groups')}{pendingN > 0 ? ` · ${pendingN}` : ''} ›
        </button>
      </div>

      {groups.length > 1 ? (
        <>
          <p className="opsSection">{t('ops_other_pending')}</p>
          <div className="opsFocusChips">
            {groups.map((g) => {
              const flash = !!flashKeys[g.key];
              return (
                <button
                  key={g.id}
                  type="button"
                  className={`opsFocusChip ${filter === g.id ? 'on' : ''} ${flash ? 'flash' : ''}`}
                  onClick={() => selectFocus(g.id)}
                >
                  {flash ? <span className="opsLiveDot" /> : null}
                  {t(g.titleKey)} · {g.count}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {groups.length === 1 && topFocus ? (
        <p className="opsOneNote">{t('ops_one_group')}</p>
      ) : null}

      <p className="opsSection">{t('ops_funnel_section')}</p>
      <p className="opsFunnelHint">{t('ops_funnel_hint')}</p>
      <div className="opsFunnel">
        {FUNNEL_TILES.map((tile) => {
          const n = metrics[tile.metricKey] ?? 0;
          const delta = funnelDeltas[tile.metricKey] || 0;
          const hasNew = delta > 0;
          return (
            <button
              key={tile.id}
              type="button"
              className={`opsFunnelTile ${n > 0 ? 'on' : ''} ${hasNew ? 'new' : ''}`}
              onClick={() => openFunnelTile(tile)}
            >
              {hasNew ? (
                <span className="opsFunnelBadge">{delta > 9 ? '9+' : delta}</span>
              ) : null}
              <span className="opsFunnelN">{n}</span>
              <span className="opsFunnelL">{t(tile.titleKey)}</span>
            </button>
          );
        })}
      </div>

      {focusDef && focusCount > 0 ? (
        <div className="opsQueueHead">
          <div>
            <h2>{t(focusDef.titleKey)}</h2>
            <p className="opsQueueHint">
              {t('ops_showing', {
                a: String(Math.min(shownRows.length, QUEUE_SHOW)),
                b: String(focusCount),
              })}
            </p>
          </div>
        </div>
      ) : null}

      {busy && !data ? (
        <div className="opsEmpty"><div className="spinner" /></div>
      ) : shownRows.length === 0 ? null : (
        <>
          <ul className="opsQueue">
            {shownRows.map((q) => {
              const p = q.profile;
              const code = candidateCode(p.nationality, p.reg_no);
              const photo = p.data?.photoClose || p.data?.photo || p.data?.photoFull;
              const flag = flagUrl(p.nationality);
              const stepTitle = q.detail && String(q.detail).startsWith('pipe_')
                ? (t(q.detail) || q.detail)
                : (q.titleKey ? (t(q.titleKey) || q.detail) : q.detail);
              return (
                <li key={`${q.kind}-${q.candidateId}-${q.label}`}>
                  <button type="button" className={`opsRow tone-${KIND_TONE[q.kind] || 'muted'}`} onClick={() => openRow(q)}>
                    <div className="opsAvatar">
                      {photo ? <img src={photo} alt="" /> : <Icon name="users" size={22} />}
                    </div>
                    <div className="opsRowMain">
                      <div className="opsRowTop">
                        <span className="opsCode">{code}</span>
                      </div>
                      <div className="opsRowSub">
                        {flag ? <img className="flag" src={flag} alt="" /> : null}
                        <span>{p.nationality || '—'}</span>
                        {stepTitle ? <span className="opsDot">·</span> : null}
                        {stepTitle ? <span>{stepTitle}</span> : null}
                      </div>
                    </div>
                    <span className="opsGo">→</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {listMore > 0 ? (
            <div className="opsMore">
              <p>{t('ops_more', { n: String(listMore) })}</p>
              {(filter === 'agency_turn' || filter === 'docs_overdue') ? (
                <button type="button" onClick={() => onNavigateCat?.('process', 'inprocess')}>{t('ops_go_process')}</button>
              ) : null}
              {(filter === 'transit' || filter === 'start_confirm') ? (
                <button type="button" onClick={() => onNavigateCat?.('hired', 'transit')}>{t('ops_go_transit')}</button>
              ) : null}
              {filter === 'arrival' ? (
                <button type="button" onClick={() => onNavigateCat?.('hired', 'arrivals')}>{t('ops_go_arrivals')}</button>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <section className="opsNotes">
        <p className="opsSection">{t('ops_notes_title') || 'Not defteri'}</p>
        <form className="opsNoteComposer" onSubmit={addNote}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('ops_notes_ph') || 'Unutmamanız gerekeni yazın…'}
            maxLength={400}
            rows={2}
          />
          <button type="submit" disabled={!draft.trim() || noteBusy}>
            {t('ops_notes_add') || 'Ekle'}
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="opsNotesHint">{t('ops_notes_empty') || 'Yapışkan not yok — buraya yazın, önünüzde kalsın.'}</p>
        ) : (
          <ul className="opsNoteList">
            {notes.map((n, i) => (
              <li key={n.id} className={`opsPaper tone-${i % 4}`}>
                <div className="opsPaperTop">
                  <span>{formatNoteDate(n.created_at)}</span>
                  <button type="button" className="opsPaperX" onClick={() => dropNote(n.id)} aria-label="×">✕</button>
                </div>
                <p>{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {sheetOpen ? (
        <div className="opsSheetScrim" onClick={() => setSheetOpen(false)} role="presentation">
          <div className="opsSheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('ops_pending_title')}>
            <div className="opsSheetHead">
              <button type="button" className="opsSheetClose" onClick={() => setSheetOpen(false)}>‹</button>
              <div>
                <h2>{t('ops_pending_title')}</h2>
                <p>
                  {urgentN > 0
                    ? t('ops_pending_urgent', { n: String(urgentN) })
                    : activePending.length
                      ? t('ops_pending_some', { n: String(activePending.length) })
                      : t('ops_pending_none')}
                </p>
              </div>
            </div>
            <div className="opsSheetBody">
              {activePending.length === 0 ? (
                <div className="opsSheetEmpty">
                  <strong>{t('ops_all_good')}</strong>
                  <span>{t('ops_all_good_hint')}</span>
                </div>
              ) : null}
              {activePending.map((a) => {
                const n = metrics[a.key] || 0;
                const isTop = topFocus === a.filter;
                return (
                  <button
                    key={a.key}
                    type="button"
                    className={`opsSheetCard ${a.urgent ? 'urgent' : ''} ${isTop ? 'focus' : ''}`}
                    onClick={() => pickAction(a)}
                  >
                    <span className="opsSheetCardTop">
                      {isTop ? <span className="opsLiveDot" /> : null}
                      <em>{n}</em>
                      {isTop ? <b className="opsSheetBadge">{t('ops_first_this')}</b> : null}
                    </span>
                    <strong>{t(a.titleKey)}</strong>
                    <span>{t(a.hintKey)}</span>
                    <i>{t('ops_focus_cta')}</i>
                  </button>
                );
              })}
              {activePending.length > 0 && clearPending.length > 0 ? (
                <p className="opsSheetSection">{t('ops_section_clear')}</p>
              ) : null}
              {clearPending.map((a) => (
                <div key={a.key} className="opsSheetCard idle">
                  <em>0</em>
                  <strong>{t(a.titleKey)}</strong>
                  <span>{t(a.hintKey)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <AgencyNoticeModal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        userIds={noticeIds}
        targetKind="focus"
      />
    </div>
  );
}
