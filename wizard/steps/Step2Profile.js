// wizard/steps/Step2Profile.js
// Adım 2: profil yazısı + galeriden fotoğraf (resize+compress+WebP). Etiketler dile bağlı.
// Gerekli paketler:  npx expo install expo-image-picker expo-image-manipulator
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { MultilineField, SectionTitle } from '../../components/fields';
import { useLanguage } from '../../i18n/LanguageContext';

const PROFILE_MIN = 150;
const PROFILE_MAX = 300;

async function optimizePhoto(uri) {
  const actions = [{ resize: { width: 800 } }];
  try {
    const out = await ImageManipulator.manipulateAsync(uri, actions, { compress: 0.82, format: ImageManipulator.SaveFormat.WEBP, base64: true });
    return `data:image/webp;base64,${out.base64}`;
  } catch (e) {
    const out = await ImageManipulator.manipulateAsync(uri, actions, { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    return `data:image/jpeg;base64,${out.base64}`;
  }
}

export default function Step2Profile({ data, update }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const profileLen = (data.profile || '').length;

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('!', t('sec_photo')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1,
      });
      if (!res.canceled && res.assets && res.assets.length) {
        setLoading(true);
        const optimized = await optimizePhoto(res.assets[0].uri);
        update({ photo: optimized });
      }
    } catch (e) {
      Alert.alert('!', '✕');
    } finally { setLoading(false); }
  };

  return (
    <View>
      <SectionTitle>{t('sec_profile')}</SectionTitle>
      <MultilineField
        label={t('f_profile')}
        value={data.profile}
        onChangeText={(v) => update({ profile: v.slice(0, PROFILE_MAX) })}
        minHeight={120}
        maxLength={PROFILE_MAX}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.meta, profileLen < PROFILE_MIN && styles.metaWarn]}>
          {profileLen < PROFILE_MIN ? t('min_chars', { n: PROFILE_MIN }) : t('enough')}
        </Text>
        <Text style={[styles.meta, profileLen < PROFILE_MIN && styles.metaWarn]}>{profileLen}/{PROFILE_MAX}</Text>
      </View>

      <SectionTitle>{t('sec_photo')}</SectionTitle>
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>{t('photo_tips_title')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_1')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_2')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_3')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_4')}</Text>
      </View>

      {data.photo ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: data.photo }} style={styles.preview} resizeMode="cover" />
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.btn} onPress={pickImage} disabled={loading}>
              <Text style={styles.btnText}>{t('change')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => update({ photo: '' })}>
              <Text style={[styles.btnText, styles.btnGhostText]}>{t('remove')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.picker} onPress={pickImage} disabled={loading} activeOpacity={0.7}>
          {loading ? <ActivityIndicator color="#c2a25a" /> : (
            <>
              <Text style={styles.pickerIcon}>＋</Text>
              <Text style={styles.pickerText}>{t('pick_photo')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      {loading ? <Text style={styles.processing}>{t('optimizing')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -6, marginBottom: 10 },
  meta: { fontSize: 12, color: '#9aa1ac', fontWeight: '600' },
  metaWarn: { color: '#c0392b' },
  tipBox: { backgroundColor: '#f7f4ec', borderWidth: 1, borderColor: '#e7dcc2', borderRadius: 10, padding: 12, marginBottom: 12 },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#8a6d2f', marginBottom: 6 },
  tip: { fontSize: 12.5, color: '#6b6457', lineHeight: 19 },
  picker: { borderWidth: 1, borderColor: '#c2a25a', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafbfc' },
  pickerIcon: { fontSize: 28, color: '#c2a25a', fontWeight: '700', marginBottom: 4 },
  pickerText: { color: '#c2a25a', fontWeight: '800', fontSize: 14 },
  photoRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { width: 96, height: 96, borderRadius: 8, backgroundColor: '#eee' },
  photoActions: { marginLeft: 14, gap: 8 },
  btn: { backgroundColor: '#1b2533', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c9ccd2' },
  btnGhostText: { color: '#c0392b' },
  processing: { fontSize: 12, color: '#9aa1ac', marginTop: 8, textAlign: 'center' },
});
