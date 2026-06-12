// screens/CVPreview.js
// CV'yi WebView'de gösterir; pinch-zoom + her yöne kaydırma açık.
// "PDF İndir" -> logolu PDF'i doğrudan üretir ve paylaş/kaydet menüsünü açar.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildCvHtml } from '../cv/buildCvHtml';
import { maskCandidate } from '../lib/candidateCode';
import { withLatinName } from '../lib/translit';
import { useLanguage } from '../i18n/LanguageContext';

export default function CVPreview({ data, langOverride, masked = false, candidateNo }) {
  const { lang, t } = useLanguage();
  const activeLang = langOverride || lang;
  const [busy, setBusy] = useState(false);

  // Tanıtım videosu CV'ye GÖMÜLMEZ; galeri bölümünde oynatılır (aday ana ekran + acente paneli).
  // EKRAN: acente görünümünde isim -> aday no, iletişim/aile bulanık.
  const screenData = useMemo(() => (masked ? maskCandidate(data || {}, candidateNo) : withLatinName(data || {})), [data, masked, candidateNo]);
  const htmlScreen = useMemo(() => buildCvHtml(screenData, activeLang, { withLogo: true, masked }), [screenData, activeLang, masked]);

  // PDF (otele verilecek): acente modunda gerçek İSİM görünür; iletişim/aile yine bulanık; Aday No adres altında.
  const htmlPdf = useMemo(() => {
    if (!masked) return htmlScreen;
    return buildCvHtml(maskCandidate(data || {}, candidateNo, { revealName: true }), activeLang, { withLogo: true, masked: true });
  }, [data, candidateNo, masked, activeLang, htmlScreen]);

  // PDF üret + paylaş/kaydet menüsü
  const downloadPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlPdf, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Turquz CV', UTI: 'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      Alert.alert('Turquz', t('pdf_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        <WebView
          key={activeLang}
          originWhitelist={['*']}
          source={{ html: htmlScreen }}
          scrollEnabled
          bounces
          scalesPageToFit
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          directionalLockEnabled={false}
          showsVerticalScrollIndicator
          showsHorizontalScrollIndicator
          style={styles.web}
        />
      </View>

      <TouchableOpacity
        style={[styles.pdfBtn, busy && styles.pdfBtnBusy]}
        onPress={downloadPdf}
        disabled={busy}
        activeOpacity={0.85}
      >
        <Text style={styles.pdfText}>{busy ? t('pdf_preparing') : t('pdf_download')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', padding: 16 },
  frame: {
    flex: 1,
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e9ebee',
    borderWidth: 1,
    borderColor: '#dfe2e7',
  },
  web: { flex: 1, backgroundColor: 'transparent' },
  pdfBtn: {
    marginTop: 14,
    backgroundColor: '#c2a25a',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBtnBusy: { opacity: 0.6 },
  pdfText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
