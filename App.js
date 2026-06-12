// App.js
// Akış: dil seçimi -> (oturum yoksa) giriş/kayıt -> karşılama -> form -> teşekkür -> home.
// Oturum Supabase'te tutulur; uygulama açılışında okunur, değişimi dinlenir.
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

import { LanguageProvider } from './i18n/LanguageContext';
import { resolveDeviceLang } from './i18n/languages';
import LanguageSelect from './screens/LanguageSelect';
import AuthScreen from './screens/AuthScreen';
import WelcomeScreen from './screens/WelcomeScreen';
import ThankYouScreen from './screens/ThankYouScreen';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import LanguageSettings from './screens/LanguageSettings';
import PortalScreen from './screens/PortalScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import CvWizard from './wizard/CvWizard';
import AgencyHomeScreen from './screens/AgencyHomeScreen';
import AgencyCandidateScreen from './screens/AgencyCandidateScreen';
import { getSession, onAuthChange, signOut } from './lib/auth';
import { saveProfile, loadProfile } from './lib/profile';
import { getRole } from './lib/roles';
import { registerForPush, notifyNewCandidate } from './lib/push';

// Akış aşamaları
const STAGE = {
  PORTAL: 'portal', LANG: 'lang', AUTH: 'auth', WELCOME: 'welcome', FORM: 'form',
  THANKS: 'thanks', HOME: 'home', SETTINGS: 'settings', LANG_SETTINGS: 'lang_settings', DOCS: 'docs',
  AGENCY: 'agency', AGENCY_CANDIDATE: 'agency_candidate',
};

function Root() {
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
  const [selectedCandidate, setSelectedCandidate] = useState(null); // acente: seçili aday
  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const [fontsReady] = useFonts({ PlayfairDisplay_700Bold, Inter_400Regular, Inter_700Bold, Cinzel_700Bold, DancingScript_700Bold });

  // Açılışta oturumu oku + değişimi dinle
  useEffect(() => {
    let sub;
    (async () => {
      const { session } = await getSession();
      setSession(session);
      // Oturum varsa role'e göre yönlendir; yoksa giriş ekranında kal.
      if (session) {
        const r = await getRole(session.user.id);
        setRole(r);
        registerForPush(session.user.id); // push token kaydı (build'de çalışır)
        if (r === 'agency' || r === 'admin') {
          setStage(STAGE.AGENCY);
        } else {
          const saved = await loadProfile(session.user.id);
          if (saved) { setData(saved); setHasCv(true); }
          setStage(STAGE.HOME);
        }
      }
      setAuthReady(true);
      sub = onAuthChange((s) => setSession(s));
    })();
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, []);

  // CV'yi Supabase'e kaydet (fire-and-forget; navigasyonu bloklamaz).
  const persist = (d) => {
    if (session?.user?.id) saveProfile(session.user.id, d).catch((e) => console.warn('CV kaydedilemedi:', e?.message));
  };

  const handleSubmit = () => {
    const isNew = !hasCv; // havuza İLK kez düşen aday
    // Kaydı bitir; ilk kayıtsa (reg_no atandıktan sonra) acentelere "yeni aday" bildirimi at.
    if (session?.user?.id) {
      saveProfile(session.user.id, data)
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
    setData({}); setHasCv(false); setRole('candidate'); setSelectedCandidate(null);
    setStage(STAGE.PORTAL);
  };

  // Oturum açılış okuması bitene kadar yükleniyor göster
  if (!authReady) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator color="#c2a25a" size="large" />
      </View>
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
            registerForPush(s.user.id); // push token kaydı (build'de çalışır)
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
          onPreview={() => goForm(7, STAGE.HOME, true, STAGE.HOME)}
          onEdit={() => goForm(0, STAGE.HOME, false, STAGE.HOME)}
          onOpenSettings={() => setStage(STAGE.SETTINGS)}
          onOpenDocs={() => setStage(STAGE.DOCS)}
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
          onBack={() => setStage(STAGE.HOME)}
        />
      );

    case STAGE.SETTINGS:
      return (
        <SettingsScreen
          fontsReady={fontsReady}
          notifications={notifications}
          onToggleNotifications={setNotifications}
          onBack={() => setStage(STAGE.HOME)}
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

    case STAGE.AGENCY:
      return (
        <AgencyHomeScreen
          fontsReady={fontsReady}
          userId={session?.user?.id}
          onOpenCandidate={(c, st) => { setSelectedCandidate({ c, st }); setStage(STAGE.AGENCY_CANDIDATE); }}
          onLogout={handleLogout}
        />
      );

    case STAGE.AGENCY_CANDIDATE:
      return (
        <AgencyCandidateScreen
          fontsReady={fontsReady}
          candidate={selectedCandidate?.c}
          agencyUserId={session?.user?.id}
          accepted={!!selectedCandidate?.st?.docs_unlocked}
          offered={selectedCandidate?.st?.status === 'offered'}
          onBack={() => setStage(STAGE.AGENCY)}
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
