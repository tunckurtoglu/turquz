import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getContract, saveContract, getCandidateContractFields, uploadDocument,
  logContractSignature, submitDocuments, notifyDocument,
} from '../lib/api';
import { buildAuditLine, sha256Hex } from '../lib/esign';
import { buildContractHtml } from '../../../cv/buildContractHtml';
import { withLatinName } from '../../../lib/translit';
import { candidateCode } from '../../../lib/candidateCode';
import {
  listEmployers, saveEmployer, touchEmployer, deleteEmployer, mergeEmployerIntoContract,
  getEmployer, employerStampInfo, employerReadyForContract, employerContractBlockReason,
} from '../lib/employers';
import StampSetup from './StampSetup.jsx';
import { stampMakeTransparentSafe } from '../lib/stampProcess';
import { useLang } from '../i18n.jsx';

async function htmlToPdfBase64(html) {
  const html2pdf = (await import('html2pdf.js')).default;
  const styleM = html.match(/<style>([\s\S]*?)<\/style>/);
  const bodyM = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  el.innerHTML = `<style>${styleM ? styleM[1] : ''}</style>${bodyM ? bodyM[1] : html}`;
  document.body.appendChild(el);
  try {
    const blob = await html2pdf().set({
      margin: 0, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#fff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] },
    }).from(el).outputPdf('blob');
    const buf = await blob.arrayBuffer(); const arr = new Uint8Array(buf);
    let bin = ''; for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  } finally { document.body.removeChild(el); }
}

const FIELDS = [
  ['title', 'contract_f_title', true], ['address', 'contract_f_address', true],
  ['phone', 'contract_f_phone'], ['email', 'contract_f_email'],
  ['contactPhone', 'contract_f_contact_phone'], ['contactEmail', 'contract_f_contact_email'],
  ['position', 'contract_f_position'], ['salary', 'contract_f_salary'], ['consulate', 'contract_f_consulate'],
];

const EMPLOYER_FORM = [
  ['name', 'employer_f_name'], ['title', 'contract_f_title'], ['address', 'contract_f_address'],
  ['phone', 'contract_f_phone'], ['email', 'contract_f_email'],
  ['contactPhone', 'contract_f_contact_phone'], ['contactEmail', 'contract_f_contact_email'],
];

const REQ_CONTRACT = new Set(['title', 'address', 'position']);
const REQ_EMPLOYER = new Set(['name', 'title', 'address']);

export default function ContractModal({ candidate, onClose, onChanged, autoSend = false }) {
  const { t } = useLang();
  const agencyId = candidate.agencyUserId;
  const [data, setData] = useState(candidate.data || {});
  const [contract, setContract] = useState(null);
  const [stamp, setStamp] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [employerPickOpen, setEmployerPickOpen] = useState(false);
  const [employerFormOpen, setEmployerFormOpen] = useState(false);
  const [employers, setEmployers] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [empF, setEmpF] = useState({});
  const [empEditId, setEmpEditId] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [stampOpen, setStampOpen] = useState(null); // employer object or null
  const [f, setF] = useState({});
  const code = candidateCode(candidate.nationality, candidate.reg_no);
  const autoSendTried = useRef(false);

  const blockMsg = (reason) => (
    reason === 'tax' ? t('employer_need_tax')
      : reason === 'stamp' ? t('employer_need_stamp')
        : t('employer_need_both')
  );

  const reloadStamp = async (employerId = contract?.employerId) => {
    if (!agencyId || !employerId) { setStamp(null); return; }
    const emp = await getEmployer(agencyId, employerId);
    setStamp(employerStampInfo(emp));
  };

  useEffect(() => {
    (async () => {
      const [c, priv] = await Promise.all([getContract(candidate.user_id), getCandidateContractFields(candidate.user_id)]);
      setContract(c || {});
      setF(c || {});
      if (priv) setData((d) => ({ ...d, ...priv }));
      if (c?.employerId) await reloadStamp(c.employerId);
    })();
  }, [candidate.user_id]);

  const refreshEmployers = async () => {
    if (!agencyId) return;
    setEmpLoading(true);
    try { setEmployers(await listEmployers(agencyId)); }
    catch (e) { console.warn(e); }
    finally { setEmpLoading(false); }
  };

  useEffect(() => {
    if (employerPickOpen) refreshEmployers();
  }, [employerPickOpen, agencyId]);

  const html = useMemo(
    () => buildContractHtml(withLatinName(data), contract || {}, stamp?.image ? { signature: stamp } : {}),
    [data, contract, stamp],
  );
  const hasInfo = !!(contract?.title?.trim() && contract?.position?.trim());

  const openEdit = () => {
    if (hasInfo) { setF(contract || {}); setFormOpen(true); return; }
    setEmployerPickOpen(true);
  };

  const pickEmployer = async (employer) => {
    const reason = employerContractBlockReason(employer);
    if (reason || !employerReadyForContract(employer)) {
      alert(blockMsg(reason));
      return;
    }
    await touchEmployer(agencyId, employer.id);
    const merged = mergeEmployerIntoContract(contract, employer);
    setContract(merged);
    setF(merged);
    setStamp(employerStampInfo(employer));
    setEmployerPickOpen(false);
    setFormOpen(true);
  };

  const openNewEmployer = () => {
    setEmpEditId(null);
    setEmpF({ name: '', title: '', address: '', phone: '', email: '', contactPhone: '', contactEmail: '' });
    setEmployerFormOpen(true);
  };

  const openEditEmployer = (e) => {
    setEmpEditId(e.id);
    setEmpF({
      name: e.name || '', title: e.title || '', address: e.address || '',
      phone: e.phone || '', email: e.email || '',
      contactPhone: e.contact_phone || '', contactEmail: e.contact_email || '',
    });
    setEmployerFormOpen(true);
  };

  const saveEmployerForm = async () => {
    if (!empF.name?.trim() || !empF.title?.trim() || !empF.address?.trim()) return;
    setEmpSaving(true);
    try {
      await saveEmployer(agencyId, {
        id: empEditId || undefined,
        name: empF.name, title: empF.title, address: empF.address,
        phone: empF.phone, email: empF.email,
        contact_phone: empF.contactPhone, contact_email: empF.contactEmail,
      });
      setEmployerFormOpen(false);
      setEmpEditId(null);
      await refreshEmployers();
    } catch (e) {
      alert(e?.message || t('err_title'));
    } finally {
      setEmpSaving(false);
    }
  };

  const removeEmployer = async (e) => {
    if (!confirm(t('employer_delete_confirm', { name: e.name || '' }))) return;
    try {
      await deleteEmployer(agencyId, e.id);
      await refreshEmployers();
    } catch (err) {
      alert(err?.message || t('err_title'));
    }
  };

  const changeEmployerFromForm = () => {
    setFormOpen(false);
    setEmployerPickOpen(true);
  };

  const saveForm = async () => {
    if (!f.title?.trim() || !f.position?.trim() || !f.address?.trim()) {
      alert(t('contract_required'));
      return;
    }
    const issueDate = contract?.issueDate || new Date().toLocaleDateString('tr-TR');
    const full = { ...f, issueDate, employerId: f.employerId || contract?.employerId || null };
    await saveContract(candidate.user_id, full, agencyId);
    setContract(full); setFormOpen(false);
  };

  const download = () => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
  };

  const sendStamped = async (skipConfirm = false) => {
    if (!hasInfo) { alert(t('contract_need_info')); openEdit(); return; }
    if (!contract?.employerId) { alert(t('stamp_need_employer')); setEmployerPickOpen(true); return; }
    const emp = await getEmployer(agencyId, contract.employerId);
    const reason = employerContractBlockReason(emp);
    if (reason || !employerReadyForContract(emp)) {
      alert(blockMsg(reason));
      return;
    }
    if (!stamp?.image) {
      alert(t('employer_need_stamp'));
      setStampOpen(emp || { id: contract.employerId, name: contract.title || '' });
      return;
    }
    if (!skipConfirm && !window.confirm(t('contract_send_confirm'))) return;
    setPreparing(true);
    try {
      const latin = withLatinName(data);
      const baseHtml = buildContractHtml(latin, contract, { screen: false });
      const docHash = (await sha256Hex(baseHtml)).slice(0, 16);
      const log = await logContractSignature({
        candidateUserId: candidate.user_id,
        signerName: stamp.name,
        signerTitle: stamp.subtitle,
        docNo: code,
        docHash,
      });
      const cleanedImage = await stampMakeTransparentSafe(stamp.image);
      const sigInfo = { ...stamp, image: cleanedImage, auditLine: buildAuditLine(log) };
      const stampedHtml = buildContractHtml(latin, contract, { signature: sigInfo, screen: false });
      const base64 = await htmlToPdfBase64(stampedHtml);
      await uploadDocument(candidate.user_id, 'contract_unsigned', base64, 'application/pdf');
      await submitDocuments(candidate.user_id, ['contract_unsigned']);
      notifyDocument(candidate.user_id, 'contract_unsigned');
      onChanged?.();
      onClose?.();
    } catch (e) {
      alert(e?.message || t('agency_notice_err'));
    } finally {
      setPreparing(false);
    }
  };

  useEffect(() => {
    if (!autoSend || autoSendTried.current || formOpen || contract === null) return;
    if (!hasInfo || !stamp?.image) return;
    autoSendTried.current = true;
    sendStamped(true);
  }, [autoSend, formOpen, contract, hasInfo, stamp?.image]);

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard contractCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead"><h3>{t('contract_title')} — {code}</h3><button className="modalX" onClick={onClose}>✕</button></div>

        {formOpen ? (
          <div className="modalBody cForm">
            <p className="fieldHint">{t('contract_fields_hint')}</p>
            <button type="button" className="ghostBtn" style={{ marginBottom: 14 }} onClick={changeEmployerFromForm}>{t('employer_reselect')}</button>
            {FIELDS.map(([key, labelKey, multi]) => (
              <div key={key} className="cField">
                <label className="fieldLbl">{t(labelKey)}{REQ_CONTRACT.has(key) ? ' *' : ''}</label>
                {multi
                  ? <textarea className="input" rows={2} value={f[key] || ''} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />
                  : <input className="input" value={f[key] || ''} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />}
              </div>
            ))}
          </div>
        ) : contract === null ? (
          <div className="center pad"><div className="spinner" /></div>
        ) : (
          <div className="contractPreviewWrap">
            <iframe title="contract" className="contractFrame" srcDoc={html} />
          </div>
        )}

        <div className="modalFoot wrap">
          {formOpen ? (
            <>
              <button className="ghostBtn" onClick={() => { setF(contract || {}); setFormOpen(false); }}>{t('intro_video_cancel')}</button>
              <button className="goldBtn sm" onClick={saveForm}>{t('save')}</button>
            </>
          ) : (
            <>
              <button className="ghostBtn" onClick={openEdit}>✎ {t('contract_edit_info')}</button>
              <button
                className="ghostBtn"
                type="button"
                onClick={async () => {
                  if (!contract?.employerId) { alert(t('stamp_need_employer')); setEmployerPickOpen(true); return; }
                  const emp = await getEmployer(agencyId, contract.employerId);
                  setStampOpen(emp || { id: contract.employerId, name: contract.title || '' });
                }}
              >
                {stamp?.image ? t('stamp_change') : t('stamp_menu')}
              </button>
              <div style={{ flex: 1 }} />
              <button className="ghostBtn" type="button" onClick={download}>{t('contract_download')}</button>
              <button className="goldBtn sm" type="button" onClick={onClose}>{t('done')}</button>
            </>
          )}
        </div>
        {!formOpen ? (
          <p className="fieldHint" style={{ padding: '0 16px 14px', margin: 0 }}>
            {stamp?.image
              ? t('stamp_contract_preview_hint')
              : t('stamp_contract_need_hint')}
          </p>
        ) : null}
      </div>

      {employerPickOpen ? (
        <div className="modalOverlay inner" onClick={() => setEmployerPickOpen(false)}>
          <div className="modalCard sm" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead"><h3>{t('employer_pick_title')}</h3><button className="modalX" onClick={() => setEmployerPickOpen(false)}>✕</button></div>
            <div className="modalBody">
              <p className="fieldHint">{t('employer_pick_sub')}</p>
              {empLoading ? <div className="center pad"><div className="spinner" /></div> : (
                <div className="employerList">
                  {employers.map((e) => (
                    <div key={e.id} className="employerCard">
                      <button type="button" className="employerCardMain" onClick={() => pickEmployer(e)}>
                        <strong>{e.name}</strong>
                        {e.title ? <span>{e.title}</span> : null}
                        <em>
                          {e.hasTaxPlate ? `✓ ${t('hotels_badge_tax')}` : `· ${t('hotels_badge_no_tax')}`}
                          {' · '}
                          {e.hasStamp ? `✓ ${t('hotels_badge_stamp')}` : `· ${t('hotels_badge_no_stamp')}`}
                          {' — '}
                          {employerReadyForContract(e) ? t('employer_use') : t('employer_not_ready')}
                        </em>
                      </button>
                      <div className="employerCardActions">
                        <button type="button" onClick={() => openEditEmployer(e)}>{t('employer_edit')}</button>
                        <button type="button" onClick={() => setStampOpen(e)}>{t('hotels_badge_stamp')}</button>
                        <button type="button" className="danger" onClick={() => removeEmployer(e)}>{t('employer_delete')}</button>
                      </div>
                    </div>
                  ))}
                  {employers.length === 0 ? <p className="fieldHint">{t('employer_pick_empty')}</p> : null}
                  <button type="button" className="ghostBtn full" onClick={openNewEmployer}>+ {t('employer_add_new')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {employerFormOpen ? (
        <div className="modalOverlay inner" onClick={() => setEmployerFormOpen(false)}>
          <div className="modalCard sm" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <h3>{empEditId ? t('employer_form_edit_title') : t('employer_form_title')}</h3>
              <button className="modalX" onClick={() => { setEmployerFormOpen(false); setEmpEditId(null); }}>✕</button>
            </div>
            <div className="modalBody cForm">
              <p className="fieldHint">{t('employer_form_hint')}</p>
              {EMPLOYER_FORM.map(([key, labelKey]) => (
                <div key={key} className="cField">
                  <label className="fieldLbl">{t(labelKey)}{REQ_EMPLOYER.has(key) ? ' *' : ''}</label>
                  {['title', 'address'].includes(key)
                    ? <textarea className="input" rows={2} value={empF[key] || ''} onChange={(e) => setEmpF((p) => ({ ...p, [key]: e.target.value }))} />
                    : <input className="input" value={empF[key] || ''} onChange={(e) => setEmpF((p) => ({ ...p, [key]: e.target.value }))} />}
                </div>
              ))}
            </div>
            <div className="modalFoot">
              <button className="ghostBtn" onClick={() => setEmployerFormOpen(false)}>{t('intro_video_cancel')}</button>
              <button className="goldBtn sm" onClick={saveEmployerForm} disabled={empSaving || !empF.name?.trim() || !empF.title?.trim() || !empF.address?.trim()}>
                {empSaving ? '…' : t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stampOpen ? (
        <StampSetup
          agencyId={agencyId}
          employer={stampOpen}
          onClose={() => setStampOpen(null)}
          onSaved={async (row) => {
            setStamp(employerStampInfo(row));
            setStampOpen(null);
            await refreshEmployers();
          }}
        />
      ) : null}
    </div>
  );
}
