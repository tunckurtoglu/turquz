import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getSession, onAuthChange, getRole, signOut, listPool, categoryOf, scanDocsDeadline, scanInterviewReminders, scanInterviewSla, isAgencySetupComplete } from './lib/api';
import { useLang } from './i18n.jsx';
import Login from './screens/Login.jsx';
import ResetPassword from './screens/ResetPassword.jsx';
import AgencySetup from './screens/AgencySetup.jsx';
import Pool from './screens/Pool.jsx';
import Candidate from './screens/Candidate.jsx';
import { Icon } from './components/Icon.jsx';
import NotifBell from './components/NotifBell.jsx';
import { getAgencyNotifPrefs, setAgencyNotifPrefs, syncChatLang } from './lib/processChat';

// Mobil ile aynı: Havuz / Süreç / Personel (Teklifli kart rozetiyle havuzda kalır)
const CATS = [
  { id: 'pool', label: 'Havuz' },
  { id: 'process', label: 'Süreç' },
  { id: 'hired', label: 'Personel' },
];
const normalizeCat = (c) => (['pool', 'process', 'hired'].includes(c) ? c : 'pool');

// Yenilemede seçili sekme + aday korunsun diye durumu URL hash'inde tutarız (router yok).
const readHash = () => {
  const h = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  return { cat: normalizeCat(h.get('cat')), c: h.get('c') };
};
const writeHash = (catVal, cId) => {
  const p = new URLSearchParams();
  if (catVal && catVal !== 'pool') p.set('cat', catVal);
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
  const [editProfile, setEditProfile] = useState(false); // acente bilgilerini düzenle modalı
  const [notifOpen, setNotifOpen] = useState(false);
  const [generalPush, setGeneralPush] = useState(true);
  const [chatPush, setChatPush] = useState(true);
  const scrollRef = useRef(0);
  const restoredRef = useRef(false);
  // İlk hash'teki aday kimliğini render anında yakala (writeHash efekti onu silmeden önce).
  const pendingCandidateRef = useRef(readHash().c);

  // Adaya girerken havuzdaki kaydırma konumunu sakla, dönünce aynı yere getir.
  // (Pool unmount EDİLMEZ; gizlenir — böylece filtreler ve açık facet'ler korunur.)
  useLayoutEffect(() => {
    if (selected) window.scrollTo(0, 0);
    else window.scrollTo(0, scrollRef.current);
  }, [selected]);
  const openCandidate = (c) => { scrollRef.current = window.scrollY; setSelected(c); };
  const goHome = () => { setSelected(null); setCat('pool'); setQ(''); };

  // Durumu URL hash'ine yaz (yenilemede korunsun). Auth recovery hash'ini ezme.
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

  // Yenileme sonrası: satırlar yüklenince hash'teki adayı bir kez geri yükle.
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

  // Dil değişiminde liste/tarama yeniden çalışmasın (ayar paneli donmasın).
  useEffect(() => {
    if (!session || !isStaff) return;
    scanDocsDeadline();
    scanInterviewReminders();
    scanInterviewSla();
    getAgencyNotifPrefs().then((p) => {
      setGeneralPush(p.generalPush);
      setChatPush(p.chatPush);
    });
  }, [session, isStaff]);
  useEffect(() => {
    if (!session || !isStaff) return;
    syncChatLang(lang);
  }, [session, isStaff, lang]);

  // Ayar menüsü dışına tıklayınca kapat
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

  const counts = useMemo(() => {
    const c = { pool: 0, process: 0, hired: 0 };
    (rows || []).forEach((r) => {
      const k = categoryOf(r.st);
      if (k === 'hired') c.hired += 1;
      else {
        c.pool += 1;
        if (k === 'process') c.process += 1;
      }
    });
    return c;
  }, [rows]);

  const logout = async () => {
    await signOut();
    setSelected(null);
    setPasswordRecovery(false);
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
  const agencyName = meta.full_name || meta.name
    || [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim()
    || (session.user.email ? session.user.email.split('@')[0] : 'Acente');

  return (
    <div className="ec">
      <div className="ecTop">
        <header className="ecHeader">
          <button className="ecLogo" onClick={goHome} title="Ana sayfa" aria-label="Ana sayfa"><img src="/turquz-logo.png" alt="Turquz" /></button>
          <div className="ecSearch">
            <Icon name="search" size={18} />
            <input placeholder="Aday ara — kod, pozisyon, uyruk…" value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }} />
            {q ? <button className="ecSearchClear" onClick={() => setQ('')} title="Temizle">✕</button> : null}
          </div>
          <div className="ecRight">
            <div className="ecWho clickable" onClick={() => setEditProfile(true)} title="Bilgileri düzenle">
              <span className="ecWhoLabel">Acente</span>
              <span className="ecWhoName">{agencyName}</span>
            </div>
            <NotifBell userId={session.user.id} />
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

                  <div className="ecSettingsBlock">
                    <div className="ecSettingsLabel">{t('set_language') || 'Dil'}</div>
                    <div className="ecLangGrid">
                      {languages.map((l) => (
                        <button
                          key={l.code}
                          type="button"
                          className={`ecLangChip ${lang === l.code ? 'on' : ''}`}
                          onClick={() => {
                            setLang(l.code);
                            setAgencyNotifPrefs({ generalPush, chatPush, preferredLang: l.code }).catch(() => {});
                          }}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
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
                </div>
              ) : null}
            </div>
            <button className="ecAccount" onClick={logout}><Icon name="logout" size={16} /> {t('set_logout') || 'Çıkış'}</button>
          </div>
        </header>

        <div className="ecCatsBar">
          <div className="segTrack">
            {CATS.map((c) => (
              <button
                key={c.id}
                className={`segItem ${cat === c.id ? 'on' : ''}`}
                onClick={() => { setCat(c.id); setSelected(null); }}
              >
                {c.label}
                {counts[c.id] != null ? <span className="segCount">{counts[c.id]}</span> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="ecAccent" />
      </div>

      <main className="ecMain">
        <div style={{ display: selected ? 'none' : 'block' }}>
          <Pool
            category={cat}
            query={q}
            rows={rows}
            onOpen={openCandidate}
            agencyId={session.user.id}
            onRefresh={() => listPool().then(setRows).catch(() => {})}
          />
        </div>
        {selected ? <Candidate sel={selected} onBack={() => setSelected(null)} agencyUserId={session.user.id} /> : null}
      </main>

      {editProfile ? (
        <AgencySetup
          user={session.user}
          onDone={(u) => { setSession((s) => ({ ...s, user: u })); setEditProfile(false); }}
          onCancel={() => setEditProfile(false)}
        />
      ) : null}
    </div>
  );
}
