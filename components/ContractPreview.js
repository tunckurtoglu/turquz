// components/ContractPreview.js
// Sözleşme önizlemesi — kontrol / kaydet / indir; gönderim aşama ekranından.
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../i18n/LanguageContext';
import { buildContractHtml } from '../cv/buildContractHtml';
import { withLatinName } from '../lib/translit';
import ContractForm from './ContractForm';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function ContractPreview({
  visible, data, contract, stampInfo,
  onClose, onSaveContract, onOpenStampSetup,
}) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [sharing, setSharing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [pdfUri, setPdfUri] = useState(null);
  const [localStamp, setLocalStamp] = useState(stampInfo || null);

  useEffect(() => {
    setLocalStamp(stampInfo || null);
  }, [stampInfo, visible]);

  const html = useMemo(
    () => buildContractHtml(
      withLatinName(data || {}),
      contract || {},
      localStamp?.image ? { signature: localStamp } : {},
    ),
    [data, contract, localStamp],
  );

  useEffect(() => {
    if (!visible) { setPdfUri(null); return undefined; }
    let alive = true;
    setPdfUri(null);
    Print.printToFileAsync({ html })
      .then(({ uri }) => { if (alive) setPdfUri(uri); })
      .catch((e) => console.warn('önizleme pdf:', e?.message));
    return () => { alive = false; };
  }, [visible, html]);

  const share = async () => {
    setSharing(true);
    try {
      const uri = pdfUri || (await Print.printToFileAsync({ html })).uri;
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

        <View style={styles.webWrap}>
          {pdfUri ? (
            <WebView originWhitelist={['*']} source={{ uri: pdfUri }} style={styles.web} showsVerticalScrollIndicator />
          ) : (
            <View style={styles.previewLoading}><ActivityIndicator size="large" color={GOLD} /></View>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {onSaveContract ? (
            <TouchableOpacity style={styles.editInfo} onPress={() => setFormOpen(true)} activeOpacity={0.7}>
              <Text style={styles.editInfoText}>✎ {t('contract_edit_info')}</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.help}>
            {localStamp?.image ? t('stamp_contract_preview_hint') : t('stamp_contract_need_hint')}
          </Text>

          {!localStamp?.image ? (
            <TouchableOpacity style={styles.inkBtn} onPress={() => onOpenStampSetup?.()} activeOpacity={0.9}>
              <Text style={styles.inkBtnText}>{t('stamp_capture')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.stampLink} onPress={() => onOpenStampSetup?.()} activeOpacity={0.7}>
              <Text style={styles.stampLinkText}>{t('stamp_change')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.shareBtn} onPress={share} disabled={sharing} activeOpacity={0.9}>
            {sharing
              ? <ActivityIndicator color={INK} />
              : <Text style={styles.shareText}>{t('contract_download')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.doneText}>{t('done')}</Text>
          </TouchableOpacity>
        </View>

        {onSaveContract ? (
          <ContractForm
            visible={formOpen}
            initial={contract}
            data={data}
            onSaveData={onSaveContract}
            onClose={() => setFormOpen(false)}
          />
        ) : null}
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
  webWrap: { flex: 1, backgroundColor: '#e9ebee' },
  web: { flex: 1, backgroundColor: 'transparent' },
  previewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  editInfo: { alignSelf: 'center', paddingBottom: 8 },
  editInfoText: { color: INK, fontWeight: '800', fontSize: 13.5, textDecorationLine: 'underline' },
  help: { color: '#5a6575', fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 10 },
  inkBtn: { backgroundColor: INK, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  inkBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  stampLink: { alignItems: 'center', paddingBottom: 10 },
  stampLinkText: { color: '#5a6575', fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' },
  shareBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 8 },
  shareText: { color: INK, fontWeight: '800', fontSize: 16 },
  doneBtn: { alignItems: 'center', paddingVertical: 12 },
  doneText: { color: INK, fontWeight: '800', fontSize: 15 },
});
