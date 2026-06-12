// components/GroupCreateSheet.js
// Acente: seçili adaylarla GRUP mülakatı oluştur — sabit tarih + saat. Slot UTC ISO saklanır.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { Select } from './Select';
import { DAYS, monthOptions, FLIGHT_YEARS, INTERVIEW_TIMES } from '../cv/options';
import { toISO } from '../lib/interviews';
import { createGroup } from '../lib/groupInterviews';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function GroupCreateSheet({ visible, agencyId, candidateIds, onClose, onCreated }) {
  const { t, lang } = useLanguage();
  const [d, setD] = useState('');
  const [m, setM] = useState('');
  const [y, setY] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setD(''); setM(''); setY(''); setTime(''); };

  const submit = async () => {
    if (!(d && m && y && time)) { Alert.alert(t('grp_new_title'), t('grp_need_time')); return; }
    setBusy(true);
    try {
      const iso = toISO(d, m, y, time);
      const id = await createGroup(agencyId, iso, candidateIds);
      reset();
      onCreated?.(id);
    } catch (e) {
      Alert.alert(t('grp_new_title'), e?.message || 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('grp_new_title')}</Text>
          <Text style={styles.sub}>{t('grp_selected_n', { n: (candidateIds || []).length })}</Text>

          <Text style={styles.lbl}>{t('grp_pick_time')}</Text>
          <View style={styles.row}>
            <View style={styles.col}><Select label={t('f_day')} value={d} options={DAYS} onChange={setD} /></View>
            <View style={styles.col}><Select label={t('f_month')} value={m} options={monthOptions(lang)} onChange={setM} /></View>
            <View style={styles.col}><Select label={t('f_year')} value={y} options={FLIGHT_YEARS} onChange={setY} /></View>
          </View>
          <Select label={t('iv_times_label')} value={time} options={INTERVIEW_TIMES} onChange={setTime} />

          <TouchableOpacity style={[styles.btn, busy && { opacity: 0.5 }]} onPress={submit} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.btnText}>{t('grp_create_btn')}</Text>}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#dfe2e7', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  sub: { fontSize: 13, color: '#9a7b1f', fontWeight: '700', marginTop: 4, marginBottom: 16 },
  lbl: { fontSize: 11, fontWeight: '800', color: '#9aa1ac', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  col: { flex: 1 },
  btn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 18 },
  btnText: { color: INK, fontWeight: '800', fontSize: 15 },
});
