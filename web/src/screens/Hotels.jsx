// web/src/screens/Hotels.jsx — Otellerim: vergi levhası + kaşe + sözleşme bilgileri + favori shortlist.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listEmployers, saveEmployer, deleteEmployer, getEmployer,
  uploadEmployerTaxPlate, getEmployerTaxPlateUrl, parseEmployerTaxPlate,
} from '../lib/employers';
import {
  listFavoriteEmployerCounts, listFavoriteDepartmentCounts, listFavoriteCandidates,
} from '../lib/favorites';
import { loadAgencyRoster, groupRosterByDepartment, loadFormerForEmployer, loadEmployerRoster } from '../lib/employerRoster';
import { candidateCode, maskedName } from '../../../lib/candidateCode';
import { langOptions, POSITIONS_BY_SECTOR } from '../../../cv/options';
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

export default function Hotels({ agencyId, onOpen, onOpenPipeline }) {
  const { t, lang } = useLang();
  const deptOptions = useMemo(
    () => langOptions(lang).POSITIONS_BY_SECTOR?.tourism
      || POSITIONS_BY_SECTOR.tourism.map((v) => ({ value: v, label: v })),
    [lang],
  );
  const deptLabel = useCallback((value) => {
    const hit = deptOptions.find((o) => o.value === value);
    return hit?.label || value;
  }, [deptOptions]);

  const taxRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [favCounts, setFavCounts] = useState({});
  const [staffCounts, setStaffCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [stampOpen, setStampOpen] = useState(null);
  const [err, setErr] = useState('');

  const [favLoading, setFavLoading] = useState(false);
  const [favDepts, setFavDepts] = useState([]);
  const [favTotal, setFavTotal] = useState(0);
  const [expandedDept, setExpandedDept] = useState(null);
  const [deptCandidates, setDeptCandidates] = useState({});
  const [deptCandLoading, setDeptCandLoading] = useState(null);
  const [hubTab, setHubTab] = useState('staff');
  const [staffForEmployer, setStaffForEmployer] = useState([]);
  const [formerForEmployer, setFormerForEmployer] = useState([]);
  const [expandedStaffDept, setExpandedStaffDept] = useState(null);
  const [expandedFormer, setExpandedFormer] = useState(false);
  const detailPushedRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, counts, roster] = await Promise.all([
        listEmployers(agencyId),
        listFavoriteEmployerCounts(agencyId),
        loadAgencyRoster(agencyId),
      ]);
      setRows(list);
      setFavCounts(counts || {});
      setStaffCounts(roster?.staffCounts || {});
    } finally { setLoading(false); }
  }, [agencyId]);

  const clearDetail = useCallback(() => {
    setSel(null);
    setF({});
    setFavDepts([]);
    setFavTotal(0);
    setExpandedDept(null);
    setDeptCandidates({});
    refresh();
  }, [refresh]);

  const loadDetailStaff = useCallback(async (employerId) => {
    if (!agencyId || !employerId) return;
    const [roster, former, staffList] = await Promise.all([
      loadAgencyRoster(agencyId),
      loadFormerForEmployer(agencyId, employerId),
      loadEmployerRoster(agencyId, employerId),
    ]);
    setStaffCounts(roster.staffCounts || {});
    setStaffForEmployer(staffList || []);
    setFormerForEmployer(former || []);
    setHubTab((staffList || []).length > 0 ? 'staff' : 'favorites');
    setExpandedStaffDept(null);
    setExpandedFormer(false);
  }, [agencyId]);

  const loadDetailFavorites = useCallback(async (employerId) => {
    if (!agencyId || !employerId) return;
    setFavLoading(true);
    setExpandedDept(null);
    setDeptCandidates({});
    setDeptCandLoading(null);
    try {
      const { departments, totalPeople } = await listFavoriteDepartmentCounts(agencyId, employerId);
      setFavDepts(departments || []);
      setFavTotal(totalPeople || 0);
    } finally { setFavLoading(false); }
  }, [agencyId]);

  useEffect(() => { if (agencyId) refresh(); }, [agencyId, refresh]);
  useEffect(() => {
    if (sel?.id) {
      loadDetailFavorites(sel.id);
      loadDetailStaff(sel.id);
    }
  }, [sel?.id, loadDetailFavorites, loadDetailStaff]);

  useEffect(() => {
    const onPop = (e) => {
      // Aday açılıp geri gelince hotel state'i geri gelir — detayı kapatma.
      if (e.state?.turquzHotel) return;
      if (!detailPushedRef.current) return;
      detailPushedRef.current = false;
      setSel(null);
      setF({});
      setFavDepts([]);
      setFavTotal(0);
      setExpandedDept(null);
      setDeptCandidates({});
      refresh();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [refresh]);

  const open = async (row) => {
    const fresh = (await getEmployer(agencyId, row.id)) || row;
    setSel(fresh);
    setF({ ...fresh });
    setErr('');
    if (!detailPushedRef.current) {
      window.history.pushState({ turquzHotel: row.id }, '');
      detailPushedRef.current = true;
    }
  };

  const back = () => {
    if (detailPushedRef.current) {
      window.history.back();
      return;
    }
    clearDetail();
  };

  const toggleDept = async (department) => {
    if (expandedDept === department) {
      setExpandedDept(null);
      return;
    }
    setExpandedDept(department);
    if (deptCandidates[department] || !sel?.id) return;
    setDeptCandLoading(department);
    try {
      const list = await listFavoriteCandidates(agencyId, sel.id, department);
      setDeptCandidates((prev) => ({ ...prev, [department]: list }));
    } finally { setDeptCandLoading(null); }
  };

  const save = async () => {
    if (!sel?.id) return;
    if (!f.name?.trim() || !f.title?.trim() || !f.address?.trim()
      || !f.country?.trim() || !f.city?.trim() || !f.region?.trim() || !f.webUrl?.trim()) {
      setErr(t('employer_fields_required'));
      return;
    }
    if (!sel.hasTaxPlate || !sel.hasStamp || !sel.stampImage) {
      setErr(t('employer_need_both'));
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
    if (!window.confirm(t('employer_delete_warning', { name: row.name || '' }))) return;
    if (!window.confirm(t('employer_delete_final'))) return;
    setBusy(true); setErr('');
    try {
      await deleteEmployer(agencyId, row.id);
      if (sel?.id === row.id) {
        if (detailPushedRef.current) {
          window.history.back();
        } else {
          clearDetail();
        }
      }
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

  const viewTax = async () => {
    const url = await getEmployerTaxPlateUrl(agencyId, sel.id);
    if (url) window.open(url, '_blank');
  };

  const staffGrouped = useMemo(
    () => groupRosterByDepartment(staffForEmployer, deptOptions),
    [staffForEmployer, deptOptions],
  );

  const infoFields = [
    ['name', 'hotels_f_name', true],
    ['title', 'contract_f_title', true],
    ['address', 'contract_f_address', true],
    ['country', 'hotels_country', true],
    ['city', 'hotels_city', true],
    ['region', 'hotels_region', true],
    ['phone', 'contract_f_phone', false],
    ['email', 'contract_f_email', false],
    ['taxNo', 'hotels_tax_no', false],
    ['taxOffice', 'hotels_tax_office', false],
    ['contactPhone', 'contract_f_contact_phone', false],
    ['contactEmail', 'contract_f_contact_email', false],
    ['webUrl', 'hotels_badge_web', true],
  ];

  const favoritesSection = (
    <section className="hotelsSec hotelsFavSec">
      <h3>{t('hotels_sec_favorites')}</h3>
      {favLoading ? (
        <div className="center pad"><div className="spinner" /></div>
      ) : favTotal === 0 ? (
        <p className="hotelsFavEmpty">{t('hotels_fav_none')}</p>
      ) : (
        <>
          <div className="hotelsFavTotal">
            <strong>{favTotal}</strong>
            <span>{t('fav_hotel_total_label')}</span>
          </div>
          <p className="fieldHint">{t('hotels_fav_hint')}</p>
          <div className="hotelsFavDepts">
            {favDepts.map(({ department, count }) => {
              const openDept = expandedDept === department;
              const cands = deptCandidates[department];
              return (
                <div key={department} className="hotelsFavDeptBlock">
                  <button
                    type="button"
                    className={`hotelsFavDeptRow ${openDept ? 'on' : ''}`}
                    onClick={() => toggleDept(department)}
                  >
                    <span className="hotelsFavDeptName">{deptLabel(department)}</span>
                    <span className="hotelsFavDeptCount">{count}</span>
                    <span className="hotelsFavDeptChev">{openDept ? '▾' : '▸'}</span>
                  </button>
                  {openDept ? (
                    deptCandLoading === department ? (
                      <div className="center pad sm"><div className="spinner" /></div>
                    ) : (
                      <div className="hotelsFavCands">
                        {(cands || []).map((c) => {
                          const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
                          const name = maskedName(c.data) || code;
                          return (
                            <div
                              key={c.user_id}
                              className="hotelsFavCand"
                            >
                              <button
                                type="button"
                                className="hotelsFavCandMain"
                                onClick={() => onOpen?.({ c, st: { _employerId: sel?.id } })}
                                disabled={!onOpen}
                              >
                                <span className="hotelsFavCandAv">👤</span>
                                <span className="hotelsFavCandBody">
                                  <strong>{name}</strong>
                                  <em>{code}{c.title ? ` · ${c.title}` : ''}</em>
                                </span>
                                {onOpen ? <span className="hotelsFavCandChev">›</span> : null}
                              </button>
                              <span className="hotelsFavCandActions">
                                <button
                                  type="button"
                                  className="hotelsFavQuickBtn"
                                  onClick={() => onOpen?.({ c, st: { _openInterview: true, _employerId: sel?.id } })}
                                  disabled={!onOpen}
                                >
                                  {t('hotels_quick_interview') || 'Mülakat'}
                                </button>
                                <button
                                  type="button"
                                  className="hotelsFavQuickBtn offer"
                                  onClick={() => onOpen?.({ c, st: { _quickOffer: true, _employerId: sel?.id } })}
                                  disabled={!onOpen}
                                >
                                  {t('hotels_quick_offer') || 'Teklif'}
                                </button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );

  const staffSection = (
    <section className="hotelsSec hotelsStaffSec">
      <p className="fieldHint">{t('employer_hub_sub_staff')}</p>
      {onOpenPipeline && sel?.id ? (
        <button type="button" className="hotelsPipelineLink" onClick={() => onOpenPipeline(sel)}>
          {t('employer_hub_open_pipeline')}
        </button>
      ) : null}
      {staffForEmployer.length === 0 && formerForEmployer.length === 0 ? (
        <p className="hotelsFavEmpty">{t('employer_roster_empty')}</p>
      ) : (
        <div className="hotelsFavDepts">
          {staffForEmployer.length > 0 ? deptOptions.map((o) => {
            const list = staffGrouped.buckets[o.value] || [];
            if (!list.length) return null;
            const openDept = expandedStaffDept === o.value;
            return (
              <div key={`staff-${o.value}`} className="hotelsFavDeptBlock">
                <button
                  type="button"
                  className={`hotelsFavDeptRow ${openDept ? 'on' : ''}`}
                  onClick={() => setExpandedStaffDept(openDept ? null : o.value)}
                >
                  <span className="hotelsFavDeptName">{o.label}</span>
                  <span className="hotelsFavDeptCount">{list.length}</span>
                  <span className="hotelsFavDeptChev">{openDept ? '▾' : '▸'}</span>
                </button>
                {openDept ? (
                  <div className="hotelsFavCands">
                    {list.map((c) => {
                      const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
                      const name = maskedName(c.data) || code;
                      const statusLabel = c.rosterStatus === 'transit' ? t('employer_roster_transit') : t('employer_roster_active');
                      return (
                        <div key={c.user_id} className="hotelsFavCand">
                          <button
                            type="button"
                            className="hotelsFavCandMain"
                            onClick={() => onOpen?.({ c, st: { _employerId: sel?.id } })}
                            disabled={!onOpen}
                          >
                            <span className="hotelsFavCandAv">👤</span>
                            <span className="hotelsFavCandBody">
                              <strong>{name}</strong>
                              <em>{code}{c.title ? ` · ${c.title}` : ''}</em>
                            </span>
                            <span className="hotelsStaffBadge">{statusLabel}</span>
                            {onOpen ? <span className="hotelsFavCandChev">›</span> : null}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          }) : null}
          {formerForEmployer.length > 0 ? (
            <div className="hotelsFavDeptBlock">
              <button
                type="button"
                className={`hotelsFavDeptRow ${expandedFormer ? 'on' : ''}`}
                onClick={() => setExpandedFormer(!expandedFormer)}
              >
                <span className="hotelsFavDeptName">{t('employer_roster_former')}</span>
                <span className="hotelsFavDeptCount">{formerForEmployer.length}</span>
                <span className="hotelsFavDeptChev">{expandedFormer ? '▾' : '▸'}</span>
              </button>
              {expandedFormer ? (
                <div className="hotelsFavCands">
                  {formerForEmployer.map((c) => {
                    const code = candidateCode(c.data?.nationality || c.nationality, c.reg_no);
                    const name = maskedName(c.data) || code;
                    return (
                      <div key={c.episode_id || c.user_id} className="hotelsFavCand">
                        <button
                          type="button"
                          className="hotelsFavCandMain"
                          onClick={() => onOpen?.({ c, st: { _employerId: sel?.id, former: true } })}
                          disabled={!onOpen}
                        >
                          <span className="hotelsFavCandAv">👤</span>
                          <span className="hotelsFavCandBody">
                            <strong>{name}</strong>
                            <em>{code}{c.job_position || c.title ? ` · ${c.job_position || c.title}` : ''}</em>
                          </span>
                          <span className="hotelsStaffBadge hotelsStaffBadgeFormer">{t('employer_roster_former')}</span>
                          {onOpen ? <span className="hotelsFavCandChev">›</span> : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );

  const infoSection = (
    <>
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
    </>
  );

  if (sel) {
    const staffN = staffForEmployer.length;
    const favN = favTotal || 0;
    return (
      <div className="hotelsWrap">
        <button type="button" className="ghostBtn" onClick={back}>‹ {t('hotels_back_list')}</button>
        <h2 className="hotelsH">{f.name || t('hotels_title')}</h2>
        {err ? <p className="errMsg">{err}</p> : null}

        <div className="hotelsHubStats">
          {staffN > 0 ? <span className="hotelsStaffBadge">{staffN} {t('employer_hub_tab_staff')}</span> : null}
          {favN > 0 ? <span className="hotelsFavBadge"><span aria-hidden>★</span> {favN}</span> : null}
        </div>

        <div className="hotelsHubTabs" role="tablist">
          {[
            { id: 'staff', label: t('employer_hub_tab_staff'), n: staffN },
            { id: 'favorites', label: t('employer_hub_tab_favorites'), n: favN },
            { id: 'info', label: t('employer_hub_tab_info'), n: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={hubTab === tab.id}
              className={`hotelsHubTab ${hubTab === tab.id ? 'on' : ''}`}
              onClick={() => setHubTab(tab.id)}
            >
              {tab.label}{tab.n > 0 ? ` (${tab.n})` : ''}
            </button>
          ))}
        </div>

        {hubTab === 'staff' ? staffSection : null}
        {hubTab === 'favorites' ? favoritesSection : null}
        {hubTab === 'info' ? infoSection : null}
      </div>
    );
  }

  return (
    <div className="hotelsWrap">
      <button type="button" className="goldBtn sm" disabled={busy} onClick={add}>+ {t('hotels_add')}</button>
      {loading ? <div className="center pad"><div className="spinner" /></div> : (
        <div className="hotelsList">
          {rows.length === 0 ? <p className="muted">{t('hotels_empty')}</p> : null}
          {rows.map((e) => {
            const fn = favCounts[e.id] || 0;
            const sn = staffCounts[e.id] || 0;
            return (
              <div key={e.id} className="hotelsCardRow">
                <button type="button" className="hotelsCard" onClick={() => open(e)}>
                  <span className="hotelsCardHead">
                    <strong>{e.name}</strong>
                    <span className="hotelsCardBadges">
                      {sn > 0 ? (
                        <span className="hotelsStaffBadge" title={t('employer_staff_count', { n: String(sn) })}>
                          {sn} {t('employer_hub_tab_staff')}
                        </span>
                      ) : null}
                      {fn > 0 ? (
                        <span className="hotelsFavBadge" title={t('fav_count', { n: String(fn) })}>
                          <span aria-hidden>★</span> {fn}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span>{e.title || '—'}</span>
                  <span className="hotelsStatusGrid">
                    {[
                      [e.hasTaxPlate, t('hotels_badge_tax')],
                      [e.hasStamp && e.stampImage, t('hotels_badge_stamp')],
                      [e.hasTaxPlate, t('hotels_sec_tax')],
                      [e.hasStamp && e.stampImage, t('hotels_sec_stamp')],
                      [e.hasInfo, t('hotels_badge_info')],
                      [e.hasWebPage, t('hotels_badge_web')],
                    ].map(([ok, label]) => (
                      <span key={label} className={`hotelsStatus ${ok ? 'ok' : 'miss'}`}>
                        <b>{ok ? '✓' : '·'}</b> {label}
                      </span>
                    ))}
                  </span>
                  {fn > 0 ? <em>{t('fav_count', { n: String(fn) })}</em> : null}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
