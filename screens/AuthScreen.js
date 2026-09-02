// screens/AuthScreen.js
// Giriş / Kayıt ekranı (8 dilli, RTL uyumlu).
// - E-posta + şifre ile giriş ve kayıt (kayıtta şifre iki kez + eşleşme kontrolü)
// - Şifremi unuttum → e-posta linki turquz://reset-password (App.js recovery ekranı)
// - Google / Apple: Supabase OAuth (in-app tarayıcı) → register_as_* ile portal kilidi
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useLanguage } from '../i18n/LanguageContext';
import { signInWithEmail, signUpWithEmail, sendPasswordReset, signOut, signInWithOAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { getRole } from '../lib/roles';
import { registerAsAgency, registerAsCandidate } from '../lib/agencyProfile';
import { GoogleIcon, AppleIcon } from '../components/BrandIcons';
import { openPrivacy } from '../lib/config';
import { saveConsent } from '../lib/consent';
import { clearRememberedLogin, loadRememberedLogin, saveRememberedLogin } from '../lib/rememberLogin';
import TurquzLogo from '../components/TurquzLogo';

const GOLD = '#c2a25a';
const GOLD_D = '#9a7b1f';
const NAVY = '#1b2533';
const INK = '#1f2733';
const MUTED = '#6b7280';
const LINE = '#dfe3e8';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

function ConsentCheck({ checked, onToggle, label, requiredLabel }) {
  return (
    <TouchableOpacity style={styles.consentRow} onPress={onToggle} activeOpacity={0.7} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && styles.checkboxOn]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.consentLbl}>
        {label}
        <Text style={styles.consentReq}>  {requiredLabel}</Text>
      </Text>
    </TouchableOpacity>
  );
}

function Field({ label, ta, inputRef, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, ta]}>{label}</Text>
      <TextInput
        ref={inputRef}
        style={[styles.input, ta]}
        placeholderTextColor="#a0a7b2"
        {...inputProps}
      />
    </View>
  );
}

export default function AuthScreen({ onAuthed, portal = 'candidate', onBack, fontsReady }) {
  const { t, dir, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('signin');     // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);           // { type:'err'|'ok', text }
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [consentGeneral, setConsentGeneral] = useState(false);
  const [consentCross, setConsentCross] = useState(false);
  const emailRef = useRef(null);
  const passRef = useRef(null);
  const pass2Ref = useRef(null);
  const agencyMode = portal === 'agency';
  const candidateSignup = !agencyMode && mode === 'signup';
  const signupConsentOk = consentGeneral && consentCross;

  // iOS AutoFill + Fabric: TextInput unmount sırasında şifre-kaydet UI çökertiyor.
  const handOffSession = useCallback(async (session) => {
    try {
      Keyboard.dismiss();
      emailRef.current?.blur?.();
      passRef.current?.blur?.();
      pass2Ref.current?.blur?.();
    } catch { /* yoksay */ }
    await new Promise((r) => setTimeout(r, 280));
    onAuthed?.(session);
  }, [onAuthed]);

  useEffect(() => {
    let live = true;
    loadRememberedLogin(portal).then((saved) => {
      if (!live) return;
      if (saved.remember) {
        setEmail(saved.email);
        setPass(saved.password);
        setRememberMe(true);
      }
    });
    return () => { live = false; };
  }, [portal]);

  const rtl = dir === 'rtl';
  const ta = { textAlign: rtl ? 'right' : 'left' };

  const passMatch = mode === 'signup' && pass2.length > 0 && pass === pass2 && pass.length >= 6;
  const passMismatch = mode === 'signup' && pass2.length > 0 && pass !== pass2;

  const clearMsg = () => setMsg(null);

  const finishAgencySession = async (session) => {
    try {
      await registerAsAgency();
    } catch (e) {
      const code = e?.message || '';
      if (code.includes('already_candidate')) {
        await signOut();
        setMsg({ type: 'err', text: t('auth_err_agency_already_candidate') });
        return false;
      }
      console.warn('register_as_agency:', code);
    }
    const role = await getRole(session.user.id);
    if (role == null) {
      setMsg({ type: 'err', text: t('role_verify_failed') });
      return false;
    }
    if (role !== 'agency' && role !== 'admin') {
      await signOut();
      setMsg({ type: 'err', text: t('auth_err_not_agency') });
      return false;
    }
    await handOffSession(session);
    return true;
  };

  const finishCandidateSession = async (session, { persistConsent = false } = {}) => {
    try {
      await registerAsCandidate();
    } catch (e) {
      const code = e?.message || '';
      if (code.includes('already_agency')) {
        await signOut();
        setMsg({ type: 'err', text: t('auth_err_not_candidate') });
        return false;
      }
      console.warn('register_as_candidate:', code);
    }
    const role = await getRole(session.user.id);
    if (role == null) {
      setMsg({ type: 'err', text: t('role_verify_failed') });
      return false;
    }
    const ok = role === 'admin'
      || (portal === 'hotel' && (role === 'hotel' || role === 'agency'))
      || (portal === 'candidate' && role === 'candidate');
    if (!ok) {
      await signOut();
      setMsg({ type: 'err', text: t('auth_err_not_candidate') });
      return false;
    }
    if (persistConsent && consentGeneral && consentCross) {
      try {
        await saveConsent(session.user.id, {
          general: true,
          crossBorder: true,
          sensitive: false,
          locale: lang,
        });
      } catch (e) {
        console.warn('signup consent:', e?.message);
      }
    }
    await handOffSession(session);
    return true;
  };

  // --- E-posta ile giriş / kayıt ---
  const submit = async () => {
    clearMsg();
    if (!isEmail(email)) return setMsg({ type: 'err', text: t('auth_err_email') });
    if (pass.length < 6) return setMsg({ type: 'err', text: t('auth_err_pass_short') });
    if (mode === 'signup' && pass !== pass2) return setMsg({ type: 'err', text: t('auth_err_pass_match') });
    if (candidateSignup && !signupConsentOk) return setMsg({ type: 'err', text: t('consent_must') });

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await signUpWithEmail(email, pass, {
          portal: agencyMode ? 'agency' : 'candidate',
        });
        if (error) { setMsg({ type: 'err', text: error.message }); return; }
        if (data?.session) {
          if (agencyMode) await finishAgencySession(data.session);
          else await finishCandidateSession(data.session, { persistConsent: true });
          return;
        }
        setMsg({ type: 'ok', text: t('auth_check_email') });
      } else {
        const { data, error } = await signInWithEmail(email, pass);
        if (error) { setMsg({ type: 'err', text: error.message }); return; }
        if (data?.session) {
          if (rememberMe) await saveRememberedLogin(portal, { email, password: pass });
          else await clearRememberedLogin(portal);
          if (agencyMode) {
            await finishAgencySession(data.session);
            return;
          }
          await finishCandidateSession(data.session);
        }
      }
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  // --- Şifremi unuttum ---
  const doReset = async () => {
    clearMsg();
    if (!isEmail(resetEmail)) return setMsg({ type: 'err', text: t('auth_err_email') });
    setBusy(true);
    try {
      const { error } = await sendPasswordReset(resetEmail);
      if (error) { setMsg({ type: 'err', text: error.message }); return; }
      setShowReset(false);
      setMsg({ type: 'ok', text: t('auth_reset_sent') });
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  // --- Google / Apple OAuth ---
  const oauth = async (provider) => {
    clearMsg();
    setBusy(true);
    try {
      const { session, error, cancelled } = await signInWithOAuth(provider);
      if (cancelled) return;
      if (error) {
        setMsg({ type: 'err', text: error.message || t('auth_oauth_failed') });
        return;
      }
      if (!session) {
        setMsg({ type: 'err', text: t('auth_oauth_failed') });
        return;
      }
      // Portal niyetini metadata'ya yaz (rol register_as_* ile gelir).
      const p = agencyMode ? 'agency' : 'candidate';
      await supabase.auth.updateUser({ data: { portal: p } }).catch(() => {});
      if (agencyMode) await finishAgencySession(session);
      else await finishCandidateSession(session);
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={['#101820', '#1b2533', '#2a3545']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowA} pointerEvents="none" />
      <View style={styles.glowB} pointerEvents="none" />

      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        enableOnAndroid
        extraScrollHeight={Platform.OS === 'ios' ? 24 : 80}
        enableResetScrollToCoords={false}
        showsVerticalScrollIndicator={false}
      >
        {onBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Text style={styles.backText}>{rtl ? '›' : '‹'}</Text>
            <Text style={styles.backLabel}>{t('back') || ''}</Text>
          </TouchableOpacity>
        ) : <View style={{ height: 8 }} />}

        <TurquzLogo width={148} height={124} style={styles.logo} fontFamily="Cinzel_600SemiBold" fontsReady={fontsReady} />

        <View style={styles.card}>
          <Text style={styles.kicker}>{agencyMode ? t('auth_panel_kicker') : t('portal_candidate')}</Text>
          <Text style={[styles.title, fontsReady && styles.titleFont]}>
            {mode === 'signin' ? t('auth_tab_signin') : t('auth_tab_signup')}
          </Text>
          <Text style={[styles.subtitle, ta]}>{agencyMode ? t('auth_subtitle_agency') : t('auth_subtitle')}</Text>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'signin' && styles.tabActive]}
              onPress={() => { setMode('signin'); clearMsg(); setConsentGeneral(false); setConsentCross(false); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('auth_tab_signin')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); clearMsg(); setConsentGeneral(false); setConsentCross(false); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('auth_tab_signup')}</Text>
            </TouchableOpacity>
          </View>

          <Field
            label={t('auth_email')}
            ta={ta}
            inputRef={emailRef}
            value={email}
            onChangeText={(v) => { setEmail(v); clearMsg(); }}
            placeholder={t('auth_email_ph')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="username"
            importantForAutofill="yes"
          />
          <Field
            label={t('auth_password')}
            ta={ta}
            inputRef={passRef}
            value={pass}
            onChangeText={(v) => { setPass(v); clearMsg(); }}
            placeholder="••••••••"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            autoComplete="password"
            importantForAutofill="yes"
          />

          {mode === 'signup' ? (
            <>
              <Field
                label={t('auth_password2')}
                ta={ta}
                inputRef={pass2Ref}
                value={pass2}
                onChangeText={(v) => { setPass2(v); clearMsg(); }}
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                autoComplete="password-new"
              />
              {passMismatch ? (
                <Text style={[styles.warn, ta]}>{t('auth_err_pass_match')}</Text>
              ) : passMatch ? (
                <Text style={[styles.ok, ta]}>{t('auth_pass_ok')}</Text>
              ) : null}
            </>
          ) : null}

          {mode === 'signin' ? (
            <View style={[styles.signinMeta, rtl && styles.signinMetaRtl]}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                  {rememberMe ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.rememberLbl}>{t('auth_remember')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setResetEmail(email); setShowReset(true); clearMsg(); }} activeOpacity={0.7}>
                <Text style={styles.forgot}>{t('auth_forgot')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {candidateSignup ? (
            <View style={styles.consentBlock}>
              <TouchableOpacity onPress={openPrivacy} activeOpacity={0.7}>
                <Text style={styles.privacyLink}>{t('consent_read')}</Text>
              </TouchableOpacity>
              <ConsentCheck
                checked={consentGeneral}
                onToggle={() => { setConsentGeneral((v) => !v); clearMsg(); }}
                label={t('consent_general')}
                requiredLabel={t('consent_required')}
              />
              <ConsentCheck
                checked={consentCross}
                onToggle={() => { setConsentCross((v) => !v); clearMsg(); }}
                label={t('consent_crossborder')}
                requiredLabel={t('consent_required')}
              />
            </View>
          ) : null}

          {msg ? (
            <Text style={[msg.type === 'err' ? styles.warn : styles.ok, ta, { marginTop: 10 }]}>{msg.text}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.cta, (busy || (candidateSignup && !signupConsentOk)) && styles.ctaDisabled]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.9}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {mode === 'signin' ? t('auth_signin_btn') : t('auth_signup_btn')}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>{t('auth_or')}</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity
            style={[styles.oauth, busy && styles.ctaDisabled]}
            onPress={() => oauth('google')}
            disabled={busy}
            activeOpacity={0.85}
          >
            <View style={styles.oauthInner}>
              <GoogleIcon size={20} />
              <Text style={styles.oauthText}>{t('auth_google')}</Text>
            </View>
          </TouchableOpacity>
          {Platform.OS === 'ios' ? (
            <TouchableOpacity
              style={[styles.oauth, styles.apple, busy && styles.ctaDisabled]}
              onPress={() => oauth('apple')}
              disabled={busy}
              activeOpacity={0.85}
            >
              <View style={styles.oauthInner}>
                <AppleIcon size={20} color="#ffffff" />
                <Text style={[styles.oauthText, { color: '#fff' }]}>{t('auth_apple')}</Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {!agencyMode ? (
            <Text style={[styles.privacyNote, rtl && styles.privacyNoteRtl]}>
              {t('auth_privacy_oauth_hint')}{' '}
              <Text style={styles.privacyLink} onPress={openPrivacy}>{t('privacy_link')}</Text>
            </Text>
          ) : null}
        </View>

        <Text style={styles.trust}>{t('auth_trust')}</Text>
      </KeyboardAwareScrollView>

      {showReset ? (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={[styles.modalTitle, ta]}>{t('auth_reset_title')}</Text>
            <Text style={[styles.modalDesc, ta]}>{t('auth_reset_desc')}</Text>
            <TextInput
              style={[styles.input, ta, { marginTop: 14 }]}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder={t('auth_email_ph')}
              placeholderTextColor="#a0a7b2"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
            />
            {msg && showReset ? (
              <Text style={[msg.type === 'err' ? styles.warn : styles.ok, ta, { marginTop: 8 }]}>{msg.text}</Text>
            ) : null}
            <TouchableOpacity style={[styles.cta, busy && styles.ctaDisabled, { marginTop: 14 }]} onPress={doReset} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t('auth_send_reset')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => { setShowReset(false); clearMsg(); }}>
              <Text style={styles.cancelText}>{t('auth_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NAVY },
  glowA: {
    position: 'absolute', top: -80, left: -60, width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(194,162,90,0.16)',
  },
  glowB: {
    position: 'absolute', bottom: 40, right: -90, width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(42,157,184,0.12)',
  },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12, marginBottom: 4 },
  backText: { color: '#e7dcc4', fontSize: 28, fontWeight: '700', marginTop: -2 },
  backLabel: { color: '#e7dcc4', fontSize: 15, fontWeight: '700', marginLeft: 2 },
  logo: { width: 148, height: 124, alignSelf: 'center', marginBottom: 10 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  kicker: {
    color: GOLD_D, fontSize: 11, fontWeight: '800', letterSpacing: 1.6,
    textTransform: 'uppercase', textAlign: 'center', marginBottom: 8,
  },
  title: { color: '#3d4654', fontSize: 26, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  subtitle: { color: MUTED, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6, marginBottom: 18 },

  tabs: { flexDirection: 'row', backgroundColor: '#f0f2f5', borderRadius: 12, padding: 4, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', shadowColor: '#1b2533', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText: { color: MUTED, fontWeight: '700', fontSize: 14.5 },
  tabTextActive: { color: NAVY },

  field: { marginTop: 12 },
  label: { color: '#3d4654', fontSize: 12.5, fontWeight: '700', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13,
    color: INK, fontSize: 15, borderWidth: 1, borderColor: LINE,
  },
  warn: { color: '#c0392b', fontSize: 13, fontWeight: '600', marginTop: 6 },
  ok: { color: '#1f8a4c', fontSize: 13, fontWeight: '600', marginTop: 6 },
  signinMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, gap: 8,
  },
  signinMetaRtl: { flexDirection: 'row-reverse' },
  rememberRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: LINE,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: NAVY, borderColor: NAVY },
  checkboxMark: { color: '#fff', fontSize: 11, fontWeight: '800', marginTop: -1 },
  rememberLbl: { color: '#3d4654', fontSize: 13, fontWeight: '700' },
  forgot: { color: '#7a6550', fontSize: 13, fontWeight: '700' },

  cta: { backgroundColor: NAVY, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  privacyNote: { color: MUTED, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17, paddingHorizontal: 2 },
  privacyNoteRtl: { writingDirection: 'rtl' },
  privacyLink: { color: GOLD_D, fontWeight: '700', marginBottom: 8 },
  consentBlock: { marginTop: 14, gap: 2 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  consentLbl: { flex: 1, color: '#3d4654', fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  consentReq: { color: '#a32d2d', fontWeight: '700', fontSize: 11 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  line: { flex: 1, height: 1, backgroundColor: LINE },
  or: { color: '#9aa1ac', marginHorizontal: 12, fontSize: 12.5, fontWeight: '600' },

  oauth: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: LINE,
  },
  oauthInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  apple: { backgroundColor: '#111', borderColor: '#111' },
  oauthText: { color: NAVY, fontSize: 15, fontWeight: '700' },

  trust: { color: 'rgba(231,220,196,0.72)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 18 },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,16,24,0.55)', justifyContent: 'center', paddingHorizontal: 22,
  },
  modal: {
    backgroundColor: '#fff', borderRadius: 18, padding: 22,
    borderWidth: 1, borderColor: 'rgba(22,32,46,0.06)',
  },
  modalTitle: { color: NAVY, fontSize: 18, fontWeight: '800' },
  modalDesc: { color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 19 },
  cancel: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { color: MUTED, fontSize: 14, fontWeight: '600' },
});
