// components/FlightTicketSheet.js
// Uçak bileti PDF + kalkış + iniş (zorunlu) + işe başlama + süre.
import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { formatArriveAt, parseArriveAt } from '../lib/flights';

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

function fmtHm(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getHours())}:${p(x.getMinutes())}`;
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

function parseInitialArrive(initialArrive) {
  const p = parseArriveAt(initialArrive);
  if (!p?.dt) return { date: null, time: null };
  return {
    date: new Date(p.dt.getFullYear(), p.dt.getMonth(), p.dt.getDate()),
    time: p.time ? new Date(2000, 0, 1, p.dt.getHours(), p.dt.getMinutes()) : null,
  };
}

/**
 * mode: 'upload' | 'edit'
 * onConfirm({ startYmd, flightYmd, endYmd, arriveAt, pickPdf?: boolean })
 */
export default function FlightTicketSheet({
  visible,
  mode = 'upload',
  initialStart,
  initialFlight,
  initialEnd,
  initialArrive,
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
  const [arrive, setArrive] = useState(() => parseInitialArrive(initialArrive).date);
  const [arriveTime, setArriveTime] = useState(() => parseInitialArrive(initialArrive).time);
  const [preset, setPreset] = useState('1y');
  // iOS only — Android uses DateTimePickerAndroid.open (works inside Modal)
  const [picking, setPicking] = useState(null); // 'start' | 'flight' | 'end' | 'arrive' | 'arriveTime'

  React.useEffect(() => {
    if (!visible) return;
    const s = initialStart ? new Date(initialStart) : new Date();
    const f = initialFlight ? new Date(initialFlight) : s;
    const e = initialEnd ? new Date(initialEnd) : addMonths(s, 12);
    const parsed = parseInitialArrive(initialArrive);
    setStart(s);
    setFlight(f);
    setEnd(e);
    setArrive(parsed.date);
    setArriveTime(parsed.time);
    setPreset(inferPreset(s, e));
    setPicking(null);
  }, [visible, initialStart, initialFlight, initialEnd, initialArrive]);

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

  const applyPicked = (kind, d) => {
    if (!d) return;
    if (kind === 'flight') setFlight(d);
    else if (kind === 'end') {
      setPreset('custom');
      setEnd(d);
    } else if (kind === 'arrive') setArrive(d);
    else if (kind === 'arriveTime') setArriveTime(d);
    else onStartChange(d);
  };

  const valueFor = (kind) => {
    if (kind === 'flight') return flight;
    if (kind === 'end') return end;
    if (kind === 'arrive') return arrive || new Date();
    if (kind === 'arriveTime') return arriveTime || new Date();
    return start;
  };

  const openPicker = (kind) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: valueFor(kind),
        mode: kind === 'arriveTime' ? 'time' : 'date',
        is24Hour: true,
        onChange: (event, d) => {
          if (event?.type === 'dismissed' || !d) return;
          applyPicked(kind, d);
        },
      });
      return;
    }
    setPicking(kind);
  };

  const save = async (withPdf) => {
    const startYmd = toYmd(start);
    const flightYmd = toYmd(flight);
    const endYmd = toYmd(end);
    const arriveYmd = toYmd(arrive);
    const arriveHm = fmtHm(arriveTime);
    if (!arriveYmd || !arriveHm) {
      Alert.alert(t('flight_arrive_notice_title'), t('flight_arrive_required'));
      openPicker(!arriveYmd ? 'arrive' : 'arriveTime');
      return;
    }
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
    await onConfirm?.({
      startYmd,
      flightYmd,
      endYmd,
      arriveAt: formatArriveAt(arriveYmd, arriveHm),
      pickPdf: withPdf,
    });
  };

  const pickerTitle =
    picking === 'arrive' ? t('flight_arrive_label')
      : picking === 'arriveTime' ? t('flight_arrive_time_label')
        : picking === 'flight' ? t('flight_depart_label')
          : picking === 'end' ? t('work_end_label')
            : t('work_start_label');

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

            <View style={styles.notice}>
              <Text style={styles.noticeKicker}>{t('flight_arrive_kicker')}</Text>
              <Text style={styles.noticeTitle}>{t('flight_arrive_notice_title')}</Text>
              <Text style={styles.noticeBody}>{t('flight_arrive_notice')}</Text>
            </View>

            <Text style={styles.label}>{t('flight_arrive_label')} *</Text>
            <TouchableOpacity
              style={[styles.dateBtn, !arrive && styles.dateBtnNeed]}
              onPress={() => openPicker('arrive')}
              activeOpacity={0.85}
            >
              <Text style={[styles.dateBtnText, !arrive && styles.dateBtnNeedText]}>
                {arrive ? fmtTr(arrive) : t('work_start_pick')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('flight_arrive_time_label')} *</Text>
            <TouchableOpacity
              style={[styles.dateBtn, !arriveTime && styles.dateBtnNeed]}
              onPress={() => openPicker('arriveTime')}
              activeOpacity={0.85}
            >
              <Text style={[styles.dateBtnText, !arriveTime && styles.dateBtnNeedText]}>
                {arriveTime ? fmtHm(arriveTime) : t('flight_arrive_time_pick')}
              </Text>
            </TouchableOpacity>

            {preferredStartDate ? (
              <View style={styles.prefBox}>
                <Text style={styles.prefText}>
                  {t('start_date_agency')}: <Text style={styles.prefDate}>{preferredStartDate}</Text>
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('flight_depart_label')} *</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('flight')} activeOpacity={0.85}>
              <Text style={styles.dateBtnText}>{fmtTr(flight) || t('work_start_pick')}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t('work_start_label')} *</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('start')} activeOpacity={0.85}>
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
                openPicker('end');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.dateBtnText}>{fmtTr(end) || t('work_start_pick')}</Text>
            </TouchableOpacity>

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

          {Platform.OS === 'ios' && picking ? (
            <View style={styles.pickerPanel}>
              <View style={styles.pickerBar}>
                <Text style={styles.pickerTitle} numberOfLines={1}>{pickerTitle}</Text>
                <TouchableOpacity onPress={() => setPicking(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.pickerDone}>{t('done')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={valueFor(picking)}
                mode={picking === 'arriveTime' ? 'time' : 'date'}
                display="spinner"
                is24Hour
                onChange={(_, d) => applyPicked(picking, d)}
                style={styles.picker}
              />
            </View>
          ) : null}
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
  title: { fontSize: 18, fontWeight: '800', color: INK, marginBottom: 14 },
  notice: {
    backgroundColor: '#faf8f2',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  noticeKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    color: GOLD,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  noticeTitle: { fontSize: 14, fontWeight: '800', color: INK, marginBottom: 4 },
  noticeBody: { fontSize: 13, lineHeight: 18, color: '#5b6575' },
  prefBox: {
    backgroundColor: '#f4f6f8', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 13, marginBottom: 14, marginTop: 6,
  },
  prefText: { fontSize: 13, color: '#2a5560', fontWeight: '600' },
  prefDate: { fontWeight: '900', color: INK },
  label: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 6, letterSpacing: 0.3, marginTop: 4 },
  dateBtn: {
    borderWidth: 1.5, borderColor: '#e2e6ec', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14,
    backgroundColor: '#f7f8fa', marginBottom: 8,
  },
  dateBtnNeed: { borderColor: GOLD, backgroundColor: '#fbf7ee' },
  dateBtnNeedText: { color: '#8a7340', fontWeight: '700' },
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
  pickerPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e6ec',
    marginHorizontal: -20,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  pickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  pickerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK, marginRight: 12 },
  pickerDone: { fontSize: 16, fontWeight: '800', color: GOLD },
  picker: { height: 200, alignSelf: 'stretch' },
});
