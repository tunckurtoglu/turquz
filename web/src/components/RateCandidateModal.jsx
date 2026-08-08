import { useEffect, useState } from 'react';
import { getMyRating, saveRating, scoreOf } from '../lib/ratings';

function Stars({ value, onChange }) {
  return (
    <div className="rateStars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n}`}>
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, value, onChange }) {
  return (
    <div className="rateRow">
      <div>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      <Stars value={value} onChange={onChange} />
    </div>
  );
}

export default function RateCandidateModal({
  open, agencyId, candidateId, peerLabel, t, onClose, onSaved,
}) {
  const [discipline, setDiscipline] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [rehire, setRehire] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !agencyId || !candidateId) return undefined;
    let alive = true;
    setLoading(true);
    setErr('');
    getMyRating(agencyId, candidateId).then((r) => {
      if (!alive) return;
      setDiscipline(r?.discipline || 0);
      setCommunication(r?.communication || 0);
      setRehire(r?.rehire || 0);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [open, agencyId, candidateId]);

  if (!open) return null;

  const ready = discipline >= 1 && communication >= 1 && rehire >= 1;
  const preview = ready ? scoreOf({ discipline, communication, rehire }) : null;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      await saveRating(agencyId, candidateId, { discipline, communication, rehire });
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'Hata');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rateOverlay" onClick={onClose}>
      <div className="ratePanel" onClick={(e) => e.stopPropagation()}>
        <div className="rateHead">
          <div>
            <div className="rateTitle">{t('rate_title') || 'Adayı değerlendir'}</div>
            {peerLabel ? <div className="rateSub">{peerLabel}</div> : null}
          </div>
          <button type="button" className="rateClose" onClick={onClose}>✕</button>
        </div>
        <p className="rateHint">{t('rate_hint') || ''}</p>
        {loading ? <div className="muted" style={{ padding: 24, textAlign: 'center' }}>…</div> : (
          <>
            <div className="rateCard">
              <Row label={t('rate_discipline') || 'İş disiplini'} hint={t('rate_discipline_hint') || ''} value={discipline} onChange={setDiscipline} />
              <Row label={t('rate_communication') || 'Performans'} hint={t('rate_communication_hint') || ''} value={communication} onChange={setCommunication} />
              <Row label={t('rate_rehire') || 'Tekrar çalışır mıyım?'} hint={t('rate_rehire_hint') || ''} value={rehire} onChange={setRehire} />
            </div>
            {preview != null ? (
              <div className="ratePreview">{(t('rate_preview') || 'Ortalama: {n} / 5').replace('{n}', preview.toFixed(1))}</div>
            ) : null}
            {err ? <div className="rateErr">{err}</div> : null}
            <button type="button" className="rateSave" disabled={!ready || busy} onClick={save}>
              {busy ? '…' : (t('rate_save') || 'Puanı kaydet')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
