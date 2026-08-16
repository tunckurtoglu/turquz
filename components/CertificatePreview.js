// components/CertificatePreview.js
// Turquz başarı sertifikası önizleme + PDF indir/paylaş (metin sabit İngilizce).
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../i18n/LanguageContext';
import { buildCertificateHtml } from '../cv/buildCertificateHtml';
import { withLatinName } from '../lib/translit';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function CertificatePreview({ visible, data, episode, onClose }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [sharing, setSharing] = useState(false);

  const html = useMemo(() => {
    const d = withLatinName(data || {});
    const ep = episode || {};
    return buildCertificateHtml({
      firstName: d.firstName,
      lastName: d.lastName,
      candidateNo: d.candidateNo,
      employerTitle: ep.employer_title,
      position: ep.job_position || ep.position,
      startAt: ep.work_start_at || ep.hired_at,
      endAt: ep.ended_at,
      issuedAt: ep.ended_at,
    });
  }, [data, episode]);

  const share = async () => {
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: t('cert_badge'),
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (e) {
      Alert.alert(t('cert_badge'), e?.message || 'error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{t('cert_badge')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <WebView originWhitelist={['*']} source={{ html }} style={styles.web} showsVerticalScrollIndicator />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={[styles.shareBtn, sharing && { opacity: 0.6 }]} onPress={share} disabled={sharing} activeOpacity={0.9}>
            {sharing ? <ActivityIndicator color={INK} /> : <Text style={styles.shareText}>{t('pdf_download')}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#e9ebee' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  web: { flex: 1, backgroundColor: '#e9ebee' },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  shareBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  shareText: { color: INK, fontWeight: '800', fontSize: 16 },
});
