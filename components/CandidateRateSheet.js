// components/CandidateRateSheet.js
// Acentenin çalıştığı adaya 1–5 puan vermesi (disiplin / iletişim / tekrar).
import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { getMyRating, saveRating, scoreOf } from '../lib/ratings';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function Stars({ value, onChange }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }} activeOpacity={0.7}>
          <Text style={[styles.star, n <= value && styles.starOn]}>{n <= value ? '★' : '☆'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Row({ label, hint, value, onChange }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Stars value={value} onChange={onChange} />
    </View>
  );
}

export default function CandidateRateSheet({
  visible, agencyId, candidateId, peerLabel, onClose, onSaved,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [discipline, setDiscipline] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [rehire, setRehire] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !agencyId || !candidateId) return undefined;
    let alive = true;
    setLoading(true);
    setErr('');
    getMyRating(agencyId, candidateId).then((r) => {
      if (!alive) return;
      setDiscipline(r?.discipline || 0);
      setCommunication(r?.communication || 0);
      setRehire(r?.rehire || 0);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [visible, agencyId, candidateId]);

  const ready = discipline >= 1 && communication >= 1 && rehire >= 1;
  const preview = ready ? scoreOf({ discipline, communication, rehire }) : null;

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      await saveRating(agencyId, candidateId, { discipline, communication, rehire });
      onSaved?.({ discipline, communication, rehire });
      onClose?.();
    } catch (e) {
      setErr(e?.message || 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('rate_title')}</Text>
          {peerLabel ? <Text style={styles.sub}>{peerLabel}</Text> : null}
          <Text style={styles.hint}>{t('rate_hint')}</Text>

          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginVertical: 28 }} />
          ) : (
            <>
              <View style={styles.card}>
                <Row label={t('rate_discipline')} hint={t('rate_discipline_hint')} value={discipline} onChange={setDiscipline} />
                <View style={styles.sep} />
                <Row label={t('rate_communication')} hint={t('rate_communication_hint')} value={communication} onChange={setCommunication} />
                <View style={styles.sep} />
                <Row label={t('rate_rehire')} hint={t('rate_rehire_hint')} value={rehire} onChange={setRehire} />
              </View>
              {preview != null ? (
                <Text style={styles.preview}>{t('rate_preview', { n: preview.toFixed(1) })}</Text>
              ) : null}
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <TouchableOpacity
                style={[styles.saveBtn, (!ready || busy) && styles.saveDim]}
                onPress={save}
                disabled={!ready || busy}
                activeOpacity={0.9}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{t('rate_save')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>{t('consent_cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,12,20,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#f7f4ec', borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 10,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 3, backgroundColor: '#ddd2b8', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: INK },
  sub: { fontSize: 13, fontWeight: '700', color: '#9a7b1f', marginTop: 4 },
  hint: { fontSize: 12.5, fontWeight: '600', color: '#8a929c', marginTop: 8, marginBottom: 14, lineHeight: 17 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ebe4d5', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 },
  rowLabel: { fontSize: 15, fontWeight: '800', color: INK },
  rowHint: { fontSize: 11.5, fontWeight: '600', color: '#8a929c', marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#ece4d2', marginLeft: 14 },
  stars: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 26, color: '#cfd3d8' },
  starOn: { color: GOLD },
  preview: { marginTop: 12, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#8a6a1f' },
  err: { color: '#a32d2d', fontWeight: '700', marginTop: 10, textAlign: 'center' },
  saveBtn: {
    marginTop: 16, backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveDim: { opacity: 0.5 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#9aa1ac', fontWeight: '700', fontSize: 14 },
});
