// components/MessageCard.js
// Form başındaki karşılama ve sonundaki kapanış mesajını gösteren kart.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MessageCard({ title, body, variant = 'intro' }) {
  const isOutro = variant === 'outro';
  return (
    <View style={[styles.card, isOutro && styles.cardOutro]}>
      {title ? <Text style={[styles.title, isOutro && styles.titleOutro]}>{title}</Text> : null}
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f7f4ec',
    borderWidth: 1,
    borderColor: '#e7dcc2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
  },
  cardOutro: { marginBottom: 0, marginTop: 18 },
  title: { fontSize: 18, fontWeight: '800', color: '#1b2533', marginBottom: 6 },
  titleOutro: { color: '#8a6d2f' },
  body: { fontSize: 14, lineHeight: 21, color: '#5a5a5a' },
});
