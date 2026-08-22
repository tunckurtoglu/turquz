// web/src/screens/Hotels.jsx — Otellerim: vergi levhası + kaşe + sözleşme bilgileri.
import { useEffect, useRef, useState } from 'react';
import {
  listEmployers, saveEmployer, deleteEmployer, getEmployer,
  uploadEmployerTaxPlate, getEmployerTaxPlateUrl, parseEmployerTaxPlate,
} from '../lib/employers';
import StampSetup from './StampSetup.jsx';
import { useLang } from '../i18n.jsx';

function fileToB64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function Hotels({ agencyId }) {
  const { t } = useLang();
  const taxRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [stampOpen, setStampOpen] = useState(null);
  const [err, setErr] = useState('');

  const refresh = async () => {
    setLoading(true);
    try { setRows(await listEmployers(agencyId)); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (agencyId) refresh(); }, [agencyId]);

  const open = async (row) => {
    const fresh = (await getEmployer(agencyId, row.id)) || row;
    setSel(fresh);
    setF({ ...fresh });
    setErr('');
  };

  const back = () => { setSel(null); setF({}); refresh(); };

  const save = async () => {
    if (!sel?.id) return;
    if (!f.name?.trim() || !f.title?.trim() || !f.address?.trim()) {
      setErr(t('employer_fields_required'));
      return;
    }
    setBusy(true); setErr('');
    try {
      const row = await saveEmployer(agencyId, f, sel.id);
      setSel(row); setF(row);
    } catch (e) { setErr(e?.message || t('agency_setup_err_save')); }
    finally { setBusy(false); }
  };

  const add = async () => {
    setBusy(true);
    try {
      const row = await saveEmployer(agencyId, { name: t('hotels_new_name'), title: t('hotels_new_name'), address: '—' });
      await open(row);
    } catch (e) { setErr(e?.message || t('err_title')); }
    finally { setBusy(false); }
  };

  const remove = async (row = sel) => {
    if (!row?.id) return;
    if (!window.confirm(t('employer_delete_confirm', { name: row.name || '' }))) return;
    setBusy(true); setErr('');
    try {
      await deleteEmployer(agencyId, row.id);
      if (sel?.id === row.id) { setSel(null); setF({}); }
      await refresh();
    } catch (e) {
      setErr(e?.message === 'delete_failed' ? t('employer_delete_fail') : (e?.message || t('err_title')));
      if (!sel) window.alert(e?.message === 'delete_failed' ? t('employer_delete_fail') : (e?.message || t('err_title')));
    } finally { setBusy(false); }
  };

  const onTaxFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sel?.id) return;
    if (!(file.type || '').includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setErr(t('agency_tax_pdf_only'));
      return;
    }
    setBusy(true); setErr('');
    try {
      const b64 = await fileToB64(file);
      let row = await uploadEmployerTaxPlate(agencyId, sel.id, b64, 'application/pdf');
      setSel(row); setF(row);
      setParsing(true);
      try {
        row = await parseEmployerTaxPlate(sel.id);
        if (row) { setSel(row); setF(row); }
      } catch (pe) {
        setErr(`${t('hotels_tax_uploaded')}; ${t('hotels_tax_parse_fail')}: ${pe?.message || ''}`);
      } finally { setParsing(false); }
    } catch (ex) { setErr(ex?.message || t('doc_upload_error')); }
    finally { setBusy(false); }
  };

  const reparse = async () => {
    if (!sel?.id || !sel.hasTaxPlate) return;
    setParsing(true); setErr('');
    try {
      const row = await parseEmployerTaxPlate(sel.id);
      if (row) { setSel(row); setF(row); }
    } catch (e) { setErr(e?.message || t('hotels_tax_parse_fail')); }
    finally { setParsing(false); }
  };

  const viewTax = async () => {
    const url = await getEmployerTaxPlateUrl(agencyId, sel.id);
    if (url) window.open(url, '_blank');
  };

  const infoFields = [
    ['name', 'employer_f_name', true],
    ['title', 'contract_f_title', true],
    ['address', 'contract_f_address', true],
    ['phone', 'contract_f_phone', false],
    ['email', 'contract_f_email', false],
    ['taxNo', 'hotels_tax_no', false],
    ['taxOffice', 'hotels_tax_office', false],
    ['contactPhone', 'contract_f_contact_phone', false],
    ['contactEmail', 'contract_f_contact_email', false],
  ];

  if (sel) {
    return (
      <div className="hotelsWrap">
        <button type="button" className="ghostBtn" onClick={back}>‹ {t('hotels_back_list')}</button>
        <h2 className="hotelsH">{f.name || t('hotels_title')}</h2>
        <p className="fieldHint">{t('hotels_detail_hint')}</p>
        {err ? <p className="errMsg">{err}</p> : null}

        <section className="hotelsSec">
          <h3>{t('hotels_sec_tax')}</h3>
          <p className="muted">
            {sel.hasTaxPlate
              ? (sel.taxPlateParsedAt ? t('hotels_tax_ok') : t('hotels_tax_uploaded'))
              : t('hotels_tax_missing')}
          </p>
          <div className="rowGap">
            <button type="button" className="goldBtn sm" disabled={busy || parsing} onClick={() => taxRef.current?.click()}>
              {busy && !parsing ? '…' : (sel.hasTaxPlate ? t('hotels_tax_replace') : t('hotels_tax_upload'))}
            </button>
            <input ref={taxRef} type="file" accept="application/pdf,.pdf" hidden onChange={onTaxFile} />
            {sel.hasTaxPlate ? (
              <>
                <button type="button" className="ghostBtn" onClick={viewTax}>{t('agency_tax_view')}</button>
                <button type="button" className="ghostBtn" disabled={parsing} onClick={reparse}>
                  {parsing ? t('hotels_tax_parsing') : t('hotels_tax_reparse')}
                </button>
              </>
            ) : null}
          </div>
        </section>

        <section className="hotelsSec">
          <h3>{t('hotels_sec_stamp')}</h3>
          {sel.hasStamp && sel.stampImage
            ? <img src={sel.stampImage} alt="" className="hotelsStamp" />
            : <p className="muted">{t('stamp_empty')}</p>}
          <button type="button" className="ghostBtn" onClick={() => setStampOpen(sel)}>
            {sel.hasStamp ? t('stamp_change') : t('stamp_capture')}
          </button>
        </section>

        <section className="hotelsSec cForm">
          <h3>{t('hotels_sec_info')}</h3>
          <p className="fieldHint">{t('hotels_info_autofill_hint')}</p>
          {infoFields.map(([key, labelKey, req]) => (
            <div key={key} className="cField">
              <label className="fieldLbl">{t(labelKey)}{req ? ' *' : ''}</label>
              {['title', 'address'].includes(key)
                ? <textarea className="input" rows={2} value={f[key] || ''} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />
                : <input className="input" value={f[key] || ''} onChange={(e) => setF((p) => ({ ...p, [key]: e.target.value }))} />}
            </div>
          ))}
          <div className="rowGap" style={{ marginTop: 12 }}>
            <button type="button" className="goldBtn sm" disabled={busy} onClick={save}>{busy ? '…' : t('save')}</button>
            <button type="button" className="dangerBtn sm" disabled={busy} onClick={() => remove(sel)}>{t('employer_delete')}</button>
          </div>
        </section>

        {stampOpen ? (
          <StampSetup
            agencyId={agencyId}
            employer={stampOpen}
            onClose={() => setStampOpen(null)}
            onSaved={(emp) => { setSel(emp); setF(emp); setStampOpen(null); }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="hotelsWrap">
      <p className="fieldHint">{t('hotels_list_hint')}</p>
      <button type="button" className="goldBtn sm" disabled={busy} onClick={add}>+ {t('hotels_add')}</button>
      {loading ? <div className="center pad"><div className="spinner" /></div> : (
        <div className="hotelsList">
          {rows.length === 0 ? <p className="muted">{t('hotels_empty')}</p> : null}
          {rows.map((e) => (
            <div key={e.id} className="hotelsCardRow">
              <button type="button" className="hotelsCard" onClick={() => open(e)}>
                <strong>{e.name}</strong>
                <span>{e.title || '—'}</span>
                <em>
                  {e.hasTaxPlate ? `✓ ${t('hotels_badge_tax')}` : `· ${t('hotels_badge_no_tax')}`}
                  {' · '}
                  {e.hasStamp ? `✓ ${t('hotels_badge_stamp')}` : `· ${t('hotels_badge_no_stamp')}`}
                </em>
              </button>
              <button
                type="button"
                className="dangerBtn sm hotelsCardDel"
                disabled={busy}
                title={t('employer_delete')}
                onClick={(ev) => { ev.stopPropagation(); remove(e); }}
              >
                {t('employer_delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
