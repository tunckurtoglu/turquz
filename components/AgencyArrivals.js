// components/AgencyArrivals.js — personel varış listesi (web Arrivals ile aynı mantık)
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import { useLanguage } from '../i18n/LanguageContext';
import { listFlights, parseArriveAt } from '../lib/flights';
import { candidateCode } from '../lib/candidateCode';
import { withLatinName } from '../lib/translit';
import { buildArrivalsHtml } from '../cv/buildArrivalsHtml';

const FILTERS = [
  { id: 'upcoming', key: 'arr_upcoming' },
  { id: 'today', key: 'arr_today' },
  { id: 'week', key: 'arr_week' },
  { id: 'all', key: 'arr_all' },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function soonLabel(dt, t) {
  if (!dt) return null;
  const h = (dt - Date.now()) / 36e5;
  if (h < 0) return { txt: t('arr_past'), c: 'gray' };
  if (h < 24) return { txt: t('arr_hours_left', { n: Math.round(h) }), c: 'red' };
  if (h < 72) return { txt: t('arr_days_left', { n: Math.ceil(h / 24) }), c: 'gold' };
  return { txt: t('arr_days_left', { n: Math.ceil(h / 24) }), c: 'gray' };
}

export default function AgencyArrivals({ candidates, onOpen, contentPadBottom = 24 }) {
  const { t } = useLanguage();
  const [flights, setFlights] = useState(null);
  const [filter, setFilter] = useState('upcoming');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    listFlights().then((f) => { if (alive) setFlights(f); });
    return () => { alive = false; };
  }, []);

  const byId = useMemo(() => {
    const m = {};
    (candidates || []).forEach((c) => { m[c.user_id] = c; });
    return m;
  }, [candidates]);

  const all = useMemo(() => {
    if (!flights) return null;
    return flights
      .map((f) => {
        const c = byId[f.user_id];
        if (!c) return null;
        const p = parseArriveAt(f.arrive_at);
        const data = withLatinName(c.data || {});
        const name = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
        const pickupName = String(f.pickup_name || '').trim();
        return {
          user_id: f.user_id,
          candidate: c,
          code: candidateCode(c.nationality, c.reg_no),
          name: name || '—',
          nationality: c.nationality || '—',
          arrival: [f.to_airport, f.to_city].filter(Boolean).join(' · ') || '—',
          terminal: f.terminal ? `T${String(f.terminal).replace(/^t/i, '')}` : '',
          flightNo: f.flight_no || '—',
          airline: f.airline || '',
          pickupName,
          pickupPhone: String(f.pickup_phone || '').trim(),
          pickupSent: !!f.pickup_sent_at,
          transit: c.arrivalStatus === 'transit' || c.status === 'in_transit',
          dt: p?.dt || null,
          date: p?.date || '—',
          time: p?.time || '—',
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.dt && b.dt ? a.dt - b.dt : a.dt ? -1 : 1));
  }, [flights, byId]);

  const list = useMemo(() => {
    if (!all) return null;
    const now = new Date();
    const t0 = startOfDay(now);
    const weekEnd = new Date(t0); weekEnd.setDate(weekEnd.getDate() + 7);
    const tomorrow = new Date(t0); tomorrow.setDate(tomorrow.getDate() + 1);
    return all.filter((r) => {
      if (filter === 'all') return true;
      if (!r.dt) return false;
      if (filter === 'upcoming') return r.dt >= now;
      if (filter === 'today') return r.dt >= t0 && r.dt < tomorrow;
      if (filter === 'week') return r.dt >= t0 && r.dt < weekEnd;
      return true;
    });
  }, [all, filter]);

  const exportPdf = async () => {
    if (!list?.length || pdfBusy) return;
    setPdfBusy(true);
    try {
      const rows = list.map((r, i) => ({
        no: i + 1, code: r.code, name: r.name, nationality: r.nationality,
        arrival: r.arrival, terminal: r.terminal, date: r.date, time: r.time,
        flightNo: r.flightNo, airline: r.airline,
        driver: r.pickupName || t('arr_no_driver'),
      }));
      const sub = t(FILTERS.find((f) => f.id === filter)?.key || 'arr_all');
      const html = buildArrivalsHtml(rows, {
        subtitle: `${t('arr_filter')}: ${sub}`,
        generatedAt: new Date().toLocaleString('tr-TR'),
      });
      await Print.printAsync({ html });
    } catch (e) {
      console.warn('arrivals pdf:', e?.message);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, filter === f.id && styles.chipOn]}
              onPress={() => setFilter(f.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{t(f.key)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.pdfBtn, (!list?.length || pdfBusy) && { opacity: 0.45 }]}
          onPress={exportPdf}
          disabled={!list?.length || pdfBusy}
          activeOpacity={0.85}
          accessibilityLabel={t('arr_pdf')}
        >
          <Text style={styles.pdfBtnText} numberOfLines={1}>{pdfBusy ? '…' : 'PDF'}</Text>
        </TouchableOpacity>
      </View>

      {list === null ? (
        <ActivityIndicator color="#c2a25a" style={{ marginTop: 40 }} />
      ) : list.length === 0 ? (
        <Text style={styles.empty}>{t('arr_empty')}</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: contentPadBottom }]}>
          {list.map((r) => {
            const s = soonLabel(r.dt, t);
            const missing = !r.pickupName;
            return (
              <TouchableOpacity
                key={r.user_id}
                style={[styles.card, missing && styles.cardMissing]}
                onPress={() => onOpen?.(r.candidate)}
                activeOpacity={0.9}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.code}>{r.code}</Text>
                  <View style={styles.tags}>
                    {r.transit ? (
                      <View style={[styles.tag, styles.tag_gold]}>
                        <Text style={[styles.tagText, styles.tagText_gold]}>{t('arr_in_transit')}</Text>
                      </View>
                    ) : null}
                    {s ? (
                      <View style={[styles.tag, styles[`tag_${s.c}`]]}>
                        <Text style={[styles.tagText, styles[`tagText_${s.c}`]]}>{s.txt}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>{r.nationality} · {r.arrival}{r.terminal ? ` / ${r.terminal}` : ''}</Text>
                <View style={styles.flightRow}>
                  <Text style={styles.when}>{r.date}{r.time && r.time !== '—' ? `  ·  ${r.time}` : ''}</Text>
                  <Text style={styles.flight} numberOfLines={1}>{r.flightNo}{r.airline ? ` · ${r.airline}` : ''}</Text>
                </View>
                <Text style={[styles.driver, missing && styles.driverMissing]} numberOfLines={2}>
                  {missing
                    ? t('arr_no_driver')
                    : `${t('arr_driver')}: ${r.pickupName}${r.pickupPhone ? ` · ${r.pickupPhone}` : ''}${r.pickupSent ? ` · ${t('arr_driver_sent')}` : ''}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const INK = '#1b2533';
const GOLD = '#c2a25a';

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 14, paddingRight: 14, paddingTop: 4, paddingBottom: 10,
  },
  filterScroll: { flex: 1, minWidth: 0 },
  filters: { gap: 8, alignItems: 'center', paddingRight: 4 },
  chip: { backgroundColor: '#ebe4d5', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  chipOn: { backgroundColor: '#16202e' },
  chipText: { fontSize: 12.5, fontWeight: '800', color: '#737373' },
  chipTextOn: { color: '#fff' },
  pdfBtn: {
    backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    flexShrink: 0, minWidth: 52, alignItems: 'center',
  },
  pdfBtnText: { fontSize: 12.5, fontWeight: '900', color: INK },
  empty: { textAlign: 'center', color: '#9aa1ac', marginTop: 40, fontSize: 14.5, paddingHorizontal: 28, lineHeight: 21 },
  list: { paddingHorizontal: 14, gap: 10 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, borderWidth: 0.5, borderColor: '#e6e8ec',
    padding: 14, shadowColor: '#0c1320', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  cardMissing: { borderColor: 'rgba(210,75,64,0.45)', backgroundColor: '#fff8f6' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  code: { fontSize: 15, fontWeight: '900', color: INK, letterSpacing: 0.3 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tag_red: { backgroundColor: '#fde8e8' },
  tag_gold: { backgroundColor: '#f3ecdc' },
  tag_gray: { backgroundColor: '#eef0f2' },
  tagText: { fontSize: 11.5, fontWeight: '800' },
  tagText_red: { color: '#a32d2d' },
  tagText_gold: { color: '#9a7b1f' },
  tagText_gray: { color: '#6b7280' },
  name: { marginTop: 6, fontSize: 15.5, fontWeight: '800', color: INK },
  meta: { marginTop: 3, fontSize: 12.5, color: '#737373', fontWeight: '600' },
  flightRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  when: { fontSize: 13, fontWeight: '800', color: '#9a7b1f' },
  flight: { fontSize: 12.5, fontWeight: '700', color: '#5c6675', flexShrink: 1, textAlign: 'right' },
  driver: { marginTop: 8, fontSize: 12.5, fontWeight: '700', color: '#3d4a5c' },
  driverMissing: { color: '#a32d2d' },
});
