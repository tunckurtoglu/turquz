// components/Select.js
// Bağımlılık gerektirmeyen, scroll ile seçim yapılan bileşenler.
//   <Select label="Uyruk" value={v} options={NATIONALITIES} onChange={fn} />
//   <MultiSelect label="Beceriler" values={arr} options={SKILLS} onChange={fn} />
// options: string dizisi  veya  { label, value } dizisi.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

const norm = (o) => (typeof o === 'string' ? { label: o, value: o } : o);

export function Select({ label, value, options = [], onChange, placeholder, disabled = false }) {
  const { t } = useLanguage();
  const ph = placeholder || t('select');
  const [open, setOpen] = useState(false);
  const opts = options.map(norm);
  const selected = opts.find((o) => o.value === value);

  return (
    <View style={[styles.field, disabled && styles.fieldDisabled]}>
      {label ? <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text> : null}
      <TouchableOpacity style={[styles.control, disabled && styles.controlDisabled]} onPress={() => !disabled && setOpen(true)} activeOpacity={disabled ? 1 : 0.7} disabled={disabled}>
        <Text
          style={[styles.controlText, !selected && styles.placeholder, disabled && styles.textDisabled]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.82}
        >
          {selected ? selected.label : ph}
        </Text>
        <Text style={[styles.chev, disabled && styles.textDisabled]}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{label || ph}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.action}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={opts}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={3}>{item.label}</Text>
                  {active ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

export function MultiSelect({ label, values = [], options = [], onChange, placeholder, maxValues }) {
  const { t } = useLanguage();
  const ph = placeholder || t('select');
  const [open, setOpen] = useState(false);
  const opts = options.map(norm);
  const set = new Set(values);
  const atLimit = typeof maxValues === 'number' && values.length >= maxValues;
  const toggle = (v) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else {
      if (atLimit) return; // sınır dolu, yeni eklenmez
      next.add(v);
    }
    onChange([...next]);
  };
  const labelFor = (v) => { const o = opts.find((x) => x.value === v); return o ? o.label : v; };
  const summary = values.length ? values.map(labelFor).join(', ') : ph;

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity style={styles.control} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={[styles.controlText, !values.length && styles.placeholder]} numberOfLines={2}>
          {summary}
        </Text>
        <Text style={styles.chev}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>
              {label || ph}
              {typeof maxValues === 'number' ? `  (${values.length}/${maxValues})` : ''}
            </Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={styles.action}>{t('done')}</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={opts}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = set.has(item.value);
              const disabled = !active && atLimit;
              return (
                <TouchableOpacity style={styles.option} onPress={() => toggle(item.value)} disabled={disabled}>
                  <View style={[styles.box, active && styles.boxActive]}>
                    {active ? <Text style={styles.boxCheck}>✓</Text> : null}
                  </View>
                  <Text style={[styles.optionText, styles.optionTextMulti, active && styles.optionTextActive, disabled && styles.optionTextDisabled]} numberOfLines={3}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  fieldDisabled: { opacity: 0.55 },
  labelDisabled: { color: '#9aa1ac' },
  controlDisabled: { backgroundColor: '#f1f2f4' },
  textDisabled: { color: '#9aa1ac' },
  label: { fontSize: 13, color: '#1b2533', fontWeight: '600', marginBottom: 5 },
  control: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe2e7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  controlText: { flex: 1, fontSize: 15, color: '#1b2533', paddingRight: 8 },
  placeholder: { color: '#aaa' },
  chev: { fontSize: 14, color: '#9aa1ac' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '70%', paddingBottom: 24,
  },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eef0f2',
    gap: 12,
  },
  sheetTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1b2533' },
  action: { fontSize: 15, fontWeight: '700', color: '#c2a25a', flexShrink: 0 },

  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  optionText: { flex: 1, fontSize: 15, color: '#1b2533' },
  optionTextMulti: { marginLeft: 12 },
  optionTextActive: { fontWeight: '700', color: '#1b2533' },
  optionTextDisabled: { color: '#c2c6cc' },
  check: { fontSize: 16, color: '#c2a25a', fontWeight: '800' },

  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#c9ccd2',
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { backgroundColor: '#c2a25a', borderColor: '#c2a25a' },
  boxCheck: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
