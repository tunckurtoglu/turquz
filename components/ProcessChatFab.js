// Sağ altta WhatsApp tarzı süreç sohbeti FAB’i.
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

export default function ProcessChatFab({ visible, onPress }) {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  if (!visible) return null;
  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: Math.max(insets.bottom, 12) + 12 }]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t('chat_open')}
    >
      <Text style={styles.icon}>💬</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#c2a25a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    elevation: 8,
    shadowColor: '#1b2533',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: { fontSize: 26 },
});
