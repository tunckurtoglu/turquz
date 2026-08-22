// components/StampSetupSheet.js
// Belirli bir işletmenin imza+kaşesini kaydet.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Image, Alert, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { saveEmployerStamp, clearEmployerStamp, getEmployer } from '../lib/employers';
import { stampMakeTransparentSafe } from '../lib/stampProcess';
import StampCaptureSheet from './StampCaptureSheet';

const GOLD = '#c2a25a';
const INK = '#1b2533';

export default function StampSetupSheet({ visible, agencyId, employer, onClose, onSaved }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [image, setImage] = useState(null);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [camOpen, setCamOpen] = useState(false);
  const [emp, setEmp] = useState(employer || null);

  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    setLoading(true);
    (async () => {
      let row = employer;
      if (agencyId && employer?.id) {
        row = (await getEmployer(agencyId, employer.id)) || employer;
      }
      if (!alive) return;
      setEmp(row || null);
      setImage(row?.stampImage || null);
      setName(row?.stampSignerName || row?.name || '');
      setTitle(row?.stampSignerTitle || '');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [visible, agencyId, employer?.id]);

  const save = async () => {
    if (!emp?.id || !agencyId) return;
    if (!image) { Alert.alert(t('stamp_title'), t('stamp_need_image')); return; }
    if (!name.trim()) { Alert.alert(t('stamp_title'), t('stamp_need_name')); return; }
    setSaving(true);
    try {
      const cleared = await stampMakeTransparentSafe(image);
      const row = await saveEmployerStamp(agencyId, emp.id, {
        image: cleared, signerName: name, signerTitle: title,
      });
      setImage(cleared);
      onSaved?.(row);
      onClose?.();
    } catch (e) {
      Alert.alert(t('stamp_title'), e?.message || 'error');
    } finally {
      setSaving(false);
    }
  };

  const clear = () => {
    Alert.alert(t('stamp_remove'), t('stamp_remove_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('stamp_remove'), style: 'destructive', onPress: async () => {
          await clearEmployerStamp(agencyId, emp.id);
          setImage(null);
          onSaved?.(await getEmployer(agencyId, emp.id));
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{t('stamp_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.empName}>{emp?.name || '—'}</Text>
            <Text style={styles.help}>{t('stamp_help_employer')}</Text>

            <View style={[styles.box, styles.checker]}>
              {image ? (
                <Image key={String(image).slice(-40)} source={{ uri: image }} style={styles.img} resizeMode="contain" />
              ) : (
                <Text style={styles.empty}>{t('stamp_empty')}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.camBtn} onPress={() => setCamOpen(true)} activeOpacity={0.9}>
              <Text style={styles.camBtnText}>{image ? t('stamp_change') : t('stamp_capture')}</Text>
            </TouchableOpacity>

            <Text style={styles.lbl}>{t('stamp_signer_name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('stamp_signer_name_ph')}
              placeholderTextColor="#9aa1ac"
            />
            <Text style={styles.lbl}>{t('stamp_signer_title')}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('stamp_signer_title_ph')}
              placeholderTextColor="#9aa1ac"
            />

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
              {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.saveText}>{t('save')}</Text>}
            </TouchableOpacity>

            {image ? (
              <TouchableOpacity style={styles.removeBtn} onPress={clear}>
                <Text style={styles.removeText}>{t('stamp_remove')}</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        )}

        <StampCaptureSheet
          visible={camOpen}
          onClose={() => setCamOpen(false)}
          onCapture={(dataUri) => { setImage(dataUri); setCamOpen(false); }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#fff' },
  back: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, paddingBottom: 40 },
  empName: { fontSize: 16, fontWeight: '800', color: INK, marginBottom: 6, textAlign: 'center' },
  help: { color: '#5a6575', fontSize: 13.5, lineHeight: 19, marginBottom: 14, textAlign: 'center' },
  box: {
    height: 160, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e6e8ec',
    alignItems: 'center', justifyContent: 'center', padding: 10, marginBottom: 12,
  },
  checker: { backgroundColor: '#dfe3e8' },
  img: { width: '100%', height: '100%' },
  empty: { color: '#9aa1ac', fontWeight: '700' },
  camBtn: { backgroundColor: INK, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 18 },
  camBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  lbl: { color: '#5a6575', fontWeight: '700', fontSize: 12.5, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK, marginBottom: 14,
  },
  saveBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  saveText: { color: INK, fontWeight: '800', fontSize: 16 },
  removeBtn: { alignItems: 'center', paddingVertical: 16 },
  removeText: { color: '#a32d2d', fontWeight: '800' },
});
