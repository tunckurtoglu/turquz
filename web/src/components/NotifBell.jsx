import { useEffect, useRef, useState } from 'react';
import { listNotifications, unreadCount, markAllRead } from '../lib/api';
import { announcementText } from '../lib/announcementI18n';
import { useLang } from '../i18n.jsx';

const LABEL = {
  document: 'Yeni belge',
  accepted: 'Teklif kabul edildi',
  offered: 'Teklif',
  interview_proposed: 'Mülakat zamanı önerildi',
  interview_scheduled: 'Mülakat planlandı',
  interview_declined: 'Mülakat reddedildi',
  interview_no_response: 'Mülakat yanıtı yok',
  interview_respond_remind: 'Mülakat yanıtı bekleniyor',
  pool_passive: 'Havuzda geçici pasif',
  reupload: 'Belge yeniden istendi',
  new_candidate: 'Yeni aday',
  docs_deadline: 'Belge süresi doldu',
  docs_extra: 'Ek süre talebi',
  chat_message: 'Süreç mesajı',
  employment_end_requested: 'Personel ayrılış talebi',
  employment_end_requested_ack: 'Ayrılış talebi alındı',
  employment_end_undone: 'Ayrılış iptal',
  employment_disputed: 'Ayrılış itirazı',
  employment_completed: 'Çalışma tamamlandı',
  employment_early_exit: 'İstihdam sona erdi',
  employment_continued: 'İstihdam devam',
  employment_end_remind: 'Ayrılış hatırlatması',
  employment_started: 'İşe başlama onaylandı',
  work_start_confirm: 'İşe başladı mı?',
  work_start_remind: 'İşe başlama hatırlatması',
  flight_ticket_ready: 'Uçak bileti hazır',
  flight_ticket_sent: 'Uçak bileti gönderildi',
  boarding_check: 'Uçuş teyidi',
  boarding_confirmed: 'Uçuş teyit edildi',
  boarding_missed: 'Uçak kaçırıldı',
  boarding_no_response: 'Uçuş cevabı yok',
  announcement: 'Duyuru',
  default: 'Bildirim',
};
const ICON = {
  document: '📄', accepted: '✅', interview_proposed: '🎥', interview_scheduled: '🎥',
  interview_declined: '✕', interview_no_response: '⏳', interview_respond_remind: '⏰', pool_passive: '⏸',
  new_candidate: '🆕', reupload: '🔁', docs_deadline: '⏰', docs_extra: '⏳', chat_message: '💬', announcement: '📢', default: '🔔',
};

function notifLabel(it, lang) {
  if (it.type === 'announcement') {
    const { title: rawTitle, body } = announcementText(it.payload, lang);
    const title = rawTitle || LABEL.announcement;
    if (!body) return title;
    const short = body.length > 90 ? `${body.slice(0, 87)}…` : body;
    return `${title} — ${short}`;
  }
  if (it.type === 'document') {
    if (it.ref_user && it.user_id && it.ref_user === it.user_id) return 'Acenteden belge';
    return 'Aday belge yükledi';
  }
  return LABEL[it.type] || LABEL.default;
}

function ago(iso) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'az önce';
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

function fmtFull(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function NotifBell({ userId, onNavigate }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [announcement, setAnnouncement] = useState(null);
  const ref = useRef(null);

  const refresh = async () => {
    const [list, n] = await Promise.all([listNotifications(userId), unreadCount(userId)]);
    setItems(list); setUnread(n);
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [userId]);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && unread > 0) { await markAllRead(userId); setUnread(0); setItems((p) => p.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() }))); }
  };

  const openItem = (it) => {
    setOpen(false);
    if (it.type === 'announcement') {
      setAnnouncement({ payload: it.payload || {}, createdAt: it.created_at });
      return;
    }
    onNavigate?.(it);
  };

  const annPack = announcement
    ? announcementText(announcement.payload, lang)
    : { title: '', body: '' };

  return (
    <div className="bellWrap" ref={ref}>
      <button className="bellBtn" onClick={toggle} title="Bildirimler" type="button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? <span className="bellDot">{unread > 9 ? '9+' : unread}</span> : null}
      </button>
      {open ? (
        <div className="bellMenu">
          <div className="bellHead">Bildirimler</div>
          {items.length === 0 ? <div className="bellEmpty">Bildirim yok</div> : (
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
                    <div className="bellTitle">{notifLabel(it, lang)}</div>
                    <div className="bellTime">{ago(it.created_at)}</div>
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
                <div className="annReaderKicker">Duyuru</div>
                <div className="annReaderWhen">{fmtFull(announcement.createdAt)}</div>
              </div>
              <button type="button" className="ghostBtn" onClick={() => setAnnouncement(null)}>Kapat</button>
            </div>
            <h2 className="annReaderTitle">{annPack.title || LABEL.announcement}</h2>
            <p className="annReaderBody">{annPack.body}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
