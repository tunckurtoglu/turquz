// components/AgencyHotelsPanel.js
// Acente — Otellerim: koyu tema, kapak görseli, işletme detayı.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Image, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HotelCoverArt from './HotelCoverArt';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { useLanguage } from '../i18n/LanguageContext';
import {
  listEmployers, saveEmployer, deleteEmployer, getEmployer,
  uploadEmployerTaxPlate, getEmployerTaxPlateUrl, parseEmployerTaxPlate,
  uploadEmployerCover, getEmployerCoverUrl,
} from '../lib/employers';
import { langOptions, POSITIONS_BY_SECTOR } from '../cv/options';
import StampSetupSheet from './StampSetupSheet';
import * as Linking from 'expo-linking';
import { C } from '../lib/theme';

const BG = C.bg;
const CARD = C.card;
const GOLD = C.goldText;
const GOLD_BTN = C.gold;
const BORDER = C.hair;
const TEXT_SEC = C.ink2;
const INK_DARK = C.ink;

function CoverBanner({ uri, height = 140 }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: '100%', height }} resizeMode="cover" />;
  }
  return <HotelCoverArt height={height} />;
}

/** 16:9 kapak — WebP (kalite korunur, ~%30–50 daha küçük); destek yoksa JPEG. */
async function optimizeCoverPhoto(uri) {
  const actions = [{ resize: { width: 1200 } }];
  try {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82,
      format: ImageManipulator.SaveFormat.WEBP,
      base64: true,
    });
    return { base64: out.base64, mime: 'image/webp' };
  } catch {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    return { base64: out.base64, mime: 'image/jpeg' };
  }
}

function StatusPill({ ok, label }) {
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillMiss]}>
      <Text style={[styles.pillIcon, ok ? styles.pillTextOk : styles.pillTextMiss]}>{ok ? '✓' : '·'}</Text>
      <Text style={[styles.pillText, ok ? styles.pillTextOk : styles.pillTextMiss]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, multiline, required }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value || ''}
        onChangeText={onChangeText}
        placeholderTextColor="#5a6578"
        multiline={multiline}
      />
    </View>
  );
}

export default function AgencyHotelsPanel({
  agencyId,
  contentPadBottom = 24,
  fixedEmployerId = null,
  embedInHub = false,
  onEmployerUpdated = null,
}) {
  const { t, lang } = useLanguage();
  const deptOptions = useMemo(
    () => langOptions(lang).POSITIONS_BY_SECTOR?.tourism
      || POSITIONS_BY_SECTOR.tourism.map((v) => ({ value: v, label: v })),
    [lang],
  );
  const deptLabel = useCallback((value) => {
    const hit = deptOptions.find((o) => o.value === value);
    return hit?.label || value;
  }, [deptOptions]);

  const [rows, setRows] = useState([]);
  const [coverUrls, setCoverUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailCoverUrl, setDetailCoverUrl] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [deleteFlow, setDeleteFlow] = useState(null); // { row, step: 1 | 2 }

  const loadCoverUrls = useCallback(async (list) => {
    if (!agencyId || !list?.length) {
      setCoverUrls({});
      return;
    }
    const withCover = list.filter((r) => r.hasCover);
    if (!withCover.length) {
      setCoverUrls({});
      return;
    }
    const entries = await Promise.all(
      withCover.map(async (r) => {
        const url = await getEmployerCoverUrl(agencyId, r.id);
        return url ? [r.id, url] : null;
      }),
    );
    setCoverUrls(Object.fromEntries(entries.filter(Boolean)));
  }, [agencyId]);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const list = await listEmployers(agencyId);
      setRows(list);
      await loadCoverUrls(list);
    } finally {
      setLoading(false);
    }
  }, [agencyId, loadCoverUrls]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!fixedEmployerId || !agencyId) return undefined;
    let alive = true;
    (async () => {
      const fresh = await getEmployer(agencyId, fixedEmployerId);
      if (!alive || !fresh) return;
      setSelected(fresh);
      setF({ ...fresh });
      if (fresh.hasCover) {
        const url = await getEmployerCoverUrl(agencyId, fresh.id);
        if (alive) setDetailCoverUrl(url);
      } else if (alive) setDetailCoverUrl(null);
    })();
    return () => { alive = false; };
  }, [agencyId, fixedEmployerId]);

  const openHotel = async (row) => {
    const fresh = (await getEmployer(agencyId, row.id)) || row;
    setSelected(fresh);
    setF({ ...fresh });
    if (fresh.hasCover) {
      const url = await getEmployerCoverUrl(agencyId, fresh.id);
      setDetailCoverUrl(url);
    } else {
      setDetailCoverUrl(null);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setF({});
    setDetailCoverUrl(null);
    refresh();
  };

  const up = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const saveFields = async () => {
    if (!selected?.id) return;
    if (!f.name?.trim() || !f.title?.trim() || !f.address?.trim()
      || !f.country?.trim() || !f.city?.trim() || !f.region?.trim() || !f.webUrl?.trim()) {
      Alert.alert(t('hotels_title'), t('employer_fields_required'));
      return;
    }
    if (!selected.hasTaxPlate || !selected.hasStamp || !selected.stampImage) {
      Alert.alert(t('hotels_title'), t('employer_need_both'));
      return;
    }
    setBusy(true);
    try {
      const row = await saveEmployer(agencyId, f, selected.id);
      setSelected(row);
      setF(row);
      onEmployerUpdated?.(row);
      if (!embedInHub) Alert.alert(t('hotels_title'), t('hotels_saved'));
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

  const closeDeleteFlow = () => setDeleteFlow(null);

  const executeDelete = async (row) => {
    if (!row?.id) return;
    setBusy(true);
    try {
      await deleteEmployer(agencyId, row.id);
      closeDeleteFlow();
      if (selected?.id === row.id) closeDetail();
      else refresh();
    } catch (e) {
      Alert.alert(
        t('hotels_title'),
        e?.message === 'delete_failed' ? t('employer_delete_fail') : (e?.message || t('err_title') || 'error'),
      );
    } finally {
      setBusy(false);
    }
  };

  const removeHotel = (row = selected) => {
    if (!row?.id || busy) return;
    setDeleteFlow({ row, step: 1 });
  };

  const renderDeleteConfirm = () => {
    if (!deleteFlow?.row) return null;
    const { row, step } = deleteFlow;
    const isFinal = step === 2;
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => { if (!busy) closeDeleteFlow(); }}
      >
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmCard, isFinal && styles.confirmCardDanger]}>
            {isFinal ? (
              <View style={styles.dangerIcon}>
                <Text style={styles.dangerIconText}>!</Text>
              </View>
            ) : null}
            <Text style={[styles.confirmTitle, isFinal && styles.confirmTitleDanger]}>
              {isFinal ? t('employer_delete_final_title') : t('employer_delete')}
            </Text>
            <Text style={styles.confirmBody}>
              {isFinal
                ? t('employer_delete_final')
                : t('employer_delete_warning', { name: row.name || '' })}
            </Text>
            <TouchableOpacity
              style={[isFinal ? styles.dangerBtn : styles.confirmPrimaryBtn, busy && { opacity: 0.6 }]}
              onPress={() => {
                if (busy) return;
                if (isFinal) executeDelete(row);
                else setDeleteFlow({ row, step: 2 });
              }}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy && isFinal
                ? <ActivityIndicator color="#fff" />
                : (
                  <Text style={isFinal ? styles.dangerBtnText : styles.confirmPrimaryText}>
                    {isFinal ? t('employer_delete') : (t('continue_btn') || 'Devam')}
                  </Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmCancelBtn}
              onPress={closeDeleteFlow}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmCancelText}>{t('consent_cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const pickCover = async () => {
    if (!selected?.id) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('perm_needed'), t('perm_msg'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      setBusy(true);
      const { base64, mime } = await optimizeCoverPhoto(res.assets[0].uri);
      const row = await uploadEmployerCover(agencyId, selected.id, base64, mime);
      setSelected(row);
      setF(row);
      const url = await getEmployerCoverUrl(agencyId, row.id);
      setDetailCoverUrl(url);
      setCoverUrls((prev) => ({ ...prev, [row.id]: url }));
      onEmployerUpdated?.(row);
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setBusy(false);
    }
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
      setParsing(true);
      try {
        row = await parseEmployerTaxPlate(selected.id);
        if (row) { setSelected(row); setF(row); onEmployerUpdated?.(row); }
        if (!embedInHub) Alert.alert(t('hotels_title'), t('hotels_tax_parsed'));
      } catch (pe) {
        if (!embedInHub) Alert.alert(t('hotels_title'), `${t('hotels_tax_uploaded')}. ${t('hotels_tax_parse_fail')}: ${pe?.message || ''}`);
      } finally {
        setParsing(false);
      }
    } catch (e) {
      Alert.alert(t('hotels_title'), e?.message || 'error');
    } finally {
      setBusy(false);
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

  const renderHotelCard = (item) => {
    const coverUri = coverUrls[item.id];
    return (
      <TouchableOpacity style={styles.hotelCard} onPress={() => openHotel(item)} activeOpacity={0.88}>
        <CoverBanner uri={coverUri} height={132} />
        <View style={styles.hotelCardBody}>
          <View style={styles.hotelCardTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>{item.title || '—'}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </View>
          <View style={styles.pillRow}>
            <StatusPill ok={item.hasTaxPlate} label={t('hotels_sec_tax')} />
            <StatusPill ok={item.hasStamp && item.stampImage} label={t('hotels_sec_stamp')} />
            <StatusPill ok={item.hasInfo} label={t('hotels_badge_info')} />
            <StatusPill ok={item.hasWebPage} label={t('hotels_badge_web')} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (fixedEmployerId && !selected) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={GOLD} />
      </View>
    );
  }

  if (selected) {
    const detailBody = (
      <View style={[styles.detailBody, embedInHub && { paddingTop: 4 }]}>
        {embedInHub ? (
          <TouchableOpacity onPress={pickCover} disabled={busy} activeOpacity={0.85} style={{ marginBottom: 10 }}>
            <Text style={styles.heroCoverBtn}>
              {selected.hasCover ? t('hotels_cover_change') : t('hotels_cover_upload')}
            </Text>
          </TouchableOpacity>
        ) : null}
            <Text style={styles.sec}>{t('hotels_sec_tax')}</Text>
            <View style={styles.card}>
              <Text style={styles.cardMeta}>
                {selected.hasTaxPlate
                  ? (selected.taxPlateParsedAt ? t('hotels_tax_ok') : t('hotels_tax_uploaded'))
                  : t('hotels_tax_missing')}
              </Text>
              <TouchableOpacity style={styles.goldBtn} onPress={uploadTax} disabled={busy || parsing} activeOpacity={0.9}>
                {(busy && !parsing)
                  ? <ActivityIndicator color={INK_DARK} />
                  : <Text style={styles.goldBtnText}>{selected.hasTaxPlate ? t('hotels_tax_replace') : t('hotels_tax_upload')}</Text>}
              </TouchableOpacity>
              {selected.hasTaxPlate ? (
                <View style={styles.rowBtns}>
                  <TouchableOpacity style={styles.ghostBtn} onPress={viewTax}>
                    <Text style={styles.ghostText}>{t('doc_view')}</Text>
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
              <TouchableOpacity style={styles.goldBtn} onPress={() => setStampOpen(true)} activeOpacity={0.9}>
                <Text style={styles.goldBtnText}>{selected.hasStamp ? t('stamp_change') : t('stamp_capture')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sec}>{t('hotels_sec_info')}</Text>
            <View style={styles.card}>
              <Field label={t('hotels_f_name')} value={f.name} onChangeText={up('name')} required />
              <Field label={t('contract_f_title')} value={f.title} onChangeText={up('title')} multiline required />
              <Field label={t('contract_f_address')} value={f.address} onChangeText={up('address')} multiline required />
              <Field label={t('hotels_country')} value={f.country} onChangeText={up('country')} required />
              <Field label={t('hotels_city')} value={f.city} onChangeText={up('city')} required />
              <Field label={t('hotels_region')} value={f.region} onChangeText={up('region')} required />
              <Field label={t('contract_f_phone')} value={f.phone} onChangeText={up('phone')} />
              <Field label={t('contract_f_email')} value={f.email} onChangeText={up('email')} />
              <Field label={t('hotels_tax_no')} value={f.taxNo} onChangeText={up('taxNo')} />
              <Field label={t('hotels_tax_office')} value={f.taxOffice} onChangeText={up('taxOffice')} />
              <Field label={t('contract_f_contact_phone')} value={f.contactPhone} onChangeText={up('contactPhone')} />
              <Field label={t('contract_f_contact_email')} value={f.contactEmail} onChangeText={up('contactEmail')} />
              <Field label={t('hotels_badge_web')} value={f.webUrl} onChangeText={up('webUrl')} required />
            </View>

            <TouchableOpacity style={[styles.saveBtn, busy && { opacity: 0.6 }]} onPress={saveFields} disabled={busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color={INK_DARK} /> : <Text style={styles.saveText}>{t('save')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.removeBtn} onPress={() => removeHotel()} disabled={busy} activeOpacity={0.85}>
              <Text style={styles.removeText}>{t('employer_delete')}</Text>
            </TouchableOpacity>
      </View>
    );

    return (
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={{ paddingBottom: contentPadBottom + 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          {!embedInHub ? (
            <View style={styles.heroWrap}>
              <CoverBanner uri={detailCoverUrl} height={200} />
              <LinearGradient
                colors={['rgba(10,17,33,0.15)', 'rgba(10,17,33,0.92)']}
                style={StyleSheet.absoluteFill}
              />
              <TouchableOpacity style={styles.heroBack} onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.back}>‹ {t('hotels_back_list')}</Text>
              </TouchableOpacity>
              <View style={styles.heroBottom}>
                <Text style={styles.heroTitle} numberOfLines={2}>{f.name || t('hotels_title')}</Text>
                <TouchableOpacity onPress={pickCover} disabled={busy} activeOpacity={0.85}>
                  <Text style={styles.heroCoverBtn}>
                    {selected.hasCover ? t('hotels_cover_change') : t('hotels_cover_upload')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {detailBody}
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
            onEmployerUpdated?.(emp);
          }}
        />
        {renderDeleteConfirm()}
      </KeyboardAvoidingView>
    );
  }

  if (fixedEmployerId) return null;

  return (
    <View style={styles.wrap}>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={GOLD} /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          style={styles.detailScroll}
          contentContainerStyle={[styles.list, { paddingBottom: contentPadBottom + 16 }]}
          ListEmptyComponent={<Text style={styles.empty}>{t('hotels_empty')}</Text>}
          ListHeaderComponent={(
            <View style={styles.listHead}>
              <Text style={styles.kicker}>{t('hotels_title').toUpperCase()}</Text>
            </View>
          )}
          ListFooterComponent={(
            <View style={styles.listFooter}>
              <TouchableOpacity style={styles.addBtn} onPress={addHotel} disabled={busy} activeOpacity={0.9}>
                {busy ? <ActivityIndicator color={INK_DARK} /> : <Text style={styles.addBtnText}>+ {t('hotels_add')}</Text>}
              </TouchableOpacity>
            </View>
          )}
          renderItem={({ item }) => renderHotelCard(item)}
        />
      )}
      {renderDeleteConfirm()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  detailScroll: { flex: 1 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  listHead: { marginBottom: 16 },
  listFooter: { paddingTop: 2, paddingBottom: 8 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: GOLD, marginBottom: 4 },
  lead: { fontSize: 13, fontWeight: '600', color: TEXT_SEC, lineHeight: 18, marginBottom: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: TEXT_SEC, fontWeight: '600', marginTop: 40, lineHeight: 20 },
  addBtn: {
    backgroundColor: GOLD_BTN, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  addBtnText: { color: INK_DARK, fontWeight: '700', fontSize: 15 },
  hotelCard: {
    backgroundColor: CARD, borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: BORDER,
    shadowColor: '#142033', shadowOpacity: 0.08, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  hotelCardBody: { padding: 14 },
  hotelCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#142033' },
  rowSub: { fontSize: 12, fontWeight: '600', color: TEXT_SEC, marginTop: 3 },
  chev: { fontSize: 22, color: GOLD, fontWeight: '600', marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, maxWidth: '48%',
  },
  pillIcon: { fontSize: 11, fontWeight: '900' },
  pillOk: { borderColor: 'rgba(168,148,104,0.55)', backgroundColor: 'rgba(168,148,104,0.1)' },
  pillMiss: { borderColor: 'rgba(138,147,160,0.35)', backgroundColor: 'rgba(138,147,160,0.08)' },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextOk: { color: GOLD },
  pillTextMiss: { color: TEXT_SEC },
  pillFav: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GOLD_BTN, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  pillFavStar: { fontSize: 10, color: INK_DARK, fontWeight: '800' },
  pillFavText: { fontSize: 11, fontWeight: '700', color: INK_DARK },
  heroWrap: { height: 200, backgroundColor: CARD },
  heroBack: { position: 'absolute', top: 12, left: 16, zIndex: 2 },
  heroBottom: { position: 'absolute', left: 16, right: 16, bottom: 14, zIndex: 2 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 6 },
  heroCoverBtn: { fontSize: 12, fontWeight: '700', color: GOLD_BTN, textDecorationLine: 'underline' },
  back: { color: GOLD_BTN, fontWeight: '700', fontSize: 15 },
  detailBody: { padding: 16 },
  sec: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase',
    color: GOLD, marginTop: 6, marginBottom: 8,
  },
  card: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER, padding: 14, marginBottom: 8,
  },
  cardMeta: { color: TEXT_SEC, fontWeight: '600', marginBottom: 10, lineHeight: 18, fontSize: 13 },
  stampImg: { width: '100%', height: 100, marginBottom: 10, backgroundColor: '#E9E4DA', borderRadius: 8 },
  goldBtn: { backgroundColor: GOLD_BTN, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  goldBtnText: { color: INK_DARK, fontWeight: '700' },
  rowBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  ghostBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  ghostText: { color: GOLD, fontWeight: '700', fontSize: 13 },
  parseHint: { marginTop: 10, color: TEXT_SEC, fontSize: 12.5, textAlign: 'center' },
  favEmpty: { color: TEXT_SEC, fontWeight: '600', fontSize: 13.5, lineHeight: 20, textAlign: 'center', paddingVertical: 8 },
  favTotalPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'baseline', gap: 8,
    backgroundColor: 'rgba(168,148,104,0.15)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  favTotalNum: { fontSize: 24, fontWeight: '800', color: GOLD },
  favTotalLbl: { fontSize: 13, fontWeight: '600', color: '#596575' },
  favHint: { fontSize: 12.5, fontWeight: '600', color: TEXT_SEC, marginBottom: 12, lineHeight: 18 },
  favDeptBlock: { marginBottom: 6 },
  favDeptRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(168,148,104,0.15)',
  },
  favDeptRowOn: { borderColor: 'rgba(168,148,104,0.45)', backgroundColor: 'rgba(168,148,104,0.08)' },
  favDeptName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#142033' },
  favDeptCount: {
    minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(168,148,104,0.2)', borderWidth: 1, borderColor: BORDER,
  },
  favDeptCountText: { fontSize: 13, fontWeight: '800', color: GOLD },
  favDeptChev: { fontSize: 14, fontWeight: '800', color: GOLD, width: 16, textAlign: 'center' },
  favCandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 10, paddingVertical: 10, marginTop: 4, marginLeft: 8,
    borderLeftWidth: 2, borderLeftColor: BORDER,
  },
  favCandAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E9E4DA',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  favCandAvatarImg: { width: '100%', height: '100%' },
  favCandAvatarText: { fontSize: 16 },
  favCandName: { fontSize: 14, fontWeight: '700', color: '#142033' },
  favCandSub: { fontSize: 12, fontWeight: '600', color: TEXT_SEC, marginTop: 2 },
  favCandChev: { fontSize: 20, color: GOLD, fontWeight: '600' },
  field: { marginBottom: 12 },
  label: { color: TEXT_SEC, fontWeight: '600', fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#142033',
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: GOLD_BTN, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  saveText: { color: INK_DARK, fontWeight: '700', fontSize: 16 },
  removeBtn: { alignItems: 'center', paddingVertical: 18 },
  removeText: { color: '#c97a72', fontWeight: '700' },
  confirmOverlay: {
    flex: 1, backgroundColor: 'rgba(10,17,33,0.62)', justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  confirmCard: {
    width: '100%', maxWidth: 340, backgroundColor: '#fff', borderRadius: 18, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  confirmCardDanger: { borderWidth: 2, borderColor: '#d64545' },
  dangerIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#d64545',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14,
  },
  dangerIconText: { color: '#fff', fontSize: 32, fontWeight: '900', lineHeight: 34 },
  confirmTitle: { fontSize: 18, fontWeight: '800', color: '#142033', textAlign: 'center', marginBottom: 10 },
  confirmTitleDanger: { color: '#b42318' },
  confirmBody: { fontSize: 14, fontWeight: '600', color: '#596575', lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  confirmPrimaryBtn: { backgroundColor: GOLD_BTN, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmPrimaryText: { color: INK_DARK, fontWeight: '800', fontSize: 15 },
  dangerBtn: { backgroundColor: '#d64545', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  confirmCancelBtn: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  confirmCancelText: { color: '#737373', fontWeight: '700', fontSize: 15 },
});
