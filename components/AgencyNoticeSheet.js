import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import {
  listAgencyNotices, listNoticeReceipts, noticeErrorText, sendAgencyNotice, listNoticeAudienceBuckets,
} from '../lib/agencyNotices';
import NoticeAudienceBuckets, { NoticePersonRow } from './NoticeAudienceBuckets';

const INK = '#142033';
const GOLD = '#b8954a';
const TONES = ['info', 'action', 'urgent'];
const TPLS = [
  { id: 'docs', tone: 'action', labelKey: 'agency_notice_tpl_docs', titleKey: 'agency_notice_tpl_docs_title', bodyKey: 'agency_notice_tpl_docs_body' },
  { id: 'info', tone: 'info', labelKey: 'agency_notice_tpl_meet', titleKey: 'agency_notice_tpl_meet_title', bodyKey: 'agency_notice_tpl_meet_body' },
  { id: 'travel', tone: 'action', labelKey: 'agency_notice_tpl_travel', titleKey: 'agency_notice_tpl_travel_title', bodyKey: 'agency_notice_tpl_travel_body' },
  { id: 'start', tone: 'action', labelKey: 'agency_notice_tpl_start', titleKey: 'agency_notice_tpl_start_title', bodyKey: 'agency_notice_tpl_start_body' },
  { id: 'urgent', tone: 'urgent', labelKey: 'agency_notice_tpl_urgent', titleKey: 'agency_notice_tpl_urgent_title', bodyKey: 'agency_notice_tpl_urgent_body' },
];

const fmt = (iso) => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
};

export default function AgencyNoticeSheet({
  visible,
  onClose,
  userIds = [],
  peerLabel,
  targetKind = 'selected',
  allowAudience = false,
  agencyId,
  startNotice,
  hideHistory = false,
  previewPeople = [],
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const ids = useMemo(() => [...new Set((userIds || []).filter(Boolean))], [userIds]);
  const pickAud = allowAudience && !ids.length;

  const [tone, setTone] = useState('info');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [detail, setDetail] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [sentNotice, setSentNotice] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [picked, setPicked] = useState(() => new Set());
  const [skip, setSkip] = useState(() => new Set());
  const [audBusy, setAudBusy] = useState(false);

  const effectiveIds = (ids.length ? ids : [...picked]).filter((id) => !skip.has(id));
  const n = effectiveIds.length;
  const shownPeople = (previewPeople || []).filter((p) => !skip.has(p.userId));

  const loadHist = useCallback(async () => {
    setHistory(await listAgencyNotices(20));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setTone('info');
    setTitle('');
    setBody('');
    setBusy(false);
    setReceipts([]);
    setSentNotice(null);
    setPicked(new Set());
    setSkip(new Set());
    setBuckets([]);
    if (startNotice) {
      setDetail(startNotice);
      listNoticeReceipts(startNotice.id).then(setReceipts);
    } else {
      setDetail(null);
    }
    if (!hideHistory) loadHist();
  }, [visible, loadHist, startNotice, hideHistory]);

  useEffect(() => {
    if (!visible || !pickAud || !agencyId) return undefined;
    let alive = true;
    setAudBusy(true);
    listNoticeAudienceBuckets(agencyId)
      .then((next) => { if (alive) setBuckets(next); })
      .finally(() => { if (alive) setAudBusy(false); });
    return () => { alive = false; };
  }, [visible, pickAud, agencyId]);

  const openDetail = async (row) => {
    setDetail(row);
    setReceipts(await listNoticeReceipts(row.id));
  };

  const applyTpl = (tpl) => {
    setTone(tpl.tone);
    setTitle(t(tpl.titleKey));
    setBody(t(tpl.bodyKey));
  };

  const send = () => {
    const ttl = title.trim();
    const txt = body.trim();
    if (!ttl || !txt) {
      Alert.alert(t('agency_notice'), t('agency_notice_need_text'));
      return;
    }
    if (!n) {
      Alert.alert(t('agency_notice'), t('agency_notice_need_people'));
      return;
    }
    Alert.alert(
      t('agency_notice'),
      t('agency_notice_confirm', { n: String(n) }),
      [
        { text: t('close'), style: 'cancel' },
        {
          text: t('agency_notice_send'),
          onPress: async () => {
            setBusy(true);
            try {
              const res = await sendAgencyNotice({
                userIds: effectiveIds,
                title: ttl,
                body: txt,
                tone,
                targetKind: ids.length ? targetKind : 'selected',
              });
              const noticeId = res?.noticeId;
              setSentNotice({
                id: noticeId,
                title: ttl,
                body: txt,
                tone,
                sentN: res?.notified || n,
                readN: 0,
              });
              if (noticeId) setReceipts(await listNoticeReceipts(noticeId));
              loadHist();
            } catch (e) {
              Alert.alert(t('agency_notice'), noticeErrorText(e?.code, t, e?.detail) || e?.message || t('agency_notice_err'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const resendUnread = async () => {
    const unread = receipts.filter((r) => !r.readAt).map((r) => r.candidateId);
    if (!unread.length) return;
    const src = detail || sentNotice;
    if (!src) return;
    setBusy(true);
    try {
      await sendAgencyNotice({
        userIds: unread,
        title: src.title,
        body: src.body,
        tone: src.tone || 'info',
        targetKind: 'selected',
      });
      Alert.alert(t('agency_notice'), t('agency_notice_sent'));
      setDetail(null);
      setSentNotice(null);
      loadHist();
    } catch (e) {
      Alert.alert(t('agency_notice'), noticeErrorText(e?.code, t, e?.detail) || e?.message || t('agency_notice_err'));
    } finally {
      setBusy(false);
    }
  };

  const toggleGroup = (b) => {
    const gids = (b.people || []).map((p) => p.userId);
    setPicked((prev) => {
      const next = new Set(prev);
      const allOn = gids.length && gids.every((id) => next.has(id));
      if (allOn) gids.forEach((id) => next.delete(id));
      else gids.forEach((id) => next.add(id));
      return next;
    });
  };

  const togglePerson = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const who = ids.length === 1
    ? (peerLabel || t('agency_notice_to_n', { n: '1' }))
    : t('agency_notice_to_n', { n: String(n) });

  const viewing = sentNotice || detail;
  const unreadN = receipts.filter((r) => !r.readAt).length;

  return (
    <Modal visible={!!visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.wrap, { paddingTop: insets.top + 6 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={viewing ? () => {
              if (startNotice && !sentNotice) { onClose?.(); return; }
              setSentNotice(null); setDetail(null); setReceipts([]);
            } : onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headTitle} numberOfLines={1}>
            {viewing ? t('agency_notice_sent') : t('agency_notice')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.done}>{t('close')}</Text>
          </TouchableOpacity>
        </View>

        {viewing ? (
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}>
            <Text style={styles.kicker}>{t(`agency_notice_tone_${viewing.tone || 'info'}`)}</Text>
            <Text style={styles.detailTitle}>{viewing.title}</Text>
            {viewing.body ? <Text style={styles.detailBody}>{viewing.body}</Text> : null}
            <Text style={styles.readN}>
              {t('agency_notice_read_n', { a: String(viewing.readN ?? receipts.filter((r) => r.readAt).length), b: String(viewing.sentN || receipts.length || n) })}
            </Text>
            {receipts.length ? (
              <View style={styles.recBox}>
                {receipts.map((r) => (
                  <NoticePersonRow key={r.candidateId} p={r} mode="read" on={!!r.readAt} />
                ))}
              </View>
            ) : null}
            {unreadN > 0 ? (
              <TouchableOpacity style={[styles.sendBtn, busy && styles.dim]} onPress={resendUnread} disabled={busy}>
                {busy ? <ActivityIndicator color="#0e141c" /> : (
                  <Text style={styles.sendText}>{t('agency_notice_resend')}</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 36 }]}
          >
            {!pickAud || n > 0 ? <Text style={styles.who}>{who}</Text> : null}

            {!pickAud && shownPeople.length ? (
              <View style={styles.codeWrap}>
                {shownPeople.map((p) => (
                  <TouchableOpacity
                    key={p.userId}
                    style={styles.codeChip}
                    onPress={() => setSkip((prev) => { const nset = new Set(prev); nset.add(p.userId); return nset; })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.codeText}>{p.code}</Text>
                    <Text style={styles.codeX}>✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {pickAud ? (
              <>
                <Text style={styles.label}>{t('agency_notice_audience')}</Text>
                {audBusy && !buckets.length ? <ActivityIndicator color={GOLD} style={{ marginBottom: 14 }} /> : (
                  <NoticeAudienceBuckets
                    buckets={buckets}
                    mode="pick"
                    picked={picked}
                    onToggleGroup={toggleGroup}
                    onTogglePerson={togglePerson}
                    theme="light"
                    t={t}
                  />
                )}
              </>
            ) : null}

            <Text style={styles.label}>{t('agency_notice_tone')}</Text>
            <View style={styles.row}>
              {TONES.map((tn) => (
                <TouchableOpacity
                  key={tn}
                  style={[styles.chip, tone === tn && styles.chipOn, tn === 'urgent' && tone === tn && styles.chipHot]}
                  onPress={() => setTone(tn)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, tone === tn && styles.chipTextOn]}>{t(`agency_notice_tone_${tn}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('agency_notice_tpl')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tplRow}>
              {TPLS.map((tpl) => (
                <TouchableOpacity key={tpl.id} style={styles.tpl} onPress={() => applyTpl(tpl)} activeOpacity={0.85}>
                  <Text style={styles.tplText}>{t(tpl.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.titleIn}
              value={title}
              onChangeText={setTitle}
              placeholder={t('agency_notice_title_ph')}
              placeholderTextColor="#9aa3b0"
              maxLength={120}
            />
            <TextInput
              style={styles.bodyIn}
              value={body}
              onChangeText={setBody}
              placeholder={t('agency_notice_body_ph')}
              placeholderTextColor="#9aa3b0"
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.sendBtn, (busy || !n) && styles.dim]}
              onPress={send}
              disabled={busy || !n}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color="#0e141c" /> : (
                <Text style={styles.sendText}>{t('agency_notice_send')} · {n}</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>{t('agency_notice_no_reply')}</Text>

            {hideHistory ? null : (
              <>
            <Text style={styles.histHead}>{t('agency_notice_history')}</Text>
            {history.length ? history.map((h) => (
              <TouchableOpacity key={h.id} style={styles.histRow} onPress={() => openDetail(h)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.histTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={styles.histMeta}>
                    {fmt(h.created_at)} · {t('agency_notice_read_n', { a: String(h.readN), b: String(h.sentN) })}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            )) : (
              <Text style={styles.hint}>{t('agency_notice_empty_hist')}</Text>
            )}
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fffdf8' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ece7db',
  },
  back: { fontSize: 32, color: INK, fontWeight: '400', marginTop: -4, width: 28 },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: INK },
  done: { fontSize: 14, fontWeight: '800', color: '#8a6a1f', width: 56, textAlign: 'right' },
  body: { paddingHorizontal: 16, paddingTop: 14 },
  who: {
    backgroundColor: '#142033', color: '#f5ecda', fontWeight: '800', fontSize: 13,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, overflow: 'hidden', marginBottom: 14,
  },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#8f7130', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  codeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  codeChip: {
    backgroundColor: '#f4ead2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(184,149,74,0.35)', flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  codeText: { fontSize: 11.5, fontWeight: '800', color: INK, letterSpacing: 0.3 },
  codeX: { fontSize: 11, fontWeight: '800', color: '#8a6a1f' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: '#ddd6c8', backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipHot: { backgroundColor: '#b42318', borderColor: '#b42318' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#6e7684' },
  chipTextOn: { color: '#f5ecda' },
  tplRow: { gap: 8, paddingBottom: 14 },
  tpl: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#f4ead2', borderWidth: 1, borderColor: 'rgba(184,149,74,0.35)',
  },
  tplText: { fontSize: 12.5, fontWeight: '700', color: INK },
  titleIn: {
    borderWidth: 1, borderColor: '#ddd6c8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 16, fontWeight: '700', color: INK, backgroundColor: '#fff', marginBottom: 8,
  },
  bodyIn: {
    borderWidth: 1, borderColor: '#ddd6c8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 15, fontWeight: '500', color: INK, backgroundColor: '#fff', minHeight: 120, marginBottom: 14,
  },
  sendBtn: {
    backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8,
  },
  sendText: { fontSize: 15, fontWeight: '800', color: '#0e141c' },
  dim: { opacity: 0.55 },
  hint: { fontSize: 12, fontWeight: '600', color: '#6e7684', lineHeight: 17, marginBottom: 18 },
  histHead: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase',
    color: '#8f7130', marginBottom: 8,
  },
  histRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ece7db',
  },
  histTitle: { fontSize: 14, fontWeight: '800', color: INK },
  histMeta: { marginTop: 2, fontSize: 12, fontWeight: '600', color: '#6e7684' },
  chev: { fontSize: 22, color: GOLD, fontWeight: '300', marginLeft: 8 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: GOLD, marginBottom: 6 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: INK, marginBottom: 8 },
  detailBody: { fontSize: 15, fontWeight: '500', color: '#2a3340', lineHeight: 22, marginBottom: 12 },
  readN: { fontSize: 14, fontWeight: '800', color: '#1f7a4d', marginBottom: 12 },
  recBox: { gap: 8, marginBottom: 14 },
});
