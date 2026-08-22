import { useCallback, useEffect, useState } from 'react';
import { useLang } from '../i18n.jsx';
import { supabase } from '../lib/supabase';
import { listAgencyNotices, listNoticeAudienceBuckets } from '../lib/agencyNotices';
import { announcementText } from '../lib/announcementI18n';
import NoticeAudienceBuckets from './NoticeAudienceBuckets.jsx';

const fmt = (iso) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

export default function AgencyAnnouncementsHub({
  open,
  onClose,
  userId,
  reloadAt,
  onCompose,
  onComposeGroup,
  onOpenSent,
}) {
  const { t, lang } = useLang();
  const [tab, setTab] = useState('brief');
  const [sent, setSent] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [buckets, setBuckets] = useState([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [{ data }, hist, b] = await Promise.all([
        supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'announcement')
          .order('created_at', { ascending: false })
          .limit(50),
        listAgencyNotices(40),
        listNoticeAudienceBuckets(userId),
      ]);
      setItems(data || []);
      setSent(hist || []);
      setBuckets(b || []);
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('type', 'announcement')
        .is('read_at', null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) {
      setDetail(null);
      setTab('brief');
    }
  }, [open]);

  useEffect(() => {
    if (open) refresh();
  }, [open, reloadAt, refresh]);

  if (!open) return null;

  const pack = detail ? announcementText(detail.payload || {}, lang) : null;
  const unreadTurquz = items.some((n) => !n.read_at);

  return (
    <div className="noticeScrim" onClick={onClose} role="presentation">
      <div className="noticeCard hubCard" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="noticeHead">
          <button type="button" className="noticeBack" onClick={detail ? () => setDetail(null) : onClose}>‹</button>
          <h2>{detail ? t('notif_announcement_read') || t('home_announcements') : t('home_announcements')}</h2>
          <button type="button" className="noticeX" onClick={onClose}>✕</button>
        </div>

        {!detail ? (
          <div className="hubTabs">
            <button
              type="button"
              className={`hubTab ${tab === 'brief' ? 'on' : ''}`}
              onClick={() => setTab('brief')}
            >
              {t('agency_notice_hub')}
            </button>
            <button
              type="button"
              className={`hubTab ${tab === 'turquz' ? 'on' : ''}`}
              onClick={() => setTab('turquz')}
            >
              {t('agency_notice_turquz')}
              {unreadTurquz ? <span className="hubTabDot" /> : null}
            </button>
          </div>
        ) : null}

        {detail ? (
          <div className="noticeBody">
            <div className="noticeKicker">{fmt(detail.created_at)}</div>
            <h3>{pack?.title || t('notif_announcement')}</h3>
            {pack?.body ? <p className="noticeText">{pack.body}</p> : null}
          </div>
        ) : tab === 'brief' ? (
          <div className="noticeBody">
            <button type="button" className="noticeSend" onClick={() => onCompose?.()}>
              {t('agency_notice_new')}
            </button>
            <p className="noticeHubHint">{t('agency_notice_hub_hint')}</p>
            <NoticeAudienceBuckets
              buckets={buckets}
              mode="send"
              t={t}
              onSendGroup={(b) => onComposeGroup?.(b)}
            />
            {loading && !sent.length ? <p className="noticeHint">…</p> : null}
            {sent.length ? sent.map((h) => (
              <button key={h.id} type="button" className="noticeHist" onClick={() => onOpenSent?.(h)}>
                <span>
                  <em className="hubTone">{t(`agency_notice_tone_${h.tone || 'info'}`)}</em>
                  <strong>{h.title}</strong>
                  <em>{fmt(h.created_at)} · {t('agency_notice_read_n', { a: String(h.readN), b: String(h.sentN) })}</em>
                </span>
                <span>›</span>
              </button>
            )) : (!loading ? (
              <p className="noticeHint">{t('agency_notice_empty_hist')}</p>
            ) : null)}
          </div>
        ) : (
          <div className="noticeBody">
            {loading && !items.length ? <p className="noticeHint">…</p> : null}
            {items.length ? items.map((n) => {
              const { title, body } = announcementText(n.payload || {}, lang);
              return (
                <button
                  key={n.id}
                  type="button"
                  className={`noticeHist ${n.read_at ? '' : 'unread'}`}
                  onClick={() => setDetail(n)}
                >
                  <span>
                    <strong>{title || t('notif_announcement')}</strong>
                    {body ? <em>{body}</em> : null}
                    <em>{fmt(n.created_at)}</em>
                  </span>
                  <span>›</span>
                </button>
              );
            }) : (!loading ? (
              <p className="noticeHint">{t('notif_empty')}</p>
            ) : null)}
          </div>
        )}
      </div>
    </div>
  );
}
