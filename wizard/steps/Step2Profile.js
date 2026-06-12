// wizard/steps/Step2Profile.js
// Adım 2: profil yazısı + fotoğraflar.
//  - Vesikalık (1:1)  -> data.photo      (CV/PDF kimlik fotosu)
//  - Boydan (3:4)     -> data.photoFull  (otel tanıtım galerisi)
//  - Yakın (3:4)      -> data.photoClose (otel tanıtım galerisi)
// Hepsi otomatik küçültülür + sıkıştırılır (WebP, JPEG fallback). (çok dilli)
// Gerekli paketler: npx expo install expo-image-picker expo-image-manipulator
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
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82, format: ImageManipulator.SaveFormat.WEBP, base64: true,
    });
    return `data:image/webp;base64,${out.base64}`;
  } catch (e) {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return `data:image/jpeg;base64,${out.base64}`;
  }
}

// Tek bir fotoğraf slotu: başlık + ipucu + (boş ise) seçici / (dolu ise) önizleme + Değiştir/Kaldır.
function PhotoSlot({ caption, hint, value, ratio, busy, onPick, onRemove, t }) {
  // ratio: thumbnail en/boy oranı (1 = kare, 0.75 = 3:4 dikey)
  const thumbStyle = [styles.preview, { aspectRatio: ratio }];
  return (
    <View style={styles.slot}>
      <Text style={styles.slotCap}>{caption}</Text>
      {hint ? <Text style={styles.slotHint}>{hint}</Text> : null}
      {value ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: value }} style={thumbStyle} resizeMode="cover" />
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.btn} onPress={onPick} disabled={busy}>
              <Text style={styles.btnText}>{t('photo_change')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onRemove} disabled={busy}>
              <Text style={[styles.btnText, styles.btnGhostText]}>{t('photo_remove')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.picker} onPress={onPick} disabled={busy} activeOpacity={0.7}>
          {busy ? (
            <ActivityIndicator color="#c2a25a" />
          ) : (
            <>
              <Text style={styles.pickerIcon}>＋</Text>
              <Text style={styles.pickerText}>{t('pick_photo')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Step2Profile({ data, update }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(null); // hangi slotun yüklendiği: 'photo' | 'photoFull' | 'photoClose' | null
  const profileLen = (data.profile || '').length;

  // field: data anahtarı, aspect: kırpma oranı [w, h]
  const pickImage = async (field, aspect) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('perm_needed'), t('perm_msg'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect, quality: 1,
      });
      if (!res.canceled && res.assets && res.assets.length) {
        setLoading(field);
        const optimized = await optimizePhoto(res.assets[0].uri);
        update({ [field]: optimized });
      }
    } catch (e) {
      Alert.alert(t('err_title'), t('err_photo'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <View>
      <SectionTitle>{t('sec_profile')}</SectionTitle>
      <MultilineField
        label={t('f_profile')}
        value={data.profile}
        onChangeText={(v) => update({ profile: v.slice(0, PROFILE_MAX) })}
        placeholder={t('ph_profile')}
        minHeight={120}
        maxLength={PROFILE_MAX}
      />
      <View style={styles.metaRow}>
        <Text style={[styles.meta, profileLen < PROFILE_MIN && styles.metaWarn]}>
          {profileLen < PROFILE_MIN ? t('min_chars', { n: PROFILE_MIN }) : t('enough')}
        </Text>
        <Text style={[styles.meta, profileLen < PROFILE_MIN && styles.metaWarn]}>
          {profileLen}/{PROFILE_MAX}
        </Text>
      </View>

      {/* --- Vesikalık (CV/PDF) --- */}
      <SectionTitle>{t('sec_photo')}</SectionTitle>
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>{t('photo_tips_title')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_1')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_2')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_3')}</Text>
        <Text style={styles.tip}>• {t('photo_tip_4')}</Text>
      </View>
      <PhotoSlot
        caption={t('photo_cap_id')}
        value={data.photo}
        ratio={1}
        busy={loading === 'photo'}
        onPick={() => pickImage('photo', [1, 1])}
        onRemove={() => update({ photo: '' })}
        t={t}
      />

      {/* --- Tanıtım fotoğrafları (otel galerisi) --- */}
      <SectionTitle>{t('sec_photos_extra')}</SectionTitle>
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>{t('photos_extra_why')}</Text>
        <Text style={styles.tip}>• {t('photo_full_hint')}</Text>
        <Text style={styles.tip}>• {t('photo_close_hint')}</Text>
      </View>
      <PhotoSlot
        caption={t('photo_cap_full')}
        hint={t('photo_full_hint')}
        value={data.photoFull}
        ratio={0.75}
        busy={loading === 'photoFull'}
        onPick={() => pickImage('photoFull', [3, 4])}
        onRemove={() => update({ photoFull: '' })}
        t={t}
      />
      <PhotoSlot
        caption={t('photo_cap_close')}
        hint={t('photo_close_hint')}
        value={data.photoClose}
        ratio={0.75}
        busy={loading === 'photoClose'}
        onPick={() => pickImage('photoClose', [3, 4])}
        onRemove={() => update({ photoClose: '' })}
        t={t}
      />

      {loading ? <Text style={styles.processing}>{t('photo_optimizing')}</Text> : null}
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

  slot: { marginBottom: 18 },
  slotCap: { fontSize: 13, fontWeight: '800', color: '#1b2533', marginBottom: 2 },
  slotHint: { fontSize: 12, color: '#9aa1ac', marginBottom: 8 },

  picker: { borderWidth: 1, borderColor: '#c2a25a', borderStyle: 'dashed', borderRadius: 12, paddingVertical: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafbfc' },
  pickerIcon: { fontSize: 28, color: '#c2a25a', fontWeight: '700', marginBottom: 4 },
  pickerText: { color: '#c2a25a', fontWeight: '800', fontSize: 14 },
  photoRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { width: 96, borderRadius: 8, backgroundColor: '#eee' },
  photoActions: { marginLeft: 14, gap: 8, flex: 1 },
  btn: { backgroundColor: '#1b2533', paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c9ccd2' },
  btnGhostText: { color: '#c0392b' },
  processing: { fontSize: 12, color: '#9aa1ac', marginTop: 8, textAlign: 'center' },
});
