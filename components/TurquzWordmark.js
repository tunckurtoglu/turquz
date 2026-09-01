// components/TurquzWordmark.js
// TURQUZ yazısında R harfi altın sarısı daire içinde — marka denemesi.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const WORDMARK_TEAL = '#4AB8C7';
export const WORDMARK_GOLD = '#C2A25A';

export default function TurquzWordmark({
  size = 20,
  color = WORDMARK_TEAL,
  gold = WORDMARK_GOLD,
  letterSpacing = 3.8,
  fontFamily,
  fontsReady = true,
  style,
  textStyle,
}) {
  const circle = size * 1.38;
  const rFont = size * 0.88;
  const gap = size * 0.06;
  const base = [
    styles.letter,
    {
      color,
      fontSize: size,
      letterSpacing,
    },
    fontsReady && fontFamily ? { fontFamily, fontWeight: '400' } : null,
    textStyle,
  ];

  return (
    <View style={[styles.row, style]} accessibilityRole="text" accessibilityLabel="TURQUZ">
      <Text style={base}>TU</Text>
      <View
        style={[
          styles.rBadge,
          {
            width: circle,
            height: circle,
            borderRadius: circle / 2,
            borderColor: gold,
            marginHorizontal: gap,
          },
        ]}
      >
        <Text
          style={[
            styles.rLetter,
            {
              color: gold,
              fontSize: rFont,
            },
            fontsReady && fontFamily ? { fontFamily, fontWeight: '400' } : null,
          ]}
        >
          R
        </Text>
      </View>
      <Text style={base}>QUZ</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontWeight: '400',
    includeFontPadding: false,
    textAlign: 'center',
  },
  rBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  rLetter: {
    fontWeight: '400',
    includeFontPadding: false,
    textAlign: 'center',
    marginTop: -1,
  },
});
