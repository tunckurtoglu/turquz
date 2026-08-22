import { useEffect, useState } from 'react';
import {
  adminDeleteProcessChat,
  adminListProcessChatMessages,
  adminListProcessChats,
} from '../lib/api';

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

export default function ProcessChats() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setErr('');
    try {
      const list = await adminListProcessChats(300);
      setRows(list || []);
    } catch (e) {
      setErr(e?.message || 'Yüklenemedi');
    }
  };

  useEffect(() => { load(); }, []);

  const openChat = async (row) => {
    setSelected(row);
    setBusy(true);
    setErr('');
    try {
      const msgs = await adminListProcessChatMessages(row.chat_id);
      setMessages(msgs || []);
    } catch (e) {
      setErr(e?.message || 'Mesajlar okunamadı');
      setMessages([]);
    } finally {
      setBusy(false);
    }
  };

  const removeChat = async () => {
    if (!selected?.chat_id) return;
    if (!confirm('Bu sohbet ve tüm mesajları kalıcı silinsin mi? Bu işlem geri alınamaz.')) return;
    setBusy(true);
    try {
      await adminDeleteProcessChat(selected.chat_id);
      setSelected(null);
      setMessages([]);
      await load();
    } catch (e) {
      setErr(e?.message || 'Silinemedi');
    } finally {
      setBusy(false);
    }
  };

  const needle = q.trim().toLowerCase();
  const filtered = !needle ? rows : rows.filter((r) => {
    const hay = [
      r.candidate_title, r.agency_company, r.candidate_reg_no, r.candidate_id, r.agency_id,
    ].map((x) => String(x || '').toLowerCase()).join(' ');
    return hay.includes(needle);
  });

  return (
    <div className="card">
      <h2>Süreç sohbetleri</h2>
      <p className="muted">
        Acente ↔ aday mesajlarının arşivi. Süreç bitsa veya hesap silinse bile kayıt kalır.
        Yalnız burada “Sil” ile kalıcı silinebilir.
      </p>
      {err ? <p style={{ color: '#a32d2d', marginTop: 8 }}>{err}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1.2fr' : '1fr', gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              className="input"
              placeholder="Aday / acente ara…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="button" className="ghostBtn" onClick={load}>Yenile</button>
          </div>
          {!filtered.length ? (
            <p className="muted">Sohbet yok.</p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Aday</th>
                    <th>Acente</th>
                    <th>Mesaj</th>
                    <th>Son</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.chat_id}
                      style={{ cursor: 'pointer', background: selected?.chat_id === r.chat_id ? 'rgba(194,162,90,0.12)' : undefined }}
                      onClick={() => openChat(r)}
                    >
                      <td>
                        <div>{r.candidate_title || (r.candidate_id ? r.candidate_id.slice(0, 8) : '— silindi')}</div>
                        {r.candidate_reg_no != null ? <code style={{ fontSize: 11 }}>#{r.candidate_reg_no}</code> : null}
                      </td>
                      <td>{r.agency_company || (r.agency_id ? r.agency_id.slice(0, 8) : '— silindi')}</td>
                      <td>{r.message_count ?? 0}</td>
                      <td style={{ fontSize: 12 }}>{fmt(r.last_message_at || r.created_at)}</td>
                      <td>{r.closed_at ? 'Kapalı' : 'Açık'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div>
                <strong>{selected.candidate_title || 'Aday'}</strong>
                <span className="muted"> ↔ </span>
                <strong>{selected.agency_company || 'Acente'}</strong>
                <div className="muted" style={{ fontSize: 12 }}>{selected.message_count || 0} mesaj · {selected.closed_at ? 'kapalı' : 'açık'}</div>
              </div>
              <button type="button" className="dangerBtn" disabled={busy} onClick={removeChat}>
                {busy ? '…' : 'Sohbeti sil'}
              </button>
            </div>
            <div style={{
              maxHeight: 520, overflow: 'auto', border: '1px solid #e6e8ec', borderRadius: 12,
              padding: 12, background: '#f8f9fb',
            }}>
              {busy && !messages.length ? <p className="muted">Yükleniyor…</p> : null}
              {!busy && !messages.length ? <p className="muted">Mesaj yok.</p> : null}
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    marginBottom: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: m.sender_role === 'agency' ? '#eef3f8' : '#fff',
                    border: '1px solid #e6e8ec',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>
                      {m.sender_role === 'agency' ? 'Acente' : m.sender_role === 'candidate' ? 'Aday' : '—'}
                    </strong>
                    <span className="muted" style={{ fontSize: 11 }}>{fmt(m.created_at)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.45 }}>{m.body}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
