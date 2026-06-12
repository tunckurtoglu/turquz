// components/FlightForm.js
// Acente uçuş adımında: uçuş bilgilerini doldurur + bileti yükler + önizler + gönderir.
// Ülke/havalimanı kaydırmalı Select; tarih CV ile aynı (gün/ay/yıl); saat (saat/dakika) Select.
// Bilet görseli yüklemesi ebeveynde (onPickTicket); bu form bilgileri tutar.
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { Select } from './Select';
import { DAYS, monthOptions, FLIGHT_YEARS, HOURS, MINUTES } from '../cv/options';
import { AIRPORT_COUNTRIES, airportsOf } from '../cv/airports';
import FlightPreview from './FlightPreview';

const INK = '#1b2533';
const GOLD = '#c2a25a';

// "dd.mm.yyyy hh:mm" <-> parçalar
const composeDT = (d, m, y, h, mi) => {
  const date = d && m && y ? `${d}.${m}.${y}` : '';
  const time = h && mi ? `${h}:${mi}` : '';
  return [date, time].filter(Boolean).join(' ');
};
const parseDT = (s) => {
  const [date = '', time = ''] = String(s || '').split(' ');
  const [d = '', m = '', y = ''] = date.split('.');
  const [h = '', mi = ''] = time.split(':');
  return { d, m, y, h, mi };
};

function TextRow({ label, value, onChangeText, placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9aa1ac" autoCapitalize="characters" />
    </View>
  );
}

export default function FlightForm({ visible, initial, data, ticketUploaded, uploadingTicket, busy, onPickTicket, onSubmit, onClose }) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';

  const [f, setF] = useState({});
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const i = initial || {};
    const dep = parseDT(i.departAt);
    const arr = parseDT(i.arriveAt);
    // Otomatik seçim: kayıt yoksa kalkış ülkesi = adayın uyruğu, varış = Türkiye.
    const nat = data?.nationality;
    const defFrom = AIRPORT_COUNTRIES.includes(nat) ? nat : '';
    setF({
      fromCountry: i.fromCity || defFrom, fromAirport: i.fromAirport || '',
      toCountry: i.toCity || 'Türkiye', toAirport: i.toAirport || '',
      dDay: dep.d, dMonth: dep.m, dYear: dep.y, dHour: dep.h, dMin: dep.mi,
      aDay: arr.d, aMonth: arr.m, aYear: arr.y, aHour: arr.h, aMin: arr.mi,
      flightNo: i.flightNo || '', terminal: i.terminal || '', airline: i.airline || '',
    });
  }, [visible, initial, data?.nationality]);

  const up = (k) => (v) => setF((p) => ({ ...p, [k]: v }));
  const months = monthOptions(lang);
  const countryOpts = AIRPORT_COUNTRIES;

  const infoOk = f.fromCountry?.trim() && f.toCountry?.trim() && f.flightNo?.trim();
  const canSend = infoOk && ticketUploaded;

  const submit = () => {
    if (!canSend) return;
    onSubmit({
      fromCity: f.fromCountry, fromAirport: f.fromAirport,
      toCity: f.toCountry, toAirport: f.toAirport,
      departAt: composeDT(f.dDay, f.dMonth, f.dYear, f.dHour, f.dMin),
      arriveAt: composeDT(f.aDay, f.aMonth, f.aYear, f.aHour, f.aMin),
      flightNo: f.flightNo, terminal: f.terminal, airline: f.airline,
    });
  };

  // Önizleme için anlık birleştirilmiş uçuş verisi
  const previewFlight = {
    fromCity: f.fromCountry, fromAirport: f.fromAirport, toCity: f.toCountry, toAirport: f.toAirport,
    departAt: composeDT(f.dDay, f.dMonth, f.dYear, f.dHour, f.dMin),
    arriveAt: composeDT(f.aDay, f.aMonth, f.aYear, f.aHour, f.aMin),
    flightNo: f.flightNo, terminal: f.terminal, airline: f.airline,
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('flight_form_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.sec}>{t('flight_route_sec')}</Text>
          <Select label={t('flight_f_from_city')} value={f.fromCountry} options={countryOpts} onChange={(v) => setF((p) => ({ ...p, fromCountry: v, fromAirport: '' }))} placeholder={t('select')} />
          {f.fromCountry ? (
            airportsOf(f.fromCountry).length
              ? <Select label={t('flight_f_from_airport')} value={f.fromAirport} options={airportsOf(f.fromCountry)} onChange={up('fromAirport')} placeholder={t('select')} />
              : <TextRow label={t('flight_f_from_airport')} value={f.fromAirport} onChangeText={up('fromAirport')} placeholder="—" />
          ) : null}

          <Select label={t('flight_f_to_city')} value={f.toCountry} options={countryOpts} onChange={(v) => setF((p) => ({ ...p, toCountry: v, toAirport: '' }))} placeholder={t('select')} />
          {f.toCountry ? (
            airportsOf(f.toCountry).length
              ? <Select label={t('flight_f_to_airport')} value={f.toAirport} options={airportsOf(f.toCountry)} onChange={up('toAirport')} placeholder={t('select')} />
              : <TextRow label={t('flight_f_to_airport')} value={f.toAirport} onChangeText={up('toAirport')} placeholder="—" />
          ) : null}

          <Text style={styles.sec}>{t('flight_time_sec')}</Text>
          <Text style={styles.groupLabel}>{t('flight_f_depart')}</Text>
          <View style={styles.row}>
            <View style={styles.col}><Select label={t('f_day')} value={f.dDay} options={DAYS} onChange={up('dDay')} /></View>
            <View style={styles.col}><Select label={t('f_month')} value={f.dMonth} options={months} onChange={up('dMonth')} /></View>
            <View style={styles.col}><Select label={t('f_year')} value={f.dYear} options={FLIGHT_YEARS} onChange={up('dYear')} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Select label={t('f_hour')} value={f.dHour} options={HOURS} onChange={up('dHour')} /></View>
            <View style={styles.col}><Select label={t('f_min')} value={f.dMin} options={MINUTES} onChange={up('dMin')} /></View>
          </View>

          <Text style={styles.groupLabel}>{t('flight_f_arrive')}</Text>
          <View style={styles.row}>
            <View style={styles.col}><Select label={t('f_day')} value={f.aDay} options={DAYS} onChange={up('aDay')} /></View>
            <View style={styles.col}><Select label={t('f_month')} value={f.aMonth} options={months} onChange={up('aMonth')} /></View>
            <View style={styles.col}><Select label={t('f_year')} value={f.aYear} options={FLIGHT_YEARS} onChange={up('aYear')} /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Select label={t('f_hour')} value={f.aHour} options={HOURS} onChange={up('aHour')} /></View>
            <View style={styles.col}><Select label={t('f_min')} value={f.aMin} options={MINUTES} onChange={up('aMin')} /></View>
          </View>

          <Text style={styles.sec}>{t('flight_form_title')}</Text>
          <TextRow label={t('flight_f_no')} value={f.flightNo} onChangeText={up('flightNo')} placeholder="TK 0367" />
          <TextRow label={t('flight_f_terminal')} value={f.terminal} onChangeText={up('terminal')} placeholder="Terminal 1 / Dış Hatlar" />
          <TextRow label={t('flight_f_airline')} value={f.airline} onChangeText={up('airline')} placeholder="Turkish Airlines" />

          <Text style={styles.sec}>{t('flight_ticket_sec')}</Text>
          {ticketUploaded ? <Text style={styles.ticketOk}>✓ {t('flight_ticket_ready')}</Text> : null}
          <TouchableOpacity style={styles.ticketBtn} onPress={onPickTicket} disabled={uploadingTicket} activeOpacity={0.85}>
            {uploadingTicket ? <ActivityIndicator color={INK} /> : <Text style={styles.ticketBtnText}>📎 {ticketUploaded ? t('flight_change_ticket') : t('flight_add_ticket')}</Text>}
          </TouchableOpacity>

          {!canSend ? <Text style={styles.req}>{t('flight_required')}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.previewBtn} onPress={() => setPreviewOpen(true)} activeOpacity={0.85}>
              <Text style={styles.previewText}>{t('contract_preview')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sendBtn, (!canSend || busy) && { opacity: 0.5 }]} onPress={submit} disabled={!canSend || busy} activeOpacity={0.9}>
              {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.sendText}>{t('flight_save_send')}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        <FlightPreview visible={previewOpen} data={data} flight={previewFlight} onClose={() => setPreviewOpen(false)} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 18, fontWeight: '800', color: INK },
  accent: { height: 2.5, backgroundColor: GOLD },

  content: { padding: 16, paddingBottom: 28 },
  sec: { fontSize: 13, fontWeight: '800', color: '#737373', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  groupLabel: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 4, marginTop: 4 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6e8ec', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  req: { color: '#a32d2d', fontSize: 12.5, fontWeight: '600', marginTop: 14 },
  ticketOk: { color: '#1f8a4c', fontSize: 13.5, fontWeight: '800', marginBottom: 8 },
  ticketBtn: { backgroundColor: '#eef0f2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  ticketBtnText: { color: INK, fontWeight: '800', fontSize: 14.5 },

  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  footerRow: { flexDirection: 'row', gap: 10 },
  previewBtn: { backgroundColor: '#eef0f2', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  previewText: { color: INK, fontWeight: '800', fontSize: 15 },
  sendBtn: { flex: 1, backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  sendText: { color: INK, fontWeight: '800', fontSize: 16 },
});
