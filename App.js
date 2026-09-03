// App.js
// Akış: dil seçimi -> (oturum yoksa) giriş/kayıt -> karşılama -> form -> teşekkür -> home.
// Oturum Supabase'te tutulur; uygulama açılışında okunur, değişimi dinlenir.
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { useFonts, PlayfairDisplay_400Regular, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { Cinzel_400Regular, Cinzel_600SemiBold, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { resolveDeviceLang } from './i18n/languages';
import LanguageSelect from './screens/LanguageSelect';
import AuthScreen from './screens/AuthScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import PortalScreen from './screens/PortalScreen';
// Ağır ekranlar açılışta yüklenmez — build 10'da statik import native çökme riski.
const WelcomeScreen = lazy(() => import('./screens/WelcomeScreen'));
const ThankYouScreen = lazy(() => import('./screens/ThankYouScreen'));
const HomeScreen = lazy(() => import('./screens/HomeScreen'));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'));
const LanguageSettings = lazy(() => import('./screens/LanguageSettings'));
const DocumentsScreen = lazy(() => import('./screens/DocumentsScreen'));
const CvWizard = lazy(() => import('./wizard/CvWizard'));
const AgencyHomeScreen = lazy(() => import('./screens/AgencyHomeScreen'));
const AgencySetupScreen = lazy(() => import('./screens/AgencySetupScreen'));
const AgencyCandidateScreen = lazy(() => import('./screens/AgencyCandidateScreen'));
import { getSession, onAuthChange, signOut } from './lib/auth';
import {
  createSessionFromUrl, getInitialAuthUrl, isAuthCallbackUrl, subscribeAuthUrls,
} from './lib/authDeepLink';
import { saveProfile, loadProfile } from './lib/profile';
import { resolveRole, loadCachedRole, getCandidateById } from './lib/roles';
import { isAgencySetupComplete } from './lib/agencyProfile';
import { registerForPush, notifyNewCandidate, scanOps, scheduleDailyActivityNudge, cancelDailyActivityNudge } from './lib/push';
import { startLastSeenTracking } from './lib/lastSeen';
import { withTimeout } from './lib/bootstrap';
import { checkForOtaUpdate } from './lib/updates';
import { registerPrivacyOpener } from './lib/config';
import PrivacyNoticeSheet from './components/PrivacyNoticeSheet';
import ConsentSheet from './components/ConsentSheet';
import { getLatestConsent, saveConsent, hasAccountConsent } from './lib/consent';

function ScreenFallback() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1b2533', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#c2a25a" size="large" />
    </View>
  );
}

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
  const [roleBlocked, setRoleBlocked] = useState(false); // rol doğrulanamadı — aday paneline düşme
  const [roleRetrying, setRoleRetrying] = useState(false);
  const [agencySetupOk, setAgencySetupOk] = useState(null); // null=yükleniyor, true/false
  const [selectedCandidate, setSelectedCandidate] = useState(null); // acente: seçili aday
  const [agencyReturn, setAgencyReturn] = useState(null);
  const [docsOpenChat, setDocsOpenChat] = useState(false); // aday: bildirimden belgeleri+chat aç
  const [docsScrollStep, setDocsScrollStep] = useState(null); // kariyer kartı: ilgili aşamaya kaydır
  const [docsReturnJourney, setDocsReturnJourney] = useState(false); // detaylardan geri → yol haritası
  const [homeJourneyOpen, setHomeJourneyOpen] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [accountConsentOk, setAccountConsentOk] = useState(null); // null=yükleniyor, true/false
  const [consentBusy, setConsentBusy] = useState(false);
  const handledPushTapRef = useRef(null);
  const enterAfterAuthRef = useRef(null);
  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const [fontsReady] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_700Bold,
    Cinzel_400Regular,
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    DancingScript_700Bold,
  });

  // OTA: açılışta değil — panel açıldıktan sonra arka planda indir (reload yok).
  useEffect(() => {
    if (stage !== STAGE.HOME && stage !== STAGE.AGENCY) return undefined;
    if (!authReady || !roleReady || roleBlocked) return undefined;
    const t = setTimeout(() => { checkForOtaUpdate().catch(() => {}); }, 8_000);
    return () => clearTimeout(t);
  }, [stage, authReady, roleReady, roleBlocked]);

  // Acente kurulum kapısı
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

  // Aday: hesap/CV öncesi asgari KVKK rızası (genel + yurt dışı)
  useEffect(() => {
    if (!session?.user?.id) {
      setAccountConsentOk(null);
      return undefined;
    }
    if (!roleReady || roleBlocked) return undefined;
    if (role !== 'candidate') {
      setAccountConsentOk(true);
      return undefined;
    }
    let cancelled = false;
    setAccountConsentOk(null);
    getLatestConsent(session.user.id)
      .then((row) => { if (!cancelled) setAccountConsentOk(hasAccountConsent(row)); })
      .catch(() => { if (!cancelled) setAccountConsentOk(false); });
    return () => { cancelled = true; };
  }, [session?.user?.id, role, roleReady, roleBlocked]);

  // Açılışta oturumu oku + deep link (şifre sıfırlama) + değişimi dinle
  useEffect(() => {
    let sub;
    let cancelled = false;
    let unsubLink;

    const applyResolvedRole = async (session, resolved) => {
      if (!session || cancelled) return;
      if (resolved.uncertain || !resolved.role) {
        setRoleBlocked(true);
        setRoleReady(false);
        return;
      }
      setRoleBlocked(false);
      setRole(resolved.role);
      setRoleReady(true);
      if (resolved.role === 'agency' || resolved.role === 'admin') {
        setStage(STAGE.AGENCY);
      } else {
        const saved = await withTimeout(loadProfile(session.user.id), 8_000, 'profile').catch(() => null);
        if (cancelled) return;
        if (saved) { setData(saved); setHasCv(true); }
        setStage(STAGE.HOME);
      }
    };

    const enterAfterAuth = async (session) => {
      if (!session || cancelled) return;
      setSession(session);
      let resolved;
      try {
        resolved = await withTimeout(resolveRole(session.user.id), 8_000, 'role');
      } catch (e) {
        const cached = await loadCachedRole(session.user.id);
        if (cached) {
          console.warn('[role] timeout/cache:', e?.message, cached);
          resolved = { role: cached, source: 'cache', uncertain: false, error: e?.message };
        } else {
          console.warn('[role] timeout, belirsiz:', e?.message);
          resolved = { role: null, source: 'error', uncertain: true, error: e?.message };
        }
      }
      if (cancelled) return;
      await applyResolvedRole(session, resolved);
    };

    enterAfterAuthRef.current = enterAfterAuth;

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
              setRoleBlocked(false);
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

  const retryRoleResolve = useCallback(async () => {
    const s = session;
    if (!s?.user?.id || !enterAfterAuthRef.current) return;
    setRoleRetrying(true);
    try {
      await enterAfterAuthRef.current(s);
    } finally {
      setRoleRetrying(false);
    }
  }, [session]);

  // Push token + alıcının bildirim dili (push_tokens.locale). Dil değişince yeniden kaydet.
  useEffect(() => {
    if (session?.user?.id) {
      registerForPush(session.user.id, lang);
      scanOps();
    }
  }, [session?.user?.id, lang]);

  // Push bildirimine tıklanınca (chat_message → sohbet ekranı).
  useEffect(() => {
    if (!authReady || !session?.user?.id || !roleReady) return undefined;

    const openFromPushData = async (data) => {
      if (!data?.kind) return;
      if (data.kind === 'chat_message') {
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
        return;
      }
      if (data.kind === 'boarding_check' && role !== 'agency' && role !== 'admin') {
        setStage(STAGE.HOME);
        return;
      }
      const docsKinds = new Set(['flight_ticket', 'flight_ticket_ready', 'flight_ticket_updated', 'document', 'pickup', 'reupload', 'agency_doc_retracted', 'agency_doc_updated', 'accepted', 'docs_extra']);
      if (docsKinds.has(data.kind) && role !== 'agency' && role !== 'admin') {
        setDocsOpenChat(false);
        const step = Number(data.scrollToStep);
        if (step >= 1 && step <= 7) setDocsScrollStep(step);
        else if (data.kind === 'pickup') setDocsScrollStep(6);
        else if (data.kind === 'flight_ticket' || data.kind === 'flight_ticket_ready') setDocsScrollStep(5);
        else setDocsScrollStep(null);
        setStage(STAGE.DOCS);
        return;
      }
      if ((data.kind === 'work_start_confirm' || data.kind === 'work_start_remind' || data.kind === 'transit_stalled') && (role === 'agency' || role === 'admin')) {
        const id = data.candidateUserId;
        if (!id) return;
        try {
          const c = await getCandidateById(id);
          if (c) {
            setSelectedCandidate({ c, st: { _openHireConfirm: true, status: 'in_transit' } });
            setStage(STAGE.AGENCY_CANDIDATE);
          }
        } catch (e) { /* yoksay */ }
        return;
      }
      if ((data.kind === 'boarding_missed') && (role === 'agency' || role === 'admin')) {
        const id = data.candidateUserId;
        if (!id) return;
        try {
          const c = await getCandidateById(id);
          if (c) {
            setSelectedCandidate({ c, st: { status: 'in_transit' } });
            setStage(STAGE.AGENCY_CANDIDATE);
          }
        } catch (e) { /* yoksay */ }
        return;
      }
      if ((data.kind === 'boarding_no_response') && (role === 'agency' || role === 'admin')) {
        const id = data.candidateUserId;
        if (!id) return;
        try {
          const c = await getCandidateById(id);
          if (c) {
            setSelectedCandidate({ c, st: { status: 'in_transit' } });
            setStage(STAGE.AGENCY_CANDIDATE);
          }
        } catch (e) { /* yoksay */ }
        return;
      }
      if ((data.kind === 'arrival_today' || data.kind === 'arrival_tomorrow') && (role === 'agency' || role === 'admin')) {
        const id = data.candidateUserId;
        if (!id) return;
        try {
          const c = await getCandidateById(id);
          if (c) {
            setSelectedCandidate({ c, st: {} });
            setStage(STAGE.AGENCY_CANDIDATE);
          }
        } catch (e) { /* yoksay */ }
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
    setData({}); setHasCv(false); setRole('candidate'); setRoleReady(false); setRoleBlocked(false); setSelectedCandidate(null);
    setPasswordRecovery(false);
    setAccountConsentOk(null);
    cancelDailyActivityNudge();
    setStage(STAGE.PORTAL);
  };

  const finishPasswordReset = async () => {
    setPasswordRecovery(false);
    if (!session?.user?.id) { setStage(STAGE.PORTAL); return; }
    let resolved;
    try {
      resolved = await withTimeout(resolveRole(session.user.id), 8_000, 'role');
    } catch {
      const cached = await loadCachedRole(session.user.id);
      resolved = cached
        ? { role: cached, source: 'cache', uncertain: false }
        : { role: null, source: 'error', uncertain: true };
    }
    if (resolved.uncertain || !resolved.role) {
      setRoleBlocked(true);
      setRoleReady(false);
      return;
    }
    setRoleBlocked(false);
    setRole(resolved.role);
    setRoleReady(true);
    if (resolved.role === 'agency' || resolved.role === 'admin') setStage(STAGE.AGENCY);
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

  // Rol doğrulanamadı — acente hesabını aday paneline düşürme
  if (session && roleBlocked) {
    return (
      <View style={[styles.flex, styles.center, styles.roleGate]}>
        <Text style={styles.roleGateTitle}>{t('role_verify_failed')}</Text>
        <Text style={styles.roleGateHint}>{t('role_verify_hint')}</Text>
        <TouchableOpacity
          style={styles.roleGateBtn}
          onPress={retryRoleResolve}
          disabled={roleRetrying}
          activeOpacity={0.85}
        >
          {roleRetrying
            ? <ActivityIndicator color="#0e141c" />
            : <Text style={styles.roleGateBtnText}>{t('call_retry')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} activeOpacity={0.7} style={styles.roleGateLogout}>
          <Text style={styles.roleGateLogoutText}>{t('set_logout')}</Text>
        </TouchableOpacity>
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

  // Aday KVKK hesap rızası — CV / ana ekran öncesi
  if (session && roleReady && role === 'candidate' && accountConsentOk === null) {
    return (
      <View style={[styles.flex, styles.center]}>
        <ActivityIndicator color="#c2a25a" size="large" />
      </View>
    );
  }
  if (session && roleReady && role === 'candidate' && accountConsentOk === false) {
    return (
      <View style={styles.flex}>
        <ConsentSheet
          visible
          titleKey="consent_account_title"
          cancelKey="set_logout"
          busy={consentBusy}
          onAccept={async (choices) => {
            setConsentBusy(true);
            try {
              await saveConsent(session.user.id, {
                general: choices.general,
                crossBorder: choices.crossBorder,
                sensitive: choices.sensitive,
                locale: lang,
              });
              setAccountConsentOk(true);
            } catch {
              Alert.alert(t('consent_title'), t('consent_error'));
            } finally {
              setConsentBusy(false);
            }
          }}
          onCancel={handleLogout}
        />
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
            try {
              setSession(s);
              let resolved;
              try {
                resolved = await withTimeout(resolveRole(s.user.id), 8_000, 'role');
              } catch {
                const cached = await loadCachedRole(s.user.id);
                resolved = cached
                  ? { role: cached, source: 'cache', uncertain: false }
                  : { role: null, source: 'error', uncertain: true };
              }
              if (resolved.uncertain || !resolved.role) {
                setRoleBlocked(true);
                setRoleReady(false);
                return;
              }
              setRoleBlocked(false);
              setRole(resolved.role);
              setRoleReady(true);
              if (resolved.role === 'agency' || resolved.role === 'admin') {
                setStage(STAGE.AGENCY);
              } else {
                const saved = await loadProfile(s.user.id).catch(() => null);
                if (saved) {
                  setData(saved);
                  setHasCv(true);
                  setStage(STAGE.HOME);
                } else {
                  setLangReturn(STAGE.WELCOME);
                  setStage(STAGE.LANG);
                }
              }
            } catch (e) {
              console.warn('[onAuthed]', e?.message || e);
              Alert.alert('Turquz', e?.message || 'Giriş sonrası hata');
            }
          }}
        />
      );

    case STAGE.WELCOME:
      return (
        <Suspense fallback={<ScreenFallback />}>
          <WelcomeScreen fontsReady={fontsReady} onStart={() => goForm(0, STAGE.WELCOME, false, STAGE.THANKS)} onBack={() => setStage(STAGE.LANG)} />
        </Suspense>
      );

    case STAGE.FORM:
      return (
        <Suspense fallback={<ScreenFallback />}>
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
        </Suspense>
      );

    case STAGE.THANKS:
      return (
        <Suspense fallback={<ScreenFallback />}>
          <ThankYouScreen
            fontsReady={fontsReady}
            onSubmit={handleSubmit}
            onBack={() => setStage(STAGE.FORM)}
          />
        </Suspense>
      );

    case STAGE.HOME:
      return (
        <Suspense fallback={<ScreenFallback />}>
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
        </Suspense>
      );

    case STAGE.DOCS:
      return (
        <Suspense fallback={<ScreenFallback />}>
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
        </Suspense>
      );

    case STAGE.SETTINGS:
      return (
        <Suspense fallback={<ScreenFallback />}>
          <SettingsScreen
            fontsReady={fontsReady}
            notifications={notifications}
            onToggleNotifications={setNotifications}
            isAgency={role === 'agency' || role === 'admin'}
            onBack={() => setStage(role === 'agency' || role === 'admin' ? STAGE.AGENCY : STAGE.HOME)}
            onChangeLanguage={() => setStage(STAGE.LANG_SETTINGS)}
            onLogout={handleLogout}
          />
        </Suspense>
      );

    case STAGE.LANG_SETTINGS:
      return (
        <Suspense fallback={<ScreenFallback />}>
          <LanguageSettings
            fontsReady={fontsReady}
            onBack={() => setStage(STAGE.SETTINGS)}
          />
        </Suspense>
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
            <Suspense fallback={<ScreenFallback />}>
              <AgencySetupScreen
                user={session.user}
                onDone={(u) => {
                  setSession((s) => ({ ...s, user: u }));
                  setAgencySetupOk(true);
                }}
                onLogout={handleLogout}
              />
            </Suspense>
          );
        }
      }
      return (
        <Suspense fallback={<ScreenFallback />}>
          <AgencyHomeScreen
            fontsReady={fontsReady}
            userId={session?.user?.id}
            agencyReturn={agencyReturn}
            onAgencyReturnConsumed={() => setAgencyReturn(null)}
            onOpenCandidate={(c, st) => {
              setAgencyReturn(st?._returnToHotels ? {
                view: 'hotels',
                employerId: st._returnEmployerId || null,
                employerName: st._returnEmployerName || '',
                department: st._returnDepartment || null,
                coverUrl: st._returnCoverUrl || null,
              } : null);
              setSelectedCandidate({ c, st });
              setStage(STAGE.AGENCY_CANDIDATE);
            }}
            onLogout={handleLogout}
          />
        </Suspense>
      );
    }

    case STAGE.AGENCY_CANDIDATE:
      return (
        <Suspense fallback={<ScreenFallback />}>
          <AgencyCandidateScreen
            fontsReady={fontsReady}
            candidate={selectedCandidate?.c}
            agencyUserId={session?.user?.id}
            accepted={!!selectedCandidate?.st?.docs_unlocked || selectedCandidate?.st?.status === 'hired' || selectedCandidate?.st?.status === 'in_transit'}
            offered={selectedCandidate?.st?.status === 'offered'}
            hired={selectedCandidate?.st?.status === 'hired'}
            inTransit={selectedCandidate?.st?.status === 'in_transit'}
            openIvJoin={!!selectedCandidate?.st?._openIvJoin}
            openInterview={!!selectedCandidate?.st?._openInterview}
            openQuickOffer={!!selectedCandidate?.st?._quickOffer}
            openChat={!!selectedCandidate?.st?._openChat}
            openWorkStart={!!selectedCandidate?.st?._openWorkStart}
            openHireConfirm={!!selectedCandidate?.st?._openHireConfirm || selectedCandidate?.st?.status === 'in_transit'}
            openRate={!!selectedCandidate?.st?.openRate || !!selectedCandidate?.st?._openRate}
            onBack={() => { setSelectedCandidate(null); setStage(STAGE.AGENCY); }}
            onAccepted={() => { setSelectedCandidate(null); setStage(STAGE.AGENCY); }}
          />
        </Suspense>
      );

    case STAGE.LANG:
    default:
      return <LanguageSelect onDone={() => { const r = afterLang(); setLangReturn(STAGE.WELCOME); setStage(r); }} />;
  }
}

function PrivacyNoticeHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    registerPrivacyOpener(() => setOpen(true));
    return () => registerPrivacyOpener(null);
  }, []);
  return <PrivacyNoticeSheet visible={open} onClose={() => setOpen(false)} />;
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
          <PrivacyNoticeHost />
        </View>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1b2533' },
  center: { justifyContent: 'center', alignItems: 'center' },
  roleGate: { paddingHorizontal: 28, gap: 12 },
  roleGateTitle: { color: '#e7dcc4', fontSize: 17, fontWeight: '800', textAlign: 'center', lineHeight: 24 },
  roleGateHint: { color: '#9aa3b0', fontSize: 13.5, fontWeight: '600', textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  roleGateBtn: {
    minWidth: 180, minHeight: 46, paddingHorizontal: 22, borderRadius: 12,
    backgroundColor: '#c2a25a', alignItems: 'center', justifyContent: 'center',
  },
  roleGateBtnText: { color: '#0e141c', fontWeight: '800', fontSize: 15 },
  roleGateLogout: { paddingVertical: 12 },
  roleGateLogoutText: { color: '#9aa3b0', fontWeight: '700', fontSize: 14 },
});
