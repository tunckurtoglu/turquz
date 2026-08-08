// components/FavoriteEmployerSheet.js
// Favori ekle/çıkar (toggle) veya işletmeye göre shortlist filtrele (+ işletme düzenle).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { listEmployers } from '../lib/employers';
import { toggleFavorite, countFavoritesByEmployer } from '../lib/favorites';
import EmployerFormSheet from './EmployerFormSheet';

const INK = '#1b2533';
const GOLD = '#c2a25a';

/**
 * mode: 'toggle' | 'filter'
 * toggle: candidateId zorunlu — satıra dokununca ekle/çıkar
 * filter: onPickEmployer(employer) — shortlist seç
 * activeEmployerIds: toggle modunda bu adayın halihazırda favori olduğu işletmeler
 */
export default function FavoriteEmployerSheet({
  visible,
  mode = 'toggle',
  agencyId,
  candidateId,
  activeEmployerIds = [],
  selectedEmployerId = null,
  onChanged,
  onPickEmployer,
  onClearFilter,
  onClose,
}) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [active, setActive] = useState(() => new Set(activeEmployerIds));
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null = yeni, object = düzenle

  const activeKey = (activeEmployerIds || []).slice().sort().join(',');

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    try {
      const [emps, cnt] = await Promise.all([
        listEmployers(agencyId),
        mode === 'filter' ? countFavoritesByEmployer(agencyId) : Promise.resolve({}),
      ]);
      const list = emps || [];
      const c = cnt || {};
      setCounts(c);
      setRows(mode === 'filter'
        ? list.slice().sort((a, b) => (c[b.id] || 0) - (c[a.id] || 0) || (a.name || '').localeCompare(b.name || '', 'tr'))
        : list);
    } catch (e) {
      console.warn('FavoriteEmployerSheet refresh:', e?.message || e);
      setRows([]);
      setCounts({});
    } finally {
      setLoading(false);
    }
  }, [agencyId, mode]);

  useEffect(() => {
    if (!visible) {
      setFormOpen(false);
      setEditing(null);
      setBusyId(null);
      return undefined;
    }
    setActive(new Set(activeEmployerIds || []));
    refresh();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeEmployerIds yerine activeKey
  }, [visible, agencyId, mode, activeKey, refresh]);

  const onToggle = async (employer) => {
    if (!candidateId || !agencyId) return;
    setBusyId(employer.id);
    try {
      const nowOn = await toggleFavorite(agencyId, employer.id, candidateId);
      setActive((prev) => {
        const next = new Set(prev);
        if (nowOn) next.add(employer.id);
        else next.delete(employer.id);
        return next;
      });
      onChanged?.(candidateId, employer.id, nowOn);
    } catch (e) {
      Alert.alert(t('fav_title_add'), e?.message || t('doc_upload_error'));
    } finally {
      setBusyId(null);
    }
  };

  const onPick = (employer) => {
    onPickEmployer?.(employer);
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

  const onSaved = async (employer) => {
    const wasNew = !editing?.id;
    setFormOpen(false);
    setEditing(null);
    await refresh();
    // Seçili shortlist işletmesi güncellendiyse pill adını tazele (sheet açık kalsın)
    if (employer?.id && selectedEmployerId === employer.id) {
      onPickEmployer?.(employer);
    }
    // Toggle modunda yeni işletme → otomatik favoriye ekle
    if (wasNew && mode === 'toggle' && employer?.id && candidateId) {
      await onToggle(employer);
    }
  };

  const title = mode === 'filter' ? t('fav_title_filter') : t('fav_title_add');
  const sub = mode === 'filter' ? t('fav_sub_filter') : t('fav_sub_add');

  return (
    <>
      <Modal visible={visible && !formOpen} animationType="slide" onRequestClose={onClose}>
        <View style={styles.wrap}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.backChevron}>{backChevron}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <View style={{ width: 28 }} />
          </View>
          <View style={styles.accent} />
          <Text style={styles.sub}>{sub}</Text>

          {mode === 'filter' && selectedEmployerId ? (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { onClearFilter?.(); onClose?.(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.clearText}>{t('fav_filter_clear')}</Text>
            </TouchableOpacity>
          ) : null}

          {loading ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}>
              {rows.map((e) => {
                const on = active.has(e.id);
                const n = counts[e.id] || 0;
                const selected = selectedEmployerId === e.id;
                return (
                  <View key={e.id} style={[styles.card, (on || selected) && styles.cardOn]}>
                    <TouchableOpacity
                      style={styles.cardMain}
                      onPress={() => (mode === 'filter' ? onPick(e) : onToggle(e))}
                      activeOpacity={0.85}
                      disabled={busyId === e.id}
                    >
                      <View style={styles.cardText}>
                        <Text style={styles.cardName}>{e.name}</Text>
                        {e.title ? <Text style={styles.cardSub} numberOfLines={2}>{e.title}</Text> : null}
                        {mode === 'filter' ? (
                          <Text style={styles.cardMeta}>{t('fav_count', { n })}</Text>
                        ) : (
                          <Text style={styles.cardMeta}>{on ? t('fav_in') : t('fav_add_tap')}</Text>
                        )}
                      </View>
                      {busyId === e.id ? (
                        <ActivityIndicator color={GOLD} />
                      ) : (
                        <Text style={[styles.star, (on || selected) && styles.starOn]}>
                          {mode === 'filter' ? (selected ? '★' : '☆') : (on ? '★' : '☆')}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => openEdit(e)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.editText}>{t('employer_edit')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
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
  clearBtn: { marginHorizontal: 16, marginBottom: 4, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e6e8ec' },
  clearText: { fontSize: 13.5, fontWeight: '800', color: '#a32d2d' },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 0.5, borderColor: '#e6e8ec', overflow: 'hidden' },
  cardOn: { borderColor: GOLD, backgroundColor: 'rgba(194,162,90,0.08)' },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 12 },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '800', color: INK },
  cardSub: { fontSize: 12.5, color: '#737373', marginTop: 4, lineHeight: 17 },
  cardMeta: { marginTop: 8, fontSize: 12.5, fontWeight: '700', color: '#9a7b1f' },
  star: { fontSize: 26, color: '#c5cad3', fontWeight: '700' },
  starOn: { color: GOLD },
  editBtn: { borderTopWidth: 0.5, borderTopColor: '#eceef1', paddingVertical: 12, alignItems: 'center' },
  editText: { fontSize: 13.5, fontWeight: '700', color: INK },
  empty: { fontSize: 14, color: '#9aa1ac', textAlign: 'center', marginVertical: 20, lineHeight: 20 },
  addBtn: { marginTop: 8, backgroundColor: '#eef0f2', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e6e8ec', borderStyle: 'dashed' },
  addText: { fontSize: 15, fontWeight: '800', color: INK },
});
