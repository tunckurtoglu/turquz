// Uygulama içi KVKK aydınlatma / açık rıza metni (tarayıcıya çıkmadan).
import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { getPrivacyNotice, PRIVACY_NOTICE_DOC_VERSION } from '../i18n/privacyNotice';

const INK = '#1b2533';
const GOLD = '#c2a25a';
const MUTED = '#6b6457';

function Bullets({ items }) {
  if (!items?.length) return null;
  return (
    <View style={styles.bullets}>
      {items.map((line) => (
        <View key={line} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function Block({ block }) {
  return (
    <View style={styles.block}>
      <Text style={styles.heading}>{block.heading}</Text>
      {(block.paragraphs || []).map((p) => (
        <Text key={p} style={styles.para}>{p}</Text>
      ))}
      <Bullets items={block.bullets} />
      {(block.subBlocks || []).map((sub) => (
        <View key={sub.title} style={styles.subBlock}>
          <Text style={styles.subTitle}>{sub.title}</Text>
          <Bullets items={sub.bullets} />
          {sub.note ? <Text style={styles.note}>{sub.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export default function PrivacyNoticeSheet({ visible, onClose }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const notice = getPrivacyNotice(lang);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>KVKK</Text>
            <Text style={styles.headTitle} numberOfLines={1}>{t('privacy_link')}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.done}>{t('close')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{notice.draftBanner}</Text>
          </View>

          <Text style={styles.sectionTitle}>{notice.sectionATitle}</Text>
          {notice.blocks.map((block) => (
            <Block key={block.heading} block={block} />
          ))}

          <Text style={[styles.sectionTitle, styles.sectionGap]}>{notice.sectionBTitle}</Text>
          <Text style={styles.para}>{notice.sectionBIntro}</Text>
          {notice.consents.map((c) => (
            <View key={c.title} style={styles.consentCard}>
              <Text style={styles.consentTitle}>{c.title}</Text>
              <Text style={styles.quote}>{c.quote}</Text>
              {c.note ? <Text style={styles.note}>{c.note}</Text> : null}
            </View>
          ))}

          <Text style={styles.meta}>v{PRIVACY_NOTICE_DOC_VERSION}</Text>
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
  back: { fontSize: 32, color: INK, fontWeight: '700', marginTop: -4, width: 28 },
  kicker: { fontSize: 11, fontWeight: '800', color: GOLD, letterSpacing: 0.6 },
  headTitle: { fontSize: 16, fontWeight: '800', color: INK, marginTop: 1 },
  done: { fontSize: 14, fontWeight: '800', color: '#8a6a1f', paddingHorizontal: 4 },
  body: { padding: 16 },
  banner: {
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: 'rgba(194,162,90,0.45)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  bannerText: { fontSize: 13, fontWeight: '600', color: '#6a5420', lineHeight: 19 },
  sectionTitle: {
    fontSize: 15, fontWeight: '800', color: INK, marginBottom: 12,
    letterSpacing: 0.2,
  },
  sectionGap: { marginTop: 10 },
  block: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8e4d8',
  },
  heading: { fontSize: 16, fontWeight: '800', color: INK, marginBottom: 8 },
  para: { fontSize: 14.5, fontWeight: '500', color: '#2a3340', lineHeight: 22, marginBottom: 8 },
  bullets: { gap: 6, marginTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { color: GOLD, fontWeight: '800', fontSize: 14, marginTop: 1 },
  bulletText: { flex: 1, fontSize: 14.5, fontWeight: '500', color: '#2a3340', lineHeight: 21 },
  subBlock: { marginTop: 12 },
  subTitle: { fontSize: 13.5, fontWeight: '800', color: MUTED, marginBottom: 6 },
  note: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  consentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e8e4d8',
  },
  consentTitle: { fontSize: 14.5, fontWeight: '800', color: INK, marginBottom: 8 },
  quote: { fontSize: 14.5, fontWeight: '500', color: '#2a3340', lineHeight: 22 },
  meta: {
    marginTop: 22,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#a79f8d',
  },
});
