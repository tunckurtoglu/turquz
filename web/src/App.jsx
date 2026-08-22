import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getSession, onAuthChange, getRole, signOut, listPool, categoryOf, scanOps, isAgencySetupComplete, getCandidate, getCandidateStatus, isEmploymentNotif, candidateIdFromNotif, getAgencyProfile, saveAgencyTaxPlate, getAgencyTaxPlateUrl } from './lib/api';
import { unreadChatCount } from './lib/ops';
import { agencyCode } from '../../lib/agencyCode';
import { useLang } from './i18n.jsx';
import Login from './screens/Login.jsx';
import ResetPassword from './screens/ResetPassword.jsx';
import AgencySetup from './screens/AgencySetup.jsx';
import Pool from './screens/Pool.jsx';
import OpsDesk from './screens/OpsDesk.jsx';
import ChatInbox from './screens/ChatInbox.jsx';
import Candidate from './screens/Candidate.jsx';
import { Icon } from './components/Icon.jsx';
import NotifBell from './components/NotifBell.jsx';
import AgencyAnnouncementsHub from './components/AgencyAnnouncementsHub.jsx';
import AgencyNoticeModal from './components/AgencyNoticeModal.jsx';
import { supabase } from './lib/supabase';
import { getAgencyNotifPrefs, setAgencyNotifPrefs, syncChatLang } from './lib/processChat';
import EmployerStampList from './screens/EmployerStampList.jsx';
import Hotels from './screens/Hotels.jsx';
import {
  PIPELINE_STAGES_PRIMARY, PIPELINE_STAGES_MORE, isPipelineMoreStage,
} from '../../../lib/agencyHomeUi';

const CAT_KEYS = [
  { id: 'ops', key: 'nav_today' },
  { id: 'pipeline', key: 'nav_candidates' },
  { id: 'pool', key: 'nav_pool' },
  { id: 'hotels', key: 'nav_hotels' },
  { id: 'messages', key: 'nav_messages' },
];
const STAFF_PIPELINE = new Set(['arrivals', 'transit', 'staff', 'former', 'cards']);
const PROCESS_PIPELINE = new Set(['interviews', 'concluded', 'offered', 'inprocess']);
const normalizeCat = (c) => {
  if (c === 'process' || c === 'hired' || c === 'staff') return 'pipeline';
  return ['ops', 'pool', 'pipeline', 'hotels', 'messages'].includes(c) ? c : 'ops';
};

const readHash = () => {
  const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  return { cat: normalizeCat(h.get('cat')), c: h.get('c') };
};
const writeHash = (catVal, cId) => {
  const p = new URLSearchParams();
  if (catVal && catVal !== 'ops') p.set('cat', catVal);
  if (cId) p.set('c', cId);
  const s = p.toString();
  const next = s ? `#${s}` : '';
  if ((window.location.hash || '') !== next) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + next);
  }
};

export default function App() {
  const { lang, setLang, languages, t } = useLang();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [agencySetupOk, setAgencySetupOk] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [cat, setCat] = useState(() => normalizeCat(readHash().cat));
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState(null);
  const [editProfile, setEditProfile] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [generalPush, setGeneralPush] = useState(true);
  const [chatPush, setChatPush] = useState(true);
  const [chatBadge, setChatBadge] = useState(0);
  const [annHubOpen, setAnnHubOpen] = useState(false);
  const [hubCompose, setHubCompose] = useState(false);
  const [hubNotice, setHubNotice] = useState(null);
  const [hubIds, setHubIds] = useState([]);
  const [hubPeople, setHubPeople] = useState([]);
  const [hubNonce, setHubNonce] = useState(0);
  const [annUnread, setAnnUnread] = useState(0);
  const [agencyProfile, setAgencyProfile] = useState(null);
  const [taxBusy, setTaxBusy] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [processJump, setProcessJump] = useState(null); // offered | inprocess | interviews | arrivals...
  const [pipelineStage, setPipelineStage] = useState('interviews');
  const [pipelineMoreOpen, setPipelineMoreOpen] = useState(false);
  const scrollRef = useRef(0);
  const restoredRef = useRef(false);
  const pendingCandidateRef = useRef(readHash().c);

  useLayoutEffect(() => {
    if (selected) window.scrollTo(0, 0);
    else window.scrollTo(0, scrollRef.current);
  }, [selected]);
  const openCandidate = (c) => { scrollRef.current = window.scrollY; setSelected(c); };
  const goHome = () => { setSelected(null); setCat('ops'); setQ(''); };

  const onNotifNavigate = async (n) => {
    const emp = isEmploymentNotif(n?.type);
    const arrival = n?.type === 'arrival_today' || n?.type === 'arrival_tomorrow';
    const boarding = n?.type === 'boarding_no_response' || n?.type === 'boarding_missed' || n?.type === 'boarding_confirmed';
    if (n?.type !== 'chat_message' && !emp && !arrival && !boarding) return;
    const id = emp
      ? await candidateIdFromNotif(n)
      : (n.payload?.candidateId || n.ref_user);
    if (!id) return;
    try {
      let row = (rows || []).find((r) => r.user_id === id);
      if (!row) {
        const [c, st] = await Promise.all([getCandidate(id), getCandidateStatus(id)]);
        if (!c) return;
        row = { ...c, st };
      }
      scrollRef.current = window.scrollY;
      setSelected({ c: row, st: {
        ...(row.st || {}),
        ...(n.type === 'chat_message' ? { _openChat: true } : {}),
        ...((n.type === 'work_start_confirm' || n.type === 'work_start_remind' || n.type === 'transit_stalled' || n.payload?.openHireConfirm) ? { _openHireConfirm: true, status: row.st?.status || 'in_transit' } : {}),
        ...(n.type === 'boarding_no_response' || n.payload?.openBoardingResolve ? { status: 'in_transit' } : {}),
        ...(n.type === 'boarding_missed' ? { status: 'in_transit' } : {}),
        ...((n.type === 'rating_required' || n.type === 'rating_remind' || n.payload?.openRate) ? { _openRate: true } : {}),
      } });
    } catch (e) { /* yoksay */ }
  };

  useEffect(() => {
    if (!ready || passwordRecovery) return;
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (
      raw.includes('access_token')
      || raw.includes('refresh_token')
      || raw.includes('type=recovery')
      || /(^|&)code=/.test(raw)
    ) return;
    writeHash(cat, selected?.c?.user_id);
  }, [cat, selected, ready, passwordRecovery]);

  useEffect(() => {
    if (restoredRef.current || !rows) return;
    restoredRef.current = true;
    const cId = pendingCandidateRef.current;
    if (cId) {
      const row = rows.find((r) => r.user_id === cId);
      if (row) setSelected({ c: row, st: row.st });
    }
  }, [rows]);

  useEffect(() => {
    let sub;
    (async () => {
      const s = await getSession();
      setSession(s);
      if (s) setRole(await getRole(s.user.id));
      setReady(true);
      sub = onAuthChange(async (ns, event) => {
        setSession(ns);
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
          return;
        }
        setRole(ns ? await getRole(ns.user.id) : null);
        if (!ns) {
          setSelected(null);
          setRows(null);
          setPasswordRecovery(false);
        }
      });
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  const isStaff = role === 'agency' || role === 'admin';

  useEffect(() => {
    let alive = true;
    if (role !== 'agency' || !session?.user?.id) {
      setAgencySetupOk(true);
      return undefined;
    }
    setAgencySetupOk(null);
    isAgencySetupComplete(session.user.id).then((ok) => {
      if (alive) setAgencySetupOk(!!ok);
    }).catch(() => { if (alive) setAgencySetupOk(false); });
    return () => { alive = false; };
  }, [role, session?.user?.id]);

  useEffect(() => {
    if (!session || !isStaff) return;
    scanOps();
    getAgencyNotifPrefs().then((p) => {
      setGeneralPush(p.generalPush);
      setChatPush(p.chatPush);
    });
    getAgencyProfile(session.user.id).then(setAgencyProfile).catch(() => setAgencyProfile(null));
  }, [session, isStaff]);

  useEffect(() => {
    if (!notifOpen || !session?.user?.id) return;
    getAgencyProfile(session.user.id).then(setAgencyProfile).catch(() => {});
  }, [notifOpen, session?.user?.id]);
  useEffect(() => {
    if (!session || !isStaff) return;
    syncChatLang(lang);
  }, [session, isStaff, lang]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onDoc = (e) => {
      if (!e.target.closest?.('.ecSettings')) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [notifOpen]);

  useEffect(() => {
    if (!session || !isStaff) return;
    let alive = true;
    listPool().then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [session, isStaff]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff) return undefined;
    let alive = true;
    const tick = () => unreadChatCount(session.user.id).then((n) => { if (alive) setChatBadge(n); }).catch(() => {});
    tick();
    const t = setInterval(tick, 20000);
    const ch = supabase
      .channel(`agency-chat-badge-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const row = payload.new || payload.old;
          if (row?.type === 'chat_message') tick();
        },
      )
      .subscribe();
    return () => { alive = false; clearInterval(t); supabase.removeChannel(ch); };
  }, [session?.user?.id, isStaff, selected, cat]);

  const refreshChatBadge = () => {
    if (!session?.user?.id) return;
    unreadChatCount(session.user.id).then(setChatBadge).catch(() => {});
  };

  useEffect(() => {
    if (!session?.user?.id || !isStaff) return undefined;
    let alive = true;
    const tick = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('type', 'announcement')
        .is('read_at', null);
      if (alive) setAnnUnread(count || 0);
    };
    tick().catch(() => {});
    const iv = setInterval(() => { tick().catch(() => {}); }, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, [session?.user?.id, isStaff, hubNonce, annHubOpen, hubCompose]);

  const counts = useMemo(() => {
    const c = { pool: 0, process: 0, hired: 0, offered: 0, transit: 0 };
    (rows || []).forEach((r) => {
      const k = categoryOf(r.st);
      if (k === 'hired') c.hired += 1;
      else if (k === 'transit') { c.transit += 1; c.hired += 1; } // personel sekme sayacına dahil
      else {
        c.pool += 1;
        if (k === 'process') c.process += 1;
        if (k === 'offered') c.offered += 1;
      }
    });
    return c;
  }, [rows]);

  const logout = async () => {
    await signOut();
    setSelected(null);
    setPasswordRecovery(false);
  };

  const navigateCat = (next, sub) => {
    setSelected(null);
    if (next === 'pool' || next === 'ops' || next === 'hotels' || next === 'messages') {
      setCat(next);
      setProcessJump(null);
      return;
    }
    setCat('pipeline');
    let stage = 'inprocess';
    if (typeof sub === 'string' && sub.startsWith('pipe_')) stage = 'inprocess';
    else if (sub && (PROCESS_PIPELINE.has(sub) || STAFF_PIPELINE.has(sub))) stage = sub === 'cards' ? 'staff' : sub;
    else if (next === 'hired' || next === 'staff') stage = 'staff';
    else if (next === 'process') stage = 'inprocess';
    setPipelineStage(stage);
    setProcessJump(typeof sub === 'string' && sub.startsWith('pipe_') ? sub : stage);
  };

  if (!ready) return <div className="center full"><div className="spinner" /></div>;

  if (passwordRecovery && session) {
    return (
      <ResetPassword
        onDone={async () => {
          setPasswordRecovery(false);
          setRole(await getRole(session.user.id));
        }}
      />
    );
  }

  if (!session || !isStaff) return <Login loggedInButNotStaff={!!session && !isStaff} onLogout={logout} />;

  const meta = session.user.user_metadata || {};
  if (role === 'agency') {
    if (agencySetupOk === null) return <div className="center full"><div className="spinner" /></div>;
    if (!agencySetupOk) {
      return (
        <AgencySetup
          user={session.user}
          onDone={(u) => {
            setSession((s) => ({ ...s, user: u }));
            setAgencySetupOk(true);
          }}
        />
      );
    }
  }
  const agencyName = agencyProfile?.companyName
    || meta.full_name || meta.name
    || [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim()
    || (session.user.email ? session.user.email.split('@')[0] : (t('role_agency') || 'Acente'));
  const agencyIdCode = agencyCode(agencyProfile?.regNo);

  const onTaxPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !session?.user?.id) return;
    if (!(file.type || '').includes('pdf') && !String(file.name || '').toLowerCase().endsWith('.pdf')) {
      window.alert(t('agency_tax_pdf_only') || 'Yalnızca PDF yükleyin.');
      return;
    }
    setTaxBusy(true);
    try {
      await saveAgencyTaxPlate(session.user.id, file);
      const p = await getAgencyProfile(session.user.id);
      setAgencyProfile(p);
    } catch (err) {
      window.alert(err?.message || t('agency_setup_err_pdf') || '');
    } finally {
      setTaxBusy(false);
    }
  };

  const onTaxView = async () => {
    try {
      setTaxBusy(true);
      const url = await getAgencyTaxPlateUrl(session.user.id);
      if (!url) { window.alert(t('agency_tax_missing') || ''); return; }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      window.alert(err?.message || t('open_failed') || '');
    } finally {
      setTaxBusy(false);
    }
  };

  const catCount = (id) => {
    if (id === 'ops') return null;
    if (id === 'messages') return chatBadge || null;
    if (id === 'pool') return counts.pool;
    if (id === 'pipeline') return counts.process + counts.offered + counts.hired;
    return null;
  };

  return (
    <div className="ec">
      <div className="ecTop">
        <header className="ecHeader">
          <button className="ecLogo" onClick={goHome} title={t('agency_home') || ''} aria-label={t('agency_home') || ''}><img src="/turquz-logo.png" alt="Turquz" /></button>
          <div className="ecBrandBlock">
            <span className="ecBrandName">Turquz</span>
            <span className="ecBrandSub">{t('agency_ops_sub') || ''}</span>
          </div>
          <div className="ecSearch">
            <Icon name="search" size={18} />
            <input
              placeholder={t('agency_search') || ''}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected(null);
                if (e.target.value) setCat('pool');
              }}
            />
            {q ? <button className="ecSearchClear" onClick={() => setQ('')} title={t('agency_clear') || ''}>✕</button> : null}
          </div>
          <div className="ecRight">
            <div className="ecWho clickable" onClick={() => setEditProfile(true)} title={t('set_edit_profile') || ''}>
              <span className="ecWhoLabel">{agencyIdCode}</span>
              <span className="ecWhoName">{agencyName}</span>
            </div>
            <div className="bellWrap">
              <button
                type="button"
                className={`ecSettingsBtn ${annHubOpen || hubCompose ? 'on' : ''}`}
                onClick={() => setAnnHubOpen(true)}
                title={t('home_announcements')}
              >
                <Icon name="announce" size={16} />
                <span>{t('home_announcements')}</span>
              </button>
              {annUnread > 0 ? <span className="bellDot">{annUnread > 9 ? '9+' : annUnread}</span> : null}
            </div>
            <NotifBell userId={session.user.id} onNavigate={onNotifNavigate} />
            <div className="ecSettings">
              <button
                type="button"
                className={`ecSettingsBtn ${notifOpen ? 'on' : ''}`}
                onClick={() => setNotifOpen((v) => !v)}
                title={t('settings') || 'Ayarlar'}
                aria-expanded={notifOpen}
              >
                <Icon name="settings" size={16} />
                <span>{t('settings') || 'Ayarlar'}</span>
              </button>
              {notifOpen ? (
                <div className="ecSettingsMenu" role="dialog" aria-label={t('settings') || 'Ayarlar'}>
                  <div className="ecSettingsHead">{t('settings') || 'Ayarlar'}</div>

                  <div className="ecIdCard">
                    <div className="ecIdCode">{agencyIdCode}</div>
                    <div className="ecIdName">{agencyName}</div>
                    <div className="ecIdHint">{t('agency_id_hint') || 'Acente kimlik kodunuz'}</div>
                  </div>

                  <div className="ecSettingsBlock">
                    <div className="ecSettingsLabel">{t('set_language') || 'Dil'}</div>
                    <select
                      className="ecLangSelect"
                      value={lang}
                      onChange={(e) => {
                        const code = e.target.value;
                        setLang(code);
                        setAgencyNotifPrefs({ generalPush, chatPush, preferredLang: code }).catch(() => {});
                      }}
                    >
                      {languages.map((l) => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ecSettingsBlock">
                    <div className="ecSettingsLabel">{t('set_notifications') || 'Bildirimler'}</div>
                    <label className="ecNotifRow">
                      <span>
                        <strong>{t('set_notif_general') || 'Genel bildirimler'}</strong>
                        <small>{t('set_notif_general_desc') || ''}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={generalPush}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setGeneralPush(v);
                          setAgencyNotifPrefs({ generalPush: v, chatPush, preferredLang: lang }).catch(() => {});
                        }}
                      />
                    </label>
                    <label className="ecNotifRow">
                      <span>
                        <strong>{t('set_notif_chat') || 'Mesaj bildirimleri'}</strong>
                        <small>{t('set_notif_chat_desc') || ''}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={chatPush}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setChatPush(v);
                          setAgencyNotifPrefs({ generalPush, chatPush: v, preferredLang: lang }).catch(() => {});
                        }}
                      />
                    </label>
                  </div>

                  <div className="ecSettingsBlock">
                    <div className="ecSettingsLabel">{t('stamp_menu') || 'İmza & kaşe'}</div>
                    <p className="ecTaxStatus">{t('stamp_list_hint_short') || 'Her işletme için ayrı kaşe'}</p>
                    <button
                      type="button"
                      className="ecTaxGhost"
                      onClick={() => { setNotifOpen(false); setStampOpen(true); }}
                    >
                      {t('stamp_menu') || 'İşletme kaşeleri'}
                    </button>
                  </div>

                  <div className="ecSettingsBlock">
                    <div className="ecSettingsLabel">{t('agency_tax_section') || 'Vergi levhası'}</div>
                    <p className="ecTaxStatus">
                      {agencyProfile?.taxPlatePath
                        ? (t('agency_tax_ready') || 'PDF yüklü')
                        : (t('agency_tax_missing') || 'Henüz yüklenmedi')}
                    </p>
                    <div className="ecTaxActions">
                      {agencyProfile?.taxPlatePath ? (
                        <button type="button" className="ecTaxGhost" onClick={onTaxView} disabled={taxBusy}>
                          {t('agency_tax_view') || 'Görüntüle'}
                        </button>
                      ) : null}
                      <label className={`ecTaxUpload ${taxBusy ? 'busy' : ''}`}>
                        {taxBusy ? '…' : (agencyProfile?.taxPlatePath
                          ? (t('agency_tax_replace') || 'Yeniden yükle')
                          : (t('agency_tax_upload') || 'PDF yükle'))}
                        <input type="file" accept="application/pdf,.pdf" hidden onChange={onTaxPick} disabled={taxBusy} />
                      </label>
                    </div>
                  </div>

                  <div className="ecSettingsBlock">
                    <button type="button" className="ecSettingsAccount" onClick={() => { setNotifOpen(false); setEditProfile(true); }}>
                      {t('set_edit_profile') || 'Bilgilerimi düzenle'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <button className="ecAccount" onClick={logout}><Icon name="logout" size={16} /> {t('set_logout') || 'Çıkış'}</button>
          </div>
        </header>

        <nav className="ecCatsBar" aria-label={t('agency_main_menu') || ''}>
          <div className="segTrack">
            {CAT_KEYS.map((c) => {
              const n = catCount(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`segItem ${cat === c.id ? 'on' : ''}`}
                  onClick={() => {
                    setSelected(null);
                    setCat(c.id);
                    if (c.id === 'pipeline') setProcessJump(pipelineStage);
                    else setProcessJump(null);
                  }}
                >
                  {t(c.key) || c.id}
                  {n != null && n > 0 ? <span className="segCount">{n > 99 ? '99+' : n}</span> : null}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="ecAccent" />
      </div>

      <main className="ecMain">
        <div style={{ display: selected ? 'none' : 'block' }}>
          {cat === 'ops' ? (
            <OpsDesk
              agencyId={session.user.id}
              onOpen={openCandidate}
              onNavigateCat={navigateCat}
            />
          ) : null}
          {cat === 'hotels' ? (
            <Hotels agencyId={session.user.id} />
          ) : null}
          {cat === 'messages' ? (
            <ChatInbox agencyId={session.user.id} onOpen={openCandidate} />
          ) : null}
          {cat === 'pipeline' ? (
            <div className="arrToggle processSubs pipelineStages" style={{ margin: '0 0 12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {PIPELINE_STAGES_PRIMARY.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`arrTab ${pipelineStage === s.id ? 'on' : ''}`}
                  onClick={() => {
                    setPipelineMoreOpen(false);
                    setPipelineStage(s.id);
                    setProcessJump(s.id);
                  }}
                >
                  {s.id === 'arrivals' ? `🛬 ${t(s.labelKey)}` : t(s.labelKey)}
                </button>
              ))}
              <div className="pipelineMoreWrap">
                <button
                  type="button"
                  className={`arrTab ${isPipelineMoreStage(pipelineStage) ? 'on' : ''}`}
                  onClick={() => setPipelineMoreOpen((v) => !v)}
                >
                  {isPipelineMoreStage(pipelineStage)
                    ? t(PIPELINE_STAGES_MORE.find((s) => s.id === pipelineStage)?.labelKey || 'pipeline_more')
                    : `${t('pipeline_more')} ▾`}
                </button>
                {pipelineMoreOpen ? (
                  <div className="pipelineMoreMenu">
                    {PIPELINE_STAGES_MORE.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`pipelineMoreItem ${pipelineStage === s.id ? 'on' : ''}`}
                        onClick={() => {
                          setPipelineStage(s.id);
                          setProcessJump(s.id);
                          setPipelineMoreOpen(false);
                        }}
                      >
                        {t(s.labelKey)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {cat === 'pool' || cat === 'pipeline' ? (
            <Pool
              category={cat === 'pipeline'
                ? (STAFF_PIPELINE.has(pipelineStage) ? 'hired' : 'process')
                : cat}
              query={q}
              rows={rows}
              onOpen={openCandidate}
              agencyId={session.user.id}
              onRefresh={() => listPool().then(setRows).catch(() => {})}
              processJump={processJump}
              onProcessJumpConsumed={() => setProcessJump(null)}
              hideStageTabs={cat === 'pipeline'}
            />
          ) : null}
        </div>
        {selected ? (
          <Candidate
            sel={selected}
            onBack={() => { setSelected(null); refreshChatBadge(); }}
            agencyUserId={session.user.id}
            onChatRead={refreshChatBadge}
          />
        ) : null}
      </main>

      <AgencyAnnouncementsHub
        open={annHubOpen && !hubCompose}
        onClose={() => setAnnHubOpen(false)}
        userId={session.user.id}
        reloadAt={hubNonce}
        onCompose={() => { setHubNotice(null); setHubIds([]); setHubPeople([]); setHubCompose(true); }}
        onComposeGroup={(b) => {
          setHubNotice(null);
          setHubIds((b.people || []).map((p) => p.userId));
          setHubPeople(b.people || []);
          setHubCompose(true);
        }}
        onOpenSent={(row) => { setHubNotice(row); setHubIds([]); setHubPeople([]); setHubCompose(true); }}
      />
      <AgencyNoticeModal
        open={hubCompose}
        onClose={() => {
          setHubCompose(false);
          setHubNotice(null);
          setHubIds([]);
          setHubPeople([]);
          setHubNonce((n) => n + 1);
        }}
        userIds={hubIds}
        previewPeople={hubPeople}
        allowAudience={!hubIds.length}
        agencyId={session.user.id}
        startNotice={hubNotice}
        hideHistory
      />

      {editProfile ? (
        <AgencySetup
          user={session.user}
          onDone={(u) => { setSession((s) => ({ ...s, user: u })); setEditProfile(false); }}
          onCancel={() => setEditProfile(false)}
        />
      ) : null}

      {stampOpen ? (
        <EmployerStampList
          agencyId={session.user.id}
          onClose={() => setStampOpen(false)}
        />
      ) : null}
    </div>
  );
}
