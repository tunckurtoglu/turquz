// components/ContractPreview.js
// Sözleşme + konsolosluk yazısı önizlemesi (WebView) + PDF paylaş/indir. Acente ve aday kullanır.
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../i18n/LanguageContext';
import { buildContractHtml } from '../cv/buildContractHtml';
import { withLatinName } from '../lib/translit';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function ContractPreview({ visible, data, contract, onClose, onEsign }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [sharing, setSharing] = useState(false);

  const html = useMemo(() => buildContractHtml(withLatinName(data || {}), contract || {}), [data, contract]);

  const share = async () => {
    setSharing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('contract_title'), UTI: 'com.adobe.pdf' });
      }
    } catch (e) {
      Alert.alert(t('doc_contract_unsigned'), e?.message || 'error');
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
          <Text style={styles.title} numberOfLines={1}>{t('contract_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.web}
          showsVerticalScrollIndicator
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {onEsign ? (
            <TouchableOpacity style={styles.esignBtn} onPress={onEsign} activeOpacity={0.9}>
              <Text style={styles.esignText}>✍️ {t('contract_esign_send')}</Text>
              <View style={styles.soonChip}><Text style={styles.soonChipText}>{t('soon')}</Text></View>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={[onEsign ? styles.shareGhost : styles.shareBtn, sharing && { opacity: 0.6 }]} onPress={share} disabled={sharing} activeOpacity={0.9}>
            {sharing ? <ActivityIndicator color={INK} /> : <Text style={onEsign ? styles.shareGhostText : styles.shareText}>{t('contract_download_sign')}</Text>}
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
  esignBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, marginBottom: 10 },
  esignText: { color: INK, fontWeight: '800', fontSize: 16 },
  soonChip: { backgroundColor: 'rgba(27,37,51,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  soonChipText: { color: INK, fontSize: 9.5, fontWeight: '800' },
  shareGhost: { backgroundColor: '#eef0f2', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  shareGhostText: { color: INK, fontWeight: '800', fontSize: 15 },
});
