// components/EmployerPickerSheet.js
// Sözleşme öncesi: kayıtlı işletmeyi seç, düzenle veya sil.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listEmployers, touchEmployer, deleteEmployer, employerReadyForContract, employerContractBlockReason } from '../lib/employers';
import EmployerFormSheet from './EmployerFormSheet';
import StampSetupSheet from './StampSetupSheet';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function EmployerPickerSheet({ visible, agencyId, onSelect, onClose }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stampEmp, setStampEmp] = useState(null);

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      setRows(await listEmployers(agencyId));
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => {
    if (visible) refresh();
    else {
      setFormOpen(false);
      setEditing(null);
    }
  }, [visible, refresh]);

  const pick = async (employer) => {
    const reason = employerContractBlockReason(employer);
    if (reason) {
      const msg = reason === 'tax' ? t('employer_need_tax')
        : reason === 'stamp' ? t('employer_need_stamp')
          : reason === 'details' ? t('employer_need_details')
            : t('employer_need_both');
      Alert.alert(t('employer_pick_title'), msg);
      return;
    }
    if (!employerReadyForContract(employer)) {
      Alert.alert(t('employer_pick_title'), t('employer_need_both'));
      return;
    }
    await touchEmployer(agencyId, employer.id);
    onSelect?.(employer);
    onClose?.();
  };

  const openEdit = (employer) => {
    setEditing(employer);
    setFormOpen(true);
  };

  const confirmDelete = (employer) => {
    const executeDelete = async () => {
      try {
        await deleteEmployer(agencyId, employer.id);
        await refresh();
      } catch (e) {
        Alert.alert(t('employer_delete'), e?.message || t('doc_upload_error'));
      }
    };
    const finalConfirm = () => Alert.alert(
      t('employer_delete'),
      t('employer_delete_final'),
      [
        { text: t('agency_cancel'), style: 'cancel' },
        { text: t('employer_delete'), style: 'destructive', onPress: executeDelete },
      ],
    );
    Alert.alert(
      t('employer_delete'),
      t('employer_delete_warning', { name: employer.name || '' }),
      [
        { text: t('agency_cancel'), style: 'cancel' },
        { text: t('continue_btn') || 'Devam', style: 'destructive', onPress: finalConfirm },
      ],
    );
  };

  const onSaved = (employer) => {
    setFormOpen(false);
    setEditing(null);
    refresh().then(() => {
      // Yeni kayıt sonrası otomatik seçme yok — levha + kaşe zorunlu
      if (employerReadyForContract(employer)) pick(employer);
      else {
        const reason = employerContractBlockReason(employer);
        const msg = reason === 'tax' ? t('employer_need_tax')
          : reason === 'stamp' ? t('employer_need_stamp')
            : reason === 'details' ? t('employer_need_details')
              : t('employer_need_both');
        Alert.alert(t('employer_pick_title'), msg);
      }
    });
  };

  return (
    <>
      <Modal visible={visible && !formOpen && !stampEmp} animationType="slide" onRequestClose={onClose}>
        <View style={styles.wrap}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.backChevron}>{backChevron}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('employer_pick_title')}</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.accent} />

          <Text style={styles.sub}>{t('employer_pick_sub')}</Text>

          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
              {rows.map((e) => (
                <View key={e.id} style={styles.card}>
                  <TouchableOpacity style={styles.cardMain} onPress={() => pick(e)} activeOpacity={0.85}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{e.name}</Text>
                      <Text style={[styles.stampChip, employerReadyForContract(e) ? styles.stampOn : styles.stampOff]}>
                        {employerReadyForContract(e) ? '✓' : '!'}
                      </Text>
                    </View>
                    {e.title ? <Text style={styles.cardSub} numberOfLines={2}>{e.title}</Text> : null}
                    <Text style={styles.cardMeta}>
                      {e.hasTaxPlate ? '✓ ' + t('hotels_badge_tax') : '· ' + t('hotels_badge_no_tax')}
                      {'  ·  '}
                      {e.hasStamp ? '✓ ' + t('hotels_badge_stamp') : '· ' + t('hotels_badge_no_stamp')}
                    </Text>
                    <Text style={styles.cardPick}>
                      {employerReadyForContract(e) ? t('employer_use') : t('employer_not_ready')}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.actionEdit}>{t('employer_edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => setStampEmp(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={[styles.actionEdit, { color: '#9a7b1f' }]}>
                        {e.hasStamp ? t('stamp_ready') : t('stamp_menu')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => confirmDelete(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.actionDel}>{t('employer_delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {rows.length === 0 ? (
                <Text style={styles.empty}>{t('employer_pick_empty')}</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>

      <EmployerFormSheet
        visible={formOpen}
        agencyId={agencyId}
        initial={editing}
        onSaved={onSaved}
        onClose={() => { setFormOpen(false); setEditing(null); }}
      />

      <StampSetupSheet
        visible={!!stampEmp}
        agencyId={agencyId}
        employer={stampEmp}
        onClose={() => setStampEmp(null)}
        onSaved={() => { setStampEmp(null); refresh(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  sub: { fontSize: 13.5, color: '#737373', lineHeight: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e6e8ec', overflow: 'hidden' },
  cardMain: { padding: 16, paddingBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { fontSize: 16, fontWeight: '800', color: INK, flex: 1 },
  stampChip: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '800', overflow: 'hidden' },
  stampOn: { backgroundColor: 'rgba(31,138,76,0.15)', color: '#1a5c2a' },
  stampOff: { backgroundColor: '#f3ecdc', color: '#9a7b1f' },
  cardSub: { fontSize: 12.5, color: '#737373', marginTop: 4, lineHeight: 17 },
  cardMeta: { fontSize: 12, color: '#8a93a0', marginTop: 6, fontWeight: '600' },
  cardPick: { marginTop: 10, fontSize: 13, fontWeight: '800', color: '#9a7b1f' },
  cardActions: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#eceef1' },
  actionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  actionEdit: { fontSize: 13.5, fontWeight: '700', color: INK },
  actionDel: { fontSize: 13.5, fontWeight: '700', color: '#a32d2d' },
  empty: { fontSize: 14, color: '#9aa1ac', textAlign: 'center', marginVertical: 20, lineHeight: 20 },
});
