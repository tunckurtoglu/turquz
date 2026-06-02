// components/fields.js
// Tüm wizard adımlarının paylaştığı alan bileşenleri.
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

// Tek satırlık etiketli alan
export function Field({ label, value, onChangeText, placeholder, ...rest }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        {...rest}
      />
    </View>
  );
}

// Çok satırlık alan (profil yazısı gibi)
export function MultilineField({ label, value, onChangeText, placeholder, minHeight = 120, ...rest }) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, styles.multiline, { minHeight }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#aaa"
        multiline
        textAlignVertical="top"
        {...rest}
      />
    </View>
  );
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// Açık/kapalı seçim (örn. "Devam ediyor")
export function Toggle({ label, value, onChange }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <View style={[styles.box, value && styles.boxActive]}>
        {value ? <Text style={styles.boxCheck}>✓</Text> : null}
      </View>
      <Text style={styles.toggleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// Tekrarlanan NESNE grupları (Diller, İş Deneyimleri, Eğitim, Sertifikalar).
// items: dizi | onChange(yeniDizi) | emptyItem: yeni öğe şablonu
// renderItem(item, patch) -> patch({ alan: değer }) ile o öğeyi günceller
export function RepeatableGroup({ items = [], onChange, emptyItem, renderItem, addLabel = '+ Ekle', maxItems, limitLabel }) {
  const setAt = (i, patch) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeAt = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { ...emptyItem }]);
  const atLimit = typeof maxItems === 'number' && items.length >= maxItems;

  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardIndex}>{i + 1}.</Text>
            <TouchableOpacity
              onPress={() => removeAt(i)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.remove}>Sil</Text>
            </TouchableOpacity>
          </View>
          {renderItem(item, (patch) => setAt(i, patch))}
        </View>
      ))}
      {atLimit ? (
        <Text style={styles.limitNote}>{limitLabel || `En fazla ${maxItems} adet ekleyebilirsin.`}</Text>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={add}>
          <Text style={styles.addBtnText}>{addLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Basit METİN listesi
export function SimpleListEditor({ items = [], onChange, placeholder, addLabel = '+ Ekle' }) {
  const setAt = (i, t) => onChange(items.map((v, idx) => (idx === i ? t : v)));
  const removeAt = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, '']);

  return (
    <View>
      {items.map((v, i) => (
        <View key={i} style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={v}
            onChangeText={(t) => setAt(i, t)}
            placeholder={placeholder}
            placeholderTextColor="#aaa"
          />
          <TouchableOpacity
            onPress={() => removeAt(i)}
            style={styles.rowRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.remove}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={add}>
        <Text style={styles.addBtnText}>{addLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13, fontWeight: '800', color: '#c2a25a', textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: 18, marginBottom: 8,
  },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#1b2533', fontWeight: '600', marginBottom: 5 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfe2e7', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#1b2533',
  },
  multiline: { paddingTop: 11 },

  card: {
    borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 12,
    padding: 12, marginBottom: 12, backgroundColor: '#fafbfc',
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardIndex: { fontSize: 13, fontWeight: '800', color: '#9aa1ac' },
  remove: { fontSize: 13, fontWeight: '700', color: '#c0392b' },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  rowInput: { flex: 1 },
  rowRemove: { paddingHorizontal: 12, paddingVertical: 8 },

  addBtn: {
    borderWidth: 1, borderColor: '#c2a25a', borderStyle: 'dashed', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', marginTop: 2, marginBottom: 4,
  },
  addBtnText: { color: '#c2a25a', fontWeight: '800', fontSize: 14 },
  limitNote: { fontSize: 12, color: '#9aa1ac', fontWeight: '600', textAlign: 'center', paddingVertical: 8 },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginBottom: 8 },
  toggleLabel: { marginLeft: 10, fontSize: 14, color: '#1b2533', fontWeight: '600' },
  box: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#c9ccd2',
    alignItems: 'center', justifyContent: 'center',
  },
  boxActive: { backgroundColor: '#c2a25a', borderColor: '#c2a25a' },
  boxCheck: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
