// screens/AuthScreen.js
// Giriş / Kayıt ekranı (8 dilli, RTL uyumlu).
// - E-posta + şifre ile giriş ve kayıt (kayıtta şifre iki kez + eşleşme kontrolü)
// - Şifremi unuttum → e-posta linki turquz://reset-password (App.js recovery ekranı)
// - Google / Apple butonları (Aşama 2'de OAuth bağlanacak; şimdilik "yakında")
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Alert, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useLanguage } from '../i18n/LanguageContext';
import { signInWithEmail, signUpWithEmail, sendPasswordReset, signOut } from '../lib/auth';
import { getRole } from '../lib/roles';
import { registerAsAgency, registerAsCandidate } from '../lib/agencyProfile';
import { GoogleIcon, AppleIcon } from '../components/BrandIcons';
import { openPrivacy } from '../lib/config';

const GOLD = '#c2a25a';
const NAVY = '#1b2533';
const CARD = '#243042';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

function PrivacyNote({ prefixKey, t, rtl }) {
  return (
    <Text style={[styles.privacyNote, rtl && styles.privacyNoteRtl]}>
      {t(prefixKey)}{' '}
      <Text style={styles.privacyLink} onPress={openPrivacy}>{t('privacy_link')} ↗</Text>
    </Text>
  );
}

export default function AuthScreen({ onAuthed, portal = 'candidate', onBack, fontsReady }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState('signin');     // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);           // { type:'err'|'ok', text }
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  // Acente: kayıt + OAuth UI açık. OAuth native bağlanınca soon kalkacak.
  const agencyMode = portal === 'agency';

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
    if (role !== 'agency' && role !== 'admin') {
      await signOut();
      setMsg({ type: 'err', text: t('auth_err_not_agency') });
      return false;
    }
    onAuthed?.(session);
    return true;
  };

  const finishCandidateSession = async (session) => {
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
    const ok = role === 'admin'
      || (portal === 'hotel' && (role === 'hotel' || role === 'agency'))
      || (portal === 'candidate' && role === 'candidate');
    if (!ok) {
      await signOut();
      setMsg({ type: 'err', text: t('auth_err_not_candidate') });
      return false;
    }
    onAuthed?.(session);
    return true;
  };

  // --- E-posta ile giriş / kayıt ---
  const submit = async () => {
    clearMsg();
    if (!isEmail(email)) return setMsg({ type: 'err', text: t('auth_err_email') });
    if (pass.length < 6) return setMsg({ type: 'err', text: t('auth_err_pass_short') });
    if (mode === 'signup' && pass !== pass2) return setMsg({ type: 'err', text: t('auth_err_pass_match') });

    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await signUpWithEmail(email, pass, {
          portal: agencyMode ? 'agency' : 'candidate',
        });
        if (error) { setMsg({ type: 'err', text: error.message }); return; }
        if (data?.session) {
          if (agencyMode) await finishAgencySession(data.session);
          else await finishCandidateSession(data.session);
          return;
        }
        setMsg({ type: 'ok', text: t('auth_check_email') });
      } else {
        const { data, error } = await signInWithEmail(email, pass);
        if (error) { setMsg({ type: 'err', text: error.message }); return; }
        if (data?.session) {
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

  // --- Google / Apple (Aşama 2) ---
  // OAuth bağlanınca options.data.portal = agency|candidate zorunlu; register_as_* ile kilitlenecek.
  const soon = () => Alert.alert('Turquz', t('auth_soon'));

  return (
    <View style={styles.flex}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 2, paddingBottom: insets.bottom + 24 }]}
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
        ) : null}
        <Image source={require('../assets/turquz-logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.titleRule} />
        <Text style={[styles.title, styles.titleCenter, fontsReady && styles.titleFont]}>{agencyMode ? t('auth_agency_login') : t('portal_candidate')}</Text>
        <Text style={[styles.subtitle, ta]}>{agencyMode ? t('auth_subtitle_agency') : t('auth_subtitle')}</Text>

        {/* Sekme: Giriş / Kayıt */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'signin' && styles.tabActive]}
            onPress={() => { setMode('signin'); clearMsg(); }}
          >
            <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('auth_tab_signin')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'signup' && styles.tabActive]}
            onPress={() => { setMode('signup'); clearMsg(); }}
          >
            <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('auth_tab_signup')}</Text>
          </TouchableOpacity>
        </View>

        {/* E-posta */}
        <Text style={[styles.label, ta]}>{t('auth_email')}</Text>
        <TextInput
          style={[styles.input, ta]}
          value={email}
          onChangeText={(v) => { setEmail(v); clearMsg(); }}
          placeholder={t('auth_email_ph')}
          placeholderTextColor="#7d8794"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          autoComplete="email"
        />

        {/* Şifre */}
        <Text style={[styles.label, ta]}>{t('auth_password')}</Text>
        <TextInput
          style={[styles.input, ta]}
          value={pass}
          onChangeText={(v) => { setPass(v); clearMsg(); }}
          placeholder="••••••"
          placeholderTextColor="#7d8794"
          secureTextEntry
          autoCapitalize="none"
        />

        {/* Şifre tekrar (sadece kayıt) */}
        {mode === 'signup' && (
          <>
            <Text style={[styles.label, ta]}>{t('auth_password2')}</Text>
            <TextInput
              style={[styles.input, ta]}
              value={pass2}
              onChangeText={(v) => { setPass2(v); clearMsg(); }}
              placeholder="••••••"
              placeholderTextColor="#7d8794"
              secureTextEntry
              autoCapitalize="none"
            />
            {passMismatch ? (
              <Text style={[styles.warn, ta]}>{t('auth_err_pass_match')}</Text>
            ) : passMatch ? (
              <Text style={[styles.ok, ta]}>{t('auth_pass_ok')}</Text>
            ) : null}
          </>
        )}

        {/* Şifremi unuttum (sadece giriş) */}
        {mode === 'signin' && (
          <TouchableOpacity onPress={() => { setResetEmail(email); setShowReset(true); clearMsg(); }}>
            <Text style={[styles.forgot, { textAlign: rtl ? 'left' : 'right' }]}>{t('auth_forgot')}</Text>
          </TouchableOpacity>
        )}

        {/* Mesaj */}
        {msg ? (
          <Text style={[msg.type === 'err' ? styles.warn : styles.ok, ta, { marginTop: 10 }]}>{msg.text}</Text>
        ) : null}

        {/* Ana buton */}
        <TouchableOpacity style={[styles.cta, busy && styles.ctaDisabled]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={NAVY} />
          ) : (
            <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{mode === 'signin' ? t('auth_signin_btn') : t('auth_signup_btn')}</Text>
          )}
        </TouchableOpacity>

        {/* KVKK (e-posta kaydı) */}
        {mode === 'signup' && (
          <PrivacyNote prefixKey="auth_privacy_signup_before" t={t} rtl={rtl} />
        )}

        {/* Ayraç + Google / Apple (OAuth native bağlanınca aktif) */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.or}>{t('auth_or')}</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity style={styles.oauth} onPress={soon} activeOpacity={0.85}>
          <View style={styles.oauthInner}>
            <GoogleIcon size={20} />
            <Text style={styles.oauthText}>{t('auth_google')}</Text>
          </View>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={[styles.oauth, styles.apple]} onPress={soon} activeOpacity={0.85}>
            <View style={styles.oauthInner}>
              <AppleIcon size={20} color="#ffffff" />
              <Text style={[styles.oauthText, { color: '#fff' }]}>{t('auth_apple')}</Text>
            </View>
          </TouchableOpacity>
        )}
        <PrivacyNote prefixKey="auth_privacy_oauth_before" t={t} rtl={rtl} />
      </KeyboardAwareScrollView>

      {/* Şifre sıfırlama paneli */}
      {showReset && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={[styles.modalTitle, ta]}>{t('auth_reset_title')}</Text>
            <Text style={[styles.modalDesc, ta]}>{t('auth_reset_desc')}</Text>
            <TextInput
              style={[styles.input, ta, { marginTop: 14 }]}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder={t('auth_email_ph')}
              placeholderTextColor="#7d8794"
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
              {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaText}>{t('auth_send_reset')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => { setShowReset(false); clearMsg(); }}>
              <Text style={styles.cancelText}>{t('auth_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NAVY },
  scroll: { paddingHorizontal: 24, minHeight: '100%' },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12, marginBottom: 2 },
  backText: { color: GOLD, fontSize: 30, fontWeight: '700', marginTop: -3 },
  backLabel: { color: GOLD, fontSize: 15, fontWeight: '700', marginLeft: 4 },
  logo: { width: 184, height: 153, alignSelf: 'center', marginBottom: 8 },
  titleRule: { width: 44, height: 2, borderRadius: 1, backgroundColor: GOLD, alignSelf: 'center', marginBottom: 10, opacity: 0.85 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2, letterSpacing: 0.3 },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  titleCenter: { textAlign: 'center', marginBottom: 6 },
  subtitle: { color: '#9aa4b1', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 16, paddingHorizontal: 4 },

  tabs: { flexDirection: 'row', backgroundColor: CARD, borderRadius: 12, padding: 4, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: GOLD },
  tabText: { color: '#9aa4b1', fontWeight: '700', fontSize: 15 },
  tabTextActive: { color: NAVY },

  label: { color: '#cbd2db', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: CARD, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 13,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#33415680',
  },
  warn: { color: '#e8806f', fontSize: 13, fontWeight: '600', marginTop: 6 },
  ok: { color: '#5fc98a', fontSize: 13, fontWeight: '600', marginTop: 6 },
  forgot: { color: GOLD, fontSize: 13, fontWeight: '600', marginTop: 10 },

  cta: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 18 },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: NAVY, fontSize: 16, fontWeight: '800' },

  privacyNote: { color: '#9aa4b1', fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17, paddingHorizontal: 4 },
  privacyNoteRtl: { writingDirection: 'rtl' },
  privacyLink: { color: GOLD, fontWeight: '700' },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: '#33415680' },
  or: { color: '#7d8794', marginHorizontal: 12, fontSize: 13 },

  oauth: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  oauthInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  apple: { backgroundColor: '#000' },
  oauthText: { color: '#1b2533', fontSize: 15, fontWeight: '700' },

  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000a', justifyContent: 'center', paddingHorizontal: 24,
  },
  modal: { backgroundColor: NAVY, borderRadius: 16, padding: 22, borderWidth: 1, borderColor: '#334156' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modalDesc: { color: '#9aa4b1', fontSize: 13, marginTop: 8, lineHeight: 19 },
  cancel: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  cancelText: { color: '#9aa4b1', fontSize: 14, fontWeight: '600' },
});
