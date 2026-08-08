// components/EmployerPickerSheet.js
// Sözleşme öncesi: kayıtlı işletmeyi seç, düzenle, sil veya yeni ekle.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listEmployers, touchEmployer, deleteEmployer } from '../lib/employers';
import EmployerFormSheet from './EmployerFormSheet';

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
    await touchEmployer(agencyId, employer.id);
    onSelect?.(employer);
    onClose?.();
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (employer) => {
    setEditing(employer);
    setFormOpen(true);
  };

  const confirmDelete = (employer) => {
    Alert.alert(
      t('employer_delete'),
      t('employer_delete_confirm').replace('{name}', employer.name || ''),
      [
        { text: t('agency_cancel'), style: 'cancel' },
        {
          text: t('employer_delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmployer(agencyId, employer.id);
              await refresh();
            } catch (e) {
              Alert.alert(t('employer_delete'), e?.message || t('doc_upload_error'));
            }
          },
        },
      ],
    );
  };

  const onSaved = (employer) => {
    const wasEdit = !!editing?.id;
    setFormOpen(false);
    setEditing(null);
    refresh().then(() => {
      if (!wasEdit) pick(employer);
    });
  };

  return (
    <>
      <Modal visible={visible && !formOpen} animationType="slide" onRequestClose={onClose}>
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
                    <Text style={styles.cardName}>{e.name}</Text>
                    {e.title ? <Text style={styles.cardSub} numberOfLines={2}>{e.title}</Text> : null}
                    <Text style={styles.cardPick}>{t('employer_use')}</Text>
                  </TouchableOpacity>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.actionEdit}>{t('employer_edit')}</Text>
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
              <TouchableOpacity style={styles.addBtn} onPress={openNew} activeOpacity={0.85}>
                <Text style={styles.addText}>+ {t('employer_add_new')}</Text>
              </TouchableOpacity>
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
  cardName: { fontSize: 16, fontWeight: '800', color: INK },
  cardSub: { fontSize: 12.5, color: '#737373', marginTop: 4, lineHeight: 17 },
  cardPick: { marginTop: 10, fontSize: 13, fontWeight: '800', color: '#9a7b1f' },
  cardActions: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#eceef1' },
  actionBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  actionEdit: { fontSize: 13.5, fontWeight: '700', color: INK },
  actionDel: { fontSize: 13.5, fontWeight: '700', color: '#a32d2d' },
  empty: { fontSize: 14, color: '#9aa1ac', textAlign: 'center', marginVertical: 20, lineHeight: 20 },
  addBtn: { marginTop: 8, backgroundColor: '#eef0f2', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e6e8ec', borderStyle: 'dashed' },
  addText: { fontSize: 15, fontWeight: '800', color: INK },
});
