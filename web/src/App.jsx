import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getSession, onAuthChange, resolveRole, signOut, listPool, categoryOf, scanOps, isAgencySetupComplete, getCandidate, getCandidateStatus, isEmploymentNotif, candidateIdFromNotif, getAgencyProfile } from './lib/api';
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
import Hotels from './screens/Hotels.jsx';
import { readHash, writeHash, writeEmployerPipelineFilter } from './lib/navHash';
import {
  PIPELINE_PHASES, phaseOfPipelineStage, pipelinePhaseById,
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

export default function App() {
  const { lang, setLang, languages, t } = useLang();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [agencySetupOk, setAgencySetupOk] = useState(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [cat, setCat] = useState(() => readHash().cat);
  const [detailTab, setDetailTab] = useState(() => readHash().tab);
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
  const [processJump, setProcessJump] = useState(null); // offered | inprocess | interviews | arrivals...
  const [pipelineStage, setPipelineStage] = useState('interviews');
  const [pipelineEmployerFilter, setPipelineEmployerFilter] = useState(() => {
    const h = readHash();
    return h.emp ? { id: h.emp, name: h.empName || '' } : null;
  });
  const scrollRef = useRef(0);
  const restoredRef = useRef(false);
  const pendingCandidateRef = useRef(readHash().c);
  const fromPopRef = useRef(false);
  const hashSyncedRef = useRef(false);
  const prevDetailTabRef = useRef('cv');
  const selectedId = selected?.c?.user_id || selected?.user_id || null;

  useLayoutEffect(() => {
    if (selected) window.scrollTo(0, 0);
    else window.scrollTo(0, scrollRef.current);
  }, [selected]);
  const openCandidate = (c) => {
    scrollRef.current = window.scrollY;
    setDetailTab('cv');
    setSelected(c);
  };
  const goHome = () => { setSelected(null); setDetailTab('cv'); setCat('ops'); setQ(''); };

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
    if (fromPopRef.current) {
      fromPopRef.current = false;
      prevDetailTabRef.current = detailTab;
      return;
    }
    let mode = hashSyncedRef.current ? 'replace' : 'replace';
    if (hashSyncedRef.current && selectedId && detailTab !== prevDetailTabRef.current) {
      mode = detailTab !== 'cv' ? 'push' : 'replace';
    }
    prevDetailTabRef.current = detailTab;
    hashSyncedRef.current = true;
    writeHash(cat, selectedId, detailTab, mode, cat === 'pipeline' ? pipelineEmployerFilter : null);
  }, [cat, selectedId, detailTab, pipelineEmployerFilter, ready, passwordRecovery]);

  useEffect(() => {
    if (!ready || passwordRecovery) return undefined;
    const onPop = async () => {
      fromPopRef.current = true;
      const { cat: hCat, c: hC, tab: hTab, emp, empName } = readHash();
      setCat(hCat);
      setDetailTab(hTab);
      setPipelineEmployerFilter(emp ? { id: emp, name: empName || '' } : null);
      if (!hC) {
        setSelected(null);
        return;
      }
      if (selectedId === hC) return;
      try {
        const [c, st] = await Promise.all([getCandidate(hC), getCandidateStatus(hC)]);
        if (c) setSelected({ c, st: st || {} });
        else setSelected(null);
      } catch {
        setSelected(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [ready, passwordRecovery, selectedId]);

  useEffect(() => {
    if (restoredRef.current || !rows) return;
    restoredRef.current = true;
    const cId = pendingCandidateRef.current;
    if (cId) {
      const row = rows.find((r) => r.user_id === cId);
      if (row) {
        setDetailTab(readHash().tab);
        setSelected({ c: row, st: row.st });
      }
    }
  }, [rows]);

  useEffect(() => {
    let sub;
    (async () => {
      const s = await getSession();
      setSession(s);
      if (s) {
        const r = await resolveRole(s.user.id);
        setRole(r.uncertain ? null : r.role);
      }
      setReady(true);
      sub = onAuthChange(async (ns, event) => {
        setSession(ns);
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
          return;
        }
        if (!ns) {
          setRole(null);
          setSelected(null);
          setRows(null);
          setPasswordRecovery(false);
          return;
        }
        const r = await resolveRole(ns.user.id);
        setRole((prev) => {
          // Geçici ağ hatasında staff oturumunu düşürme
          if (r.uncertain) return prev;
          return r.role;
        });
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
    else if (sub && (PROCESS_PIPELINE.has(sub) || STAFF_PIPELINE.has(sub))) {
      stage = sub === 'cards' ? 'staff' : (sub === 'concluded' ? 'interviews' : sub);
    }
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
          const r = await resolveRole(session.user.id);
          if (!r.uncertain) setRole(r.role);
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
          <div className="ecBrandBlock">
            <span className="ecBrandName">Turquz</span>
            <span className="ecBrandSub">{t('agency_ops_sub') || ''}</span>
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
                <span>{t('home_announce_short')}</span>
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
          {(cat === 'pool' || cat === 'pipeline') ? (
            <div className="ecSearchBar">
              <Icon name="search" size={18} />
              <input
                placeholder={t('agency_code_ph') || t('agency_search') || ''}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setSelected(null);
                }}
              />
              {q ? (
                <button type="button" className="ecSearchClear" onClick={() => setQ('')} title={t('agency_clear') || ''}>✕</button>
              ) : null}
            </div>
          ) : null}
          {cat === 'ops' ? (
            <OpsDesk
              agencyId={session.user.id}
              onOpen={openCandidate}
              onNavigateCat={navigateCat}
            />
          ) : null}
          {cat === 'hotels' ? (
            <Hotels
              agencyId={session.user.id}
              onOpen={openCandidate}
              onOpenPipeline={(emp) => {
                setSelected(null);
                setCat('pipeline');
                setPipelineStage('staff');
                setProcessJump('staff');
                setPipelineEmployerFilter({ id: emp.id, name: emp.name || '' });
                writeEmployerPipelineFilter(emp.id, emp.name || '');
              }}
            />
          ) : null}
          {cat === 'messages' ? (
            <ChatInbox agencyId={session.user.id} onOpen={openCandidate} />
          ) : null}
          {cat === 'pipeline' ? (() => {
            const phaseId = phaseOfPipelineStage(pipelineStage);
            const phaseDef = pipelinePhaseById(phaseId);
            const archive = phaseDef.archive;
            return (
              <div className="pipeNav">
                <div className="pipePhaseTrack">
                  {PIPELINE_PHASES.map((ph) => {
                    const on = phaseId === ph.id;
                    return (
                      <button
                        key={ph.id}
                        type="button"
                        className={`pipePhase ${on ? 'on' : ''}`}
                        onClick={() => {
                          if (on) return;
                          setPipelineStage(ph.defaultStage);
                          setProcessJump(ph.defaultStage);
                        }}
                      >
                        {t(ph.labelKey)}
                      </button>
                    );
                  })}
                </div>
                <div className="pipeStageRow">
                  {[...phaseDef.stages, ...(archive ? [archive] : [])].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`pipeStage ${pipelineStage === s.id ? 'on' : ''}`}
                      onClick={() => {
                        setPipelineStage(s.id);
                        setProcessJump(s.id);
                      }}
                    >
                      {t(s.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })() : null}
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
              employerFilter={cat === 'pipeline' ? pipelineEmployerFilter : null}
              onClearEmployerFilter={() => {
                setPipelineEmployerFilter(null);
                writeEmployerPipelineFilter(null);
              }}
            />
          ) : null}
        </div>
        {selected ? (
          <Candidate
            sel={selected}
            detailTab={detailTab}
            onDetailTabChange={setDetailTab}
            onBack={() => { setSelected(null); setDetailTab('cv'); refreshChatBadge(); }}
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
          onDone={async (u) => {
            setSession((s) => ({ ...s, user: u }));
            setAgencyProfile(await getAgencyProfile(session.user.id));
            setEditProfile(false);
          }}
          onCancel={() => setEditProfile(false)}
        />
      ) : null}
    </div>
  );
}
