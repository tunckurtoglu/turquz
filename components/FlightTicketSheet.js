// components/FlightTicketSheet.js
// Uçak bileti PDF + uçuş günü + işe başlama + süre (6 ay / 1 yıl / özel bitiş).
import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function toYmd(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

function fmtTr(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getDate())}.${p(x.getMonth() + 1)}.${x.getFullYear()}`;
}

function addMonths(d, months) {
  const x = new Date(d);
  const day = x.getDate();
  x.setMonth(x.getMonth() + months);
  if (x.getDate() !== day) x.setDate(0);
  return x;
}

function sameYmd(a, b) {
  return toYmd(a) && toYmd(a) === toYmd(b);
}

function inferPreset(start, end) {
  if (!start || !end) return '1y';
  if (sameYmd(end, addMonths(start, 6))) return '6m';
  if (sameYmd(end, addMonths(start, 12))) return '1y';
  return 'custom';
}

/**
 * mode: 'upload' | 'edit'
 * onConfirm({ startYmd, flightYmd, endYmd, pickPdf?: boolean })
 */
export default function FlightTicketSheet({
  visible,
  mode = 'upload',
  initialStart,
  initialFlight,
  initialEnd,
  preferredStartDate,
  busy,
  onClose,
  onConfirm,
}) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState(() => (initialStart ? new Date(initialStart) : new Date()));
  const [flight, setFlight] = useState(() => (initialFlight ? new Date(initialFlight) : new Date()));
  const [end, setEnd] = useState(() => {
    if (initialEnd) return new Date(initialEnd);
    return addMonths(initialStart ? new Date(initialStart) : new Date(), 12);
  });
  const [preset, setPreset] = useState('1y');
  const [picking, setPicking] = useState(null); // 'start' | 'flight' | 'end' | null

  React.useEffect(() => {
    if (!visible) return;
    const s = initialStart ? new Date(initialStart) : new Date();
    const f = initialFlight ? new Date(initialFlight) : s;
    const e = initialEnd ? new Date(initialEnd) : addMonths(s, 12);
    setStart(s);
    setFlight(f);
    setEnd(e);
    setPreset(inferPreset(s, e));
    setPicking(Platform.OS === 'ios' ? 'flight' : null);
  }, [visible, initialStart, initialFlight, initialEnd]);

  const applyPreset = (next, fromStart = start) => {
    setPreset(next);
    if (next === '6m') setEnd(addMonths(fromStart, 6));
    else if (next === '1y') setEnd(addMonths(fromStart, 12));
  };

  const onStartChange = (d) => {
    setStart(d);
    if (preset === '6m') setEnd(addMonths(d, 6));
    else if (preset === '1y') setEnd(addMonths(d, 12));
  };

  const save = async (withPdf) => {
    const startYmd = toYmd(start);
    const flightYmd = toYmd(flight);
    const endYmd = toYmd(end);
    if (!startYmd || !flightYmd) {
      Alert.alert(t('work_start_title'), t('work_start_required'));
      return;
    }
    if (!endYmd) {
      Alert.alert(t('work_start_title'), t('work_end_required'));
      return;
    }
    if (endYmd <= startYmd) {
      Alert.alert(t('work_start_title'), t('work_term_invalid'));
      return;
    }
    await onConfirm?.({ startYmd, flightYmd, endYmd, pickPdf: withPdf });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {mode === 'edit' ? t('work_start_edit_title') : t('flight_ticket_sheet_title')}
            </Text>
            <Text style={styles.hint}>{t('work_start_hint')}</Text>
            {preferredStartDate ? (
              <View style={styles.prefBox}>
                <Text style={styles.prefText}>
                  📅 {t('start_date_agency')}: <Text style={styles.prefDate}>{preferredStartDate}</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('flight_depart_label')} *</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicking('flight')} activeOpacity={0.85}>
              <Text style={styles.dateBtnText}>{fmtTr(flight) || t('work_start_pick')}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('work_start_label')} *</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setPicking('start')} activeOpacity={0.85}>
              <Text style={styles.dateBtnText}>{fmtTr(start) || t('work_start_pick')}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('work_term_label')} *</Text>
            <View style={styles.segRow}>
              {[
                { id: '6m', label: t('work_term_6m') },
                { id: '1y', label: t('work_term_1y') },
                { id: 'custom', label: t('work_term_custom') },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.segBtn, preset === opt.id && styles.segBtnOn]}
                  onPress={() => applyPreset(opt.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segText, preset === opt.id && styles.segTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t('work_end_label')} *</Text>
            <TouchableOpacity
              style={[styles.dateBtn, preset !== 'custom' && styles.dateBtnLocked]}
              onPress={() => {
                if (preset !== 'custom') applyPreset('custom');
                setPicking('end');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dateBtnText}>{fmtTr(end) || t('work_start_pick')}</Text>
            </TouchableOpacity>

            {picking ? (
              <DateTimePicker
                value={picking === 'flight' ? flight : picking === 'end' ? end : start}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setPicking(null);
                  if (!d) return;
                  if (picking === 'flight') setFlight(d);
                  else if (picking === 'end') {
                    setPreset('custom');
                    setEnd(d);
                  } else onStartChange(d);
                }}
              />
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={!!busy}>
                <Text style={styles.cancelText}>{t('consent_cancel')}</Text>
              </TouchableOpacity>
              {mode === 'edit' ? (
                <TouchableOpacity style={[styles.primary, busy && styles.dim]} onPress={() => save(false)} disabled={!!busy}>
                  {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.primaryText}>{t('work_start_save')}</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.primary, busy && styles.dim]} onPress={() => save(true)} disabled={!!busy}>
                  {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.primaryText}>{t('flight_pick_pdf')}</Text>}
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,20,28,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#d8dde5', marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 6 },
  hint: { fontSize: 13, color: '#5b6575', lineHeight: 18, marginBottom: 16 },
  prefBox: {
    backgroundColor: '#eef4f6', borderWidth: 1, borderColor: '#cfe0e6', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 13, marginBottom: 14,
  },
  prefText: { fontSize: 13, color: '#2a5560', fontWeight: '600' },
  prefDate: { fontWeight: '900', color: INK },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6, letterSpacing: 0.3, marginTop: 4 },
  dateBtn: {
    borderWidth: 1.5, borderColor: '#e2e6ec', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: '#f7f8fa', marginBottom: 8,
  },
  dateBtnLocked: { opacity: 0.92 },
  dateBtnText: { fontSize: 16, fontWeight: '700', color: INK },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segBtn: {
    flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: '#e2e6ec',
    paddingVertical: 10, alignItems: 'center', backgroundColor: '#f7f8fa',
  },
  segBtnOn: { borderColor: GOLD, backgroundColor: '#f7f0de' },
  segText: { fontSize: 12, fontWeight: '700', color: '#5b6575' },
  segTextOn: { color: INK },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 4 },
  cancel: {
    flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e6ec',
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontWeight: '700', color: '#5b6575' },
  primary: {
    flex: 1.4, borderRadius: 12, backgroundColor: GOLD, paddingVertical: 14, alignItems: 'center',
  },
  primaryText: { fontWeight: '800', color: INK },
  dim: { opacity: 0.6 },
});
