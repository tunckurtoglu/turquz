// components/EmployerFormSheet.js
// Yeni işletme şablonu kaydet (sözleşme formundaki işveren alanları).
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { saveEmployer } from '../lib/employers';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function Row({ label, value, onChangeText, placeholder, keyboardType, multiline, required }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9aa1ac"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="sentences"
      />
    </View>
  );
}

export default function EmployerFormSheet({ visible, agencyId, initial, onSaved, onClose }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setF(initial || {});
  }, [visible, initial]);

  const up = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const ok = f.name?.trim() && f.title?.trim() && f.address?.trim()
    && f.country?.trim() && f.city?.trim() && f.region?.trim() && f.webUrl?.trim();

  const save = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      const row = await saveEmployer(agencyId, f, initial?.id);
      onSaved?.(row);
      onClose?.();
    } catch (e) {
      Alert.alert(t('employer_form_title'), e?.message === 'name_required' ? t('employer_name_required') : (e?.message || t('doc_upload_error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{initial?.id ? t('employer_form_edit_title') : t('employer_form_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>{t('employer_form_hint')}</Text>
          <Row label={t('employer_f_name')} value={f.name} onChangeText={up('name')} placeholder={t('employer_f_name_ph')} required />
          <Text style={styles.sec}>{t('contract_employer_sec')}</Text>
          <Row label={t('contract_f_title')} value={f.title} onChangeText={up('title')} placeholder="SBN TURİZM... / ABC TEKSTİL A.Ş." multiline required />
          <Row label={t('contract_f_address')} value={f.address} onChangeText={up('address')} placeholder="..." multiline required />
          <Row label={t('hotels_country')} value={f.country} onChangeText={up('country')} required />
          <Row label={t('hotels_city')} value={f.city} onChangeText={up('city')} required />
          <Row label={t('hotels_region')} value={f.region} onChangeText={up('region')} required />
          <Row label={t('hotels_badge_web')} value={f.webUrl} onChangeText={up('webUrl')} placeholder="https://..." keyboardType="url" required />
          <Row label={t('contract_f_phone')} value={f.phone} onChangeText={up('phone')} keyboardType="phone-pad" />
          <Row label={t('contract_f_email')} value={f.email} onChangeText={up('email')} keyboardType="email-address" />
          <Text style={styles.sec}>{t('contract_contact_sec')}</Text>
          <Row label={t('contract_f_contact_phone')} value={f.contactPhone} onChangeText={up('contactPhone')} keyboardType="phone-pad" />
          <Row label={t('contract_f_contact_email')} value={f.contactEmail} onChangeText={up('contactEmail')} keyboardType="email-address" />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.saveBtn, (!ok || busy) && { opacity: 0.5 }]} onPress={save} disabled={!ok || busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.saveText}>{t('employer_save')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  content: { padding: 16, paddingBottom: 28 },
  hint: { fontSize: 13, color: '#737373', lineHeight: 19, marginBottom: 14 },
  sec: { fontSize: 13, fontWeight: '800', color: '#9a7b1f', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 20, marginBottom: 10 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  inputMulti: { minHeight: 56, textAlignVertical: 'top' },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  saveBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: INK, fontWeight: '800', fontSize: 16 },
});
