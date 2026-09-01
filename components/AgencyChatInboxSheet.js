// Acente footer “Mesajlar” — duyuru / hatırlatma gibi tam ekran sekme.
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import AgencyChatInbox from './AgencyChatInbox';
import { C } from '../lib/theme';

const BG = C.bg;
const INK = C.ink;

export default function AgencyChatInboxSheet({
  visible,
  onClose,
  agencyId,
  onOpen,
  onBadgeChange,
  embedded = false,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const shell = (
      <View style={[styles.wrap, embedded && styles.wrapEmbedded, { paddingTop: embedded ? 8 : insets.top + 6 }]}>
        {!embedded ? <StatusBar barStyle="dark-content" /> : null}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headTitle}>{t('agency_chat_inbox_title') || 'Süreç sohbetleri'}</Text>
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
  );

  return embedded ? (
    visible ? shell : null
  ) : (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {shell}
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  wrapEmbedded: { backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(168,148,104,0.18)',
  },
  back: { color: C.goldText, fontSize: 32, fontWeight: '400', marginTop: -4, width: 28 },
  headTitle: { color: INK, fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
});
