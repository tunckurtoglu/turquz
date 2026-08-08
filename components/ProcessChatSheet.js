// components/ProcessChatSheet.js — süreç sohbeti (metin + AI çeviri)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, FlatList, TextInput, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import {
  listProcessMessages, sendProcessMessage, subscribeProcessMessages, syncChatLang,
} from '../lib/processChat';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ProcessChatSheet({ visible, onClose, candidateId, peerLabel }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    try {
      await syncChatLang(lang);
      const data = await listProcessMessages(candidateId, lang);
      setChatId(data.chatId || null);
      setMessages(data.messages || []);
    } catch (e) {
      const code = e?.code || e?.message;
      if (code === 'chat_locked') Alert.alert(t('chat_title'), t('chat_locked'));
      else Alert.alert(t('chat_title'), e?.message || t('chat_send_error'));
    } finally {
      setLoading(false);
    }
  }, [candidateId, lang, t]);

  useEffect(() => {
    if (visible) load();
    else { setMessages([]); setChatId(null); setText(''); }
  }, [visible, load]);

  useEffect(() => {
    if (!visible || !chatId) return undefined;
    return subscribeProcessMessages(chatId, () => { load(); });
  }, [visible, chatId, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const data = await sendProcessMessage(candidateId, body, lang);
      if (data?.message) setMessages((m) => [...m, data.message]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
    } catch (e) {
      Alert.alert(t('chat_title'), e?.message || t('chat_send_error'));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
      <Text style={[styles.bubbleText, item.mine && styles.mineText]}>{item.body}</Text>
      <Text style={[styles.time, item.mine && styles.mineTime]}>{fmtTime(item.createdAt)}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
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
        <Text style={styles.hint}>{t('chat_hint')}</Text>

        {loading && !messages.length ? (
          <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
            ListEmptyComponent={<Text style={styles.empty}>{t('chat_empty')}</Text>}
          />
        )}

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('chat_placeholder')}
            placeholderTextColor="#9aa1ac"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]}
            onPress={send}
            disabled={!text.trim() || sending}
            activeOpacity={0.85}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendTxt}>{t('chat_send')}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 10, backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e6e8ec',
  },
  close: { fontSize: 32, color: INK, fontWeight: '700', marginTop: -4, width: 28 },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  sub: { fontSize: 12, color: '#737373', marginTop: 1 },
  hint: { fontSize: 12, color: '#8a929c', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#eef0f3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 14, paddingBottom: 8, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#9aa1ac', marginTop: 40, fontSize: 14 },
  bubble: {
    maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: INK },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e6e8ec' },
  bubbleText: { fontSize: 15, color: INK, lineHeight: 20 },
  mineText: { color: '#fff' },
  time: { fontSize: 10, color: '#9aa1ac', marginTop: 4, alignSelf: 'flex-end' },
  mineTime: { color: 'rgba(255,255,255,0.55)' },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e6e8ec',
  },
  input: {
    flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#d8dce2',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: INK, backgroundColor: '#f8f9fb',
  },
  sendBtn: {
    backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 14, height: 40,
    alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },
  sendTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
