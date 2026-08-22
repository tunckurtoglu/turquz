import { useEffect, useRef, useState } from 'react';
import { listNotifications, unreadCount, markAllRead } from '../lib/api';
import { announcementText } from '../lib/announcementI18n';
import { useLang } from '../i18n.jsx';
import { candidateCode } from '../../../lib/candidateCode';

const ICON = {
  document: '📄', accepted: '✅', interview_proposed: '🎥', interview_scheduled: '🎥',
  interview_declined: '✕', interview_no_response: '⏳', interview_respond_remind: '⏰', pool_passive: '⏸',
  new_candidate: '🆕', reupload: '🔁', agency_doc_retracted: '↩', agency_doc_updated: '📄', flight_ticket_updated: '✈️',
  docs_deadline: '⏰', docs_extra: '⏳', chat_message: '💬', announcement: '📢', agency_notice: '📌',
  arrival_today: '🛬', arrival_tomorrow: '🛬', pickup: '🤝', flight_ticket_ready: '✈️', flight_ticket_sent: '✈️',
  default: '🔔',
};

function notifText(n, t, lang) {
  const p = n.payload || {};
  if (n.type === 'announcement' || n.type === 'agency_notice') {
    const { title: rawTitle, body } = announcementText(p, lang);
    const from = n.type === 'agency_notice'
      ? (String(p.agencyName || '').trim() ? t('agency_notice_from_named', { name: String(p.agencyName).trim() }) : t('agency_notice_from'))
      : t('notif_announcement');
    const title = rawTitle || from || t('notif_announcement');
    if (!body) return title;
    const short = body.length > 90 ? `${body.slice(0, 87)}…` : body;
    return `${title} — ${short}`;
  }
  if (n.type === 'document') {
    if (n.ref_user && n.user_id && n.ref_user === n.user_id) return t('notif_document_for_you') || t('notif_document');
    return t('notif_document');
  }
  if (n.type === 'interview_scheduled') {
    const code = candidateCode(p.nationality, p.reg_no);
    const slot = p.slot || '';
    if (slot && code) return (t('notif_interview_scheduled_detail') || '').replace('{code}', code).replace('{slot}', slot);
  }
  if (n.type === 'interview_declined') {
    const code = candidateCode(p.nationality, p.reg_no);
    if (code && !String(code).endsWith('----')) {
      return (t('notif_interview_declined_detail') || '').replace('{code}', code);
    }
  }
  if (n.type === 'interview_no_response') {
    const code = candidateCode(p.nationality, p.reg_no);
    const hours = p.hours != null ? String(p.hours) : '48';
    if (code && !String(code).endsWith('----')) {
      return (t('notif_interview_no_response_detail') || '').replace('{code}', code).replace('{hours}', hours);
    }
    return `${t('notif_interview_no_response') || ''}${hours ? ` (${hours}s)` : ''}`;
  }
  if (n.type === 'flight_ticket_ready') {
    const when = p.arriveAt || p.when;
    if (when) return t('notif_flight_ticket_ready', { when }) || t('notif_flight_ticket_ready_plain');
    return t('notif_flight_ticket_ready_plain') || t('notif_flight_ticket_ready');
  }
  if (n.type === 'arrival_today' || n.type === 'arrival_tomorrow') {
    const vars = { code: p.code || '', when: p.when || '—' };
    return t(p.missingDriver ? `notif_${n.type}_nodriver` : `notif_${n.type}`, vars) || t(`notif_${n.type}`);
  }
  return t(`notif_${n.type}`) || t('notif_title');
}

function ago(iso, t) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return t('chat_just_now') || '—';
  const m = Math.floor(s / 60);
  if (m < 60) return t('chat_min_ago', { n: String(m) }) || `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return t('chat_hour_ago', { n: String(h) }) || `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return t('chat_day_ago', { n: String(d) }) || `${d}d`;
  return new Date(iso).toLocaleDateString();
}

function fmtFull(iso, lang) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(lang === 'tr' ? 'tr-TR' : undefined, {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export default function NotifBell({ userId, onNavigate }) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [announcement, setAnnouncement] = useState(null);
  const ref = useRef(null);

  const refresh = async () => {
    const [list, n] = await Promise.all([listNotifications(userId), unreadCount(userId)]);
    setItems(list); setUnread(n);
  };

  useEffect(() => { refresh(); const id = setInterval(refresh, 30000); return () => clearInterval(id); }, [userId]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && unread > 0) {
      await markAllRead(userId);
      setUnread(0);
      setItems((p) => p.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    }
  };

  const openItem = (it) => {
    setOpen(false);
    if (it.type === 'announcement' || it.type === 'agency_notice') {
      setAnnouncement({ payload: it.payload || {}, createdAt: it.created_at, type: it.type });
      return;
    }
    onNavigate?.(it);
  };

  const annPack = announcement
    ? announcementText(announcement.payload, lang)
    : { title: '', body: '' };

  return (
    <div className="bellWrap" ref={ref}>
      <button className="bellBtn" onClick={toggle} title={t('notif_title') || ''} type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? <span className="bellDot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="bellMenu">
          <div className="bellHead">{t('notif_title')}</div>
          {items.length === 0 ? <div className="bellEmpty">{t('notif_empty')}</div> : (
            <div className="bellList">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`bellItem clickable ${it.read_at ? '' : 'unread'}`}
                  onClick={() => openItem(it)}
                >
                  <span className="bellIcon">{ICON[it.type] || ICON.default}</span>
                  <div className="bellText">
                    <div className="bellTitle">{notifText(it, t, lang)}</div>
                    <div className="bellTime">{ago(it.created_at, t)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {announcement ? (
        <div className="annReaderBackdrop" role="presentation" onClick={() => setAnnouncement(null)}>
          <div className="annReaderCard" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="annReaderTop">
              <div>
                <div className="annReaderKicker">{t('notif_announcement')}</div>
                <div className="annReaderWhen">{fmtFull(announcement.createdAt, lang)}</div>
              </div>
              <button type="button" className="ghostBtn" onClick={() => setAnnouncement(null)}>{t('close')}</button>
            </div>
            <h2 className="annReaderTitle">{annPack.title || t('notif_announcement')}</h2>
            <p className="annReaderBody">{annPack.body}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
