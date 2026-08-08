import { useEffect, useRef, useState } from 'react';
import { getMySignature, saveMySignature } from '../lib/api';

export default function SignatureSetup({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [method, setMethod] = useState('draw');
  const [uploaded, setUploaded] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    (async () => {
      const sig = await getMySignature();
      if (sig) { setName(sig.signerName || ''); setTitle(sig.signerTitle || ''); setUploaded(sig.image || ''); setMethod('upload'); }
    })();
  }, []);

  // canvas çizim
  useEffect(() => {
    if (method !== 'draw') return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const rect = cv.getBoundingClientRect();
    cv.width = rect.width * 2; cv.height = rect.height * 2; ctx.scale(2, 2);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10243f';
    const pos = (e) => { const r = cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const start = (e) => { e.preventDefault(); drawing.current = true; dirty.current = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (e) => { if (!drawing.current) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const end = () => { drawing.current = false; };
    cv.addEventListener('mousedown', start); cv.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    cv.addEventListener('touchstart', start, { passive: false }); cv.addEventListener('touchmove', move, { passive: false }); cv.addEventListener('touchend', end);
    return () => { cv.removeEventListener('mousedown', start); cv.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end); cv.removeEventListener('touchstart', start); cv.removeEventListener('touchmove', move); cv.removeEventListener('touchend', end); };
  }, [method]);

  const clearCanvas = () => { const cv = canvasRef.current; if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); dirty.current = false; };

  const pickFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      // 900px genişliğe ölçekle (PNG)
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 900 / img.width);
        const cv = document.createElement('canvas'); cv.width = img.width * scale; cv.height = img.height * scale;
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        setUploaded(cv.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  };

  const save = async () => {
    if (!name.trim()) { alert('Firma / yetkili adı girin.'); return; }
    let image = '';
    if (method === 'draw') { if (!dirty.current) { alert('Lütfen imzanızı çizin.'); return; } image = canvasRef.current.toDataURL('image/png'); }
    else { if (!uploaded) { alert('Lütfen imza/kaşe görseli yükleyin.'); return; } image = uploaded; }
    setBusy(true);
    try { await saveMySignature({ image, signerName: name, signerTitle: title }); onSaved?.(); onClose?.(); }
    catch (e) { alert(e?.message || 'Hata'); } finally { setBusy(false); }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard sigCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead"><h3>İmza & Kaşe</h3><button className="modalX" onClick={onClose}>✕</button></div>
        <div className="modalBody">
          <label className="fieldLbl">Firma / yetkili adı</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Firma / yetkili" />
          <label className="fieldLbl">Unvan (isteğe bağlı)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unvan" />

          <div className="sigTabs">
            <button className={`sigTab ${method === 'draw' ? 'on' : ''}`} onClick={() => setMethod('draw')}>✍️ Çiz</button>
            <button className={`sigTab ${method === 'upload' ? 'on' : ''}`} onClick={() => setMethod('upload')}>🖼️ Görsel Yükle</button>
          </div>

          {method === 'draw' ? (
            <>
              <canvas ref={canvasRef} className="sigCanvas" />
              <button className="ghostBtn sm" onClick={clearCanvas}>Temizle</button>
            </>
          ) : (
            <div className="sigUpload">
              {uploaded ? <img src={uploaded} className="sigPreview" alt="" /> : <div className="sigUploadEmpty">Görsel seç</div>}
              <input type="file" accept="image/*" onChange={pickFile} />
            </div>
          )}
        </div>
        <div className="modalFoot">
          <button className="ghostBtn" onClick={onClose}>Vazgeç</button>
          <button className="goldBtn sm" onClick={save} disabled={busy}>{busy ? '…' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  );
}
