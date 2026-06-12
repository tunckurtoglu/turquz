// components/PhotoWatermark.js
// Fotoğrafın SAĞ ALT köşesine küçük + belirgin Turquz logosu (hırsızlık/ekran görüntüsü caydırıcı).
// Konumlandırılmış (relative) bir foto kabının içine konur; tıklamayı engellemez.
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const LOGO = require('../assets/turquz-logo.png');

export default function PhotoWatermark({ size = 40, opacity = 0.75, margin = 8 }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={LOGO}
        resizeMode="contain"
        style={[styles.logo, { width: size, height: size, opacity, bottom: margin, right: margin }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { position: 'absolute' },
});
