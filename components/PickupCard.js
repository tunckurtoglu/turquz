// components/PickupCard.js
// Havaalanı karşılama kartı. role='agency' -> karşılayacak kişinin ad+telefonunu girer ve adaya gönderir.
// role='candidate' -> bilgi geldiyse görevliyi + WhatsApp butonu + uyarıyı görür; gelmediyse "sonra iletilecek" notu.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Linking, ActivityIndicator, Alert } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { getFlight, savePickup, sendPickup } from '../lib/flights';
import { notifyDocument } from '../lib/push';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function PickupCard({ userId, role, agencyId, label, flight }) {
  const { t } = useLanguage();
  const isAgency = role === 'agency';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(isAgency);
  const [busy, setBusy] = useState(false);

  // Acente: kendi yükler. Aday: parent'tan gelen (realtime) flight'ı kullanır.
  useEffect(() => {
    if (isAgency) {
      getFlight(userId).then((f) => {
        if (f) { setName(f.pickupName || ''); setPhone(f.pickupPhone || ''); setSent(!!f.pickupSent); }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else if (flight) {
      setName(flight.pickupName || ''); setPhone(flight.pickupPhone || ''); setSent(!!flight.pickupSent);
    }
  }, [isAgency, userId, flight]);

  const save = async () => {
    if (!name.trim() || !phone.trim()) { Alert.alert(t('pickup_title'), 'Ad ve telefon girin.'); return; }
    setBusy(true);
    try { await savePickup(userId, { pickupName: name.trim(), pickupPhone: phone.trim() }, agencyId); Alert.alert(t('pickup_title'), 'Kaydedildi.'); }
    catch (e) { Alert.alert(t('pickup_title'), e?.message || 'Hata'); } finally { setBusy(false); }
  };

  const send = async () => {
    if (!name.trim() || !phone.trim()) { Alert.alert(t('pickup_title'), 'Ad ve telefon girin.'); return; }
    Alert.alert(t('pickup_title'), 'Karşılama bilgileri adaya gönderilsin mi?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Gönder', onPress: async () => {
        setBusy(true);
        try {
          await savePickup(userId, { pickupName: name.trim(), pickupPhone: phone.trim() }, agencyId);
          await sendPickup(userId);
          notifyDocument(userId, 'pickup');
          setSent(true);
          Alert.alert(t('pickup_title'), 'Adaya iletildi.');
        } catch (e) { Alert.alert(t('pickup_title'), e?.message || 'Hata'); } finally { setBusy(false); }
      } },
    ]);
  };

  const waOpen = () => {
    const digits = (phone || '').replace(/[^0-9]/g, '');
    if (!digits) return;
    const msg = encodeURIComponent(t('pickup_hi', { x: label || '' }));
    Linking.openURL(`https://wa.me/${digits}?text=${msg}`).catch(() => {});
  };

  // ---- ACENTE GÖRÜNÜMÜ ----
  if (isAgency) {
    if (loading) return <View style={styles.card}><ActivityIndicator color={GOLD} /></View>;
    return (
      <View style={styles.card}>
        <View style={styles.head}><Text style={styles.title}>🤝 {t('pickup_title')}</Text>{sent ? <View style={styles.sentTag}><Text style={styles.sentTagText}>✓ İletildi</Text></View> : null}</View>
        <Text style={styles.hint}>Adayı havaalanında karşılayacak kişinin bilgileri. Hazır olduğunuzda "Adaya Gönder" deyin (sonradan da güncelleyebilirsiniz).</Text>

        <Text style={styles.lbl}>Karşılayacak kişi (ad soyad)</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Örn. Ahmet Yılmaz" placeholderTextColor="#9aa1ac" />
        <Text style={styles.lbl}>Telefon (WhatsApp)</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+90 5xx xxx xx xx" placeholderTextColor="#9aa1ac" keyboardType="phone-pad" />

        <View style={styles.row}>
          <TouchableOpacity style={[styles.ghost, busy && { opacity: 0.5 }]} onPress={save} disabled={busy}><Text style={styles.ghostText}>Kaydet</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.send, busy && { opacity: 0.5 }]} onPress={send} disabled={busy}>
            {busy ? <ActivityIndicator color={INK} /> : <Text style={styles.sendText}>{sent ? 'Tekrar Gönder' : 'Adaya Gönder'}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ---- ADAY GÖRÜNÜMÜ ----
  if (!sent || !(name && phone)) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>🤝 {t('pickup_title')}</Text>
        <Text style={styles.waitNote}>⏳ {t('pickup_wait')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🤝 {t('pickup_title')}</Text>
      <Text style={styles.personLbl}>{t('pickup_person')}</Text>
      <Text style={styles.personName}>{name}</Text>
      <Text style={styles.personPhone}>{phone}</Text>
      <TouchableOpacity style={styles.wa} onPress={waOpen} activeOpacity={0.9}>
        <Text style={styles.waText}>💬 {t('pickup_whatsapp')}</Text>
      </TouchableOpacity>
      <View style={styles.warnBox}><Text style={styles.warnText}>⚠️ {t('pickup_warn')}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eadfc2', borderRadius: 16, padding: 16, marginTop: 14, shadowColor: INK, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: INK },
  hint: { fontSize: 12.5, color: '#6b6457', lineHeight: 18, marginTop: 8, marginBottom: 4 },
  lbl: { fontSize: 11, fontWeight: '800', color: '#9aa1ac', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e0e2e6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: INK },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  ghost: { flex: 1, backgroundColor: '#eef0f3', borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  ghostText: { color: INK, fontWeight: '800', fontSize: 14 },
  send: { flex: 1.4, backgroundColor: GOLD, borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  sendText: { color: INK, fontWeight: '800', fontSize: 14 },
  sentTag: { backgroundColor: '#e7f6ec', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  sentTagText: { color: '#1f8a4c', fontWeight: '800', fontSize: 12 },
  waitNote: { fontSize: 13.5, color: '#9a6b16', lineHeight: 20, marginTop: 10, fontWeight: '600' },
  personLbl: { fontSize: 11, fontWeight: '800', color: '#9aa1ac', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12 },
  personName: { fontSize: 19, fontWeight: '800', color: INK, marginTop: 4 },
  personPhone: { fontSize: 16, color: '#3a4658', fontWeight: '700', marginTop: 2 },
  wa: { backgroundColor: '#25D366', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  waText: { color: '#fff', fontWeight: '800', fontSize: 15.5 },
  warnBox: { backgroundColor: '#fff7e6', borderWidth: 1, borderColor: '#e3c987', borderRadius: 12, padding: 12, marginTop: 12 },
  warnText: { color: '#8a6d1f', fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
