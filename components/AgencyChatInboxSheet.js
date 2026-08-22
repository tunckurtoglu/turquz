// Acente footer “Mesajlar” — duyuru / hatırlatma gibi tam ekran sekme.
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import AgencyChatInbox from './AgencyChatInbox';

const NAVY = '#000b18';

export default function AgencyChatInboxSheet({
  visible,
  onClose,
  agencyId,
  onOpen,
  onBadgeChange,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headTitle}>{t('nav_messages')}</Text>
          <View style={{ width: 28 }} />
        </View>
        {visible ? (
          <AgencyChatInbox
            agencyId={agencyId}
            padBottom={insets.bottom + 16}
            hideIntro
            onBadgeChange={onBadgeChange}
            onOpen={onOpen}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 12,
  },
  back: { color: '#e7dcc4', fontSize: 32, fontWeight: '400', marginTop: -4, width: 28 },
  headTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
