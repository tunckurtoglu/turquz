// components/AgencyArrivals.js — personel varış listesi (web Arrivals ile aynı mantık)
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import { useLanguage } from '../i18n/LanguageContext';
import { listFlights, parseArriveAt } from '../lib/flights';
import { candidateCode } from '../lib/candidateCode';
import { withLatinName } from '../lib/translit';
import { buildArrivalsHtml } from '../cv/buildArrivalsHtml';
import { C } from '../lib/theme';

const BG = '#0A1121';
const CARD = '#121B2E';
const GOLD = '#A89468';
const GOLD_BTN = '#C8B88E';
const BORDER = 'rgba(168,148,104,0.28)';
const TEXT_SEC = '#8E98A8';
const INK = '#f0ece4';

const FILTERS = [
  { id: 'today', key: 'arr_today' },
  { id: 'upcoming', key: 'arr_upcoming' },
  { id: 'week', key: 'arr_week' },
  { id: 'all', key: 'arr_all' },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

function soonLabel(dt, t) {
  if (!dt) return null;
  const h = (dt - Date.now()) / 36e5;
  if (h < 0) return { txt: t('arr_past'), tone: 'muted' };
  if (h < 24) return { txt: t('arr_hours_left', { n: Math.round(h) }), tone: 'hot' };
  if (h < 72) return { txt: t('arr_days_left', { n: Math.ceil(h / 24) }), tone: 'gold' };
  return { txt: t('arr_days_left', { n: Math.ceil(h / 24) }), tone: 'muted' };
}

function tagStyles(tone, light = false) {
  const s = light ? lightStyles : styles;
  if (tone === 'hot') return { box: s.tagHot, text: s.tagTextHot };
  if (tone === 'gold') return { box: s.tagGold, text: s.tagTextGold };
  return { box: s.tagMuted, text: s.tagTextMuted };
}

export default function AgencyArrivals({ candidates, onOpen, contentPadBottom = 24, light = false, flightRows, onCountChange }) {
  const { t } = useLanguage();
  const [loadedFlights, setLoadedFlights] = useState(null);
  const [filter, setFilter] = useState('today');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (Array.isArray(flightRows)) {
      setLoadedFlights(flightRows);
      return undefined;
    }
    let alive = true;
    listFlights().then((f) => { if (alive) setLoadedFlights(f); });
    return () => { alive = false; };
  }, [flightRows]);

  const flights = Array.isArray(flightRows) ? flightRows : loadedFlights;

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
          airportCheckStatus: c.airport_check_status || c.st?.airport_check_status || '',
          airportCheckAnsweredAt: c.airport_check_answered_at || c.st?.airport_check_answered_at || '',
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

  useEffect(() => {
    onCountChange?.(list === null ? null : list.length);
  }, [list, onCountChange]);

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
    <View style={[styles.wrap, light && lightStyles.wrap]}>
      <View style={[styles.intro, light && lightStyles.intro]}>
        <Text style={[styles.kicker, light && lightStyles.kicker]}>{t('staff_tab_arrivals') || 'Transfer'}</Text>
        <Text style={[styles.lead, light && lightStyles.lead]}>{t('ops_arrival_hint') || 'Yaklaşan havaalanı transferlerini aşağıda görebilirsiniz.'}</Text>
      </View>

      <View style={[styles.filterRow, light && lightStyles.filterRow]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, light && lightStyles.chip, filter === f.id && styles.chipOn, filter === f.id && light && lightStyles.chipOn]}
              onPress={() => setFilter(f.id)}
              activeOpacity={0.85}
            >
              <Text style={[styles.chipText, light && lightStyles.chipText, filter === f.id && styles.chipTextOn, filter === f.id && light && lightStyles.chipTextOn]}>{t(f.key)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          style={[styles.pdfBtn, light && lightStyles.pdfBtn, (!list?.length || pdfBusy) && { opacity: 0.45 }]}
          onPress={exportPdf}
          disabled={!list?.length || pdfBusy}
          activeOpacity={0.85}
          accessibilityLabel={t('arr_pdf')}
        >
          <Text style={[styles.pdfBtnText, light && lightStyles.pdfBtnText]} numberOfLines={1}>{pdfBusy ? '…' : 'PDF'}</Text>
        </TouchableOpacity>
      </View>

      {list === null ? (
        <ActivityIndicator color={GOLD_BTN} style={{ marginTop: 40 }} />
      ) : list.length === 0 ? (
        <Text style={[styles.empty, light && lightStyles.empty]}>{t('arr_empty')}</Text>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, light && lightStyles.list, { paddingBottom: contentPadBottom }]}>
          {list.map((r) => {
            const s = soonLabel(r.dt, t);
            const missing = !r.pickupName;
            const tagStyle = s ? tagStyles(s.tone) : null;
            return (
              <TouchableOpacity
                key={r.user_id}
                style={[styles.card, light && lightStyles.card, missing && styles.cardMissing]}
                onPress={() => onOpen?.(r.candidate)}
                activeOpacity={0.88}
              >
                <View style={styles.cardTop}>
                  <Text style={[styles.code, light && lightStyles.code]}>{r.code}</Text>
                  <View style={styles.tags}>
                    {r.transit ? (
                      <View style={[styles.tag, styles.tagGold]}>
                        <Text style={[styles.tagText, styles.tagTextGold]}>{t('arr_in_transit')}</Text>
                      </View>
                    ) : null}
                    {r.airportCheckStatus === 'confirmed' ? (
                      <View style={[styles.tag, styles.tagConfirmed, light && lightStyles.tagConfirmed]}>
                        <Text style={[styles.tagText, styles.tagTextConfirmed, light && lightStyles.tagTextConfirmed]}>
                          ✓ {t('airport_check_agency_confirmed') || 'Havaalanına geldi'}
                          {r.airportCheckAnsweredAt ? ` · ${new Date(r.airportCheckAnsweredAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                        </Text>
                      </View>
                    ) : r.airportCheckStatus === 'missed' || r.airportCheckStatus === 'no_response' ? (
                      <View style={[styles.tag, styles.tagLate]}>
                        <Text style={[styles.tagText, styles.tagTextLate]}>
                          {t('airport_check_agency_late') || 'Uçuşa geç kaldı'}
                        </Text>
                      </View>
                    ) : r.airportCheckStatus === 'pending' ? (
                      <View style={[styles.tag, styles.tagMuted]}>
                        <Text style={[styles.tagText, styles.tagTextMuted]}>
                          {t('airport_check_agency_pending') || 'Havaalanı teyidi bekleniyor'}
                        </Text>
                      </View>
                    ) : null}
                    {s && tagStyle ? (
                      <View style={[styles.tag, tagStyle.box]}>
                        <Text style={[styles.tagText, tagStyle.text]}>{s.txt}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={[styles.name, light && lightStyles.name]} numberOfLines={1}>{r.name}</Text>
                <Text style={[styles.meta, light && lightStyles.meta]} numberOfLines={1}>
                  {r.nationality} · {r.arrival}{r.terminal ? ` / ${r.terminal}` : ''}
                </Text>
                <View style={[styles.whenStrip, light && lightStyles.whenStrip]}>
                  <Text style={[styles.whenIcon, light && lightStyles.whenIcon]}>✈</Text>
                  <Text style={[styles.when, light && lightStyles.when]} numberOfLines={1}>
                    {r.date}{r.time && r.time !== '—' ? ` · ${r.time}` : ''}
                  </Text>
                  <Text style={[styles.flight, light && lightStyles.flight]} numberOfLines={1}>
                    {r.flightNo}{r.airline ? ` · ${r.airline}` : ''}
                  </Text>
                </View>
                <Text style={[styles.driver, light && lightStyles.driver, missing && styles.driverMissing]} numberOfLines={2}>
                  {missing
                    ? t('arr_no_driver')
                    : `${t('arr_driver')}: ${r.pickupName}${r.pickupPhone ? ` · ${r.pickupPhone}` : ''}${r.pickupSent ? ` · ${t('arr_driver_sent')}` : ''}`}
                </Text>
                <Text style={[styles.chev, light && lightStyles.chev]}>›</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BG },
  intro: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  kicker: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase', color: GOLD,
  },
  lead: { marginTop: 4, fontSize: 13, fontWeight: '600', color: TEXT_SEC, lineHeight: 18 },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 10,
  },
  filterScroll: { flex: 1, minWidth: 0 },
  filters: { gap: 8, alignItems: 'center', paddingRight: 4 },
  chip: {
    backgroundColor: CARD, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    flexShrink: 0, borderWidth: 1, borderColor: BORDER,
  },
  chipOn: { backgroundColor: GOLD_BTN, borderColor: GOLD_BTN },
  chipText: { fontSize: 12.5, fontWeight: '800', color: INK },
  chipTextOn: { color: BG },
  pdfBtn: {
    backgroundColor: GOLD_BTN, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8,
    flexShrink: 0, minWidth: 52, alignItems: 'center',
  },
  pdfBtnText: { fontSize: 12.5, fontWeight: '900', color: BG },
  empty: { textAlign: 'center', color: TEXT_SEC, marginTop: 40, fontSize: 14.5, paddingHorizontal: 28, lineHeight: 21 },
  list: { paddingHorizontal: 16, gap: 10, paddingTop: 4 },
  card: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    padding: 14, paddingRight: 28, position: 'relative',
  },
  cardMissing: { borderColor: 'rgba(240,128,128,0.4)', borderLeftWidth: 3, borderLeftColor: '#f08080' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, flexWrap: 'wrap', justifyContent: 'flex-end' },
  code: { fontSize: 14, fontWeight: '800', color: INK, letterSpacing: 0.3 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagHot: { backgroundColor: 'rgba(179,45,45,0.2)' },
  tagGold: { backgroundColor: 'rgba(200,184,142,0.16)' },
  tagMuted: { backgroundColor: 'rgba(142,152,168,0.14)' },
  tagLate: { backgroundColor: 'rgba(179,45,45,0.2)' },
  tagText: { fontSize: 11, fontWeight: '800' },
  tagTextHot: { color: '#f08080' },
  tagTextGold: { color: GOLD_BTN },
  tagTextMuted: { color: TEXT_SEC },
  tagTextLate: { color: '#f08080' },
  tagConfirmed: { backgroundColor: 'rgba(90,170,120,0.16)' },
  tagTextConfirmed: { color: '#5fa978' },
  name: { marginTop: 6, fontSize: 15, fontWeight: '800', color: INK },
  meta: { marginTop: 3, fontSize: 12.5, color: TEXT_SEC, fontWeight: '600' },
  whenStrip: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(200,184,142,0.1)', borderWidth: 1, borderColor: 'rgba(200,184,142,0.22)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  whenIcon: { fontSize: 12, color: GOLD_BTN },
  when: { fontSize: 12.5, fontWeight: '800', color: GOLD_BTN, flexShrink: 0 },
  flight: { fontSize: 12, fontWeight: '700', color: TEXT_SEC, flex: 1, textAlign: 'right' },
  driver: { marginTop: 8, fontSize: 12.5, fontWeight: '700', color: TEXT_SEC },
  driverMissing: { color: '#f08080' },
  chev: {
    position: 'absolute', right: 12, top: '50%', marginTop: -12,
    fontSize: 22, color: 'rgba(200,184,142,0.45)', fontWeight: '300',
  },
});

const lightStyles = StyleSheet.create({
  wrap: { backgroundColor: C.bg },
  intro: { backgroundColor: C.bg },
  kicker: { color: C.goldText },
  lead: { color: C.ink2 },
  filterRow: { backgroundColor: C.bg },
  chip: { backgroundColor: C.card, borderColor: C.hair },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { color: C.ink2 },
  chipTextOn: { color: '#F7F2E8' },
  pdfBtn: { backgroundColor: C.ink },
  pdfBtnText: { color: '#F7F2E8' },
  empty: { color: C.ink2 },
  list: { backgroundColor: C.bg },
  card: {
    backgroundColor: C.card,
    borderColor: C.hair,
    shadowColor: C.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  code: { color: C.ink },
  name: { color: C.ink },
  meta: { color: C.ink2 },
  whenStrip: { backgroundColor: C.goldSoft, borderColor: C.hair },
  whenIcon: { color: C.goldText },
  when: { color: C.goldText },
  flight: { color: C.ink2 },
  driver: { color: C.ink2 },
  chev: { color: 'rgba(20,32,51,0.55)' },
  tagHot: { backgroundColor: C.dangerSoft },
  tagGold: { backgroundColor: C.goldSoft },
  tagMuted: { backgroundColor: '#EEF0F2' },
  tagTextHot: { color: C.danger },
  tagTextGold: { color: C.goldText },
  tagTextMuted: { color: C.ink2 },
});
