// components/ProcessChatSheet.js — süreç sohbeti (metin + AI çeviri)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, Modal, TouchableOpacity, FlatList, TextInput, StyleSheet,
  ActivityIndicator, Platform, Alert, Keyboard, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import {
  listProcessMessages, sendProcessMessage, subscribeProcessMessages, syncChatLang,
} from '../lib/processChat';
import { getSession } from '../lib/auth';
import { markChatMessagesReadForCandidate } from '../lib/notifications';
import { C } from '../lib/theme';

const BG = '#0A1121';
const CARD = '#121B2E';
const GOLD = '#A89468';
const GOLD_BTN = '#C8B88E';
const BORDER = 'rgba(168,148,104,0.28)';
const TEXT_SEC = '#8E98A8';
const INK = '#f0ece4';
const INK_DARK = '#0e141c';

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dateKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dateLabel(iso, t, lang) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);
  if (d >= startToday) return t('arr_today') || t('nav_today') || 'Bugün';
  if (d >= startYesterday) return t('chat_yesterday') || 'dün';
  try {
    return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : lang || 'tr', {
      day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return d.toLocaleDateString();
  }
}

function langTag(code) {
  const m = { tr: 'TR', en: 'EN', ru: 'RU', kk: 'KZ', ky: 'KG', uz: 'UZ', tk: 'TK', de: 'DE', th: 'TH', fa: 'FA' };
  return m[code] || (code || '').toUpperCase().slice(0, 2);
}

function buildListItems(messages, t, lang) {
  const out = [];
  let lastDay = null;
  (messages || []).forEach((m) => {
    const dk = dateKey(m.createdAt);
    if (dk && dk !== lastDay) {
      out.push({ kind: 'date', id: `date-${dk}`, label: dateLabel(m.createdAt, t, lang) });
      lastDay = dk;
    }
    out.push({ kind: 'msg', id: m.id, msg: m });
  });
  return out;
}

function PeerAvatar({ uri, size = 40, light = false }) {
  const r = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: r, backgroundColor: light ? C.goldSoft : BG,
      borderWidth: 1, borderColor: light ? C.hair : BORDER, alignItems: 'center', justifyContent: 'center',
    }}
    >
      <Text style={{ fontSize: size * 0.42 }}>👤</Text>
    </View>
  );
}

export default function ProcessChatSheet({
  visible,
  onClose,
  candidateId,
  peerLabel,
  peerPhoto,
  peerName,
  peerCode,
  onRead,
  light = false,
}) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [keyboardH, setKeyboardH] = useState(0);
  const listRef = useRef(null);

  const headerName = peerName || (peerLabel ? peerLabel.split(' · ')[0] : '') || t('chat_title');
  const headerCode = peerCode || (peerLabel?.includes(' · ') ? peerLabel.split(' · ').slice(1).join(' · ') : '');

  const listItems = useMemo(
    () => buildListItems(messages, t, lang),
    [messages, t, lang],
  );

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd?.({ animated });
    });
  }, []);

  const load = useCallback(async ({ spinner } = { spinner: true }) => {
    if (!candidateId) return;
    if (spinner) setLoading(true);
    try {
      syncChatLang(lang);
      const data = await listProcessMessages(candidateId, lang);
      setChatId(data.chatId || null);
      setMessages(data.messages || []);
      setReadOnly(!!(data.readOnly || data.closed));
      scrollToEnd(false);
    } catch (e) {
      const code = e?.code || e?.message;
      if (code === 'chat_locked') Alert.alert(t('chat_title'), t('chat_locked'));
      else if (code === 'chat_closed') {
        setReadOnly(true);
        setMessages([]);
      } else Alert.alert(t('chat_title'), e?.message || t('chat_send_error'));
    } finally {
      setLoading(false);
    }
  }, [candidateId, lang, t, scrollToEnd]);

  useEffect(() => {
    if (visible) load({ spinner: true });
    else {
      setMessages([]);
      setChatId(null);
      setReadOnly(false);
      setText('');
      setKeyboardH(0);
      Keyboard.dismiss();
    }
  }, [visible, load]);

  useEffect(() => {
    if (!visible || !candidateId) return undefined;
    let alive = true;
    getSession().then((s) => {
      const uid = s?.user?.id;
      if (!alive || !uid) return;
      markChatMessagesReadForCandidate(uid, candidateId)
        .then(() => { onRead?.(); })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [visible, candidateId, onRead]);

  useEffect(() => {
    if (!visible || !chatId) return undefined;
    const unsub = subscribeProcessMessages(chatId, () => { load({ spinner: false }); });
    const tmr = setInterval(() => { load({ spinner: false }); }, 12000);
    return () => { unsub(); clearInterval(tmr); };
  }, [visible, chatId, load]);

  useEffect(() => {
    if (!visible) return undefined;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => {
      const h = Math.max(0, e?.endCoordinates?.height || 0);
      setKeyboardH(h);
      setTimeout(() => scrollToEnd(true), Platform.OS === 'ios' ? 40 : 80);
    };
    const onHide = () => setKeyboardH(0);
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [visible, scrollToEnd]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    const tempId = `local-${Date.now()}`;
    const optimistic = {
      id: tempId,
      senderId: null,
      body,
      original: body,
      sourceLang: lang,
      createdAt: new Date().toISOString(),
      readAt: null,
      mine: true,
    };
    setText('');
    setMessages((m) => [...m, optimistic]);
    scrollToEnd(true);
    setSending(true);
    try {
      const data = await sendProcessMessage(candidateId, body, lang);
      if (data?.message) {
        setMessages((m) => {
          const withoutTemp = m.filter((x) => x.id !== tempId);
          if (withoutTemp.some((x) => x.id === data.message.id)) return withoutTemp;
          return [...withoutTemp, data.message];
        });
      } else {
        setMessages((m) => m.filter((x) => x.id !== tempId));
      }
      scrollToEnd(true);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== tempId));
      setText(body);
      Alert.alert(t('chat_title'), e?.message || t('chat_send_error'));
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (item) => {
    const translated = !item.mine && item.original && item.body !== item.original;
    const src = item.sourceLang || lang;
    const bubble = (
      <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs, light && !item.mine && lightStyles.theirs]}>
        <Text style={[styles.bubbleText, item.mine && styles.mineText, light && lightStyles.lightBubbleText]}>{item.body}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.time, item.mine && styles.mineTime, light && !item.mine && lightStyles.time]}>{fmtTime(item.createdAt)}</Text>
          {item.mine ? (
            <Text
              style={[styles.ticks, item.readAt && styles.ticksRead]}
              accessibilityLabel={item.readAt ? t('chat_seen') : t('chat_sent')}
            >
              {item.readAt ? '✓✓' : '✓'}
            </Text>
          ) : null}
        </View>
      </View>
    );

    if (item.mine) {
      return (
        <View style={styles.rowMine}>
          <View style={styles.bubbleColMine}>
            {bubble}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.rowTheirs}>
        <PeerAvatar uri={peerPhoto} size={32} light={light} />
        <View style={styles.bubbleColTheirs}>
          {bubble}
          {translated ? (
            <Text style={[styles.translateTag, light && lightStyles.translateTag]}>
              {langTag(src)} → {langTag(lang)} · {t('chat_translated') || 'Çevrildi'}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => {
    if (item.kind === 'date') {
      return (
        <View style={styles.dateSep}>
          <Text style={[styles.dateSepTxt, light && lightStyles.dateSepTxt]}>{item.label}</Text>
        </View>
      );
    }
    return renderMessage(item.msg);
  };

  const composerPad = keyboardH > 0 ? 8 : Math.max(insets.bottom, 10);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.wrap, light && lightStyles.wrap, { paddingBottom: keyboardH }]}>
        <StatusBar barStyle={light ? 'dark-content' : 'light-content'} />
        <View style={[styles.header, light && lightStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.close, light && lightStyles.close]}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <PeerAvatar uri={peerPhoto} size={40} light={light} />
            <View style={styles.headerText}>
              <Text style={[styles.title, light && lightStyles.title]} numberOfLines={1}>{headerName}</Text>
              {headerCode ? <Text style={[styles.sub, light && lightStyles.sub]} numberOfLines={1}>{headerCode}</Text> : null}
            </View>
          </View>
          <View style={{ width: 28 }} />
        </View>

        {!readOnly ? (
          <View style={[styles.topHint, light && lightStyles.topHint]}>
            <Text style={[styles.hintIcon, light && lightStyles.hintIcon]}>✦</Text>
            <Text style={[styles.topHintTxt, light && lightStyles.topHintTxt]} numberOfLines={2}>{t('chat_hint_short') || t('chat_hint')}</Text>
          </View>
        ) : null}

        {loading && !messages.length ? (
          <View style={styles.center}><ActivityIndicator color={light ? C.goldText : GOLD_BTN} /></View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.listFlex}
            data={listItems}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.list, light && lightStyles.list]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scrollToEnd(false)}
            onLayout={() => scrollToEnd(false)}
            ListEmptyComponent={<Text style={[styles.empty, light && lightStyles.empty]}>{t('chat_empty')}</Text>}
          />
        )}

        {readOnly ? (
          <View style={[styles.readonlyBar, light && lightStyles.readonlyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={[styles.readonlyText, light && lightStyles.readonlyText]}>{t('chat_history_readonly') || 'Bu süreç sonlandı. Konuşma salt okunur.'}</Text>
          </View>
        ) : (
          <>
            <View style={[styles.composer, light && lightStyles.composer, { paddingBottom: composerPad }]}>
              <TextInput
                style={[styles.input, light && lightStyles.input]}
                value={text}
                onChangeText={setText}
                placeholder={t('chat_placeholder')}
                placeholderTextColor={light ? C.ink2 : TEXT_SEC}
                multiline
                maxLength={2000}
                onFocus={() => setTimeout(() => scrollToEnd(true), 100)}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
                onPress={send}
                disabled={!text.trim() || sending}
                activeOpacity={0.85}
              >
                {sending ? (
                  <ActivityIndicator color={INK_DARK} size="small" />
                ) : (
                  <Text style={styles.sendIcon}>➤</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={[styles.hintBox, light && lightStyles.hintBox, { paddingBottom: keyboardH > 0 ? 6 : Math.max(insets.bottom, 8) }]}>
              <Text style={[styles.hintFoot, light && lightStyles.hintFoot]}>{t('chat_hint_short') || t('chat_hint')}</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingBottom: 10, backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
  },
  close: { fontSize: 32, color: GOLD_BTN, fontWeight: '400', marginTop: -4, width: 28 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '800', color: INK },
  sub: { fontSize: 12, fontWeight: '600', color: TEXT_SEC, marginTop: 1 },
  topHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: CARD, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
  },
  hintIcon: { fontSize: 11, color: GOLD },
  topHintTxt: { flex: 1, fontSize: 11.5, fontWeight: '600', color: TEXT_SEC, lineHeight: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listFlex: { flex: 1 },
  list: { paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center', color: TEXT_SEC, marginTop: 40, fontSize: 14 },
  dateSep: { alignItems: 'center', marginVertical: 14 },
  dateSepTxt: {
    fontSize: 11, fontWeight: '800', color: TEXT_SEC, letterSpacing: 0.4,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(18,27,46,0.85)', overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER,
  },
  rowMine: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  rowTheirs: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10, maxWidth: '92%' },
  bubbleColMine: { maxWidth: '82%' },
  bubbleColTheirs: { flex: 1, minWidth: 0, maxWidth: '86%' },
  bubble: {
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  mine: { backgroundColor: GOLD_BTN, borderBottomRightRadius: 4 },
  theirs: {
    backgroundColor: CARD,
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: INK, lineHeight: 21 },
  mineText: { color: INK_DARK },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  time: { fontSize: 10, fontWeight: '600', color: TEXT_SEC },
  mineTime: { color: 'rgba(14,20,28,0.55)' },
  ticks: { fontSize: 11, fontWeight: '800', color: 'rgba(14,20,28,0.45)' },
  ticksRead: { color: '#1f5c3a' },
  translateTag: {
    marginTop: 4, marginLeft: 2, fontSize: 10, fontWeight: '700',
    color: GOLD, letterSpacing: 0.3,
  },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10, backgroundColor: CARD,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  readonlyBar: {
    paddingHorizontal: 16, paddingTop: 14, backgroundColor: CARD,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  readonlyText: { fontSize: 13, fontWeight: '700', color: TEXT_SEC, textAlign: 'center', lineHeight: 18 },
  input: {
    flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: INK, backgroundColor: BG,
  },
  sendBtn: {
    backgroundColor: GOLD_BTN, borderRadius: 22, width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: INK_DARK, fontSize: 18, fontWeight: '800', marginLeft: 2 },
  hintBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, paddingTop: 4, backgroundColor: BG,
  },
  hintFoot: { fontSize: 11, fontWeight: '600', color: TEXT_SEC, textAlign: 'center' },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  header: { backgroundColor: C.bg, borderBottomColor: C.hair },
  close: { color: C.goldText },
  title: { color: C.ink },
  sub: { color: C.ink2 },
  topHint: { backgroundColor: C.card, borderBottomColor: C.hair },
  topHintTxt: { color: C.ink2 },
  list: { backgroundColor: C.bg },
  empty: { color: C.ink2 },
  theirs: { backgroundColor: C.card, borderColor: C.hair },
  lightBubbleText: { color: C.ink },
  time: { color: C.muted },
  readonlyBar: { backgroundColor: C.card, borderTopColor: C.hair },
  readonlyText: { color: C.ink2 },
  composer: { backgroundColor: C.card, borderTopColor: C.hair },
  input: { backgroundColor: C.bg, borderColor: C.hair, color: C.ink },
  hintBox: { backgroundColor: C.bg },
  hintFoot: { color: C.ink2 },
  dateSepTxt: { backgroundColor: C.goldSoft, borderColor: C.hair, color: C.ink2 },
  hintIcon: { color: C.goldText },
  translateTag: { color: C.goldText },
});
