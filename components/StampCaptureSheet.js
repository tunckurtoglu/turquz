// components/StampCaptureSheet.js
// İmza+kaşe için çerçeveli kamera: kağıdı çerçeveye oturt, çek, kırp.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, useWindowDimensions, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useLanguage } from '../i18n/LanguageContext';
import { stampMakeTransparentSafe } from '../lib/stampProcess';

const GOLD = '#c2a25a';
const INK = '#1b2533';

export default function StampCaptureSheet({ visible, onCapture, onClose }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (visible && perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [visible, perm, requestPerm]);

  useEffect(() => {
    if (!visible) setPreview(null);
  }, [visible]);

  // Yatay imza+kaşe alanı (~2.4:1)
  const frameW = Math.min(width * 0.88, 420);
  const frameH = Math.min(frameW / 2.35, height * 0.28);

  const cropToFrame = async (photo) => {
    const pw = photo.width || 0;
    const ph = photo.height || 0;
    if (!pw || !ph) return photo.uri;
    // Kamera genelde ekranı doldurur; çerçeve ekranın ortasında.
    // Yaklaşık oran: çerçeve genişliği / ekran genişliği.
    const scale = Math.max(pw / width, ph / height);
    const fw = frameW * scale;
    const fh = frameH * scale;
    const originX = Math.max(0, (pw - fw) / 2);
    const originY = Math.max(0, (ph - fh) / 2);
    const cropW = Math.min(fw, pw - originX);
    const cropH = Math.min(fh, ph - originY);
    const out = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ crop: { originX, originY, width: cropW, height: cropH } }, { resize: { width: 900 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.PNG, base64: true },
    );
    return out;
  };

  const finalizePreview = async (uri, rawDataUri) => {
    let dataUri = rawDataUri;
    if (!dataUri || dataUri.startsWith('data:image/jpeg') || dataUri.startsWith('data:image/jpg')) {
      const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 900 } }], {
        compress: 1, format: ImageManipulator.SaveFormat.PNG, base64: true,
      });
      dataUri = `data:image/png;base64,${m.base64}`;
    }
    const cleared = await stampMakeTransparentSafe(dataUri);
    setPreview({ uri: cleared, dataUri: cleared });
  };

  const shoot = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!photo?.uri) return;
      const cropped = await cropToFrame(photo);
      const uri = cropped.uri || photo.uri;
      const dataUri = cropped.base64
        ? `data:image/png;base64,${cropped.base64}`
        : null;
      await finalizePreview(uri, dataUri);
    } catch (e) {
      console.warn('stamp shoot', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const pickGallery = async () => {
    setBusy(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const dataUri = a.base64
        ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}`
        : null;
      await finalizePreview(a.uri, dataUri);
    } catch (e) {
      console.warn('stamp gallery', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!preview?.dataUri || busy) return;
    onCapture?.(preview.dataUri);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        {preview ? (
          <View style={[styles.previewWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.previewTitle}>{t('stamp_preview_title')}</Text>
            <Text style={styles.previewHint}>{t('stamp_preview_hint')}</Text>
            <View style={[styles.previewBox, styles.previewChecker]}>
              <Image source={{ uri: preview.uri }} style={styles.previewImg} resizeMode="contain" />
            </View>
            <TouchableOpacity style={[styles.goldBtn, busy && { opacity: 0.6 }]} onPress={confirm} disabled={busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.goldBtnText}>{t('stamp_use_this')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setPreview(null)} activeOpacity={0.85}>
              <Text style={styles.ghostBtnText}>{t('stamp_retake')}</Text>
            </TouchableOpacity>
          </View>
        ) : !perm ? (
          <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
        ) : !perm.granted ? (
          <View style={styles.center}>
            <Text style={styles.permText}>{t('stamp_cam_perm')}</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPerm}>
              <Text style={styles.permBtnText}>{t('stamp_cam_allow')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={pickGallery} disabled={busy}>
              <Text style={styles.ghostBtnText}>{t('stamp_from_gallery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 16 }} onPress={onClose}>
              <Text style={styles.permCloseText}>{t('consent_cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.dim} />
              <View style={styles.midRow}>
                <View style={styles.dim} />
                <View style={[styles.frame, { width: frameW, height: frameH }]}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                  <Text style={styles.frameLabel}>{t('stamp_frame_label')}</Text>
                </View>
                <View style={styles.dim} />
              </View>
              <View style={styles.dim} />
            </View>

            <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>{t('stamp_cam_hint')}</Text>
              <View style={{ width: 28 }} />
            </View>

            <View style={[styles.bottom, { paddingBottom: insets.bottom + 20 }]}>
              <TouchableOpacity style={styles.galleryBtn} onPress={pickGallery} disabled={busy}>
                <Text style={styles.galleryText}>{t('stamp_from_gallery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutter} onPress={shoot} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={INK} /> : <View style={styles.shutterInner} />}
              </TouchableOpacity>
              <View style={{ width: 88 }} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#0e1622' },
  permText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 18 },
  permBtn: { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13, marginBottom: 12 },
  permBtnText: { color: INK, fontWeight: '800' },
  permCloseText: { color: '#9aa4b1', fontWeight: '700' },

  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.58)' },
  midRow: { flexDirection: 'row' },
  frame: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', borderRadius: 12,
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8,
  },
  frameLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '700' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: GOLD },
  tl: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  tr: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  br: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },

  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18 },
  close: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hint: { flex: 1, color: '#fff', fontSize: 13.5, fontWeight: '700', textAlign: 'center', marginHorizontal: 8 },

  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  galleryBtn: { width: 88 },
  galleryText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },

  previewWrap: { flex: 1, backgroundColor: '#0e1622', paddingHorizontal: 20 },
  previewTitle: { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  previewHint: { color: '#9aa4b1', fontSize: 13, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  previewBox: {
    flex: 1, backgroundColor: '#fff', borderRadius: 14, marginBottom: 16,
    alignItems: 'center', justifyContent: 'center', padding: 12, maxHeight: 280,
  },
  previewChecker: {
    backgroundColor: '#e8eaed',
    // checkerboard hissi: düz gri üzerinde şeffaf sonucu görmek için
  },
  previewImg: { width: '100%', height: '100%' },
  goldBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  goldBtnText: { color: INK, fontWeight: '800', fontSize: 16 },
  ghostBtn: { alignItems: 'center', paddingVertical: 12 },
  ghostBtnText: { color: '#e7dcc4', fontWeight: '700', fontSize: 14 },
});
