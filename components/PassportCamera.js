// NOT: Şu an devre dışı — pasaport yalnızca PDF (lib/features.js → PASSPORT_CAMERA_ENABLED).
// Banka tarzı çerçeveli pasaport kamerası: ekranda pasaport çerçevesi var, kişi oraya
// oturtup çeker. Çekilen fotoğrafın URI'si onCapture ile döner. Native (expo-camera) — dev build gerekir.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#c2a25a';

export default function PassportCamera({ visible, onCapture, onClose }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => { if (visible && perm && !perm.granted && perm.canAskAgain) requestPerm(); }, [visible, perm, requestPerm]);
  // Kamera her açıldığında yönergeyi otomatik göster ("Anladım" ile kapanır, "?" ile tekrar açılır).
  useEffect(() => { setHelp(visible); }, [visible]);

  const frameW = Math.min(width * 0.9, 420);
  const frameH = frameW / 1.42; // pasaport veri sayfası ~1.42:1

  const shoot = async () => {
    if (!camRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (photo?.uri) onCapture(photo.uri);
    } catch (e) { /* yoksay */ } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        {!perm ? (
          <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
        ) : !perm.granted ? (
          <View style={styles.center}>
            <Text style={styles.permText}>{t('passport_cam_perm')}</Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPerm}><Text style={styles.permBtnText}>{t('passport_cam_allow')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.permClose} onPress={onClose}><Text style={styles.permCloseText}>{t('consent_cancel')}</Text></TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="back" />

            {/* Karartı + ortada şeffaf çerçeve */}
            <View style={styles.overlay} pointerEvents="box-none">
              <View style={styles.dim} />
              <View style={styles.midRow}>
                <View style={styles.dim} />
                <View style={[styles.frame, { width: frameW, height: frameH }]}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>
                <View style={styles.dim} />
              </View>
              <View style={styles.dim} />
            </View>

            {/* Üst: kapat + ipucu + yardım (?) */}
            <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={styles.close}>✕</Text></TouchableOpacity>
              <Text style={styles.hint}>{t('passport_cam_hint')}</Text>
              <TouchableOpacity style={styles.helpBtn} onPress={() => setHelp(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.helpBtnText}>?</Text>
              </TouchableOpacity>
            </View>

            {/* Yardım: nasıl çekilir (örnek pasaport çizimi) */}
            {help ? (
              <View style={styles.helpBackdrop}>
                <View style={styles.helpCard}>
                  <Text style={styles.helpTitle}>{t('passport_help_title')}</Text>
                  {/* Örnek pasaport (çerçeve içinde) */}
                  <View style={styles.exFrame}>
                    <View style={[styles.exCorner, styles.exTL]} />
                    <View style={[styles.exCorner, styles.exTR]} />
                    <View style={[styles.exCorner, styles.exBL]} />
                    <View style={[styles.exCorner, styles.exBR]} />
                    <View style={styles.exTop}>
                      <View style={styles.exPhoto} />
                      <View style={styles.exLines}>
                        <View style={[styles.exLine, { width: '90%' }]} />
                        <View style={[styles.exLine, { width: '65%' }]} />
                        <View style={[styles.exLine, { width: '80%' }]} />
                        <View style={[styles.exLine, { width: '55%' }]} />
                      </View>
                    </View>
                    <View style={styles.exMrz}>
                      <View style={styles.exMrzLine} />
                      <View style={styles.exMrzLine} />
                    </View>
                  </View>
                  <Text style={styles.helpTip}>• {t('passport_help_1')}</Text>
                  <Text style={styles.helpTip}>• {t('passport_help_2')}</Text>
                  <Text style={styles.helpTip}>• {t('passport_help_3')}</Text>
                  <TouchableOpacity style={styles.helpOk} onPress={() => setHelp(false)} activeOpacity={0.9}>
                    <Text style={styles.helpOkText}>{t('passport_help_ok')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Çek butonu */}
            <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
              <TouchableOpacity style={styles.shutter} onPress={shoot} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color="#1b2533" /> : <View style={styles.shutterInner} />}
              </TouchableOpacity>
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
  permBtn: { backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 13 },
  permBtnText: { color: '#1b2533', fontWeight: '800' },
  permClose: { marginTop: 16 },
  permCloseText: { color: '#9aa4b1', fontWeight: '700' },

  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  midRow: { flexDirection: 'row', height: undefined },
  frame: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 14, backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: GOLD },
  tl: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  tr: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  br: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },

  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  close: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hint: { flex: 1, color: '#fff', fontSize: 13.5, fontWeight: '700', textAlign: 'center', marginHorizontal: 8 },
  helpBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  helpBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Yardım penceresi
  helpBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  helpCard: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center' },
  helpTitle: { fontSize: 17, fontWeight: '800', color: '#1b2533', marginBottom: 16 },
  exFrame: { width: 230, height: 162, borderRadius: 12, borderWidth: 2, borderColor: '#d6dae0', backgroundColor: '#f6f7f9', padding: 14, justifyContent: 'space-between', marginBottom: 18 },
  exCorner: { position: 'absolute', width: 22, height: 22, borderColor: GOLD },
  exTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  exTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  exBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  exBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  exTop: { flexDirection: 'row', gap: 12 },
  exPhoto: { width: 46, height: 58, borderRadius: 6, backgroundColor: '#c3cad3' },
  exLines: { flex: 1, justifyContent: 'center', gap: 7 },
  exLine: { height: 7, borderRadius: 4, backgroundColor: '#cdd3da' },
  exMrz: { gap: 5 },
  exMrzLine: { height: 9, borderRadius: 2, backgroundColor: '#9aa4b1' },
  helpTip: { alignSelf: 'stretch', color: '#5a5341', fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: 4 },
  helpOk: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 30, alignItems: 'center', marginTop: 14, alignSelf: 'stretch' },
  helpOkText: { color: '#1b2533', fontWeight: '800', fontSize: 15 },

  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutter: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
