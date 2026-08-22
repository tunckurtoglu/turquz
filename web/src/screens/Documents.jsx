import { useEffect, useRef, useState } from 'react';
import {
  listDocuments, getSignedUrl, requestReupload, uploadDocument, submitDocuments,
  removeDocument, notifyDocument, setWorkStartAt, getCandidateStatus, getCandidate, getContract,
  retractAgencyDoc, replaceSubmittedDocument,
} from '../lib/api';
import { formatArriveAt, getFlight, parseArriveAt, saveArrival, msUntilArrival } from '../../../lib/flights';
import { formatCountdown } from '../lib/interviews';
import { useLang } from '../i18n.jsx';
import { PIPELINE, kindState, activeStep, stepDefForKind, stepActor } from '../../../lib/pipeline';
import { Icon } from '../components/Icon.jsx';
import ContractModal from './ContractModal.jsx';
import PickupCard from './PickupCard.jsx';

const STATUS_KEYS = { valid: 'doc_status_valid', review: 'doc_status_review', invalid: 'doc_status_invalid', unreadable: 'doc_status_unreadable' };
const BOARDING_KEYS = {
  pending: 'boarding_lbl_pending', confirmed: 'boarding_lbl_confirmed',
  missed: 'boarding_lbl_missed', no_response: 'boarding_lbl_no_response',
};

export default function Documents({ candidate, agencyUserId }) {
  const { t } = useLang();
  const docLabel = (k) => t(`doc_${k}`) || k;
  const statusInfo = (st) => {
    if (!st || !STATUS_KEYS[st]) return null;
    const colors = { valid: 'green', review: 'gold', invalid: 'red', unreadable: 'red' };
    return { t: t(STATUS_KEYS[st]), c: colors[st] };
  };
  const boardingLbl = (st) => (st && BOARDING_KEYS[st] ? t(BOARDING_KEYS[st]) : st);
  const [docs, setDocs] = useState(null);
  const [openId, setOpenId] = useState('');
  const [contractOpen, setContractOpen] = useState(false);
  const [contractAutoSend, setContractAutoSend] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [workStart, setWorkStart] = useState('');
  const [workEnd, setWorkEnd] = useState('');
  const [termPreset, setTermPreset] = useState('1y');
  const [flightDepart, setFlightDepart] = useState('');
  const [arriveYmd, setArriveYmd] = useState('');
  const [arriveTime, setArriveTime] = useState('');
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
  const [nowTick, setNowTick] = useState(Date.now());

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
    const [rows, st, row, con, fl] = await Promise.all([
      listDocuments(candidate.user_id),
      getCandidateStatus(candidate.user_id),
      getCandidate(candidate.user_id),
      getContract(candidate.user_id),
      getFlight(candidate.user_id),
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
    const parsed = parseArriveAt(fl?.arriveAt);
    setArriveYmd(parsed?.ymd || '');
    setArriveTime((parsed?.time || '').slice(0, 5));
    setBoardingStatus(st?.boarding_status || null);
    setFlightDepartOn(st?.flight_depart_on ? String(st.flight_depart_on).slice(0, 10) : '');
    setDocsDeadlineAt(st?.docs_deadline_at || null);
    setPayOk(!!con?.isPaid);
    setPayStatus(con?.paymentStatus || null);
    const pref = row?.data?.preferredStartDate || candidate?.data?.preferredStartDate || '';
    setPreferredStart(pref || '');
  };
  useEffect(() => { refresh(); }, [candidate.user_id]);

  useEffect(() => {
    const arriveStr = arriveYmd ? formatArriveAt(arriveYmd, arriveTime) : '';
    if (!arriveStr || !docs?.flight_ticket?.submitted_at) return undefined;
    if (msUntilArrival(arriveStr) <= 0) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [arriveYmd, arriveTime, docs?.flight_ticket?.submitted_at]);

  const isSubmitted = (k) => !!docs?.[k]?.submitted_at;
  const isUploaded = (k) => !!docs?.[k];
  const has = (k) => { const def = stepDefForKind(k); return def?.owner === 'agency' ? isSubmitted(k) : isSubmitted(k); };

  const view = async (k) => {
    const r = docs?.[k]; if (!r?.storage_path) return;
    try {
      setOpenId(k);
      const url = await getSignedUrl(r.storage_path);
      if (url) setViewer({ url, label: docLabel(k), path: r.storage_path, kind: k, mime: r.mime_type });
    } catch (e) { alert(e?.message || t('doc_upload_error')); }
    finally { setOpenId(''); }
  };

  const download = async (k) => {
    const r = docs?.[k] || (viewer?.kind === k ? { storage_path: viewer.path, mime_type: viewer.mime } : null);
    if (!r?.storage_path && !viewer?.url) return;
    try {
      const url = r?.storage_path ? await getSignedUrl(r.storage_path) : viewer.url;
      const res = await fetch(url);
      if (!res.ok) throw new Error('download_failed');
      const blob = await res.blob();
      const mime = r?.mime_type || viewer?.mime || blob.type || '';
      const path = r?.storage_path || viewer?.path || '';
      const isPdf = mime.includes('pdf') || path.toLowerCase().endsWith('.pdf');
      const ext = isPdf ? 'pdf' : (mime.includes('png') ? 'png' : 'jpg');
      const name = `${(docLabel(k) || k || 'belge').replace(/[^\w\-çğıöşüÇĞİÖŞÜ ]+/gi, '')}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) {
      alert(e?.message || t('doc_upload_error'));
    }
  };
  const reupload = async (k) => {
    if (!confirm(t('reupload_confirm') || '')) return;
    try { await requestReupload(candidate.user_id, k); await refresh(); } catch (e) { alert(e?.message || t('doc_upload_error')); }
  };

  const retractErrMsg = (e) => {
    const msg = String(e?.message || e?.code || '');
    if (msg.includes('already_hired')) return t('agency_retract_blocked_hired') || msg;
    if (msg.includes('flight_already_sent') || msg.includes('in_transit')) return t('agency_retract_blocked_flight') || msg;
    return e?.message || 'Hata';
  };

  const retractAgency = async (k) => {
    const ok = confirm(
      k === 'flight_ticket'
        ? (t('agency_retract_flight_confirm') || '')
        : (t('agency_retract_contract_confirm') || ''),
    );
    if (!ok) return;
    try {
      await retractAgencyDoc(candidate.user_id, k);
      notifyDocument(candidate.user_id, 'agency_doc_retracted');
      await refresh();
    } catch (e) {
      alert(retractErrMsg(e));
    }
  };

  const replaceFlight = () => {
    if (!confirm(t('agency_replace_flight_confirm') || '')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const isPdf = file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) { alert(t('doc_pdf_only') || 'Yalnız PDF'); return; }
      try {
        const reader = new FileReader();
        const base64 = await new Promise((resolve, reject) => {
          reader.onload = () => {
            const s = String(reader.result || '');
            const i = s.indexOf(',');
            resolve(i >= 0 ? s.slice(i + 1) : s);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await replaceSubmittedDocument(candidate.user_id, 'flight_ticket', base64, 'application/pdf');
        notifyDocument(candidate.user_id, 'flight_ticket_updated');
        await refresh();
      } catch (e) {
        alert(e?.message || t('doc_upload_error'));
      }
    };
    input.click();
  };
  const send = async (k) => {
    if (k === 'flight_ticket' && !workStart) {
      alert(t('work_start_required_before_send') || 'Uçak biletini göndermeden önce işe başlama tarihini girin.');
      setFlightModal('edit');
      return;
    }
    if (k === 'flight_ticket' && (!arriveYmd || !arriveTime)) {
      alert(t('flight_arrive_required_before_send'));
      setFlightModal('edit');
      return;
    }
    if (!confirm(`${docLabel(k)} — ${t('docs_send') || ''}?`)) return;
    try {
      await submitDocuments(candidate.user_id, [k]);
      notifyDocument(candidate.user_id, k);
      await refresh();
    } catch (e) {
      if (String(e?.message || '').includes('work_start_required')) {
        alert(t('work_start_required_before_send'));
        setFlightModal('edit');
      } else alert(e?.message || t('doc_upload_error'));
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
    if (!arriveYmd || !arriveTime) {
      alert(t('flight_arrive_required'));
      setFlightModal('upload');
      return;
    }
    const isPdf = file.type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) { alert(t('doc_pdf_only')); return; }
    setPendingFile(file);
    setFlightModal('upload');
  };

  const pickFlightPdf = () => {
    if (!arriveYmd || !arriveTime) { alert(t('flight_arrive_required')); return; }
    if (!workStart || !flightDepart) { alert(t('work_start_required_before_send') || t('work_start_required')); return; }
    if (!workEnd) { alert(t('work_end_label')); return; }
    flightInput.current?.click();
  };

  const confirmFlightModal = async () => {
    if (!arriveYmd || !arriveTime) { alert(t('flight_arrive_required')); return; }
    if (!workStart || !flightDepart) { alert(t('work_start_required_before_send') || t('work_start_required')); return; }
    if (!workEnd) { alert(t('work_end_label')); return; }
    if (workEnd <= workStart) { alert(t('work_end_label')); return; }
    try {
      await setWorkStartAt(candidate.user_id, workStart, flightDepart, workEnd);
      await saveArrival(candidate.user_id, formatArriveAt(arriveYmd, (arriveTime || '').slice(0, 5)), agencyUserId);
      if (flightModal === 'upload') {
        const file = pendingFile;
        if (!file) {
          pickFlightPdf();
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
          } catch (e2) { alert(e2?.message || t('doc_upload_error')); }
        };
        reader.readAsDataURL(file);
        return;
      }
      setFlightModal(null);
      await refresh();
    } catch (e) { alert(e?.message || t('doc_upload_error')); }
  };

  const removeAgency = async (k) => {
    if (!confirm(`${t('photo_remove') || ''}?`)) return;
    try { await removeDocument(candidate.user_id, k); await refresh(); } catch (e) { alert(e?.message || t('doc_upload_error')); }
  };

  if (docs === null) return <div className="center pad"><div className="spinner" /></div>;

  return (
    <div className="docs">
      <div className="docsOpsBar">
        {payStatus != null || payOk ? (
          <div className={`docsOpsChip ${payOk ? 'ok' : 'warn'}`}>
            {payOk ? t('web_contract_open_chat') : (t('web_contract_pay_wait') || payStatus)}
          </div>
        ) : null}
        {docsDeadlineAt ? (
          <div className={`docsOpsChip ${new Date(docsDeadlineAt).getTime() < Date.now() ? 'hot' : ''}`}>
            SLA: {new Date(docsDeadlineAt).toLocaleDateString('tr-TR')}
          </div>
        ) : null}
        {boardingStatus ? (
          <div className={`docsOpsChip ${boardingStatus === 'confirmed' ? 'ok' : boardingStatus === 'missed' ? 'hot' : 'warn'}`}>
            {boardingLbl(boardingStatus)}
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
              <span className={`ownerChip ${mine ? 'agency' : 'cand'}`}>{mine ? (t('doc_owner_agency') || '—') : (t('doc_owner_candidate') || '—')}</span>
            </div>
            <div className="docRows">
              {s.kinds.map((k) => {
                if (k === 'contract_signed') return null;
                const r = docs[k];
                const kst = kindState(k, has);
                const st = r?.status && statusInfo(r.status);
                const exists = !!r?.storage_path;
                const draft = mine && isUploaded(k) && !isSubmitted(k);

                if (k === 'contract_unsigned') {
                  const locked = kst === 'locked';
                  return (
                    <div key={k} className="docRow">
                      <span className={`docBullet ${isSubmitted(k) ? 'on' : ''}`}>{isSubmitted(k) ? '✓' : '•'}</span>
                      <span className="docName">{docLabel(k)}</span>
                      {draft ? <span className="badge gold">{t('doc_draft')}</span> : null}
                      <span className="docSpacer" />
                      {locked ? <span className="docWait">{t('web_docs_wait_pkg')}</span> : isSubmitted(k) ? (
                        <>
                          <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> {t('doc_view') || 'Görüntüle'}</button>
                          <button className="docView" type="button" onClick={() => download(k)}>{t('doc_download') || 'İndir'}</button>
                          <button className="docView" type="button" style={{ color: '#a32d2d' }} onClick={() => retractAgency(k)}>
                            {t('agency_retract_btn') || 'Geri al'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="docView" onClick={() => { setContractAutoSend(false); setContractOpen(true); }}>
                            {t('doc_view')}
                          </button>
                          <button
                            className="sendBtn"
                            onClick={() => {
                              if (!window.confirm(t('contract_send_confirm') || '')) return;
                              setContractAutoSend(true);
                              setContractOpen(true);
                            }}
                          >
                            Gönder →
                          </button>
                        </>
                      )}
                    </div>
                  );
                }

                if (k === 'work_permit' && preferredStart) {
                  return (
                    <div key={k} className="docRow" style={{ flexWrap: 'wrap' }}>
                      <span className={`docBullet ${kst === 'done' ? 'on' : ''}`}>{kst === 'done' ? '✓' : '•'}</span>
                      <span className="docName">{docLabel(k)}</span>
                      <span className="badge teal">{t('start_date_agency') || 'En erken başlangıç'}: {preferredStart}</span>
                      <span className="docSpacer" />
                      {exists ? (
                        <>
                          <button className="docView" onClick={() => view(k)} disabled={openId === k}><Icon name="search" size={14} /> {t('doc_view') || 'Görüntüle'}</button>
                          <button className="docView" type="button" onClick={() => download(k)}>{t('doc_download') || 'İndir'}</button>
                        </>
                      ) : kst === 'locked' ? <span className="docLock">🔒</span> : <span className="docWait">{t('web_docs_waiting')}</span>}
                      {exists ? <button className="docReupload" onClick={() => reupload(k)} title={t('reupload_btn')}>↻</button> : null}
                    </div>
                  );
                }

                if (k === 'flight_ticket') {
                  const locked = kst === 'locked';
                  return (
                    <div key={k} className="docRow" style={{ flexWrap: 'wrap' }}>
                      <span className={`docBullet ${isSubmitted(k) ? 'on' : ''}`}>{isSubmitted(k) ? '✓' : '•'}</span>
                      <span className="docName">{docLabel(k)}</span>
                      {draft ? <span className="badge gold">{t('doc_draft')}</span> : null}
                      {preferredStart ? <span className="badge gold">{t('start_date_agency') || 'Aday tercihi'}: {preferredStart}</span> : null}
                      {workStart ? <span className="badge teal">{t('work_start_label')}: {workStart}</span> : null}
                      {arriveYmd ? <span className="badge gold">{t('flight_arrive_label')}: {formatArriveAt(arriveYmd, arriveTime) || arriveYmd}</span> : null}
                      {workEnd ? <span className="badge">{t('work_end_label')}: {workEnd}</span> : null}
                      <span className="docSpacer" />
                      {locked ? <span className="docWait">{t('web_docs_wait_turn')}</span> : isSubmitted(k) ? (
                        <>
                          <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> {t('doc_view') || 'Görüntüle'}</button>
                          <button className="docView" type="button" onClick={() => download(k)}>{t('doc_download') || 'İndir'}</button>
                          <button className="docView" type="button" onClick={() => setFlightModal('edit')}>{t('web_docs_edit_dates')}</button>
                          <button className="docView" type="button" onClick={replaceFlight}>{t('flight_change_ticket') || 'Bileti Değiştir'}</button>
                          <button className="docView" type="button" style={{ color: '#a32d2d' }} onClick={() => retractAgency(k)}>
                            {t('agency_retract_btn') || 'Geri al'}
                          </button>
                        </>
                      ) : (
                        <>
                          {exists ? (
                            <>
                              <button className="docView" onClick={() => view(k)}><Icon name="search" size={14} /> {t('doc_view') || 'Görüntüle'}</button>
                              <button className="docView" type="button" onClick={() => download(k)}>{t('doc_download') || 'İndir'}</button>
                            </>
                          ) : null}
                          <button className="docView" type="button" onClick={openFlightUpload}>{exists ? t('flight_change_ticket') : t('doc_upload')}</button>
                          {draft ? <button className="sendBtn" onClick={() => send(k)}>{t('docs_send')} →</button> : null}
                        </>
                      )}
                      <input ref={flightInput} type="file" accept="application/pdf,.pdf" hidden onChange={onFlightFile} />
                    </div>
                  );
                }

                return (
                  <div key={k} className="docRow">
                    <span className={`docBullet ${kst === 'done' ? 'on' : ''}`}>{kst === 'done' ? '✓' : '•'}</span>
                    <span className="docName">{docLabel(k) || t(`doc_${k}`) || k}</span>
                    {st ? <span className={`badge ${st.c}`}>{st.t}</span> : null}
                    <span className="docSpacer" />
                    {exists ? (
                      <>
                        <button className="docView" onClick={() => view(k)} disabled={openId === k}><Icon name="search" size={14} /> {t('doc_view') || 'Görüntüle'}</button>
                        <button className="docView" type="button" onClick={() => download(k)}>{t('doc_download') || 'İndir'}</button>
                      </>
                    ) : kst === 'locked' ? <span className="docLock">🔒</span> : <span className="docWait">{t('web_docs_waiting')}</span>}
                    {exists ? <button className="docReupload" onClick={() => reupload(k)} title={t('reupload_btn')}>↻</button> : null}
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
          <span className="ownerChip agency">{t('doc_owner_agency')}</span>
        </div>
        {isSubmitted('flight_ticket') ? (
          <>
            {(() => {
              const arriveStr = arriveYmd ? formatArriveAt(arriveYmd, arriveTime) : '';
              const left = arriveStr ? msUntilArrival(arriveStr, nowTick) : 0;
              return left > 0 ? (
                <div className="transitCountdown">
                  <strong>⏱ {t('arrive_countdown_title')}: {formatCountdown(left)}</strong>
                  <p>{t('arrive_countdown_sub_ag')}</p>
                </div>
              ) : null;
            })()}
            <PickupCard embedded userId={candidate.user_id} agencyId={agencyUserId} />
          </>
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
              <span className="docName">{t('doc_success_certificate') || docLabel('success_certificate')}</span>
              <span className="docSpacer" />
              <button className="docView" onClick={() => view('success_certificate')} disabled={openId === 'success_certificate'}>
                <Icon name="search" size={14} /> {t('doc_view') || 'Görüntüle'}
              </button>
              <button className="docView" type="button" onClick={() => download('success_certificate')}>
                {t('doc_download') || 'İndir'}
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
            <h3 style={{ marginTop: 0 }}>{flightModal === 'edit' ? t('work_start_edit_title') : t('flight_ticket_sheet_title')}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.45 }}>
              {t('work_start_hint')}
            </p>
            <div className="flightArriveNote">
              <span className="flightArriveKicker">{t('flight_arrive_kicker')}</span>
              <strong>{t('flight_arrive_notice_title')}</strong>
              <p>{t('flight_arrive_notice')}</p>
            </div>
            <label className="flightFieldLabel">{t('flight_arrive_label')} *</label>
            <input
              type="date"
              className={`input ${arriveYmd ? '' : 'inputNeed'}`}
              value={arriveYmd}
              onChange={(e) => setArriveYmd(e.target.value)}
              required
            />
            <label className="flightFieldLabel">{t('flight_arrive_time_label')} *</label>
            <input
              type="time"
              className={`input ${arriveTime ? '' : 'inputNeed'}`}
              value={arriveTime}
              onChange={(e) => setArriveTime((e.target.value || '').slice(0, 5))}
              required
            />
            {preferredStart ? (
              <p className="flightPrefHint">
                {t('start_date_agency') || 'Adayın tercih ettiği en erken başlangıç'}: {preferredStart}
              </p>
            ) : null}
            <label className="flightFieldLabel">{t('flight_depart_label')} *</label>
            <input
              type="date"
              className="input"
              value={flightDepart}
              onChange={(e) => setFlightDepart(e.target.value)}
              required
            />
            <label className="flightFieldLabel">{t('work_start_label')} *</label>
            <input
              type="date"
              className="input"
              value={workStart}
              onChange={(e) => onWorkStartChange(e.target.value)}
              required
            />
            <label className="flightFieldLabel">{t('work_term_label')} *</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[
                { id: '6m', label: t('web_term_6m') },
                { id: '1y', label: t('web_term_1y') },
                { id: 'custom', label: t('web_term_custom') },
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
            <label className="flightFieldLabel">{t('work_end_label')} *</label>
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
              <button type="button" className="ghostBtn" onClick={() => { setFlightModal(null); setPendingFile(null); }}>{t('agency_cancel')}</button>
              {flightModal === 'upload' && !pendingFile ? (
                <button type="button" className="buyPrimary" onClick={pickFlightPdf}>{t('web_pdf_pick')}</button>
              ) : (
                <button type="button" className="buyPrimary" onClick={confirmFlightModal}>
                  {flightModal === 'edit' ? (t('iv_save_time') || 'OK') : t('web_save_upload')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {contractOpen ? (
        <ContractModal
          candidate={{ ...candidate, agencyUserId }}
          autoSend={contractAutoSend}
          onClose={() => { setContractOpen(false); setContractAutoSend(false); }}
          onChanged={refresh}
        />
      ) : null}

      {viewer ? (
        <div className="docViewer" onClick={() => setViewer(null)}>
          <div className="docViewerCard" onClick={(e) => e.stopPropagation()}>
            <div className="docViewerHead">
              <strong>{viewer.label}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="docView" onClick={() => download(viewer.kind)}>{t('doc_download') || 'İndir'}</button>
                <button type="button" className="ghostBtn" onClick={() => setViewer(null)}>{t('close')}</button>
              </div>
            </div>
            <iframe title={viewer.label} src={viewer.url} style={{ width: '100%', height: '70vh', border: 0 }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
