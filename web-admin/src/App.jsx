import { useEffect, useState } from 'react';
import {
  adminStats, getRole, getSession, onAuthChange, signOut,
} from './lib/api';
import Login from './screens/Login.jsx';
import Agencies from './screens/Agencies.jsx';
import Candidates from './screens/Candidates.jsx';
import Hotels from './screens/Hotels.jsx';
import Announcements from './screens/Announcements.jsx';
import Interventions from './screens/Interventions.jsx';
import ProcessChats from './screens/ProcessChats.jsx';
import OpsLog from './screens/OpsLog.jsx';
import AirportChecks from './screens/AirportChecks.jsx';
import Certificates from './screens/Certificates.jsx';

const TABS = [
  { id: 'overview', label: 'Özet' },
  { id: 'interventions', label: 'Müdahale', badgeKey: 'interventions' },
  { id: 'airport', label: 'Havaalanı', badgeKey: 'airport_checks' },
  { id: 'certificates', label: 'Sertifikalar', badgeKey: 'pending_certificates' },
  { id: 'announcements', label: 'Duyurular' },
  { id: 'ops', label: 'Kayıtlar' },
  { id: 'chats', label: 'Sohbetler' },
  { id: 'agencies', label: 'Acenteler' },
  { id: 'candidates', label: 'Adaylar' },
  { id: 'hotels', label: 'Oteller' },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [tab, setTab] = useState('overview');
  const [agencyId, setAgencyId] = useState(null);
  const [candidateId, setCandidateId] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let sub;
    (async () => {
      const s = await getSession();
      setSession(s);
      if (s) setRole(await getRole(s.user.id));
      setReady(true);
      sub = onAuthChange(async (ns) => {
        setSession(ns);
        setRole(ns ? await getRole(ns.user.id) : null);
        if (!ns) {
          setAgencyId(null);
          setCandidateId(null);
          setStats(null);
        }
      });
    })();
    return () => sub?.unsubscribe?.();
  }, []);

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!session || !isAdmin) return undefined;
    let alive = true;
    adminStats().then((s) => { if (alive) setStats(s); }).catch(() => {});
    return () => { alive = false; };
  }, [session, isAdmin, tab, agencyId, candidateId]);

  const logout = async () => { await signOut(); };

  if (!ready) return <div className="center full"><div className="spinner" /></div>;
  if (!session || !isAdmin) {
    return <Login wrongRole={!!session && !isAdmin} onLogout={logout} />;
  }

  const goTab = (id) => {
    setTab(id);
    setAgencyId(null);
    setCandidateId(null);
  };

  return (
    <div className="shell">
      <header className="top">
        <button type="button" className="topLogo" onClick={() => goTab('overview')} aria-label="Özet">
          <img src="/turquz-logo.png" alt="Turquz" />
        </button>
        <div className="topBrand">ADMIN</div>
        <nav className="topNav">
          {TABS.map((t) => {
            const badge = t.badgeKey ? stats?.[t.badgeKey] : 0;
            return (
              <button
                key={t.id}
                type="button"
                className={`navBtn ${tab === t.id ? 'on' : ''}`}
                onClick={() => goTab(t.id)}
              >
                {t.label}
                {badge > 0 ? <span className="navBadge">{badge}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="topRight">
          <span className="topWho">{session.user.email}</span>
          <button type="button" className="ghostBtn" style={{ color: '#fff', borderColor: '#33455a' }} onClick={logout}>
            Çıkış
          </button>
        </div>
      </header>
      <div className="accent" />

      <main className="main">
        {tab === 'overview' ? (
          <>
            <div className="stats">
              <div className="statCard">
                <div className="statLabel">Acenteler</div>
                <div className="statVal">{stats?.agencies ?? '—'}</div>
              </div>
              <div className="statCard">
                <div className="statLabel">Adaylar</div>
                <div className="statVal">{stats?.candidates ?? '—'}</div>
              </div>
              <div className="statCard">
                <div className="statLabel">Oteller</div>
                <div className="statVal">{stats?.hotels ?? 0}</div>
              </div>
              <div className="statCard">
                <div className="statLabel">Admin</div>
                <div className="statVal">{stats?.admins ?? '—'}</div>
              </div>
              <div className="statCard">
                <div className="statLabel">Müdahale bekleyen</div>
                <div className="statVal">{stats?.interventions ?? '—'}</div>
              </div>
              <div className="statCard">
                <div className="statLabel">Havaalanı uyarıları</div>
                <div className="statVal">{stats?.airport_checks ?? '—'}</div>
              </div>
              <div className="statCard">
                <div className="statLabel">Sertifika bekleyen</div>
                <div className="statVal">{stats?.pending_certificates ?? '—'}</div>
              </div>
            </div>
            <div className="card">
              <h2>Hızlı erişim</h2>
              <div className="actions">
                {(stats?.interventions ?? 0) > 0 ? (
                  <button type="button" className="goldBtn" style={{ width: 'auto' }} onClick={() => goTab('interventions')}>
                    Müdahale kuyruğu ({stats.interventions})
                  </button>
                ) : null}
                {(stats?.airport_checks ?? 0) > 0 ? (
                  <button type="button" className="goldBtn" style={{ width: 'auto' }} onClick={() => goTab('airport')}>
                    Havaalanı uyarıları ({stats.airport_checks})
                  </button>
                ) : null}
                {(stats?.pending_certificates ?? 0) > 0 ? (
                  <button type="button" className="goldBtn" style={{ width: 'auto' }} onClick={() => goTab('certificates')}>
                    Sertifika kuyruğu ({stats.pending_certificates})
                  </button>
                ) : null}
                <button type="button" className="goldBtn" style={{ width: 'auto' }} onClick={() => goTab('announcements')}>Duyuru gönder</button>
                <button type="button" className="goldBtn" style={{ width: 'auto' }} onClick={() => goTab('agencies')}>Acenteleri aç</button>
                <button type="button" className="goldBtn" style={{ width: 'auto' }} onClick={() => goTab('candidates')}>Adayları aç</button>
              </div>
              <p style={{ marginTop: 16, color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5 }}>
                Bu panel yalnızca <strong>admin</strong> rolüyle açılır. Satıra tıklayarak detay, belge ve vergi levhasına ulaşır;
                gerekirse hesabı sistemden kalıcı silebilirsin.
              </p>
            </div>
          </>
        ) : null}

        {tab === 'agencies' ? (
          <Agencies
            selectedId={agencyId}
            onSelect={setAgencyId}
            onOpenCandidate={(id) => {
              setAgencyId(null);
              setCandidateId(id);
              setTab('candidates');
            }}
          />
        ) : null}

        {tab === 'candidates' ? (
          <Candidates selectedId={candidateId} onSelect={setCandidateId} />
        ) : null}

        {tab === 'announcements' ? <Announcements /> : null}
        {tab === 'interventions' ? (
          <Interventions
            onOpenCandidate={(id) => {
              setCandidateId(id);
              setTab('candidates');
            }}
          />
        ) : null}
        {tab === 'airport' ? (
          <AirportChecks
            onOpenCandidate={(id) => {
              setCandidateId(id);
              setTab('candidates');
            }}
          />
        ) : null}
        {tab === 'certificates' ? (
          <Certificates
            onOpenCandidate={(id) => {
              setCandidateId(id);
              setTab('candidates');
            }}
          />
        ) : null}
        {tab === 'chats' ? <ProcessChats /> : null}
        {tab === 'ops' ? <OpsLog /> : null}
        {tab === 'hotels' ? <Hotels /> : null}
      </main>
    </div>
  );
}
