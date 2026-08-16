// App.js
// Akış: dil seçimi -> (oturum yoksa) giriş/kayıt -> karşılama -> form -> teşekkür -> home.
// Oturum Supabase'te tutulur; uygulama açılışında okunur, değişimi dinlenir.
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { resolveDeviceLang } from './i18n/languages';
import LanguageSelect from './screens/LanguageSelect';
import AuthScreen from './screens/AuthScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import ThankYouScreen from './screens/ThankYouScreen';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import LanguageSettings from './screens/LanguageSettings';
import PortalScreen from './screens/PortalScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import CvWizard from './wizard/CvWizard';
import AgencyHomeScreen from './screens/AgencyHomeScreen';
import AgencySetupScreen from './screens/AgencySetupScreen';
import AgencyCandidateScreen from './screens/AgencyCandidateScreen';
import { getSession, onAuthChange, signOut } from './lib/auth';
import {
  createSessionFromUrl, getInitialAuthUrl, isAuthCallbackUrl, subscribeAuthUrls,
} from './lib/authDeepLink';
import { saveProfile, loadProfile } from './lib/profile';
import { getRole, getCandidateById } from './lib/roles';
import { isAgencySetupComplete } from './lib/agencyProfile';
import { registerForPush, notifyNewCandidate, scanInterviewReminders, scanInterviewSla, scheduleDailyActivityNudge, cancelDailyActivityNudge } from './lib/push';
import { scanEmploymentLifecycle } from './lib/employment';
import { startLastSeenTracking } from './lib/lastSeen';
import { checkForOtaUpdate } from './lib/updates';
import { syncAppIconTheme, watchAppIconTheme } from './lib/appIcon';
import { withTimeout } from './lib/bootstrap';

// Akış aşamaları
const STAGE = {
  PORTAL: 'portal', LANG: 'lang', AUTH: 'auth', WELCOME: 'welcome', FORM: 'form',
  THANKS: 'thanks', HOME: 'home', SETTINGS: 'settings', LANG_SETTINGS: 'lang_settings', DOCS: 'docs',
  AGENCY: 'agency', AGENCY_CANDIDATE: 'agency_candidate', RESET_PASSWORD: 'reset_password',
};

function Root() {
  const { lang, t } = useLanguage(); // adayın yazdığı dil -> source_lang olarak kaydedilir
  const [stage, setStage] = useState(STAGE.PORTAL);
  const [authPortal, setAuthPortal] = useState('candidate'); // portaldan seçilen giriş türü
  const [data, setData] = useState({});
  const [startStep, setStartStep] = useState(0);
  const [notifications, setNotifications] = useState(true);
  const [langReturn, setLangReturn] = useState(STAGE.WELCOME); // dil seçiminden sonra nereye
  const [hasCv, setHasCv] = useState(false);
  const [formExit, setFormExit] = useState(STAGE.WELCOME);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [finishTo, setFinishTo] = useState(STAGE.THANKS);

  const [session, setSession] = useState(null);       // Supabase oturumu
  const [authReady, setAuthReady] = useState(false);  // ilk oturum okuması bitti mi
  const [role, setRole] = useState('candidate');      // 'candidate' | 'agency' | 'admin'
  const [roleReady, setRoleReady] = useState(false);  // getRole bitmeden aday varsayılanıyla nudge planlanmasın
  const [agencySetupOk, setAgencySetupOk] = useState(null); // null=yükleniyor, true/false
  const [selectedCandidate, setSelectedCandidate] = useState(null); // acente: seçili aday
  const [docsOpenChat, setDocsOpenChat] = useState(false); // aday: bildirimden belgeleri+chat aç
  const [docsScrollStep, setDocsScrollStep] = useState(null); // kariyer kartı: ilgili aşamaya kaydır
  const [docsReturnJourney, setDocsReturnJourney] = useState(false); // detaylardan geri → yol haritası
  const [homeJourneyOpen, setHomeJourneyOpen] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const handledPushTapRef = useRef(null);
  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const [fontsReady] = useFonts({ PlayfairDisplay_700Bold, Inter_400Regular, Inter_700Bold, Cinzel_700Bold, DancingScript_700Bold });

  // Release build: OTA (arka planda indir; açılışı bloklamaz).
  useEffect(() => {
    checkForOtaUpdate();
  }, []);

  // Gece/gündüz ikon — oturum hazır olduktan sonra (açılışı yavaşlatmasın).
  useEffect(() => {
    if (!authReady) return undefined;
    syncAppIconTheme();
    return watchAppIconTheme();
  }, [authReady]);

  // Acente kurulum kapısı (vergi levhası + 2 telefon + yetkili)
  useEffect(() => {
    let cancelled = false;
    if (role !== 'agency' || !session?.user?.id) {
      setAgencySetupOk(true);
      return undefined;
    }
    setAgencySetupOk(null);
    isAgencySetupComplete(session.user.id).then((ok) => {
      if (!cancelled) setAgencySetupOk(!!ok);
    }).catch(() => {
      if (!cancelled) setAgencySetupOk(false);
    });
    return () => { cancelled = true; };
  }, [role, session?.user?.id]);

  // Açılışta oturumu oku + deep link (şifre sıfırlama) + değişimi dinle
  useEffect(() => {
    let sub;
    let cancelled = false;
    let unsubLink;

    const enterAfterAuth = async (session) => {
      if (!session || cancelled) return;
      setSession(session);
      const r = await withTimeout(getRole(session.user.id), 8_000, 'role').catch(() => 'candidate');
      if (cancelled) return;
      setRole(r);
      setRoleReady(true);
      if (r === 'agency' || r === 'admin') {
        setStage(STAGE.AGENCY);
      } else {
        const saved = await withTimeout(loadProfile(session.user.id), 8_000, 'profile').catch(() => null);
        if (cancelled) return;
        if (saved) { setData(saved); setHasCv(true); }
        setStage(STAGE.HOME);
      }
    };

    const handleAuthUrl = async (url) => {
      if (!url || !isAuthCallbackUrl(url)) return false;
      try {
        const res = await createSessionFromUrl(url);
        if (!res?.session || cancelled) return !!res?.session;
        setSession(res.session);
        const isRecovery = res.type === 'recovery' || String(url).includes('type=recovery');
        if (isRecovery) {
          setPasswordRecovery(true);
          setStage(STAGE.RESET_PASSWORD);
          return true;
        }
        await enterAfterAuth(res.session);
        return true;
      } catch (e) {
        console.warn('[auth-link]', e?.message || e);
        return false;
      }
    };

    (async () => {
      try {
        const initialUrl = await getInitialAuthUrl();
        const fromLink = await handleAuthUrl(initialUrl);
        if (cancelled) return;
        if (!fromLink) {
          const { session } = await withTimeout(getSession(), 12_000, 'session');
          if (cancelled) return;
          if (session) await enterAfterAuth(session);
        }
      } catch (e) {
        console.warn('[bootstrap] Açılış oturumu:', e?.message || e);
      } finally {
        if (!cancelled) {
          setAuthReady(true);
          sub = onAuthChange((s, event) => {
            setSession(s);
            if (event === 'PASSWORD_RECOVERY') {
              setPasswordRecovery(true);
              setStage(STAGE.RESET_PASSWORD);
              return;
            }
            if (!s) {
              setData({});
              setHasCv(false);
              setRole('candidate');
              setRoleReady(false);
              setSelectedCandidate(null);
              setPasswordRecovery(false);
              setStage(STAGE.PORTAL);
              cancelDailyActivityNudge();
            }
          });
          unsubLink = subscribeAuthUrls((url) => { handleAuthUrl(url); });
        }
      }
    })();
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe?.();
      unsubLink?.();
    };
  }, []);

  // Push token + alıcının bildirim dili (push_tokens.locale). Dil değişince yeniden kaydet.
  useEffect(() => {
    if (session?.user?.id) {
      registerForPush(session.user.id, lang);
      scanInterviewReminders();
      scanInterviewSla();
      scanEmploymentLifecycle();
    }
  }, [session?.user?.id, lang]);

  // Push bildirimine tıklanınca (chat_message → sohbet ekranı).
  useEffect(() => {
    if (!authReady || !session?.user?.id || !roleReady) return undefined;

    const openFromPushData = async (data) => {
      if (!data || data.kind !== 'chat_message') return;
      if (role === 'agency' || role === 'admin') {
        const id = data.candidateUserId;
        if (!id) return;
        try {
          const c = await getCandidateById(id);
          if (c) {
            setSelectedCandidate({ c, st: { _openChat: true } });
            setStage(STAGE.AGENCY_CANDIDATE);
          }
        } catch (e) { /* yoksay */ }
      } else {
        setDocsOpenChat(true);
        setDocsScrollStep(null);
        setStage(STAGE.DOCS);
      }
    };

    const handleResponse = (response) => {
      if (!response) return;
      const id = response?.notification?.request?.identifier;
      if (id && handledPushTapRef.current === id) return;
      if (id) handledPushTapRef.current = id;
      openFromPushData(response?.notification?.request?.content?.data);
      Notifications.clearLastNotificationResponseAsync?.().catch?.(() => {});
    };

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    Notifications.getLastNotificationResponseAsync?.()
      .then(handleResponse)
      .catch(() => {});

    return () => sub.remove();
  }, [authReady, session?.user?.id, roleReady, role]);

  // Aday: last_seen + günlük "app'e gir" hatırlatması. Acente/admin asla planlanmaz; eski plan iptal.
  // role satırı henüz yoksa (OAuth defer) getRole 'candidate' döner — yine de izle.
  useEffect(() => {
    if (!session?.user?.id || !roleReady) return undefined;
    if (role === 'agency' || role === 'admin') {
      cancelDailyActivityNudge();
      return undefined;
    }
    const stop = startLastSeenTracking();
    scheduleDailyActivityNudge({
      title: t('activity_nudge_title') || 'Turquz',
      body: t('activity_nudge_body') || 'Bugün uygulamaya bir kez gir — profilin havuzda daha görünür olur.',
    });
    return stop;
  }, [session?.user?.id, role, roleReady, lang, t]);

  // CV'yi Supabase'e kaydet (fire-and-forget; navigasyonu bloklamaz).
  const persist = (d) => {
    if (session?.user?.id) saveProfile(session.user.id, d, lang).catch((e) => console.warn('CV kaydedilemedi:', e?.message));
  };

  const handleSubmit = () => {
    const isNew = !hasCv; // havuza İLK kez düşen aday
    // Kaydı bitir; ilk kayıtsa (reg_no atandıktan sonra) acentelere "yeni aday" bildirimi at.
    if (session?.user?.id) {
      saveProfile(session.user.id, data, lang)
        .then(() => { if (isNew) notifyNewCandidate(); })
        .catch((e) => console.warn('CV kaydedilemedi:', e?.message));
    }
    setHasCv(true);
    setStage(STAGE.HOME);
  };

  const goForm = (step, exitTo, preview = false, finish = STAGE.THANKS) => {
    setStartStep(step); setFormExit(exitTo); setPreviewOnly(preview); setFinishTo(finish); setStage(STAGE.FORM);
  };

  const handleLogout = async () => {
    await signOut();
    setData({}); setHasCv(false); setRole('candidate'); setRoleReady(false); setSelectedCandidate(null);
    setPasswordRecovery(false);
    cancelDailyActivityNudge();
    setStage(STAGE.PORTAL);
  };

  const finishPasswordReset = async () => {
    setPasswordRecovery(false);
    if (!session?.user?.id) { setStage(STAGE.PORTAL); return; }
    const r = await getRole(session.user.id).catch(() => 'candidate');
    setRole(r);
    setRoleReady(true);
    if (r === 'agency' || r === 'admin') setStage(STAGE.AGENCY);
    else {
      const saved = await loadProfile(session.user.id).catch(() => null);
      if (saved) { setData(saved); setHasCv(true); }
      setStage(STAGE.HOME);
    }
  };

  // Oturum açılış okuması bitene kadar yükleniyor göster
  if (!authReady) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator color="#c2a25a" size="large" />
      </View>
    );
  }

  // Şifre sıfırlama kapısı — normal ana ekrana girmeden önce
  if (passwordRecovery || stage === STAGE.RESET_PASSWORD) {
    return (
      <ResetPasswordScreen
        onDone={finishPasswordReset}
        onCancel={handleLogout}
      />
    );
  }

  // Dil seçiminden sonra nereye: settings'ten gelindiyse HOME, ilk akışta WELCOME (CV varsa HOME).
  const afterLang = () => {
    if (role === 'agency' || role === 'admin') return STAGE.AGENCY;
    return langReturn === STAGE.HOME ? STAGE.HOME : (hasCv ? STAGE.HOME : STAGE.WELCOME);
  };

  switch (stage) {
    case STAGE.PORTAL:
      return (
        <PortalScreen
          fontsReady={fontsReady}
          onSelect={(p) => { setAuthPortal(p); setStage(STAGE.AUTH); }}
        />
      );

    case STAGE.AUTH:
      return (
        <AuthScreen
          fontsReady={fontsReady}
          portal={authPortal}
          onBack={() => setStage(STAGE.PORTAL)}
          onAuthed={async (s) => {
            setSession(s);
            const r = await getRole(s.user.id);
            setRole(r);
            setRoleReady(true);
            // Acente/admin: doğrudan havuza (dil/karşılama/CV adımları yok).
            if (r === 'agency' || r === 'admin') {
              setStage(STAGE.AGENCY);
            } else {
              // Aday: kayıtlı CV varsa doğrudan ana sayfa; yoksa ilk kayıt akışı.
              const saved = await loadProfile(s.user.id);
              if (saved) {
                setData(saved);
                setHasCv(true);
                setStage(STAGE.HOME);
              } else {
                setLangReturn(STAGE.WELCOME);
                setStage(STAGE.LANG);
              }
            }
          }}
        />
      );

    case STAGE.WELCOME:
      return <WelcomeScreen fontsReady={fontsReady} onStart={() => goForm(0, STAGE.WELCOME, false, STAGE.THANKS)} onBack={() => setStage(STAGE.LANG)} />;

    case STAGE.FORM:
      return (
        <CvWizard
          key={startStep}
          data={data}
          startStep={startStep}
          previewOnly={previewOnly}
          onChange={update}
          onExit={() => setStage(formExit)}
          onEdit={() => goForm(0, STAGE.HOME, false, STAGE.HOME)}
          onFinish={() => {
            if (finishTo === STAGE.THANKS) setStage(STAGE.THANKS);
            else { persist(data); setHasCv(true); setStage(finishTo); }
          }}
        />
      );

    case STAGE.THANKS:
      return (
        <ThankYouScreen
          fontsReady={fontsReady}
          onSubmit={handleSubmit}
          onBack={() => setStage(STAGE.FORM)}
        />
      );

    case STAGE.HOME:
      return (
        <HomeScreen
          fontsReady={fontsReady}
          data={data}
          userId={session?.user?.id}
          openJourney={homeJourneyOpen}
          onJourneyOpened={() => setHomeJourneyOpen(false)}
          onPreview={() => goForm(7, STAGE.HOME, true, STAGE.HOME)}
          onEdit={() => goForm(0, STAGE.HOME, false, STAGE.HOME)}
          onOpenSettings={() => setStage(STAGE.SETTINGS)}
          onOpenDocs={(opts) => {
            setDocsOpenChat(!!opts?.openChat);
            setDocsScrollStep(opts?.scrollToStep || null);
            setDocsReturnJourney(!!opts?.returnToJourney);
            setStage(STAGE.DOCS);
          }}
          onLogout={handleLogout}
          onSaveData={(patch) => { const nd = { ...data, ...patch }; setData(nd); persist(nd); }}
        />
      );

    case STAGE.DOCS:
      return (
        <DocumentsScreen
          fontsReady={fontsReady}
          data={data}
          userId={session?.user?.id}
          initialChatOpen={docsOpenChat}
          initialScrollStep={docsScrollStep}
          onBack={() => {
            const reopenJourney = docsReturnJourney;
            setDocsOpenChat(false);
            setDocsScrollStep(null);
            setDocsReturnJourney(false);
            setHomeJourneyOpen(reopenJourney);
            setStage(STAGE.HOME);
          }}
        />
      );

    case STAGE.SETTINGS:
      return (
        <SettingsScreen
          fontsReady={fontsReady}
          notifications={notifications}
          onToggleNotifications={setNotifications}
          isAgency={role === 'agency' || role === 'admin'}
          onBack={() => setStage(role === 'agency' || role === 'admin' ? STAGE.AGENCY : STAGE.HOME)}
          onChangeLanguage={() => setStage(STAGE.LANG_SETTINGS)}
          onLogout={handleLogout}
        />
      );

    case STAGE.LANG_SETTINGS:
      return (
        <LanguageSettings
          fontsReady={fontsReady}
          onBack={() => setStage(STAGE.SETTINGS)}
        />
      );

    case STAGE.AGENCY: {
      // Admin muaf; acente completed_at yoksa kurulum.
      if (role === 'agency') {
        if (agencySetupOk === null) {
          return (
            <View style={[styles.flex, styles.center]}>
              <ActivityIndicator color="#c2a25a" />
            </View>
          );
        }
        if (!agencySetupOk) {
          return (
            <AgencySetupScreen
              user={session.user}
              onDone={(u) => {
                setSession((s) => ({ ...s, user: u }));
                setAgencySetupOk(true);
              }}
              onLogout={handleLogout}
            />
          );
        }
      }
      return (
        <AgencyHomeScreen
          fontsReady={fontsReady}
          userId={session?.user?.id}
          onOpenCandidate={(c, st) => { setSelectedCandidate({ c, st }); setStage(STAGE.AGENCY_CANDIDATE); }}
          onLogout={handleLogout}
        />
      );
    }

    case STAGE.AGENCY_CANDIDATE:
      return (
        <AgencyCandidateScreen
          fontsReady={fontsReady}
          candidate={selectedCandidate?.c}
          agencyUserId={session?.user?.id}
          accepted={!!selectedCandidate?.st?.docs_unlocked || selectedCandidate?.st?.status === 'hired' || selectedCandidate?.st?.status === 'in_transit'}
          offered={selectedCandidate?.st?.status === 'offered'}
          hired={selectedCandidate?.st?.status === 'hired'}
          inTransit={selectedCandidate?.st?.status === 'in_transit'}
          openIvJoin={!!selectedCandidate?.st?._openIvJoin}
          openChat={!!selectedCandidate?.st?._openChat}
          openWorkStart={!!selectedCandidate?.st?._openWorkStart}
          openHireConfirm={!!selectedCandidate?.st?._openHireConfirm || selectedCandidate?.st?.status === 'in_transit'}
          onBack={() => { setSelectedCandidate(null); setStage(STAGE.AGENCY); }}
          onAccepted={() => { setSelectedCandidate(null); setStage(STAGE.AGENCY); }}
        />
      );

    case STAGE.LANG:
    default:
      return <LanguageSelect onDone={() => { const r = afterLang(); setLangReturn(STAGE.WELCOME); setStage(r); }} />;
  }
}

export default function App() {
  // Cihazın dilini oku, desteklenen 8 dile eşle (yoksa İngilizce).
  // Localization.getLocales() ilk öğe kullanıcının birincil dilidir.
  const deviceLang = (() => {
    try {
      const locales = Localization.getLocales?.() || [];
      const code = locales[0]?.languageCode || locales[0]?.languageTag;
      return resolveDeviceLang(code);
    } catch {
      return resolveDeviceLang(null);
    }
  })();

  return (
    <SafeAreaProvider>
      <LanguageProvider initialLang={deviceLang}>
        <View style={styles.flex}>
          <StatusBar barStyle="light-content" />
          <Root />
        </View>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1b2533' },
  center: { justifyContent: 'center', alignItems: 'center' },
});
