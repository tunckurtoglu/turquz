// screens/CVPreview.js
// CV'yi WebView'de gösterir; pinch-zoom + her yöne kaydırma açık.
// Seçili dili (useLanguage) buildCvHtml'e geçirir; admin için langOverride ile ezilebilir.
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildCvHtml } from '../cv/buildCvHtml';
import { useLanguage } from '../i18n/LanguageContext';

export default function CVPreview({ data, langOverride }) {
  const { lang } = useLanguage();
  const activeLang = langOverride || lang;

  const html = useMemo(() => buildCvHtml(data || {}, activeLang), [data, activeLang]);

  // Önizleme penceresi: ekran yüksekliğinin ~%72'si kadar, kaydırılabilir/zoom'lanabilir kutu
  const winH = Dimensions.get('window').height;
  const boxHeight = Math.round(winH * 0.72);

  return (
    <View style={[styles.frame, { height: boxHeight }]}>
      <WebView
        key={activeLang}
        originWhitelist={['*']}
        source={{ html }}
        // ---- zoom + her yöne kaydırma ----
        scrollEnabled
        bounces
        scalesPageToFit              // iOS: içeriği pencereye sığdırır, sonra pinch-zoom serbest
        setBuiltInZoomControls       // Android: çift dokun/iki parmak zoom
        setDisplayZoomControls={false}
        directionalLockEnabled={false}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e9ebee',
    borderWidth: 1,
    borderColor: '#dfe2e7',
  },
  web: { flex: 1, backgroundColor: 'transparent' },
});
