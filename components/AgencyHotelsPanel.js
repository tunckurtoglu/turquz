// components/AgencyHotelsPanel.js
// Acente — Otellerim: işletme listesi + detay (kaşe, vergi levhası, AI doldurma).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Image, TextInput, ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useLanguage } from '../i18n/LanguageContext';
import {
  listEmployers, saveEmployer, deleteEmployer, getEmployer,
  uploadEmployerTaxPlate, getEmployerTaxPlateUrl, parseEmployerTaxPlate,
} from '../lib/employers';
import StampSetupSheet from './StampSetupSheet';
import * as Linking from 'expo-linking';

const INK = '#1b2533';
const GOLD = '#c2a25a';

function Field({ label, value, onChangeText, multiline, required }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value || ''}
        onChangeText={onChangeText}
        placeholderTextColor="#9aa1ac"
        multiline={multiline}
      />
    </View>
  );
}

export default function AgencyHotelsPanel({ agencyId }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      setRows(await listEmployers(agencyId));
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const openHotel = async (row) => {
    const fresh = (await getEmployer(agencyId, row.id)) || row;
    setSelected(fresh);
    setF({ ...fresh });
  };

  const closeDetail = () => {
    setSelected(null);
    setF({});
    refresh();
  };

  const up = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const saveFields = async () => {
    if (!selected?.id) return;
    if (!f.name?.trim() || !f.title?.trim() || !f.address?.trim()) {
      Alert.alert(t('hotels_title'), t('employer_name_required'));
      return;
    }
    setBusy(true);
    try {
      const row = await saveEmployer(agencyId, f, selected.id);
      setSelected(row);
      setF(row);
      Alert.alert(t('hotels_title'), t('hotels_saved'));
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setBusy(false);
    }
  };

  const addHotel = async () => {
    setBusy(true);
    try {
      const row = await saveEmployer(agencyId, {
        name: t('hotels_new_name'),
        title: t('hotels_new_name'),
        address: '—',
      });
      await openHotel(row);
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeHotel = (row = selected) => {
    if (!row?.id) return;
    Alert.alert(t('employer_delete'), t('employer_delete_confirm', { name: row.name || '' }), [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('employer_delete'), style: 'destructive', onPress: async () => {
          try {
            await deleteEmployer(agencyId, row.id);
            if (selected?.id === row.id) closeDetail();
            else refresh();
          } catch (e) {
            Alert.alert(
              t('hotels_title'),
              e?.message === 'delete_failed' ? t('employer_delete_fail') : (e?.message || t('err_title') || 'error'),
            );
          }
        },
      },
    ]);
  };

  const uploadTax = async () => {
    if (!selected?.id) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'], copyToCacheDirectory: true, multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const isPdf = (a.mimeType || '').includes('pdf') || (a.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) { Alert.alert(t('hotels_title'), t('doc_pdf_only')); return; }
      setBusy(true);
      const base64 = await new File(a.uri).base64();
      let row = await uploadEmployerTaxPlate(agencyId, selected.id, base64, 'application/pdf');
      setSelected(row);
      setF(row);
      // Otomatik AI doldurma
      setParsing(true);
      try {
        row = await parseEmployerTaxPlate(selected.id);
        if (row) { setSelected(row); setF(row); }
        Alert.alert(t('hotels_title'), t('hotels_tax_parsed'));
      } catch (pe) {
        Alert.alert(t('hotels_title'), `${t('hotels_tax_uploaded')}. ${t('hotels_tax_parse_fail')}: ${pe?.message || ''}`);
      } finally {
        setParsing(false);
      }
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setBusy(false);
    }
  };

  const reparse = async () => {
    if (!selected?.id || !selected.hasTaxPlate) return;
    setParsing(true);
    try {
      const row = await parseEmployerTaxPlate(selected.id);
      if (row) { setSelected(row); setF(row); }
      Alert.alert(t('hotels_title'), t('hotels_tax_parsed'));
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setParsing(false);
    }
  };

  const viewTax = async () => {
    try {
      const url = await getEmployerTaxPlateUrl(agencyId, selected.id);
      if (url) await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    }
  };

  if (selected) {
    return (
      <View style={styles.wrap}>
        <View style={styles.detailHead}>
          <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>‹ {t('hotels_back_list')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.detailBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.detailTitle}>{f.name || t('hotels_title')}</Text>
          <Text style={styles.hint}>{t('hotels_detail_hint')}</Text>

          <Text style={styles.sec}>{t('hotels_sec_tax')}</Text>
          <View style={styles.card}>
            <Text style={styles.cardMeta}>
              {selected.hasTaxPlate
                ? (selected.taxPlateParsedAt ? t('hotels_tax_ok') : t('hotels_tax_uploaded'))
                : t('hotels_tax_missing')}
            </Text>
            <TouchableOpacity style={styles.inkBtn} onPress={uploadTax} disabled={busy || parsing} activeOpacity={0.9}>
              {(busy && !parsing)
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.inkBtnText}>{selected.hasTaxPlate ? t('hotels_tax_replace') : t('hotels_tax_upload')}</Text>}
            </TouchableOpacity>
            {selected.hasTaxPlate ? (
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.ghostBtn} onPress={viewTax}>
                  <Text style={styles.ghostText}>{t('doc_view')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={reparse} disabled={parsing}>
                  {parsing ? <ActivityIndicator color={GOLD} /> : <Text style={styles.ghostText}>{t('hotels_tax_reparse')}</Text>}
                </TouchableOpacity>
              </View>
            ) : null}
            {parsing ? <Text style={styles.parseHint}>{t('hotels_tax_parsing')}</Text> : null}
          </View>

          <Text style={styles.sec}>{t('hotels_sec_stamp')}</Text>
          <View style={styles.card}>
            {selected.hasStamp && selected.stampImage ? (
              <Image source={{ uri: selected.stampImage }} style={styles.stampImg} resizeMode="contain" />
            ) : (
              <Text style={styles.cardMeta}>{t('stamp_missing')}</Text>
            )}
            <TouchableOpacity style={styles.inkBtn} onPress={() => setStampOpen(true)} activeOpacity={0.9}>
              <Text style={styles.inkBtnText}>{selected.hasStamp ? t('stamp_change') : t('stamp_capture')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sec}>{t('hotels_sec_info')}</Text>
          <Text style={styles.infoHint}>{t('hotels_info_autofill_hint')}</Text>
          <Field label={t('employer_f_name')} value={f.name} onChangeText={up('name')} required />
          <Field label={t('contract_f_title')} value={f.title} onChangeText={up('title')} multiline required />
          <Field label={t('contract_f_address')} value={f.address} onChangeText={up('address')} multiline required />
          <Field label={t('contract_f_phone')} value={f.phone} onChangeText={up('phone')} />
          <Field label={t('contract_f_email')} value={f.email} onChangeText={up('email')} />
          <Field label={t('hotels_tax_no')} value={f.taxNo} onChangeText={up('taxNo')} />
          <Field label={t('hotels_tax_office')} value={f.taxOffice} onChangeText={up('taxOffice')} />
          <Field label={t('contract_f_contact_phone')} value={f.contactPhone} onChangeText={up('contactPhone')} />
          <Field label={t('contract_f_contact_email')} value={f.contactEmail} onChangeText={up('contactEmail')} />

          <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={saveFields} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.saveText}>{t('save')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.removeBtn} onPress={removeHotel}>
            <Text style={styles.removeText}>{t('employer_delete')}</Text>
          </TouchableOpacity>
        </ScrollView>

        <StampSetupSheet
          visible={stampOpen}
          agencyId={agencyId}
          employer={selected}
          onClose={() => setStampOpen(false)}
          onSaved={(emp) => {
            setSelected(emp);
            setF(emp);
            setStampOpen(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.listHint}>{t('hotels_list_hint')}</Text>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>{t('hotels_empty')}</Text>}
          ListHeaderComponent={(
            <TouchableOpacity style={styles.addBtn} onPress={addHotel} disabled={busy} activeOpacity={0.9}>
              <Text style={styles.addBtnText}>+ {t('hotels_add')}</Text>
            </TouchableOpacity>
          )}
          renderItem={({ item }) => (
            <View style={styles.rowWrap}>
              <TouchableOpacity style={styles.row} onPress={() => openHotel(item)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>{item.title || '—'}</Text>
                  <Text style={styles.rowMeta}>
                    {item.hasTaxPlate ? '✓ ' + t('hotels_badge_tax') : '· ' + t('hotels_badge_no_tax')}
                    {'  ·  '}
                    {item.hasStamp ? '✓ ' + t('hotels_badge_stamp') : '· ' + t('hotels_badge_no_stamp')}
                  </Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.listDel} onPress={() => removeHotel(item)} activeOpacity={0.85}>
                <Text style={styles.listDelText}>{t('employer_delete')}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  listHint: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, color: '#5a6575', fontSize: 13.5, lineHeight: 19 },
  list: { padding: 14, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#9aa1ac', fontWeight: '700', marginTop: 40 },
  addBtn: { backgroundColor: INK, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: '#e6e8ec', flex: 1,
  },
  rowWrap: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginBottom: 10 },
  listDel: {
    justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14,
    borderWidth: 1, borderColor: '#e6c2bc', backgroundColor: '#fff',
  },
  listDelText: { color: '#c0392b', fontWeight: '800', fontSize: 13 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: INK },
  rowSub: { fontSize: 13, color: '#5a6575', marginTop: 2 },
  rowMeta: { fontSize: 12, color: '#8a93a0', marginTop: 6, fontWeight: '600' },
  chev: { fontSize: 22, color: '#c2a25a', fontWeight: '700', marginLeft: 8 },
  detailHead: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  back: { color: GOLD, fontWeight: '800', fontSize: 15 },
  detailBody: { padding: 16, paddingBottom: 48 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: INK, marginBottom: 6 },
  hint: { color: '#5a6575', fontSize: 13.5, lineHeight: 19, marginBottom: 14 },
  sec: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 10, marginBottom: 8 },
  infoHint: { fontSize: 12.5, fontWeight: '700', color: '#5a6575', lineHeight: 18, marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e6e8ec', padding: 14, marginBottom: 8 },
  cardMeta: { color: '#5a6575', fontWeight: '700', marginBottom: 10 },
  stampImg: { width: '100%', height: 100, marginBottom: 10, backgroundColor: '#dfe3e8', borderRadius: 8 },
  inkBtn: { backgroundColor: INK, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  inkBtnText: { color: '#fff', fontWeight: '800' },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  ghostBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e6e8ec' },
  ghostText: { color: GOLD, fontWeight: '800', fontSize: 13 },
  parseHint: { marginTop: 10, color: '#5a6575', fontSize: 12.5, textAlign: 'center' },
  field: { marginBottom: 12 },
  label: { color: '#5a6575', fontWeight: '700', fontSize: 12.5, marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK,
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveText: { color: INK, fontWeight: '800', fontSize: 16 },
  removeBtn: { alignItems: 'center', paddingVertical: 18 },
  removeText: { color: '#a32d2d', fontWeight: '800' },
});
