// web StampSetup — işletme başına imza/kaşe.
import { useEffect, useRef, useState } from 'react';
import { saveEmployerStamp, clearEmployerStamp, getEmployer } from '../lib/employers';
import { stampMakeTransparentSafe } from '../lib/stampProcess';
import { useLang } from '../i18n.jsx';

export default function StampSetup({ agencyId, employer, onClose, onSaved }) {
  const { t } = useLang();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [camOn, setCamOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [emp, setEmp] = useState(employer || null);

  useEffect(() => {
    (async () => {
      let row = employer;
      if (agencyId && employer?.id) row = (await getEmployer(agencyId, employer.id)) || employer;
      setEmp(row || null);
      setImage(row?.stampImage || null);
      setName(row?.stampSignerName || row?.name || '');
      setTitle(row?.stampSignerTitle || '');
    })();
    return () => stopCam();
  }, [agencyId, employer?.id]);

  const stopCam = () => {
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCamOn(false);
  };

  const startCam = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play?.();
        }
      });
    } catch (e) {
      setErr(t('stamp_cam_fail'));
    }
  };

  const shoot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const fw = vw * 0.78;
    const fh = Math.min(vh * 0.36, fw / 2.35);
    const sx = (vw - fw) / 2;
    const sy = (vh - fh) / 2;
    canvas.width = 900;
    canvas.height = Math.round(900 * (fh / fw));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, fw, fh, 0, 0, canvas.width, canvas.height);
    const raw = canvas.toDataURL('image/png');
    stopCam();
    stampMakeTransparentSafe(raw).then(setImage);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const raw = String(reader.result || '');
      setImage(await stampMakeTransparentSafe(raw));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!emp?.id || !agencyId) return;
    if (!image) { setErr(t('stamp_need_image')); return; }
    if (!name.trim()) { setErr(t('stamp_need_name')); return; }
    setBusy(true);
    setErr('');
    try {
      const cleared = await stampMakeTransparentSafe(image);
      setImage(cleared);
      const row = await saveEmployerStamp(agencyId, emp.id, { image: cleared, signerName: name, signerTitle: title });
      onSaved?.(row);
      onClose?.();
    } catch (e) {
      setErr(e?.message || t('agency_setup_err_save'));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirm(t('stamp_remove_confirm'))) return;
    await clearEmployerStamp(agencyId, emp.id);
    setImage(null);
    onSaved?.(await getEmployer(agencyId, emp.id));
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard sm" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modalHead">
          <h3>{t('stamp_title')} — {emp?.name || ''}</h3>
          <button type="button" className="modalX" onClick={onClose}>✕</button>
        </div>
        <div className="modalBody">
          <p className="fieldHint">{t('stamp_help_employer')}</p>
          {err ? <p style={{ color: '#a32d2d', fontSize: 13 }}>{err}</p> : null}

          {camOn ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
              <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block' }} />
              <div style={{
                position: 'absolute', left: '11%', right: '11%', top: '32%', height: '36%',
                border: '2px solid #c2a25a', borderRadius: 10,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }}
              />
              <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button type="button" className="goldBtn sm" onClick={shoot}>{t('stamp_shoot')}</button>
                <button type="button" className="ghostBtn" onClick={stopCam}>{t('agency_cancel')}</button>
              </div>
            </div>
          ) : (
            <div style={{
              height: 140, border: '1px solid #e6e8ec', borderRadius: 12, marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dfe3e8', padding: 8,
            }}>
              {image
                ? <img src={image} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <span className="muted">{t('stamp_empty')}</span>}
            </div>
          )}

          <canvas ref={canvasRef} hidden />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {!camOn ? (
              <button type="button" className="ghostBtn" onClick={startCam}>
                {image ? t('stamp_change') : t('stamp_capture')}
              </button>
            ) : null}
            <label className="ghostBtn" style={{ cursor: 'pointer' }}>
              {t('stamp_from_file')}
              <input type="file" accept="image/*" hidden onChange={onFile} />
            </label>
            {image ? <button type="button" className="ghostBtn" onClick={clear}>{t('stamp_remove')}</button> : null}
          </div>

          <label className="fieldLbl">{t('stamp_signer_name')} *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('stamp_signer_name_ph')} />
          <label className="fieldLbl" style={{ marginTop: 10 }}>{t('stamp_signer_title')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('stamp_signer_title_ph')} />
        </div>
        <div className="modalFoot">
          <button type="button" className="ghostBtn" onClick={onClose}>{t('intro_video_cancel')}</button>
          <button type="button" className="goldBtn sm" onClick={save} disabled={busy}>{busy ? '…' : t('save')}</button>
        </div>
      </div>
    </div>
  );
}
