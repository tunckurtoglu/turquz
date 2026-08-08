import { useEffect, useMemo, useState } from 'react';
import ConfirmDelete from '../components/ConfirmDelete.jsx';
import {
  categoryOf, deleteUserFully, getAgency, listAgencies, listAgencyCandidates, signedUrl,
} from '../lib/api';
import { candidateCode } from '../../../lib/candidateCode';

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

function statusLabel(r) {
  const c = categoryOf({ status: r.status, docs_unlocked: r.docs_unlocked, stage: r.stage });
  return ({ pool: 'Havuz', offered: 'Teklifli', process: 'Süreçte', hired: 'Personel' })[c] || r.status || '—';
}

const GROUP_ORDER = ['hired', 'process', 'offered', 'pool'];
const GROUP_TITLE = {
  hired: 'Personeller',
  process: 'Süreçtekiler',
  offered: 'Teklif gönderilenler',
  pool: 'Diğer',
};

export default function Agencies({ selectedId, onSelect, onOpenCandidate }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const [cands, setCands] = useState(null);
  const [taxUrl, setTaxUrl] = useState(null);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setErr('');
    listAgencies().then(setRows).catch((e) => { setErr(e.message); setRows([]); });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null); setTaxUrl(null); setCands(null);
      return undefined;
    }
    let alive = true;
    setCands(null);
    getAgency(selectedId).then(async (d) => {
      if (!alive) return;
      setDetail(d);
      if (d?.tax_plate_path) {
        try { setTaxUrl(await signedUrl('agency-docs', d.tax_plate_path)); }
        catch { setTaxUrl(null); }
      } else setTaxUrl(null);
    }).catch((e) => setErr(e.message));

    listAgencyCandidates(selectedId)
      .then((list) => { if (alive) setCands(list); })
      .catch((e) => { if (alive) { setErr(e.message); setCands([]); } });

    return () => { alive = false; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows || [];
    return (rows || []).filter((r) => {
      const blob = [r.email, r.company_name, r.contact_first_name, r.contact_last_name, r.phone_authorized, r.phone_rep]
        .filter(Boolean).join(' ').toLowerCase();
      return blob.includes(s);
    });
  }, [rows, q]);

  const grouped = useMemo(() => {
    const g = { hired: [], process: [], offered: [], pool: [] };
    (cands || []).forEach((r) => {
      const c = categoryOf({ status: r.status, docs_unlocked: r.docs_unlocked, stage: r.stage });
      (g[c] || g.pool).push(r);
    });
    return g;
  }, [cands]);

  const doDelete = async () => {
    setBusy(true); setErr('');
    try {
      await deleteUserFully(selectedId, { kind: 'agency' });
      setConfirm(false);
      onSelect(null);
      load();
    } catch (e) {
      setErr(e?.message || 'Silinemedi');
    } finally {
      setBusy(false);
    }
  };

  if (selectedId && detail) {
    const name = [detail.contact_first_name, detail.contact_last_name].filter(Boolean).join(' ') || '—';
    return (
      <div>
        <button type="button" className="backLink" onClick={() => onSelect(null)}>‹ Acente listesi</button>
        {err ? <p className="loginErr">{err}</p> : null}
        <div className="detail">
          <div className="card">
            <h2>Acente bilgileri</h2>
            <div className="kv">
              <div className="k">E-posta</div><div className="v">{detail.email || '—'}</div>
              <div className="k">Şirket</div><div className="v">{detail.company_name || '—'}</div>
              <div className="k">Yetkili</div><div className="v">{name}</div>
              <div className="k">Yetkili tel.</div><div className="v">{detail.phone_authorized || '—'}</div>
              <div className="k">Temsilci tel.</div><div className="v">{detail.phone_rep || '—'}</div>
              <div className="k">Kurulum</div>
              <div className="v">
                {detail.completed_at
                  ? <span className="badge ok">Tamam · {fmt(detail.completed_at)}</span>
                  : <span className="badge miss">Eksik</span>}
              </div>
              <div className="k">Kayıt</div><div className="v">{fmt(detail.auth_created_at || detail.created_at)}</div>
              <div className="k">Son giriş</div><div className="v">{fmt(detail.last_sign_in_at)}</div>
              <div className="k">User ID</div><div className="v mono">{detail.user_id}</div>
            </div>
            <div className="actions">
              <button type="button" className="dangerBtn" onClick={() => setConfirm(true)}>Sistemden sil</button>
            </div>
          </div>
          <div className="card">
            <h2>Vergi levhası</h2>
            {taxUrl ? (
              <p><a className="linkBtn" href={taxUrl} target="_blank" rel="noreferrer">PDF’i aç ↗</a></p>
            ) : (
              <p className="empty" style={{ padding: 12 }}>Yüklenmemiş</p>
            )}
            <div style={{ marginTop: 16 }}>
              <div className="kv">
                <div className="k">Teklifli</div><div className="v">{grouped.offered.length}</div>
                <div className="k">Süreçte</div><div className="v">{grouped.process.length}</div>
                <div className="k">Personel</div><div className="v">{grouped.hired.length}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h2>Bağlı adaylar {cands ? `(${cands.length})` : ''}</h2>
          {cands == null ? (
            <div className="empty" style={{ padding: 16 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : cands.length === 0 ? (
            <p className="empty" style={{ padding: 12 }}>Bu acenteye bağlı aday yok (teklif / süreç / personel).</p>
          ) : (
            GROUP_ORDER.map((key) => {
              const list = grouped[key] || [];
              if (!list.length) return null;
              return (
                <div key={key} style={{ marginTop: 14 }}>
                  <div className="panelTitle" style={{ fontSize: 14, marginBottom: 8 }}>
                    {GROUP_TITLE[key]} <span className="muted">({list.length})</span>
                  </div>
                  <div className="tableWrap">
                    <table className="adminTable">
                      <thead>
                        <tr>
                          <th>Ad / Kod</th>
                          <th>E-posta</th>
                          <th>Ünvan</th>
                          <th>Durum</th>
                          <th>Tarih</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((r) => (
                          <tr
                            key={r.user_id}
                            className={onOpenCandidate ? 'clickable' : ''}
                            onClick={() => onOpenCandidate?.(r.user_id)}
                          >
                            <td>
                              <strong>{r.full_name || '—'}</strong>
                              <div className="mono muted">{candidateCode(r.nationality, r.reg_no)}</div>
                            </td>
                            <td>{r.email || '—'}</td>
                            <td>{r.title || '—'}</td>
                            <td><span className="badge">{statusLabel(r)}</span></td>
                            <td>{fmt(r.hired_at || r.accepted_at || r.offered_at || r.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {confirm ? (
          <ConfirmDelete
            title="Acenteyi sil?"
            text={`${detail.email || name} hesabı ve tüm acente verileri kalıcı silinir. Bu işlem geri alınamaz.`}
            busy={busy}
            onCancel={() => setConfirm(false)}
            onConfirm={doDelete}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {err ? <p className="loginErr">{err}</p> : null}
      <div className="panel">
        <div className="panelHead">
          <h2 className="panelTitle">Acenteler {rows ? `(${filtered.length})` : ''}</h2>
          <input className="input search" placeholder="Ara: e-posta, şirket, telefon…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="ghostBtn" onClick={load}>Yenile</button>
        </div>
        {!rows ? <div className="empty"><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
          <div className="tableWrap">
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Şirket / Yetkili</th>
                  <th>E-posta</th>
                  <th>Telefonlar</th>
                  <th>Adaylar</th>
                  <th>Kurulum</th>
                  <th>Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="empty">Kayıt yok</td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.user_id} className="clickable" onClick={() => onSelect(r.user_id)}>
                    <td>
                      <strong>{r.company_name || '—'}</strong>
                      <div className="muted" style={{ fontSize: 12.5 }}>
                        {[r.contact_first_name, r.contact_last_name].filter(Boolean).join(' ') || 'Yetkili yok'}
                      </div>
                    </td>
                    <td>{r.email || '—'}</td>
                    <td>
                      <div>{r.phone_authorized || '—'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{r.phone_rep || ''}</div>
                    </td>
                    <td>
                      <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                        <div>Teklif: <b>{r.cnt_offered ?? 0}</b></div>
                        <div>Süreç: <b>{r.cnt_process ?? 0}</b></div>
                        <div>Personel: <b>{r.cnt_hired ?? 0}</b></div>
                      </div>
                    </td>
                    <td>
                      {r.completed_at
                        ? <span className="badge ok">Tamam</span>
                        : <span className="badge miss">Eksik</span>}
                    </td>
                    <td>{fmt(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
