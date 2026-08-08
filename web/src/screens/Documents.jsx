import { useEffect, useRef, useState } from 'react';
import { listDocuments, getSignedUrl, requestReupload, uploadDocument, submitDocuments, removeDocument, notifyDocument } from '../lib/api';
import { useLang } from '../i18n.jsx';
import { PIPELINE, kindState, activeStep, stepDefForKind } from '../../../lib/pipeline';
import { Icon } from '../components/Icon.jsx';
import ContractModal from './ContractModal.jsx';
import PickupCard from './PickupCard.jsx';

const DOC_LABEL = {
  passport: 'Pasaport', diploma: 'Diploma / Öğrenci Belgesi', criminal: 'Adli Sicil Belgesi',
  health_report: 'Hastane Sağlık Raporu', contract_unsigned: 'Hizmet Sözleşmesi', contract_signed: 'İmzalı Hizmet Sözleşmesi',
  consulate_ref: 'Konsolosluk Referans No', work_permit: 'Çalışma Vizesi', flight_ticket: 'Uçak Bileti',
};
const STATUS = {
  valid: { t: 'Onaylı', c: 'green' }, review: { t: 'İncelemede', c: 'gold' },
  invalid: { t: 'Reddedildi', c: 'red' }, unreadable: { t: 'Okunamadı', c: 'red' },
};

export default function Documents({ candidate, agencyUserId }) {
  const { t } = useLang();
  const [docs, setDocs] = useState(null);
  const [openId, setOpenId] = useState('');
  const [contractOpen, setContractOpen] = useState(false);
  const [viewer, setViewer] = useState(null); // aynı sayfada açılan belge: { url, label, path }
  const flightInput = useRef(null);

  const refresh = async () => {
    const rows = await listDocuments(candidate.user_id);
    const m = {}; rows.forEach((r) => { m[r.kind] = r; });
    setDocs(m);
  };
  useEffect(() => { refresh(); }, [candidate.user_id]);

  const isSubmitted = (k) => !!docs?.[k]?.submitted_at;
  const isUploaded = (k) => !!docs?.[k];
  const has = (k) => { const def = stepDefForKind(k); return def?.owner === 'agency' ? isSubmitted(k) : isSubmitted(k); };

  const view = async (k) => {
    const r = docs?.[k]; if (!r?.storage_path) return;
    // Yeni sekme yerine AYNI sayfada görüntüleyicide aç (popup gerekmez, engellenmez).
    try {
      setOpenId(k);
      const url = await getSignedUrl(r.storage_path);
      if (url) setViewer({ url, label: DOC_LABEL[k] || 'Belge', path: r.storage_path });
    } catch (e) { alert(e?.message || 'Belge açılamadı'); }
    finally { setOpenId(''); }
  };
  const reupload = async (k) => {
    if (!confirm(`${DOC_LABEL[k]} için adaydan yeniden yükleme istensin mi?`)) return;
    try { await requestReupload(candidate.user_id, k); await refresh(); } catch (e) { alert(e?.message || 'Hata'); }
  };
  const send = async (k) => {
    if (!confirm(`${DOC_LABEL[k]} adaya gönderilsin mi?`)) return;
    try { await submitDocuments(candidate.user_id, [k]); notifyDocument(candidate.user_id, k); await refresh(); } catch (e) { alert(e?.message || 'Hata'); }
  };
  const uploadFlight = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const isPdf = file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) { alert('Uçak bileti yalnızca PDF olarak yüklenebilir.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result).split(',')[1];
      try { await uploadDocument(candidate.user_id, 'flight_ticket', base64, 'application/pdf'); await refresh(); } catch (e2) { alert(e2?.message || 'Hata'); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const removeAgency = async (k) => {
    if (!confirm('Taslak kaldırılsın mı?')) return;
    try { await removeDocument(candidate.user_id, k); await refresh(); } catch (e) { alert(e?.message || 'Hata'); }
  };

  if (docs === null) return <div className="center pad"><div className="spinner" /></div>;

  return (
    <div className="docs">
      {PIPELINE.map((s) => {
        const mine = s.owner === 'agency';
        const act = activeStep(has);
        const mode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
        return (
          <div key={s.step} className={`docStep ${mode}`}>
            <div className="docStepHead">
              <span className={`stepNo ${mode}`}>{mode === 'done' ? '✓' : s.step}</span>
              <span className={`ownerChip ${mine ? 'agency' : 'cand'}`}>{mine ? 'Acente' : 'Aday'}</span>
            </div>
            <div className="docRows">
              {s.kinds.map((k) => {
                const r = docs[k];
                const kst = kindState(k, has);
                const st = r?.status && STATUS[r.status] ? STATUS[r.status] : null;
                const exists = !!r?.storage_path;
                const draft = mine && isUploaded(k) && !isSubmitted(k);

                // Acente: Hizmet Sözleşmesi (özel akış)
                if (k === 'contract_unsigned') {
                  const locked = kst === 'locked';
                  return (
                    <div key={k} className="docRow">
                      <span className={`docBullet ${isSubmitted(k) ? 'on' : ''}`}>{isSubmitted(k) ? '✓' : '•'}</span>
                      <span className="docName">{DOC_LABEL[k]}</span>
                      {draft ? <span className="badge gold">Taslak</span> : null}
                      <span className="docSpacer" />
                      {locked ? <span className="docWait">Aday paketi bekleniyor</span> : isSubmitted(k) ? (
                        <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> Görüntüle</button>
                      ) : (
                        <>
                          <button className="docView" onClick={() => setContractOpen(true)}>Sözleşme</button>
                          {draft ? <button className="sendBtn" onClick={() => send(k)}>Gönder →</button> : null}
                          {draft ? <button className="docReupload" onClick={() => removeAgency(k)} title="Kaldır">🗑</button> : null}
                        </>
                      )}
                    </div>
                  );
                }

                // Acente: Uçak Bileti
                if (k === 'flight_ticket') {
                  const locked = kst === 'locked';
                  return (
                    <div key={k} className="docRow">
                      <span className={`docBullet ${isSubmitted(k) ? 'on' : ''}`}>{isSubmitted(k) ? '✓' : '•'}</span>
                      <span className="docName">{DOC_LABEL[k]}</span>
                      {draft ? <span className="badge gold">Taslak</span> : null}
                      <span className="docSpacer" />
                      {locked ? <span className="docWait">Sıra bekleniyor</span> : isSubmitted(k) ? (
                        <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> Görüntüle</button>
                      ) : (
                        <>
                          {exists ? <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> Görüntüle</button> : null}
                          <button className="docView" onClick={() => flightInput.current?.click()}>{exists ? 'Değiştir' : 'Yükle'}</button>
                          {draft ? <button className="sendBtn" onClick={() => send(k)}>Gönder →</button> : null}
                        </>
                      )}
                      <input ref={flightInput} type="file" accept="application/pdf,.pdf" hidden onChange={uploadFlight} />
                    </div>
                  );
                }

                // Aday belgeleri (görüntüle + yeniden iste)
                return (
                  <div key={k} className="docRow">
                    <span className={`docBullet ${kst === 'done' ? 'on' : ''}`}>{kst === 'done' ? '✓' : '•'}</span>
                    <span className="docName">{DOC_LABEL[k] || t(`doc_${k}`) || k}</span>
                    {st ? <span className={`badge ${st.c}`}>{st.t}</span> : null}
                    <span className="docSpacer" />
                    {exists ? (
                      <button className="docView" onClick={() => view(k)} disabled={openId === k}><Icon name="search" size={14} /> Görüntüle</button>
                    ) : kst === 'locked' ? <span className="docLock">🔒</span> : <span className="docWait">Bekleniyor</span>}
                    {exists ? <button className="docReupload" onClick={() => reupload(k)} title="Yeniden iste">↻</button> : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Havaalanı karşılama — yalnızca uçak bileti adaya GÖNDERİLDİĞİNDE açılır */}
      {isSubmitted('flight_ticket') ? (
        <PickupCard userId={candidate.user_id} agencyId={agencyUserId} />
      ) : (
        <div className="pickupCard">
          <div className="pickupHead"><h3>🤝 Havaalanı Karşılama</h3></div>
          <p className="pickupHint">🔒 Havaalanı karşılama, uçak biletini adaya gönderdikten sonra açılır.</p>
        </div>
      )}

      {contractOpen ? (
        <ContractModal
          candidate={{ ...candidate, agencyUserId }}
          esigned={(docs.contract_unsigned?.mime_type || '').includes('pdf')}
          onClose={() => setContractOpen(false)}
          onChanged={refresh}
        />
      ) : null}

      {viewer ? (
        <div className="docViewer" onClick={() => setViewer(null)}>
          <div className="docViewerInner" onClick={(e) => e.stopPropagation()}>
            <div className="docViewerBar">
              <span className="docViewerTitle">{viewer.label}</span>
              <div className="docViewerActions">
                <a className="docViewerOpen" href={viewer.url} target="_blank" rel="noopener">Yeni sekmede aç ↗</a>
                <button className="docViewerClose" onClick={() => setViewer(null)} aria-label="Kapat">✕</button>
              </div>
            </div>
            {/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(viewer.path || '')
              ? <img src={viewer.url} alt={viewer.label} className="docViewerImg" />
              : <iframe title={viewer.label} src={viewer.url} className="docViewerFrame" />}
          </div>
        </div>
      ) : null}
    </div>
  );
}
