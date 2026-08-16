// Aday paneli — sıkça sorulan sorular (accordion) + Turquz destek.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { getCandidateFaq } from '../lib/candidateFaq';
import { openTurquzSupportChat } from '../lib/config';

const INK = '#1b2533';
const GOLD = '#c2a25a';
const LOGO = require('../assets/turquz-logo.png');

export default function FaqSheet({ visible, onClose, chatPrefill = '', onOpenContact }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const items = useMemo(() => getCandidateFaq(lang), [lang]);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!visible) setOpenId(null);
  }, [visible]);

  const startChat = () => {
    if (onOpenContact) {
      onOpenContact();
      return;
    }
    const msg = chatPrefill || t('faq_chat_msg');
    openTurquzSupportChat(msg).catch(() => {
      Alert.alert(t('faq_chat'), t('faq_chat_fail'));
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('home_faq')}</Text>
            <Text style={styles.sub}>{t('home_faq_sub')}</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const open = openId === item.id;
            return (
              <View key={item.id} style={[styles.card, open && styles.cardOpen]}>
                <TouchableOpacity
                  style={styles.qRow}
                  onPress={() => setOpenId(open ? null : item.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.qMark}>?</Text>
                  <Text style={styles.qText}>{item.q}</Text>
                  <Text style={styles.chev}>{open ? '▾' : '›'}</Text>
                </TouchableOpacity>
                {open ? <Text style={styles.aText}>{item.a}</Text> : null}
              </View>
            );
          })}

          <View style={styles.support}>
            <View style={styles.supportGold} />
            <Text style={styles.supportTitle}>{t('faq_not_found')}</Text>
            <Text style={styles.supportSub}>{t('faq_not_found_sub')}</Text>
            <TouchableOpacity style={styles.chatBtn} onPress={startChat} activeOpacity={0.9}>
              <Image source={LOGO} style={styles.chatLogo} resizeMode="contain" />
              <Text style={styles.chatBtnText}>{t('faq_chat')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e6e8ec',
  },
  close: { fontSize: 32, color: INK, fontWeight: '700', marginTop: -4, width: 28 },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  sub: { fontSize: 12, color: '#737373', marginTop: 2 },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4,
    borderWidth: 1, borderColor: '#e8e4d8',
  },
  cardOpen: { borderColor: GOLD, backgroundColor: '#fffdf8' },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  qMark: {
    width: 26, height: 26, borderRadius: 13, overflow: 'hidden',
    backgroundColor: '#f0e6cf', color: INK, fontWeight: '900', fontSize: 14,
    textAlign: 'center', lineHeight: 26,
  },
  qText: { flex: 1, fontSize: 15, fontWeight: '700', color: INK, lineHeight: 20 },
  chev: { color: GOLD, fontSize: 18, fontWeight: '700', width: 18, textAlign: 'center' },
  aText: {
    fontSize: 14, color: '#4a5563', lineHeight: 21, fontWeight: '500',
    paddingBottom: 14, paddingLeft: 36, paddingRight: 4,
  },
  support: {
    marginTop: 8, backgroundColor: '#16202e', borderRadius: 18, overflow: 'hidden',
    paddingHorizontal: 18, paddingTop: 22, paddingBottom: 18, alignItems: 'center',
  },
  supportGold: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: GOLD },
  supportTitle: { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 22 },
  supportSub: { color: '#c5ccd6', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  chatBtn: {
    marginTop: 14, alignSelf: 'stretch', backgroundColor: GOLD, borderRadius: 12, minHeight: 48,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14,
  },
  chatLogo: { width: 28, height: 20 },
  chatBtnText: { color: INK, fontWeight: '800', fontSize: 15 },
});
