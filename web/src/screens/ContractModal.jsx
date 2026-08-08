import { useEffect, useMemo, useState } from 'react';
import { getContract, saveContract, getCandidateContractFields, getMySignature, logContractSignature, getLatestContractSignature, uploadDocument, removeDocument } from '../lib/api';
import { buildAuditLine, sha256Hex } from '../lib/esign';
import { buildContractHtml } from '../../../cv/buildContractHtml';
import { withLatinName } from '../../../lib/translit';
import { candidateCode } from '../../../lib/candidateCode';
import { listEmployers, saveEmployer, touchEmployer, deleteEmployer, mergeEmployerIntoContract } from '../lib/employers';
import SignatureSetup from './SignatureSetup.jsx';

// İmzalı HTML -> A4 PDF (base64). Ekran stilleri atlanır (screen:false), html2pdf ile.
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
  ['title', 'İşveren unvanı *', true], ['address', 'İşyeri adresi *', true], ['phone', 'Telefon'], ['email', 'E-posta'],
  ['contactPhone', 'İletişim telefonu'], ['contactEmail', 'İletişim e-postası'],
  ['position', 'Pozisyon / görev *'], ['salary', 'Brüt ücret (TL)'], ['consulate', 'Konsolosluk / şehir'],
];

const EMPLOYER_FORM = [
  ['name', 'Liste adı *'], ['title', 'İşveren unvanı *'], ['address', 'İşyeri adresi *'],
  ['phone', 'Telefon'], ['email', 'E-posta'], ['contactPhone', 'İletişim telefonu'], ['contactEmail', 'İletişim e-postası'],
];

export default function ContractModal({ candidate, esigned, onClose, onChanged }) {
  const agencyId = candidate.agencyUserId;
  const [data, setData] = useState(candidate.data || {});
  const [contract, setContract] = useState(null);
  const [signature, setSignature] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [employerPickOpen, setEmployerPickOpen] = useState(false);
  const [employerFormOpen, setEmployerFormOpen] = useState(false);
  const [employers, setEmployers] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSaving, setEmpSaving] = useState(false);
  const [empF, setEmpF] = useState({});
  const [empEditId, setEmpEditId] = useState(null);
  const [sigOpen, setSigOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [f, setF] = useState({});
  const code = candidateCode(candidate.nationality, candidate.reg_no);

  useEffect(() => {
    (async () => {
      const [c, priv] = await Promise.all([getContract(candidate.user_id), getCandidateContractFields(candidate.user_id)]);
      setContract(c || {});
      setF(c || {});
      if (priv) setData((d) => ({ ...d, ...priv }));
      if (esigned) {
        const [mine, log] = await Promise.all([getMySignature(), getLatestContractSignature(candidate.user_id)]);
        if (mine && log) setSignature({ image: mine.image, name: mine.signerName, subtitle: mine.signerTitle, auditLine: buildAuditLine(log) });
      }
    })();
  }, [candidate.user_id, esigned]);

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

  const html = useMemo(() => buildContractHtml(withLatinName(data), contract || {}, signature ? { signature } : {}), [data, contract, signature]);
  const hasInfo = !!(contract?.title?.trim() && contract?.position?.trim());

  const openEdit = () => {
    if (hasInfo) { setF(contract || {}); setFormOpen(true); return; }
    setEmployerPickOpen(true);
  };

  const pickEmployer = async (employer) => {
    await touchEmployer(agencyId, employer.id);
    const merged = mergeEmployerIntoContract(contract, employer);
    setContract(merged);
    setF(merged);
    setEmployerPickOpen(false);
    setFormOpen(true);
  };

  const openNewEmployer = () => {
    setEmpEditId(null);
    setEmpF({});
    setEmployerFormOpen(true);
  };

  const openEditEmployer = (e) => {
    setEmpEditId(e.id);
    setEmpF({
      name: e.name || '',
      title: e.title || '',
      address: e.address || '',
      phone: e.phone || '',
      email: e.email || '',
      contactPhone: e.contactPhone || '',
      contactEmail: e.contactEmail || '',
    });
    setEmployerFormOpen(true);
  };

  const removeEmployer = async (e) => {
    if (!confirm(`"${e.name}" listeden silinsin mi? Bu işlem geri alınamaz.`)) return;
    try {
      await deleteEmployer(agencyId, e.id);
      await refreshEmployers();
    } catch (err) { alert(err?.message || 'Hata'); }
  };

  const saveEmployerForm = async () => {
    if (!empF.name?.trim() || !empF.title?.trim() || !empF.address?.trim()) return;
    setEmpSaving(true);
    try {
      const row = await saveEmployer(agencyId, empF, empEditId || undefined);
      const wasEdit = !!empEditId;
      setEmployerFormOpen(false);
      setEmpF({});
      setEmpEditId(null);
      await refreshEmployers();
      if (!wasEdit) await pickEmployer(row);
    } catch (e) { alert(e?.message || 'Hata'); }
    finally { setEmpSaving(false); }
  };

  const changeEmployerFromForm = () => {
    setFormOpen(false);
    setEmployerPickOpen(true);
  };
  const saveForm = async () => {
    const issueDate = contract?.issueDate || new Date().toLocaleDateString('tr-TR');
    const full = { ...f, issueDate };
    await saveContract(candidate.user_id, full, agencyId);
    setContract(full); setFormOpen(false);
  };

  const download = () => {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => { try { w.print(); } catch (_) {} }, 400);
  };

  const doSign = async () => {
    if (!hasInfo) { alert('Önce sözleşme bilgilerini doldurun.'); openEdit(); return; }
    const mine = await getMySignature();
    if (!mine) { alert('Önce imza & kaşenizi tanımlayın.'); setSigOpen(true); return; }
    if (!confirm('Sözleşme imza ve kaşenizle elektronik olarak imzalanacak. Onaylıyor musunuz?')) return;
    setSigning(true);
    try {
      const latin = withLatinName(data);
      const baseHtml = buildContractHtml(latin, contract, { screen: false });
      const docHash = (await sha256Hex(baseHtml)).slice(0, 16);
      const log = await logContractSignature({ candidateUserId: candidate.user_id, signerName: mine.signerName, signerTitle: mine.signerTitle, docNo: code, docHash });
      const sigInfo = { image: mine.image, name: mine.signerName, subtitle: mine.signerTitle, auditLine: buildAuditLine(log) };
      const signedHtml = buildContractHtml(latin, contract, { signature: sigInfo, screen: false });
      const base64 = await htmlToPdfBase64(signedHtml);
      await uploadDocument(candidate.user_id, 'contract_unsigned', base64, 'application/pdf');
      setSignature(sigInfo); onChanged?.();
      alert('Sözleşme e-imzalandı. "Gönder" ile adaya iletebilirsiniz.');
    } catch (e) { alert(e?.message || 'Hata'); } finally { setSigning(false); }
  };

  const cancelEsign = async () => {
    if (!confirm('E-imza kaldırılsın mı? Sözleşme imzasız hâle döner.')) return;
    setCanceling(true);
    try { await removeDocument(candidate.user_id, 'contract_unsigned'); setSignature(null); onChanged?.(); }
    catch (e) { alert(e?.message || 'Hata'); } finally { setCanceling(false); }
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modalCard contractCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalHead"><h3>Hizmet Sözleşmesi — {code}</h3><button className="modalX" onClick={onClose}>✕</button></div>

        {formOpen ? (
          <div className="modalBody cForm">
            <p className="fieldHint">Resmi sözleşme metni değişmez; yalnızca doldurulan alanlar güncellenir.</p>
            <button type="button" className="ghostBtn" style={{ marginBottom: 14 }} onClick={changeEmployerFromForm}>İşletmeyi değiştir</button>
            {FIELDS.map(([key, label, multi]) => (
              <div key={key} className="cField">
                <label className="fieldLbl">{label}</label>
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
              <button className="ghostBtn" onClick={() => { setF(contract || {}); setFormOpen(false); }}>Vazgeç</button>
              <button className="goldBtn sm" onClick={saveForm}>Kaydet</button>
            </>
          ) : (
            <>
              <button className="ghostBtn" onClick={openEdit}>✎ Bilgileri Düzenle</button>
              <button className="ghostBtn" onClick={download}>İndir / Yazdır</button>
              <div style={{ flex: 1 }} />
              {signature ? (
                <>
                  <span className="signedTag">✓ E-imzalandı</span>
                  <button className="ghostBtn" onClick={() => setSigOpen(true)}>İmza & Kaşe</button>
                  <button className="dangerBtn sm" onClick={cancelEsign} disabled={canceling}>{canceling ? '…' : 'E-imzayı İptal Et'}</button>
                </>
              ) : (
                <>
                  <button className="ghostBtn" onClick={() => setSigOpen(true)}>İmza & Kaşe</button>
                  <button className="goldBtn sm" onClick={doSign} disabled={signing}>{signing ? 'İmzalanıyor…' : '✍️ E-imza ile İmzala'}</button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {employerPickOpen ? (
        <div className="modalOverlay inner" onClick={() => setEmployerPickOpen(false)}>
          <div className="modalCard sm" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead"><h3>İşletme Seç</h3><button className="modalX" onClick={() => setEmployerPickOpen(false)}>✕</button></div>
            <div className="modalBody">
              <p className="fieldHint">İşveren bilgileri kayıtlı işletmeden dolar. Pozisyon ve ücreti aday için ayrıca girersiniz.</p>
              {empLoading ? <div className="center pad"><div className="spinner" /></div> : (
                <div className="employerList">
                  {employers.map((e) => (
                    <div key={e.id} className="employerCard">
                      <button type="button" className="employerCardMain" onClick={() => pickEmployer(e)}>
                        <strong>{e.name}</strong>
                        {e.title ? <span>{e.title}</span> : null}
                        <em>Bu işletmeyi kullan</em>
                      </button>
                      <div className="employerCardActions">
                        <button type="button" onClick={() => openEditEmployer(e)}>Düzenle</button>
                        <button type="button" className="danger" onClick={() => removeEmployer(e)}>Sil</button>
                      </div>
                    </div>
                  ))}
                  {employers.length === 0 ? <p className="fieldHint">Henüz kayıtlı işletme yok.</p> : null}
                  <button type="button" className="ghostBtn full" onClick={openNewEmployer}>+ Yeni işletme ekle</button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {employerFormOpen ? (
        <div className="modalOverlay inner" onClick={() => setEmployerFormOpen(false)}>
          <div className="modalCard sm" onClick={(e) => e.stopPropagation()}>
            <div className="modalHead"><h3>{empEditId ? 'İşletmeyi Düzenle' : 'İşletme Kaydet'}</h3><button className="modalX" onClick={() => { setEmployerFormOpen(false); setEmpEditId(null); }}>✕</button></div>
            <div className="modalBody cForm">
              <p className="fieldHint">Bu bilgiler tekrar kullanılır; resmi sözleşme metni değişmez.</p>
              {EMPLOYER_FORM.map(([key, label]) => (
                <div key={key} className="cField">
                  <label className="fieldLbl">{label}</label>
                  {['title', 'address'].includes(key)
                    ? <textarea className="input" rows={2} value={empF[key] || ''} onChange={(e) => setEmpF((p) => ({ ...p, [key]: e.target.value }))} />
                    : <input className="input" value={empF[key] || ''} onChange={(e) => setEmpF((p) => ({ ...p, [key]: e.target.value }))} />}
                </div>
              ))}
            </div>
            <div className="modalFoot">
              <button className="ghostBtn" onClick={() => setEmployerFormOpen(false)}>Vazgeç</button>
              <button className="goldBtn sm" onClick={saveEmployerForm} disabled={empSaving || !empF.name?.trim() || !empF.title?.trim() || !empF.address?.trim()}>
                {empSaving ? '…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sigOpen ? <SignatureSetup onClose={() => setSigOpen(false)} onSaved={() => {}} /> : null}
    </div>
  );
}
