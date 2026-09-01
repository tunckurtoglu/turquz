import { useMemo, useState } from 'react';
import { generateAndPublishSuccessCertificate } from '../lib/api';
import { buildSuccessCertificateHtml, completedEpisodeFromDetail } from '../lib/successCertificate';

export default function SuccessCertificateModal({ detail, onClose, onSent }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const episode = useMemo(() => completedEpisodeFromDetail(detail), [detail]);
  const html = useMemo(() => {
    if (!detail || !episode) return '';
    try {
      return buildSuccessCertificateHtml(detail, episode);
    } catch {
      return '';
    }
  }, [detail, episode]);

  if (!detail) return null;

  const name = detail.full_name
    || [detail.data?.firstName, detail.data?.lastName].filter(Boolean).join(' ')
    || 'Aday';

  const send = async () => {
    if (!window.confirm(`${name} için İngilizce başarı sertifikası oluşturulup adaya e-posta ile gönderilsin mi?`)) return;
    setBusy(true);
    setErr('');
    try {
      await generateAndPublishSuccessCertificate(detail.user_id, detail);
      onSent?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Sertifika gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modalOverlay" onClick={() => { if (!busy) onClose?.(); }}>
      <div className="certPreviewModal" onClick={(e) => e.stopPropagation()}>
        <div className="certPreviewHead">
          <div>
            <h3>Başarı sertifikası önizleme</h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {name} · İngilizce · A4 yatay
            </p>
          </div>
          <button type="button" className="ghostBtn sm" disabled={busy} onClick={onClose}>✕</button>
        </div>
        {!episode || !html ? (
          <p className="loginErr" style={{ margin: 0 }}>Tamamlanmış sezon bulunamadı; sertifika oluşturulamaz.</p>
        ) : (
          <iframe title="Sertifika önizleme" className="certPreviewFrame" srcDoc={html} />
        )}
        {err ? <p className="loginErr">{err}</p> : null}
        <div className="modalActions certPreviewActions">
          <button type="button" className="ghostBtn" disabled={busy} onClick={onClose}>Kapat</button>
          <button
            type="button"
            className="goldBtn sm"
            disabled={busy || !html}
            onClick={send}
          >
            {busy ? 'Gönderiliyor…' : 'Adaya gönder'}
          </button>
        </div>
      </div>
    </div>
  );
}
