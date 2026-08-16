// screens/CVPreview.js
// CV'yi WebView'de gösterir; pinch-zoom + her yöne kaydırma açık.
// "PDF İndir" -> logolu PDF'i doğrudan üretir ve paylaş/kaydet menüsünü açar.
import React, { useMemo, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildCvHtml } from '../cv/buildCvHtml';
import { maskCandidate } from '../lib/candidateCode';
import { withLatinName } from '../lib/translit';
import { useLanguage } from '../i18n/LanguageContext';

// Fotoğraf base64'lerini key'e koyma — çok uzun key RN'de güvenilir değil.
function cvContentFingerprint(d = {}, lang = '') {
  return [
    lang,
    String(d.title ?? ''),
    String(d.profile || '').slice(0, 120),
    JSON.stringify(d.positions || []),
    JSON.stringify(d.skills || []),
    JSON.stringify(d.experience || []),
    JSON.stringify(d.education || []),
    JSON.stringify(d.certificates || []),
    d.photo ? '1' : '0',
    d.photoClose ? '1' : '0',
    d.photoFull ? '1' : '0',
  ].join('\u001f');
}

const CVPreview = forwardRef(function CVPreview({
  data, langOverride, masked = false, candidateNo, contentKey, hidePdfBtn = false,
}, ref) {
  const { lang, t } = useLanguage();
  const activeLang = langOverride || lang;
  const [busy, setBusy] = useState(false);

  const screenData = useMemo(() => (masked ? maskCandidate(data || {}, candidateNo) : withLatinName(data || {})), [data, masked, candidateNo]);
  const htmlScreen = useMemo(() => buildCvHtml(screenData, activeLang, { withLogo: true, masked }), [screenData, activeLang, masked]);

  const htmlPdf = useMemo(() => {
    if (!masked) return htmlScreen;
    return buildCvHtml(maskCandidate(data || {}, candidateNo, { revealName: true }), activeLang, { withLogo: true, masked: true });
  }, [data, candidateNo, masked, activeLang, htmlScreen]);

  // RN WebView source.html değişince çoğu zaman yenilenmez; içerik anahtarı ile remount.
  // contentKey: parent (override) bilgisini doğrudan geçirir — title-only değişimde kaçmasın.
  const webKey = contentKey || cvContentFingerprint(screenData, activeLang);

  const downloadPdf = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlPdf, base64: false, width: 595, height: 842 });
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
  }, [busy, htmlPdf, t]);

  useImperativeHandle(ref, () => ({ downloadPdf }), [downloadPdf]);

  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        <WebView
          key={webKey}
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

      {!hidePdfBtn ? (
        <TouchableOpacity
          style={[styles.pdfBtn, busy && styles.pdfBtnBusy]}
          onPress={downloadPdf}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Text style={styles.pdfText}>{busy ? t('pdf_preparing') : t('pdf_download')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default CVPreview;

const styles = StyleSheet.create({
  wrap: { flex: 1, width: '100%', padding: 0 },
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
