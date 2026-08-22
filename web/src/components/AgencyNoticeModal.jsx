import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLang } from '../i18n.jsx';
import {
  listAgencyNotices, listNoticeReceipts, noticeErrorText, sendAgencyNotice, listNoticeAudienceBuckets,
} from '../lib/agencyNotices';
import NoticeAudienceBuckets, { NoticePersonRow } from './NoticeAudienceBuckets.jsx';

const TONES = ['info', 'action', 'urgent'];
const TPLS = [
  { id: 'docs', tone: 'action', labelKey: 'agency_notice_tpl_docs', titleKey: 'agency_notice_tpl_docs_title', bodyKey: 'agency_notice_tpl_docs_body' },
  { id: 'info', tone: 'info', labelKey: 'agency_notice_tpl_meet', titleKey: 'agency_notice_tpl_meet_title', bodyKey: 'agency_notice_tpl_meet_body' },
  { id: 'travel', tone: 'action', labelKey: 'agency_notice_tpl_travel', titleKey: 'agency_notice_tpl_travel_title', bodyKey: 'agency_notice_tpl_travel_body' },
  { id: 'start', tone: 'action', labelKey: 'agency_notice_tpl_start', titleKey: 'agency_notice_tpl_start_title', bodyKey: 'agency_notice_tpl_start_body' },
  { id: 'urgent', tone: 'urgent', labelKey: 'agency_notice_tpl_urgent', titleKey: 'agency_notice_tpl_urgent_title', bodyKey: 'agency_notice_tpl_urgent_body' },
];

const fmt = (iso) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

export default function AgencyNoticeModal({
  open,
  onClose,
  userIds = [],
  peerLabel,
  targetKind = 'selected',
  allowAudience = false,
  agencyId,
  startNotice,
  hideHistory = false,
  previewPeople = [],
}) {
  const { t } = useLang();
  const ids = useMemo(() => [...new Set((userIds || []).filter(Boolean))], [userIds]);
  const pickAud = allowAudience && !ids.length;
  const [tone, setTone] = useState('info');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [sentNotice, setSentNotice] = useState(null);
  const [err, setErr] = useState('');
  const [buckets, setBuckets] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [skip, setSkip] = useState(() => new Set());
  const [audBusy, setAudBusy] = useState(false);

  const effectiveIds = (ids.length ? ids : [...picked]).filter((id) => !skip.has(id));
  const n = effectiveIds.length;
  const shownPeople = (previewPeople || []).filter((p) => !skip.has(p.userId));

  const loadHist = useCallback(async () => {
    setHistory(await listAgencyNotices(20));
  }, []);

  useEffect(() => {
    if (!open) return;
    setTone('info');
    setTitle('');
    setBody('');
    setBusy(false);
    setReceipts([]);
    setSentNotice(null);
    setErr('');
    setPicked(new Set());
    setSkip(new Set());
    setBuckets([]);
    if (startNotice) {
      setDetail(startNotice);
      listNoticeReceipts(startNotice.id).then(setReceipts);
    } else {
      setDetail(null);
    }
    if (!hideHistory) loadHist();
  }, [open, loadHist, startNotice, hideHistory]);

  useEffect(() => {
    if (!open || !pickAud || !agencyId) return undefined;
    let alive = true;
    setAudBusy(true);
    listNoticeAudienceBuckets(agencyId)
      .then((next) => { if (alive) setBuckets(next); })
      .finally(() => { if (alive) setAudBusy(false); });
    return () => { alive = false; };
  }, [open, pickAud, agencyId]);

  if (!open) return null;

  const who = ids.length === 1
    ? (peerLabel || t('agency_notice_to_n', { n: '1' }))
    : t('agency_notice_to_n', { n: String(n) });
  const viewing = sentNotice || detail;
  const unreadN = receipts.filter((r) => !r.readAt).length;

  const openDetail = async (row) => {
    setDetail(row);
    setSentNotice(null);
    setReceipts(await listNoticeReceipts(row.id));
  };

  const toggleGroup = (b) => {
    const gids = (b.people || []).map((p) => p.userId);
    setPicked((prev) => {
      const next = new Set(prev);
      const allOn = gids.length && gids.every((id) => next.has(id));
      if (allOn) gids.forEach((id) => next.delete(id));
      else gids.forEach((id) => next.add(id));
      return next;
    });
  };

  const togglePerson = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async (e) => {
    e?.preventDefault?.();
    const ttl = title.trim();
    const txt = body.trim();
    if (!ttl || !txt) { setErr(t('agency_notice_need_text')); return; }
    if (!n) { setErr(t('agency_notice_need_people')); return; }
    if (!window.confirm(t('agency_notice_confirm', { n: String(n) }))) return;
    setBusy(true);
    setErr('');
    try {
      const res = await sendAgencyNotice({
        userIds: effectiveIds,
        title: ttl,
        body: txt,
        tone,
        targetKind: ids.length ? targetKind : 'selected',
      });
      const noticeId = res?.noticeId;
      setSentNotice({
        id: noticeId,
        title: ttl,
        body: txt,
        tone,
        sentN: res?.notified || n,
        readN: 0,
      });
      if (noticeId) setReceipts(await listNoticeReceipts(noticeId));
      loadHist();
    } catch (e2) {
      setErr(noticeErrorText(e2?.code, t, e2?.detail) || e2?.message || t('agency_notice_err'));
    } finally {
      setBusy(false);
    }
  };

  const resendUnread = async () => {
    const unread = receipts.filter((r) => !r.readAt).map((r) => r.candidateId);
    const src = detail || sentNotice;
    if (!unread.length || !src) return;
    setBusy(true);
    setErr('');
    try {
      await sendAgencyNotice({
        userIds: unread,
        title: src.title,
        body: src.body,
        tone: src.tone || 'info',
        targetKind: 'selected',
      });
      setDetail(null);
      setSentNotice(null);
      loadHist();
    } catch (e2) {
      setErr(noticeErrorText(e2?.code, t, e2?.detail) || e2?.message || t('agency_notice_err'));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    if (viewing && startNotice && !sentNotice) { onClose(); return; }
    if (viewing) { setSentNotice(null); setDetail(null); setReceipts([]); return; }
    onClose();
  };

  return (
    <div className="noticeScrim" onClick={onClose} role="presentation">
      <div className="noticeCard" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="noticeHead">
          <button type="button" className="noticeBack" onClick={back}>‹</button>
          <h2>{viewing ? t('agency_notice_sent') : t('agency_notice')}</h2>
          <button type="button" className="noticeX" onClick={onClose}>✕</button>
        </div>

        {viewing ? (
          <div className="noticeBody">
            <div className="noticeKicker">{t(`agency_notice_tone_${viewing.tone || 'info'}`)}</div>
            <h3>{viewing.title}</h3>
            {viewing.body ? <p className="noticeText">{viewing.body}</p> : null}
            <p className="noticeRead">
              {t('agency_notice_read_n', {
                a: String(viewing.readN ?? receipts.filter((r) => r.readAt).length),
                b: String(viewing.sentN || receipts.length || n),
              })}
            </p>
            {receipts.length ? (
              <div className="noticeRecs">
                {receipts.map((r) => (
                  <NoticePersonRow key={r.candidateId} p={r} mode="read" on={!!r.readAt} />
                ))}
              </div>
            ) : null}
            {unreadN > 0 ? (
              <button type="button" className="noticeSend" onClick={resendUnread} disabled={busy}>
                {busy ? '…' : t('agency_notice_resend')}
              </button>
            ) : null}
            {err ? <p className="noticeErr">{err}</p> : null}
          </div>
        ) : (
          <form className="noticeBody" onSubmit={send}>
            {!pickAud || n > 0 ? <div className="noticeWho">{who}</div> : null}

            {!pickAud && shownPeople.length ? (
              <div className="audCodes preview">
                {shownPeople.map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    className="audChip"
                    onClick={() => setSkip((prev) => { const nset = new Set(prev); nset.add(p.userId); return nset; })}
                  >
                    {p.code} ✕
                  </button>
                ))}
              </div>
            ) : null}

            {pickAud ? (
              <>
                <div className="noticeLabel">{t('agency_notice_audience')}</div>
                {audBusy && !buckets.length ? <p className="noticeHint">…</p> : (
                  <NoticeAudienceBuckets
                    buckets={buckets}
                    mode="pick"
                    picked={picked}
                    onToggleGroup={toggleGroup}
                    onTogglePerson={togglePerson}
                    t={t}
                  />
                )}
              </>
            ) : null}

            <div className="noticeLabel">{t('agency_notice_tone')}</div>
            <div className="noticeTones">
              {TONES.map((tn) => (
                <button
                  key={tn}
                  type="button"
                  className={`noticeChip ${tone === tn ? 'on' : ''} ${tn === 'urgent' && tone === tn ? 'hot' : ''}`}
                  onClick={() => setTone(tn)}
                >
                  {t(`agency_notice_tone_${tn}`)}
                </button>
              ))}
            </div>
            <div className="noticeLabel">{t('agency_notice_tpl')}</div>
            <div className="noticeTpls">
              {TPLS.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  className="noticeTpl"
                  onClick={() => { setTone(tpl.tone); setTitle(t(tpl.titleKey)); setBody(t(tpl.bodyKey)); }}
                >
                  {t(tpl.labelKey)}
                </button>
              ))}
            </div>
            <input
              className="noticeTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('agency_notice_title_ph')}
              maxLength={120}
            />
            <textarea
              className="noticeArea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('agency_notice_body_ph')}
              maxLength={2000}
              rows={6}
            />
            <button type="submit" className="noticeSend" disabled={busy || !n}>
              {busy ? '…' : `${t('agency_notice_send')} · ${n}`}
            </button>
            <p className="noticeHint">{t('agency_notice_no_reply')}</p>
            {err ? <p className="noticeErr">{err}</p> : null}

            {hideHistory ? null : (
              <>
                <div className="noticeLabel">{t('agency_notice_history')}</div>
                {history.length ? history.map((h) => (
                  <button key={h.id} type="button" className="noticeHist" onClick={() => openDetail(h)}>
                    <span>
                      <strong>{h.title}</strong>
                      <em>{fmt(h.created_at)} · {t('agency_notice_read_n', { a: String(h.readN), b: String(h.sentN) })}</em>
                    </span>
                    <span>›</span>
                  </button>
                )) : (
                  <p className="noticeHint">{t('agency_notice_empty_hist')}</p>
                )}
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
