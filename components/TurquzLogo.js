// components/TurquzLogo.js
// Emblem (PNG üst kısım) + altın daireli R wordmark — tam logo denemesi.

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import TurquzWordmark from './TurquzWordmark';

const LOGO = require('../assets/turquz-logo.png');
const SRC_W = 603;
const SRC_H = 413;
/** PNG'de alt yazı bandının başladığı yaklaşık oran (emblem / toplam yükseklik). */
const EMBLEM_RATIO = 0.72;

export default function TurquzLogo({
  width = 148,
  height,
  style,
  wordmarkSize,
  fontFamily,
  fontsReady = true,
  emblemRatio = EMBLEM_RATIO,
}) {
  const imgH = width * (SRC_H / SRC_W);
  const emblemH = imgH * emblemRatio;
  const totalH = height ?? emblemH + (wordmarkSize || width * 0.135) * 1.55;
  const wmSize = wordmarkSize ?? Math.max(11, width * 0.135);

  return (
    <View style={[styles.wrap, { width, height: totalH }, style]}>
      <View style={[styles.emblemClip, { width, height: emblemH }]}>
        <Image source={LOGO} style={{ width, height: imgH }} resizeMode="contain" />
      </View>
      <TurquzWordmark
        size={wmSize}
        letterSpacing={wmSize * 0.19}
        fontFamily={fontFamily}
        fontsReady={fontsReady}
        style={styles.wordmark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  emblemClip: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  wordmark: {
    marginTop: -2,
  },
});
