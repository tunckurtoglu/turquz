// components/ConsentSheet.js
// KVKK açık rıza modalı: granüler kutular (genel / özel nitelikli / yurt dışı aktarım).
// Kullanım: hesap/CV kapısı (App.js), belge yükleme (DocumentsScreen).
// Onaylanan izinler çağıran ekrana döner; kaydetme (Supabase 'consents') çağıranda yapılır.
//
// Zorunlu izinler: genel + yurt dışı aktarım.
// requireSensitive=true ise özel nitelikli izni de zorunlu olur (adli sicil gibi).
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { openPrivacy } from '../lib/config';

function CheckRow({ checked, onToggle, label, required, requiredLabel }) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <Text style={styles.checkLabel}>
        {label}{required ? <Text style={styles.req}>  {requiredLabel}</Text> : null}
      </Text>
    </TouchableOpacity>
  );
}

export default function ConsentSheet({
  visible,
  requireSensitive = false,
  busy = false,
  titleKey = 'consent_title',
  cancelKey = 'consent_cancel',
  onAccept,
  onCancel,
  onClosed,
}) {
  const { t } = useLanguage();
  const [general, setGeneral] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [crossBorder, setCrossBorder] = useState(false);
  const [warn, setWarn] = useState(false);

  // Her açılışta sıfırla (kullanıcı bilinçli işaretlesin).
  useEffect(() => {
    if (visible) { setGeneral(false); setSensitive(false); setCrossBorder(false); setWarn(false); }
  }, [visible]);

  const mandatoryOk = general && crossBorder && (!requireSensitive || sensitive);

  const handleAccept = () => {
    if (!mandatoryOk) { setWarn(true); return; }
    onAccept({ general, sensitive, crossBorder });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onCancel(); }} onDismiss={onClosed}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t(titleKey)}</Text>
          <TouchableOpacity onPress={openPrivacy} activeOpacity={0.7}>
            <Text style={styles.readLink}>{t('consent_read')}</Text>
          </TouchableOpacity>

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 6 }}>
            <CheckRow checked={general} onToggle={() => setGeneral((v) => !v)} label={t('consent_general')} required requiredLabel={t('consent_required')} />
            <CheckRow checked={crossBorder} onToggle={() => setCrossBorder((v) => !v)} label={t('consent_crossborder')} required requiredLabel={t('consent_required')} />
            {requireSensitive ? (
              <CheckRow checked={sensitive} onToggle={() => setSensitive((v) => !v)} label={t('consent_sensitive')} required requiredLabel={t('consent_required')} />
            ) : null}
          </ScrollView>

          {warn ? <Text style={styles.warn}>{t('consent_must')}</Text> : null}

          <TouchableOpacity style={[styles.accept, (!mandatoryOk || busy) && styles.acceptDim]} onPress={handleAccept} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.acceptText}>{t('consent_accept')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onCancel} disabled={busy}>
            <Text style={styles.cancelText}>{t(cancelKey)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '88%' },
  title: { fontSize: 19, fontWeight: '800', color: '#1b2533', marginBottom: 6 },
  readLink: { fontSize: 13, fontWeight: '700', color: '#c2a25a', marginBottom: 12 },
  intro: { fontSize: 13.5, color: '#6b6457', lineHeight: 20, marginBottom: 14 },
  scroll: { flexGrow: 0 },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderTopWidth: 0.5, borderTopColor: '#eef0f2' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: '#c9ccd2', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1 },
  boxOn: { backgroundColor: '#c2a25a', borderColor: '#c2a25a' },
  tick: { color: '#fff', fontSize: 15, fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: 13.5, color: '#1b2533', lineHeight: 19 },
  req: { color: '#a32d2d', fontWeight: '700', fontSize: 12 },

  warn: { color: '#a32d2d', fontSize: 13, fontWeight: '600', marginTop: 10 },

  accept: { marginTop: 16, backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  acceptDim: { opacity: 0.5 },
  acceptText: { color: '#1b2533', fontSize: 15, fontWeight: '800' },
  cancel: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#737373', fontSize: 15, fontWeight: '700' },
});
