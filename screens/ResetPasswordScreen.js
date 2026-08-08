// screens/ResetPasswordScreen.js — e-posta linkinden gelen recovery oturumunda yeni şifre.
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useLanguage } from '../i18n/LanguageContext';
import { updatePassword, signOut } from '../lib/auth';

const GOLD = '#c2a25a';
const NAVY = '#1b2533';

export default function ResetPasswordScreen({ onDone, onCancel }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const rtl = dir === 'rtl';
  const ta = { textAlign: rtl ? 'right' : 'left' };

  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const passMatch = pass2.length > 0 && pass === pass2 && pass.length >= 6;
  const passMismatch = pass2.length > 0 && pass !== pass2;

  const save = async () => {
    setMsg(null);
    if (pass.length < 6) return setMsg({ type: 'err', text: t('auth_err_pass_short') });
    if (pass !== pass2) return setMsg({ type: 'err', text: t('auth_err_pass_match') });
    setBusy(true);
    try {
      const { error } = await updatePassword(pass);
      if (error) { setMsg({ type: 'err', text: error.message }); return; }
      setMsg({ type: 'ok', text: t('auth_password_updated') });
      onDone?.();
    } catch (e) {
      setMsg({ type: 'err', text: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    await signOut();
    onCancel?.();
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
      >
        <Image source={require('../assets/turquz-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.kicker}>{t('auth_reset_title')}</Text>
        <Text style={[styles.title, ta]}>{t('auth_new_password_title')}</Text>
        <Text style={[styles.desc, ta]}>{t('auth_new_password_desc')}</Text>

        <Text style={[styles.lbl, ta]}>{t('auth_new_password')}</Text>
        <TextInput
          style={[styles.input, ta]}
          value={pass}
          onChangeText={setPass}
          placeholder="••••••••"
          placeholderTextColor="#7d8794"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="password-new"
        />

        <Text style={[styles.lbl, ta]}>{t('auth_new_password2')}</Text>
        <TextInput
          style={[styles.input, ta]}
          value={pass2}
          onChangeText={setPass2}
          placeholder="••••••••"
          placeholderTextColor="#7d8794"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          autoComplete="password-new"
        />
        {passMismatch ? <Text style={[styles.warn, ta]}>{t('auth_err_pass_match')}</Text> : null}
        {passMatch ? <Text style={[styles.ok, ta]}>{t('auth_pass_ok')}</Text> : null}
        {msg ? <Text style={[msg.type === 'err' ? styles.warn : styles.ok, ta, { marginTop: 10 }]}>{msg.text}</Text> : null}

        <TouchableOpacity style={[styles.cta, busy && styles.ctaDisabled]} onPress={save} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={NAVY} /> : <Text style={styles.ctaText}>{t('auth_save_password')}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={cancel} disabled={busy}>
          <Text style={styles.cancelText}>{t('auth_cancel')}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: NAVY },
  scroll: { paddingHorizontal: 24, paddingBottom: 24 },
  logo: { width: 150, height: 58, alignSelf: 'center', marginBottom: 12 },
  kicker: { color: GOLD, fontWeight: '800', letterSpacing: 2, fontSize: 11, textAlign: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  desc: { color: '#aeb6c2', fontSize: 14, lineHeight: 20, marginTop: 8, marginBottom: 8, textAlign: 'center' },
  lbl: { color: '#cbd2db', fontSize: 12.5, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12,
    fontSize: 16, color: NAVY,
  },
  warn: { color: '#ff9a8d', fontSize: 13, fontWeight: '600', marginTop: 8 },
  ok: { color: '#8fd4a0', fontSize: 13, fontWeight: '600', marginTop: 8 },
  cta: {
    backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancel: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: '#9aa1ac', fontSize: 14, fontWeight: '700' },
});
