// components/ContractForm.js
// Acente "Teklif/Sözleşme" sayfası: kendi alanlarını doldurur (aday alanları CV'den gelir).
// Buradan GÖNDERME yok; imza ve gönderim Belgeler > "İmzalı Hizmet Sözleşmesi" adımında.
// Bu sayfa: bilgileri kaydeder + önizleme/PDF indirme + (yakında) e-imza.
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function Row({ label, value, onChangeText, placeholder, keyboardType, multiline }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
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

export default function ContractForm({ visible, initial, data, onSaveData, onChangeEmployer, onClose }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';

  const [f, setF] = useState({});
  useEffect(() => { if (visible) setF(initial || {}); }, [visible, initial]);

  const up = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const infoOk = f.title?.trim() && f.address?.trim() && f.position?.trim();

  const persist = () => { if (infoOk) onSaveData?.(f); };           // bilgileri kaydet (kabul etmez)
  const close = () => { persist(); onClose(); };
  const saveAndClose = () => { persist(); onClose(); };            // "Kaydet" -> Görüntüle'den e-imzalanır

  const changeEmployer = () => {
    persist();
    onClose?.();
    onChangeEmployer?.();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('contract_form_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={[styles.sec, styles.secFirst]}>{t('contract_employer_sec')}</Text>
          {onChangeEmployer ? (
            <TouchableOpacity style={styles.reselectBtn} onPress={changeEmployer} activeOpacity={0.85}>
              <Text style={styles.reselectText}>{t('employer_reselect')}</Text>
            </TouchableOpacity>
          ) : null}
          <Row label={t('contract_f_title')} value={f.title} onChangeText={up('title')} placeholder="SBN TURİZM... – JUJU PREMIER PALACE OTEL" multiline />
          <Row label={t('contract_f_address')} value={f.address} onChangeText={up('address')} placeholder="BELDİBİ MAH. ... KEMER / ANTALYA" multiline />
          <Row label={t('contract_f_phone')} value={f.phone} onChangeText={up('phone')} placeholder="+90 242 ..." keyboardType="phone-pad" />
          <Row label={t('contract_f_email')} value={f.email} onChangeText={up('email')} placeholder="otel@..." keyboardType="email-address" />

          <Text style={styles.sec}>{t('contract_contact_sec')}</Text>
          <Row label={t('contract_f_contact_phone')} value={f.contactPhone} onChangeText={up('contactPhone')} placeholder="+90 5..." keyboardType="phone-pad" />
          <Row label={t('contract_f_contact_email')} value={f.contactEmail} onChangeText={up('contactEmail')} placeholder="acente@..." keyboardType="email-address" />

          <Text style={styles.sec}>{t('contract_job_sec')}</Text>
          <Row label={t('contract_f_position')} value={f.position} onChangeText={up('position')} placeholder="GARSON – SERVİS ELEMANI / WAITER" />
          <Row label={t('contract_f_salary')} value={f.salary} onChangeText={up('salary')} placeholder="33.030,00" keyboardType="numbers-and-punctuation" />

          <Text style={styles.sec}>{t('contract_consulate_sec')}</Text>
          <Row label={t('contract_f_consulate')} value={f.consulate} onChangeText={up('consulate')} placeholder="ALMATY" />

          {!infoOk ? <Text style={styles.req}>{t('contract_required')}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.previewFull, !infoOk && { opacity: 0.5 }]} onPress={saveAndClose} disabled={!infoOk} activeOpacity={0.9}>
            <Text style={styles.previewText}>{t('esign_save')}</Text>
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
  title: { fontSize: 18, fontWeight: '800', color: INK },
  accent: { height: 2.5, backgroundColor: GOLD },

  content: { padding: 16, paddingBottom: 32 },
  sec: { fontSize: 13, fontWeight: '800', color: '#9a7b1f', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 30, marginBottom: 14, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#eceef1' },
  secFirst: { marginTop: 4, paddingTop: 0, borderTopWidth: 0 },
  reselectBtn: {
    alignSelf: 'flex-start', marginBottom: 14, paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: '#f3ecdc', borderWidth: 1, borderColor: 'rgba(194,162,90,.35)',
  },
  reselectText: { fontSize: 13.5, fontWeight: '800', color: '#9a7b1f' },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  req: { color: '#a32d2d', fontSize: 12.5, fontWeight: '600', marginTop: 14 },

  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  previewFull: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  previewText: { color: INK, fontWeight: '800', fontSize: 16 },
  footHint: { color: '#737373', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 10 },
});
