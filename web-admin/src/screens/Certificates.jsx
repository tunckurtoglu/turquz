import { useEffect, useState } from 'react';
import { getCandidate, listPendingCertificates } from '../lib/api';
import SuccessCertificateModal from '../components/SuccessCertificateModal.jsx';

function fmt(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('tr-TR'); } catch { return String(d); }
}

function statusLabel(status) {
  if (status === 'needs_issue') return 'Gönderim bekliyor';
  return status || '—';
}

export default function Certificates({ onOpenCandidate }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const [previewDetail, setPreviewDetail] = useState(null);

  const load = async () => {
    setErr('');
    try {
      setRows(await listPendingCertificates(300));
    } catch (e) {
      setErr(e?.message || 'Sertifika kuyruğu yüklenemedi');
    }
  };

  useEffect(() => { load(); }, []);

  const openPreview = async (row) => {
    const key = `${row.candidate_id}:preview`;
    setBusy(key);
    setErr('');
    try {
      const detail = await getCandidate(row.candidate_id);
      setPreviewDetail(detail);
    } catch (e) {
      setErr(e?.message || 'Aday detayı yüklenemedi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 8px' }}>Başarı sertifikaları</h1>
      <p className="muted" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
        Sezonu tamamlayan adaylar. İngilizce sertifikayı önizleyip onayladıktan sonra adaya e-posta ile gönderin; acente paneline gitmez.
      </p>
      {err ? <p className="loginErr">{err}</p> : null}
      {!rows.length ? (
        <p className="empty">Bekleyen sertifika yok.</p>
      ) : (
        <div className="tableWrap">
          <table className="adminTable">
            <thead>
              <tr>
                <th>Aday</th>
                <th>İşletme</th>
                <th>Sezon bitişi</th>
                <th>Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.candidate_id}>
                  <td>
                    <button type="button" className="linkBtn" onClick={() => onOpenCandidate(row.candidate_id)}>
                      {row.candidate_name || '—'}
                    </button>
                    {row.candidate_reg_no ? <div className="muted mono" style={{ fontSize: 12 }}>#{row.candidate_reg_no}</div> : null}
                  </td>
                  <td>{row.employer_title || '—'}</td>
                  <td>{fmt(row.season_ended_at)}</td>
                  <td>
                    <span className={`badge ${row.cert_status === 'needs_issue' ? 'warn' : ''}`}>
                      {statusLabel(row.cert_status)}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      type="button"
                      className="goldBtn sm"
                      disabled={busy === `${row.candidate_id}:preview`}
                      onClick={() => openPreview(row)}
                    >
                      {busy === `${row.candidate_id}:preview` ? '…' : 'Önizle ve gönder'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {previewDetail ? (
        <SuccessCertificateModal
          detail={previewDetail}
          onClose={() => setPreviewDetail(null)}
          onSent={() => { setPreviewDetail(null); load(); }}
        />
      ) : null}
    </div>
  );
}
