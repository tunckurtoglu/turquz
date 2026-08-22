// components/ProcessChatSheet.js — süreç sohbeti (metin + AI çeviri)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, TextInput, StyleSheet,
  ActivityIndicator, Platform, Alert, Keyboard, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import {
  listProcessMessages, sendProcessMessage, subscribeProcessMessages, syncChatLang,
} from '../lib/processChat';
import { getSession } from '../lib/auth';
import { markChatMessagesReadForCandidate } from '../lib/notifications';

const GOLD = '#c2a25a';
const NAVY = '#000b18';

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ProcessChatSheet({ visible, onClose, candidateId, peerLabel, onRead }) {
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

  // Modal içinde KeyboardAvoidingView güvenilir değil — klavye yüksekliğini elle uygula.
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

  const renderItem = ({ item }) => (
    <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.bubbleText, item.mine && styles.mineText]}>{item.body}</Text>
      <View style={styles.metaRow}>
        <Text style={[styles.time, item.mine && styles.mineTime]}>{fmtTime(item.createdAt)}</Text>
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

  const composerPad = keyboardH > 0 ? 8 : Math.max(insets.bottom, 10);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.wrap, { paddingBottom: keyboardH }]}>
        <StatusBar barStyle="light-content" />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('chat_title')}</Text>
            {peerLabel ? <Text style={styles.sub} numberOfLines={1}>{peerLabel}</Text> : null}
          </View>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.hintBox}>
          <Text style={styles.hintIcon}>✨</Text>
          <Text style={styles.hint}>{t('chat_hint')}</Text>
        </View>

        {loading && !messages.length ? (
          <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.listFlex}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onContentSizeChange={() => scrollToEnd(false)}
            onLayout={() => scrollToEnd(false)}
            ListEmptyComponent={<Text style={styles.empty}>{t('chat_empty')}</Text>}
          />
        )}

        {readOnly ? (
          <View style={[styles.readonlyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Text style={styles.readonlyText}>{t('chat_history_readonly') || 'Bu süreç sonlandı. Konuşma salt okunur.'}</Text>
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: composerPad }]}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder={t('chat_placeholder')}
              placeholderTextColor="#7a8796"
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
              {sending ? <ActivityIndicator color="#0e141c" /> : <Text style={styles.sendTxt}>{t('chat_send')}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10, backgroundColor: NAVY,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(90,130,170,0.28)',
  },
  close: { fontSize: 32, color: '#e7dcc4', fontWeight: '400', marginTop: -4, width: 28 },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#9fb0c4', marginTop: 1 },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#0a1524', borderBottomWidth: 2, borderBottomColor: GOLD,
  },
  hintIcon: { fontSize: 15, marginTop: 1 },
  hint: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#e7dcc4', lineHeight: 19 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listFlex: { flex: 1 },
  list: { padding: 14, paddingBottom: 8, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center', color: '#7a8796', marginTop: 40, fontSize: 14 },
  bubble: {
    maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: GOLD },
  theirs: {
    alignSelf: 'flex-start', backgroundColor: '#0a1524',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,130,170,0.28)',
  },
  bubbleText: { fontSize: 15, color: '#e8eef6', lineHeight: 20 },
  mineText: { color: '#0e141c' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 },
  time: { fontSize: 10, color: '#7a8796' },
  mineTime: { color: 'rgba(14,20,28,0.55)' },
  ticks: { fontSize: 11, fontWeight: '800', color: 'rgba(14,20,28,0.45)' },
  ticksRead: { color: '#1f5c3a' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#0a1524',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(90,130,170,0.28)',
  },
  readonlyBar: {
    paddingHorizontal: 16, paddingTop: 14, backgroundColor: '#0a1524',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(90,130,170,0.28)',
  },
  readonlyText: { fontSize: 13, fontWeight: '700', color: '#9fb0c4', textAlign: 'center', lineHeight: 18 },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(90,130,170,0.35)',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#fff', backgroundColor: '#071019',
  },
  sendBtn: {
    backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 14, height: 40,
    alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },
  sendTxt: { color: '#0e141c', fontWeight: '800', fontSize: 14 },
});
