import { useEffect, useRef, useState } from 'react';
import {
  listDocuments, getSignedUrl, requestReupload, uploadDocument, submitDocuments,
  removeDocument, notifyDocument, setWorkStartAt, getCandidateStatus, getCandidate, getContract,
} from '../lib/api';
import { useLang } from '../i18n.jsx';
import { PIPELINE, kindState, activeStep, stepDefForKind, stepActor } from '../../../lib/pipeline';
import { Icon } from '../components/Icon.jsx';
import ContractModal from './ContractModal.jsx';
import PickupCard from './PickupCard.jsx';

const DOC_LABEL = {
  passport: 'Pasaport', diploma: 'Diploma / Öğrenci Belgesi', criminal: 'Adli Sicil Belgesi',
  health_report: 'Hastane Sağlık Raporu', contract_unsigned: 'Hizmet Sözleşmesi', contract_signed: 'İmzalı Hizmet Sözleşmesi',
  consulate_ref: 'Konsolosluk Referans No', work_permit: 'Çalışma Vizesi', flight_ticket: 'Uçak Bileti',
  success_certificate: 'Turquz Başarı Sertifikası',
};
const STATUS = {
  valid: { t: 'Onaylı', c: 'green' }, review: { t: 'İncelemede', c: 'gold' },
  invalid: { t: 'Reddedildi', c: 'red' }, unreadable: { t: 'Okunamadı', c: 'red' },
};
const BOARDING_LBL = {
  pending: 'Uçuş teyidi bekleniyor',
  confirmed: 'Uçuş onaylandı',
  missed: 'Uçak kaçırıldı',
  no_response: 'Uçuş cevabı yok',
};

export default function Documents({ candidate, agencyUserId }) {
  const { t } = useLang();
  const [docs, setDocs] = useState(null);
  const [openId, setOpenId] = useState('');
  const [contractOpen, setContractOpen] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [workStart, setWorkStart] = useState('');
  const [workEnd, setWorkEnd] = useState('');
  const [termPreset, setTermPreset] = useState('1y');
  const [flightDepart, setFlightDepart] = useState('');
  const [flightModal, setFlightModal] = useState(null); // 'upload' | 'edit' | null
  const [pendingFile, setPendingFile] = useState(null);
  const flightInput = useRef(null);
  const [preferredStart, setPreferredStart] = useState(
    candidate?.data?.preferredStartDate || candidate?.preferredStartDate || '',
  );
  const [boardingStatus, setBoardingStatus] = useState(null);
  const [flightDepartOn, setFlightDepartOn] = useState('');
  const [docsDeadlineAt, setDocsDeadlineAt] = useState(null);
  const [payStatus, setPayStatus] = useState(null);
  const [payOk, setPayOk] = useState(false);

  const addMonthsYmd = (ymd, months) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const day = dt.getDate();
    dt.setMonth(dt.getMonth() + months);
    if (dt.getDate() !== day) dt.setDate(0);
    const p = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  };

  const inferPreset = (start, end) => {
    if (!start || !end) return '1y';
    if (end === addMonthsYmd(start, 6)) return '6m';
    if (end === addMonthsYmd(start, 12)) return '1y';
    return 'custom';
  };

  const applyPreset = (next, start = workStart) => {
    setTermPreset(next);
    if (!start) return;
    if (next === '6m') setWorkEnd(addMonthsYmd(start, 6));
    else if (next === '1y') setWorkEnd(addMonthsYmd(start, 12));
  };

  const onWorkStartChange = (v) => {
    setWorkStart(v);
    if (termPreset === '6m') setWorkEnd(addMonthsYmd(v, 6));
    else if (termPreset === '1y') setWorkEnd(addMonthsYmd(v, 12));
  };

  const refresh = async () => {
    const [rows, st, row, con] = await Promise.all([
      listDocuments(candidate.user_id),
      getCandidateStatus(candidate.user_id),
      getCandidate(candidate.user_id),
      getContract(candidate.user_id),
    ]);
    const m = {}; rows.forEach((r) => { m[r.kind] = r; });
    setDocs(m);
    const start = st?.work_start_at ? String(st.work_start_at).slice(0, 10) : '';
    const end = st?.planned_end_on
      ? String(st.planned_end_on).slice(0, 10)
      : (st?.work_end_at ? String(st.work_end_at).slice(0, 10) : (start ? addMonthsYmd(start, 12) : ''));
    setWorkStart(start);
    setWorkEnd(end);
    setTermPreset(inferPreset(start, end));
    setFlightDepart(st?.flight_depart_on ? String(st.flight_depart_on).slice(0, 10) : '');
    setBoardingStatus(st?.boarding_status || null);
    setFlightDepartOn(st?.flight_depart_on ? String(st.flight_depart_on).slice(0, 10) : '');
    setDocsDeadlineAt(st?.docs_deadline_at || null);
    setPayOk(!!con?.isPaid);
    setPayStatus(con?.paymentStatus || null);
    const pref = row?.data?.preferredStartDate || candidate?.data?.preferredStartDate || '';
    setPreferredStart(pref || '');
  };
  useEffect(() => { refresh(); }, [candidate.user_id]);

  const isSubmitted = (k) => !!docs?.[k]?.submitted_at;
  const isUploaded = (k) => !!docs?.[k];
  const has = (k) => { const def = stepDefForKind(k); return def?.owner === 'agency' ? isSubmitted(k) : isSubmitted(k); };

  const view = async (k) => {
    const r = docs?.[k]; if (!r?.storage_path) return;
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
    if (k === 'flight_ticket' && !workStart) {
      alert('Uçak biletini göndermeden önce işe başlama tarihini girin.');
      setFlightModal('edit');
      return;
    }
    if (!confirm(`${DOC_LABEL[k]} adaya gönderilsin mi?`)) return;
    try {
      await submitDocuments(candidate.user_id, [k]);
      notifyDocument(candidate.user_id, k);
      await refresh();
    } catch (e) {
      if (String(e?.message || '').includes('work_start_required')) {
        alert('İşe başlama tarihi zorunlu. Lütfen tarih girin.');
        setFlightModal('edit');
      } else alert(e?.message || 'Hata');
    }
  };

  const openFlightUpload = () => {
    setFlightModal('upload');
    setPendingFile(null);
  };

  const onFlightFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) { alert('Uçak bileti yalnızca PDF olarak yüklenebilir.'); return; }
    setPendingFile(file);
    setFlightModal('upload');
  };

  const confirmFlightModal = async () => {
    if (!workStart || !flightDepart) { alert('Uçuş günü ve işe başlama tarihi zorunludur.'); return; }
    if (!workEnd) { alert('Planlanan bitiş tarihi zorunludur.'); return; }
    if (workEnd <= workStart) { alert('Bitiş tarihi, başlangıçtan sonra olmalıdır.'); return; }
    try {
      await setWorkStartAt(candidate.user_id, workStart, flightDepart, workEnd);
      if (flightModal === 'upload') {
        const file = pendingFile;
        if (!file) {
          flightInput.current?.click();
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result).split(',')[1];
          try {
            await uploadDocument(candidate.user_id, 'flight_ticket', base64, 'application/pdf');
            setFlightModal(null);
            setPendingFile(null);
            await refresh();
          } catch (e2) { alert(e2?.message || 'Hata'); }
        };
        reader.readAsDataURL(file);
        return;
      }
      setFlightModal(null);
      await refresh();
    } catch (e) { alert(e?.message || 'Hata'); }
  };

  const removeAgency = async (k) => {
    if (!confirm('Taslak kaldırılsın mı?')) return;
    try { await removeDocument(candidate.user_id, k); await refresh(); } catch (e) { alert(e?.message || 'Hata'); }
  };

  if (docs === null) return <div className="center pad"><div className="spinner" /></div>;

  return (
    <div className="docs">
      <div className="docsOpsBar">
        {payStatus != null || payOk ? (
          <div className={`docsOpsChip ${payOk ? 'ok' : 'warn'}`}>
            {payOk ? 'Ücret: tamam' : `Ücret: ${payStatus || 'bekleniyor'}`}
          </div>
        ) : null}
        {docsDeadlineAt ? (
          <div className={`docsOpsChip ${new Date(docsDeadlineAt).getTime() < Date.now() ? 'hot' : ''}`}>
            SLA: {new Date(docsDeadlineAt).toLocaleDateString('tr-TR')}
          </div>
        ) : null}
        {boardingStatus ? (
          <div className={`docsOpsChip ${boardingStatus === 'confirmed' ? 'ok' : boardingStatus === 'missed' ? 'hot' : 'warn'}`}>
            {BOARDING_LBL[boardingStatus] || boardingStatus}
            {flightDepartOn ? ` · ${flightDepartOn}` : ''}
          </div>
        ) : null}
      </div>
      {PIPELINE.map((s) => {
        const actor = stepActor(s, has);
        const mine = actor === 'agency';
        const act = activeStep(has);
        const mode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
        return (
          <div key={s.step} className={`docStep ${mode}`}>
            <div className="docStepHead">
              <span className={`stepNo ${mode}`}>{s.step}</span>
              <span className={`docStepTitle ${mode}`}>{t(s.titleKey) || ''}</span>
              <span className={`ownerChip ${mine ? 'agency' : 'cand'}`}>{mine ? 'Acente' : 'Aday'}</span>
            </div>
            <div className="docRows">
              {s.kinds.map((k) => {
                const r = docs[k];
                const kst = kindState(k, has);
                const st = r?.status && STATUS[r.status] ? STATUS[r.status] : null;
                const exists = !!r?.storage_path;
                const draft = mine && isUploaded(k) && !isSubmitted(k);

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

                if (k === 'work_permit' && preferredStart) {
                  return (
                    <div key={k} className="docRow" style={{ flexWrap: 'wrap' }}>
                      <span className={`docBullet ${kst === 'done' ? 'on' : ''}`}>{kst === 'done' ? '✓' : '•'}</span>
                      <span className="docName">{DOC_LABEL[k]}</span>
                      <span className="badge teal">{t('start_date_agency') || 'En erken başlangıç'}: {preferredStart}</span>
                      <span className="docSpacer" />
                      {exists ? (
                        <button className="docView" onClick={() => view(k)} disabled={openId === k}><Icon name="search" size={14} /> Görüntüle</button>
                      ) : kst === 'locked' ? <span className="docLock">🔒</span> : <span className="docWait">Bekleniyor</span>}
                      {exists ? <button className="docReupload" onClick={() => reupload(k)} title="Yeniden iste">↻</button> : null}
                    </div>
                  );
                }

                if (k === 'flight_ticket') {
                  const locked = kst === 'locked';
                  return (
                    <div key={k} className="docRow" style={{ flexWrap: 'wrap' }}>
                      <span className={`docBullet ${isSubmitted(k) ? 'on' : ''}`}>{isSubmitted(k) ? '✓' : '•'}</span>
                      <span className="docName">{DOC_LABEL[k]}</span>
                      {draft ? <span className="badge gold">Taslak</span> : null}
                      {preferredStart ? <span className="badge gold">{t('start_date_agency') || 'Aday tercihi'}: {preferredStart}</span> : null}
                      {workStart ? <span className="badge teal">Başlangıç: {workStart}</span> : null}
                      {workEnd ? <span className="badge">Bitiş: {workEnd}</span> : null}
                      <span className="docSpacer" />
                      {locked ? <span className="docWait">Sıra bekleniyor</span> : isSubmitted(k) ? (
                        <>
                          <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> Görüntüle</button>
                          <button className="docView" type="button" onClick={() => setFlightModal('edit')}>Tarihi düzenle</button>
                        </>
                      ) : (
                        <>
                          {exists ? <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> Görüntüle</button> : null}
                          <button className="docView" type="button" onClick={openFlightUpload}>{exists ? 'Değiştir' : 'Yükle'}</button>
                          {draft ? <button className="sendBtn" onClick={() => send(k)}>Gönder →</button> : null}
                        </>
                      )}
                      <input ref={flightInput} type="file" accept="application/pdf,.pdf" hidden onChange={onFlightFile} />
                    </div>
                  );
                }

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

      <div className={`docStep ${isSubmitted('flight_ticket') ? 'active' : 'locked'}`}>
        <div className="docStepHead">
          <span className={`stepNo ${isSubmitted('flight_ticket') ? 'active' : ''}`}>6</span>
          <span className={`docStepTitle ${isSubmitted('flight_ticket') ? '' : 'locked'}`}>{t('pipe_step_6') || 'Havaalanı Transfer'}</span>
          <span className="ownerChip agency">Acente</span>
        </div>
        {isSubmitted('flight_ticket') ? (
          <PickupCard embedded userId={candidate.user_id} agencyId={agencyUserId} />
        ) : (
          <p className="pickupHint">🔒 {t('pickup_lock_agency') || 'Havaalanı transfer, uçak biletini adaya gönderdikten sonra açılır.'}</p>
        )}
      </div>

      <div className={`docStep ${isSubmitted('success_certificate') ? 'active' : 'locked'}`}>
        <div className="docStepHead">
          <span className={`stepNo ${isSubmitted('success_certificate') ? 'active' : ''}`}>7</span>
          <span className={`docStepTitle ${isSubmitted('success_certificate') ? '' : 'locked'}`}>{t('pipe_step_7') || 'Başarı Sertifikası'}</span>
          <span className="ownerChip agency">{t('doc_owner_turquz') || 'Turquz'}</span>
        </div>
        {isSubmitted('success_certificate') ? (
          <>
            <p className="certCongrats">🎉 {t('pipe_step_7_desc')}</p>
            <div className="docRow">
              <span className="docBullet on">✓</span>
              <span className="docName">{t('doc_success_certificate') || DOC_LABEL.success_certificate}</span>
              <span className="docSpacer" />
              <button className="docView" onClick={() => view('success_certificate')} disabled={openId === 'success_certificate'}>
                <Icon name="search" size={14} /> Görüntüle
              </button>
            </div>
          </>
        ) : (
          <p className="pickupHint">🔒 {t('pipe_step_7_wait_agency')}</p>
        )}
      </div>

      {flightModal ? (
        <div className="docViewer" onClick={() => setFlightModal(null)}>
          <div className="docViewerCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>{flightModal === 'edit' ? 'İşe başlama tarihini güncelle' : 'Uçak bileti + işe başlama'}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.45 }}>
              Süre: 6 ay, 1 yıl veya özel bitiş. Sertifika planlanan bitişte tamamlanınca verilir.
            </p>
            {preferredStart ? (
              <p style={{ background: '#eef4f6', border: '1px solid #cfe0e6', borderRadius: 10, padding: '10px 12px', fontWeight: 700, color: '#2a5560' }}>
                📅 {t('start_date_agency') || 'Adayın tercih ettiği en erken başlangıç'}: {preferredStart}
              </p>
            ) : null}
            <label style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Uçuş / kalkış günü *</label>
            <input
              type="date"
              className="input"
              value={flightDepart}
              onChange={(e) => setFlightDepart(e.target.value)}
              required
            />
            <label style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6, marginTop: 12 }}>İşe başlama tarihi *</label>
            <input
              type="date"
              className="input"
              value={workStart}
              onChange={(e) => onWorkStartChange(e.target.value)}
              required
            />
            <label style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6, marginTop: 12 }}>Çalışma süresi *</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[
                { id: '6m', label: '6 ay' },
                { id: '1y', label: '1 yıl' },
                { id: 'custom', label: 'Özel' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={termPreset === opt.id ? 'buyPrimary' : 'ghostBtn'}
                  style={{ flex: 1, padding: '8px 6px', fontSize: 13 }}
                  onClick={() => applyPreset(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>Planlanan bitiş *</label>
            <input
              type="date"
              className="input"
              value={workEnd}
              onChange={(e) => { setTermPreset('custom'); setWorkEnd(e.target.value); }}
              required
            />
            {flightModal === 'upload' && pendingFile ? (
              <p style={{ fontSize: 13, marginTop: 10 }}>PDF: {pendingFile.name}</p>
            ) : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" className="ghostBtn" onClick={() => { setFlightModal(null); setPendingFile(null); }}>İptal</button>
              {flightModal === 'upload' && !pendingFile ? (
                <button type="button" className="buyPrimary" onClick={() => flightInput.current?.click()}>PDF seç</button>
              ) : (
                <button type="button" className="buyPrimary" onClick={confirmFlightModal}>
                  {flightModal === 'edit' ? 'Kaydet' : 'Kaydet + yükle'}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
          <div className="docViewerCard" onClick={(e) => e.stopPropagation()}>
            <div className="docViewerHead">
              <strong>{viewer.label}</strong>
              <button type="button" className="ghostBtn" onClick={() => setViewer(null)}>Kapat</button>
            </div>
            <iframe title={viewer.label} src={viewer.url} style={{ width: '100%', height: '70vh', border: 0 }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
