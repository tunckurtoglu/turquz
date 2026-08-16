import { useEffect, useMemo, useState } from 'react';
import { categoryOf, listAnnouncements, listCandidates, sendAnnouncement } from '../lib/api';
import { candidateCode } from '../../../lib/candidateCode';

const AUDIENCE = [
  { id: 'all', label: 'Herkes (aday + acente)' },
  { id: 'candidates', label: 'Tüm adaylar' },
  { id: 'agencies', label: 'Tüm acenteler' },
  { id: 'pool', label: 'Havuzdaki adaylar' },
  { id: 'offered', label: 'Teklif bekleyen adaylar' },
  { id: 'process', label: 'Süreçteki adaylar' },
  { id: 'hired', label: 'Personel' },
  { id: 'selected', label: 'Seçili adaylar' },
];

const CAT_LBL = { pool: 'Havuz', offered: 'Teklifli', process: 'Süreçte', hired: 'Personel' };

function fmt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function audienceLabel(a, n) {
  const base = AUDIENCE.find((x) => x.id === a)?.label || a;
  if (a === 'selected' && n) return `${base} (${n})`;
  return base;
}

export default function Announcements() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [list, setList] = useState([]);
  const [cands, setCands] = useState([]);
  const [candsBusy, setCandsBusy] = useState(false);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(() => new Set());

  const reload = async () => {
    try {
      setList(await listAnnouncements());
    } catch (e) {
      console.warn(e);
    }
  };

  useEffect(() => { reload(); }, []);
  useEffect(() => {
    if (audience !== 'selected') return undefined;
    let alive = true;
    setCandsBusy(true);
    listCandidates()
      .then((rows) => { if (alive) setCands(rows || []); })
      .catch(() => { if (alive) setCands([]); })
      .finally(() => { if (alive) setCandsBusy(false); });
    return () => { alive = false; };
  }, [audience]);

  const filtered = useMemo(() => {
    const term = q.trim().toLocaleLowerCase('tr');
    return (cands || []).filter((r) => {
      if (!term) return true;
      const code = candidateCode(r.nationality, r.reg_no) || '';
      const blob = `${code} ${r.full_name || ''} ${r.email || ''} ${r.title || ''} ${r.reg_no || ''}`;
      return blob.toLocaleLowerCase('tr').includes(term);
    });
  }, [cands, q]);

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickFiltered = () => {
    setPicked((prev) => {
      const next = new Set(prev);
      filtered.slice(0, 500).forEach((r) => next.add(r.user_id));
      return next;
    });
  };

  const send = async () => {
    setErr('');
    setOk('');
    if (!title.trim() || !body.trim()) {
      setErr('Başlık ve metin gerekli.');
      return;
    }
    if (audience === 'selected' && picked.size === 0) {
      setErr('En az bir aday seçin.');
      return;
    }
    const who = AUDIENCE.find((a) => a.id === audience)?.label || audience;
    const extra = audience === 'selected' ? ` (${picked.size} aday)` : '';
    if (!window.confirm(`${who}${extra} için duyuru 10 dile çevrilip uygulama içi + push olarak gönderilsin mi?`)) return;
    setBusy(true);
    try {
      const r = await sendAnnouncement({
        title: title.trim(),
        body: body.trim(),
        audience,
        userIds: audience === 'selected' ? [...picked] : [],
      });
      setOk(`Gönderildi · ${r.notified || 0} bildirim · ${r.pushed || 0} push · ${r.translated || 10} dil`);
      setTitle('');
      setBody('');
      if (audience === 'selected') setPicked(new Set());
      await reload();
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg === 'selected_required') setErr('En az bir aday seçin.');
      else if (msg === 'bad_audience') setErr('Hedef kitle geçersiz. SQL güncellemesi (0081) gerekir.');
      else setErr(msg || 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <h2>Duyuru gönder</h2>
      <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.45, marginTop: 0 }}>
        Kanal: <strong>uygulama içi bildirim + push</strong>. SMS ve e-posta henüz yok.
        Metin gönderilirken <strong>10 dile otomatik çevrilir</strong>; her kullanıcı kendi dilinde görür.
      </p>

      <label className="fieldLbl">Hedef kitle</label>
      <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={busy}>
        {AUDIENCE.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>

      {audience === 'selected' ? (
        <div className="annPick">
          <div className="annPickBar">
            <input
              className="input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kod, isim veya e-posta ara…"
              disabled={busy}
            />
            <button type="button" className="ghostBtn" onClick={pickFiltered} disabled={busy || !filtered.length}>
              Filtrelenenleri seç
            </button>
            <button type="button" className="ghostBtn" onClick={() => setPicked(new Set())} disabled={busy || !picked.size}>
              Temizle
            </button>
            <span className="annPickCount">{picked.size} seçili</span>
          </div>
          <div className="annPickList">
            {candsBusy && !cands.length ? (
              <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 8 }}>Aday listesi yükleniyor…</p>
            ) : !filtered.length ? (
              <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 8 }}>Eşleşen aday yok.</p>
            ) : filtered.map((r) => {
              const st = categoryOf({ status: r.status, docs_unlocked: r.docs_unlocked, stage: r.stage });
              const code = candidateCode(r.nationality, r.reg_no);
              return (
                <label key={r.user_id} className="annPickRow">
                  <input type="checkbox" checked={picked.has(r.user_id)} onChange={() => toggle(r.user_id)} disabled={busy} />
                  <span className="annPickCode">{code}</span>
                  <span className="annPickName">{r.full_name || r.title || '—'}</span>
                  <span className="annPickCat">{CAT_LBL[st] || st}</span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <label className="fieldLbl">Başlık</label>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={120}
        placeholder="Örn. Sistem bakımı"
        disabled={busy}
      />

      <label className="fieldLbl">Metin</label>
      <textarea
        className="input"
        style={{ minHeight: 120, resize: 'vertical' }}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        placeholder="Kısa ve net duyuru metni…"
        disabled={busy}
      />

      {err ? <div className="loginErr">{err}</div> : null}
      {ok ? <div style={{ color: 'var(--ok)', fontWeight: 700, marginTop: 10, fontSize: 13.5 }}>{ok}</div> : null}

      <button type="button" className="goldBtn" style={{ width: 'auto', marginTop: 16 }} onClick={send} disabled={busy}>
        {busy ? 'Gönderiliyor…' : 'Duyuruyu gönder'}
      </button>

      <h3 style={{ marginTop: 36, marginBottom: 12 }}>Son duyurular</h3>
      {!list.length ? (
        <p style={{ color: 'var(--muted)', fontSize: 13.5 }}>Henüz duyuru yok.</p>
      ) : (
        <div className="annList">
          {list.map((a) => (
            <div key={a.id} className="annItem">
              <div className="annMeta">
                <span className="annAudience">{audienceLabel(a.audience, (a.target_ids || []).length)}</span>
                <span className="annTime">{fmt(a.created_at)}</span>
              </div>
              <div className="annTitle">{a.title}</div>
              <div className="annBody">{a.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
