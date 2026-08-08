import { useEffect, useRef, useState } from 'react';
import { listNotifications, unreadCount, markAllRead } from '../lib/api';

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
  chat_message: 'Süreç mesajı',
  default: 'Bildirim',
};
const ICON = {
  document: '📄', accepted: '✅', interview_proposed: '🎥', interview_scheduled: '🎥',
  interview_declined: '✕', interview_no_response: '⏳', interview_respond_remind: '⏰', pool_passive: '⏸',
  new_candidate: '🆕', reupload: '🔁', docs_deadline: '⏰', chat_message: '💬', default: '🔔',
};

function ago(iso) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'az önce';
  const m = Math.floor(s / 60); if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR');
}

export default function NotifBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
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

  return (
    <div className="bellWrap" ref={ref}>
      <button className="bellBtn" onClick={toggle} title="Bildirimler">
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
                <div key={it.id} className={`bellItem ${it.read_at ? '' : 'unread'}`}>
                  <span className="bellIcon">{ICON[it.type] || ICON.default}</span>
                  <div className="bellText">
                    <div className="bellTitle">{LABEL[it.type] || LABEL.default}</div>
                    <div className="bellTime">{ago(it.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
