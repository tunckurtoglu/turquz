// Aday + acente iletişim — WhatsApp / Telegram destek, e-posta, sosyal, web + SSS.
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Alert, StatusBar,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { getCandidateFaq } from '../lib/candidateFaq';
import {
  openTurquzWhatsApp, openTurquzTelegram, openTurquzEmail, openExternal,
  INSTAGRAM_URL, TIKTOK_URL, CAREER_SITE_URL,
} from '../lib/config';
import ContactIcon from './ContactIcon';

const NAVY = '#000b18';
const GOLD = '#c2a25a';
const PANEL = '#0a1524';
const PANEL_LINE = 'rgba(90,130,170,0.28)';
const GOLD_LINE = 'rgba(194,162,90,0.22)';

function WhatsAppIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.4a8.4 8.4 0 0 0-7.2 12.7L3.6 20.4l4.4-1.15A8.4 8.4 0 1 0 12 3.4Z"
        stroke={color} strokeWidth="1.7" strokeLinejoin="round"
      />
      <Path
        d="M9.2 9.1c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .5.3l.7 1.7c.1.2 0 .4-.1.6l-.4.5c-.1.1-.1.3 0 .4.3.5.9 1.1 1.5 1.4.2.1.4.1.5 0l.6-.4c.2-.1.4-.1.5 0l1.5.9c.2.1.3.3.3.5v.5c0 .2 0 .4-.2.5-.4.4-1 .6-1.6.6-2.5 0-5.3-2.6-5.9-4.9-.1-.4-.1-.8 0-1.1.1-.3.3-.5.5-.7Z"
        fill={color}
      />
    </Svg>
  );
}
function TelegramIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.4 4.6 3.9 11c-.9.35-.88 1.62.04 1.93l4.1 1.38 1.58 4.85c.28.87 1.4 1.1 2.02.42l2.3-2.5 4.05 2.98c.72.53 1.74.14 1.94-.74L21.6 5.7c.2-.9-.7-1.62-1.2-1.1Z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      <Path d="m9.2 14.2 8.8-7.1" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}
function MailIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="5.5" width="17" height="13" rx="2.2" stroke={color} strokeWidth="1.7" />
      <Path d="M4.2 7.2 12 13.1l7.8-5.9" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function InstagramIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" stroke={color} strokeWidth="1.8" />
      <Circle cx="12" cy="12" r="4.1" stroke={color} strokeWidth="1.8" />
      <Circle cx="17.15" cy="6.85" r="1.15" fill={color} />
    </Svg>
  );
}
function TikTokIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.2 3.5v10.1a3.7 3.7 0 1 1-3.2-3.66"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M14.2 7.2c1.35 1.55 3.15 2.45 5.3 2.55" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
function GlobeIcon({ color = GOLD, size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth="1.7" />
      <Path d="M3.8 12h16.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Path d="M12 3.8c2.4 2.6 3.6 5.4 3.6 8.2s-1.2 5.6-3.6 8.2c-2.4-2.6-3.6-5.4-3.6-8.2s1.2-5.6 3.6-8.2Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
    </Svg>
  );
}

function Row({ icon, title, sub, onPress, last }) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.cardMid}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub} numberOfLines={2}>{sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

export default function ContactSheet({ visible, onClose, prefill = '', name = '', showFaq = true }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const msg = prefill || t('faq_chat_msg');
  const who = name ? `\n\n${name}` : '';
  const faqItems = useMemo(() => (showFaq ? getCandidateFaq(lang) : []), [showFaq, lang]);
  const [faqOpen, setFaqOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!visible) {
      setFaqOpen(false);
      setOpenId(null);
    }
  }, [visible]);

  const fail = () => Alert.alert(t('contact_title'), t('faq_chat_fail'));

  const wa = () => openTurquzWhatsApp(msg).catch(fail);
  const tg = () => openTurquzTelegram(msg).catch(fail);
  const email = () => openTurquzEmail({ subject: t('contact_email_subject'), body: msg + who }).catch(fail);

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.panelHead}>
              <View style={styles.panelHeadIcon}>
                <ContactIcon color={GOLD} size={28} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle}>{t('contact_title')}</Text>
                <Text style={styles.panelSub}>{t('contact_sub')}</Text>
              </View>
            </View>

            <Row
              icon={<WhatsAppIcon />}
              title={t('contact_wa')}
              sub={t('contact_wa_sub')}
              onPress={wa}
            />
            <Row
              icon={<TelegramIcon />}
              title={t('contact_tg')}
              sub={t('contact_tg_sub')}
              onPress={tg}
            />
            <Row
              icon={<MailIcon />}
              title={t('contact_email')}
              sub={t('contact_email_sub')}
              onPress={email}
              last
            />
          </View>

          {showFaq && faqItems.length ? (
            <View style={[styles.panel, { marginTop: 14 }]}>
              <TouchableOpacity
                style={styles.faqToggle}
                onPress={() => setFaqOpen((v) => !v)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.faqToggleTitle}>{t('home_faq')}</Text>
                  <Text style={styles.faqToggleSub}>{t('home_faq_sub')}</Text>
                </View>
                <Text style={styles.faqToggleChev}>{faqOpen ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {faqOpen ? faqItems.map((item, idx) => {
                const open = openId === item.id;
                const last = idx === faqItems.length - 1;
                return (
                  <View key={item.id} style={!last ? styles.faqBorder : null}>
                    <TouchableOpacity
                      style={styles.faqRow}
                      onPress={() => setOpenId(open ? null : item.id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.faqMark}>
                        <Text style={styles.faqMarkText}>?</Text>
                      </View>
                      <Text style={styles.faqQ}>{item.q}</Text>
                      <Text style={styles.faqChev}>{open ? '▾' : '›'}</Text>
                    </TouchableOpacity>
                    {open ? <Text style={styles.faqA}>{item.a}</Text> : null}
                  </View>
                );
              }) : null}
            </View>
          ) : null}

          <View style={[styles.panel, { marginTop: 14 }]}>
            <Text style={styles.socialHead}>{t('set_social')}</Text>
            <Row
              icon={<InstagramIcon />}
              title={t('contact_ig')}
              sub={t('contact_ig_sub')}
              onPress={() => openExternal(INSTAGRAM_URL)}
            />
            <Row
              icon={<TikTokIcon />}
              title={t('contact_tt')}
              sub={t('contact_tt_sub')}
              onPress={() => openExternal(TIKTOK_URL)}
            />
            <Row
              icon={<GlobeIcon />}
              title={t('contact_web')}
              sub={t('contact_web_sub')}
              onPress={() => openExternal(CAREER_SITE_URL)}
              last
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10,
  },
  back: { color: '#e7dcc4', fontSize: 32, fontWeight: '400', marginTop: -4, width: 28 },
  body: { paddingHorizontal: 18, paddingTop: 8 },
  panel: {
    backgroundColor: PANEL,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PANEL_LINE,
    overflow: 'hidden',
    paddingTop: 6,
  },
  panelHead: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GOLD_LINE,
  },
  panelHeadIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(194,162,90,0.12)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  panelTitle: { color: GOLD, fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  panelSub: { color: '#8fa3bb', fontSize: 13, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: GOLD_LINE },
  iconWrap: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  cardMid: { flex: 1, minWidth: 0 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cardSub: { color: '#8fa3bb', fontSize: 13, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  chev: { color: GOLD, fontSize: 26, fontWeight: '300', marginTop: -2 },
  socialHead: {
    color: '#dcc187', fontSize: 11.5, fontWeight: '800', letterSpacing: 1.1,
    textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
  },
  faqToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
  },
  faqToggleTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  faqToggleSub: { color: '#8fa3bb', fontSize: 12.5, fontWeight: '500', marginTop: 3, lineHeight: 17 },
  faqToggleChev: { color: GOLD, fontSize: 18, fontWeight: '800', paddingLeft: 4 },
  faqBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: GOLD_LINE },
  faqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  faqMark: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(194,162,90,0.18)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  faqMarkText: { color: GOLD, fontWeight: '900', fontSize: 13 },
  faqQ: { flex: 1, color: '#fff', fontSize: 14.5, fontWeight: '700', lineHeight: 20 },
  faqChev: { color: GOLD, fontSize: 18, fontWeight: '700', width: 18, textAlign: 'center' },
  faqA: {
    color: '#a8b8ca', fontSize: 13.5, fontWeight: '500', lineHeight: 20,
    paddingHorizontal: 16, paddingLeft: 54, paddingBottom: 14,
  },
});
