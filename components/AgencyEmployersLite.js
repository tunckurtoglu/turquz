// components/AgencyEmployersLite.js
// İşletme listesi — FavoriteEmployerSheet olmadan, doğrudan agency_employers.
// Panel açılışını şişirmemek için hafif tutulur.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { listEmployers } from '../lib/employers';
import { listFavoriteEmployerCounts } from '../lib/favorites';
import { C } from '../lib/theme';

export default function AgencyEmployersLite({
  agencyId,
  contentPadBottom = 24,
  onOpenPipeline,
  onClose,
}) {
  const { t } = useLanguage();
  const [rows, setRows] = useState([]);
  const [favCounts, setFavCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const refresh = useCallback(async () => {
    if (!agencyId) return;
    setLoading(true);
    setErr('');
    try {
      const [list, favs] = await Promise.all([
        listEmployers(agencyId),
        listFavoriteEmployerCounts(agencyId).catch(() => ({})),
      ]);
      setRows(list || []);
      setFavCounts(favs || {});
    } catch (e) {
      setErr(String(e?.message || e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [agencyId]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onClose?.()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{t('hotels_working_title') || 'İşletme merkezi'}</Text>
        <TouchableOpacity onPress={refresh} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.refresh}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: contentPadBottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>{t('agency_hotels_hub_hint') || 'İşletmelerine dokun.'}</Text>

        {loading ? (
          <ActivityIndicator color={C.gold} style={{ marginTop: 36 }} />
        ) : err ? (
          <Text style={styles.empty}>{err}</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>{t('fav_need_hotel') || 'Kayıtlı işletme yok.'}</Text>
        ) : (
          rows.map((e) => {
            const fn = favCounts[e.id] || 0;
            return (
              <TouchableOpacity
                key={e.id}
                style={styles.card}
                activeOpacity={0.88}
                onPress={() => onOpenPipeline?.(e)}
              >
                <Text style={styles.name} numberOfLines={1}>{e.name || '—'}</Text>
                <Text style={styles.sub} numberOfLines={1}>{e.title || e.city || '—'}</Text>
                {fn > 0 ? (
                  <View style={styles.pills}>
                    <View style={styles.pillFav}>
                      <Text style={styles.pillFavTxt}>★ {t('fav_count', { n: String(fn) }) || `${fn} favori`}</Text>
                    </View>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10, gap: 10,
  },
  back: { color: C.goldText, fontSize: 28, fontWeight: '300', width: 28 },
  title: { flex: 1, color: C.ink, fontSize: 17, fontWeight: '800' },
  refresh: { color: C.goldText, fontSize: 22, fontWeight: '700', width: 28, textAlign: 'right' },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  hint: { color: C.ink2, fontSize: 13, fontWeight: '600', marginBottom: 14, lineHeight: 18 },
  empty: { color: C.ink2, textAlign: 'center', marginTop: 40, fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.hair,
  },
  name: { color: C.ink, fontSize: 16, fontWeight: '800' },
  sub: { color: C.ink2, fontSize: 13, fontWeight: '600', marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pillFav: {
    backgroundColor: 'rgba(194,162,90,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  pillFavTxt: { color: C.goldText, fontSize: 12, fontWeight: '800' },
  pillStaff: {
    backgroundColor: 'rgba(126,200,216,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  pillStaffTxt: { color: '#7EC8D8', fontSize: 12, fontWeight: '800' },
});
