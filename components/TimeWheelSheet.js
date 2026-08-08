// iOS Alarm tarzı saat/dakika tekerleği (DateTimePicker spinner).
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ivClampToBand, ivDefaultInBand } from '../cv/options';

const INK = '#1b2533';
const GOLD = '#c2a25a';
const pad = (n) => String(n).padStart(2, '0');

function hhmmToDate(hhmm) {
  const [h, m] = String(hhmm || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}
function dateToHhmm(dt) {
  return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export default function TimeWheelSheet({
  visible,
  value,
  bandIndex = 0,
  minHhmm = '',
  title,
  cancelLabel = 'Vazgeç',
  saveLabel = 'Kaydet',
  onCancel,
  onSave,
}) {
  const insets = useSafeAreaInsets();
  const clamp = (hhmm) => {
    let next = ivClampToBand(hhmm || ivDefaultInBand(bandIndex), bandIndex);
    if (minHhmm) {
      const [mh, mm] = String(minHhmm).split(':').map(Number);
      const [h, m] = String(next).split(':').map(Number);
      if ((h * 60 + m) < (mh * 60 + mm)) next = minHhmm;
    }
    return next;
  };
  const [draft, setDraft] = useState(hhmmToDate(value || ivDefaultInBand(bandIndex)));

  useEffect(() => {
    if (visible) setDraft(hhmmToDate(clamp(value || ivDefaultInBand(bandIndex))));
  }, [visible, value, bandIndex, minHhmm]);

  const apply = (dt) => {
    const clamped = clamp(dateToHhmm(dt));
    setDraft(hhmmToDate(clamped));
    return clamped;
  };

  const onChange = (_e, selected) => {
    if (!selected) return;
    if (Platform.OS === 'android') {
      // Android diyalog: hemen kaydet / iptal olayları native'den gelir.
      if (_e?.type === 'dismissed') { onCancel?.(); return; }
      onSave?.(apply(selected));
      return;
    }
    apply(selected);
  };

  if (Platform.OS === 'android' && visible) {
    return (
      <DateTimePicker
        value={draft}
        mode="time"
        display="spinner"
        is24Hour
        minuteInterval={1}
        onChange={onChange}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.flex} activeOpacity={1} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.bar}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.cancel}>{cancelLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>{title || ''}</Text>
            <TouchableOpacity
              onPress={() => onSave?.(clamp(dateToHhmm(draft)))}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.save}>{saveLabel}</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={draft}
            mode="time"
            display="spinner"
            themeVariant="dark"
            is24Hour
            minuteInterval={1}
            onChange={onChange}
            style={styles.picker}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  cancel: { color: GOLD, fontSize: 17, fontWeight: '600', minWidth: 72 },
  save: { color: GOLD, fontSize: 17, fontWeight: '700', minWidth: 72, textAlign: 'right' },
  title: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '700' },
  picker: { height: 216, alignSelf: 'center' },
});
