// screens/AgencySetupScreen.js
// Acente ilk giriş / kayıt sonrası zorunlu kurulum kapısı.
// Vergi levhası PDF + yetkili ad/soyad + yetkili telefon + temsilci telefon.
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  completeAgencySetup, getAgencyProfile, uploadAgencyTaxPlate,
} from '../lib/agencyProfile';
import TurquzLogo from '../components/TurquzLogo';

const GOLD = '#c2a25a';
const NAVY = '#1b2533';

export default function AgencySetupScreen({ user, onDone, onLogout }) {
  const insets = useSafeAreaInsets();
  const uid = user?.id;
  const m = user?.user_metadata || {};

  const [company, setCompany] = useState('');
  const [first, setFirst] = useState(m.first_name || '');
  const [last, setLast] = useState(m.last_name || '');
  const [phoneAuth, setPhoneAuth] = useState(m.phone || '');
  const [phoneRep, setPhoneRep] = useState(m.phone_rep || '');
  const [taxPath, setTaxPath] = useState('');
  const [taxName, setTaxName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!uid) return;
    getAgencyProfile(uid).then((p) => {
      if (!p) return;
      if (p.companyName) setCompany(p.companyName);
      if (p.contactFirstName) setFirst(p.contactFirstName);
      if (p.contactLastName) setLast(p.contactLastName);
      if (p.phoneAuthorized) setPhoneAuth(p.phoneAuthorized);
      if (p.phoneRep) setPhoneRep(p.phoneRep);
      if (p.taxPlatePath) {
        setTaxPath(p.taxPlatePath);
        setTaxName('vergi_levhasi.pdf');
      }
    });
  }, [uid]);

  const pickTaxPdf = async () => {
    setErr('');
    try {
      const DocumentPicker = await import('expo-document-picker');
      const { readFileBase64 } = await import('../lib/readFileBase64');
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      const isPdf = (asset.mimeType || '').includes('pdf') || (asset.name || '').toLowerCase().endsWith('.pdf');
      if (!isPdf) { setErr('Yalnızca PDF yükleyin.'); return; }
      setBusy(true);
      const base64 = await readFileBase64(asset.uri);
      const path = await uploadAgencyTaxPlate(uid, base64);
      setTaxPath(path);
      setTaxName(asset.name || 'vergi_levhasi.pdf');
    } catch (e) {
      setErr(e?.message || 'PDF yüklenemedi');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const f = first.trim();
    const l = last.trim();
    const p1 = phoneAuth.trim();
    const p2 = phoneRep.trim();
    const c = company.trim();
    if (!c) { setErr('Şirket / işletme adı zorunludur.'); return; }
    if (!f || !l) { setErr('Yetkili ad ve soyad zorunludur.'); return; }
    if (p1.replace(/\D/g, '').length < 10) { setErr('Geçerli bir yetkili telefon girin.'); return; }
    if (p2.replace(/\D/g, '').length < 10) { setErr('Geçerli bir temsilci telefon girin.'); return; }
    if (!taxPath) { setErr('Vergi levhasını PDF olarak yükleyin.'); return; }

    setErr('');
    setBusy(true);
    try {
      await completeAgencySetup(uid, {
        companyName: c,
        contactFirstName: f,
        contactLastName: l,
        phoneAuthorized: p1,
        phoneRep: p2,
        taxPlatePath: taxPath,
      });
      const { data } = await (await import('../lib/supabase')).supabase.auth.getUser();
      onDone?.(data?.user || user);
    } catch (e) {
      setErr(e?.message === 'incomplete' ? 'Tüm zorunlu alanları doldurun.' : (e?.message || 'Kaydedilemedi'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TurquzLogo width={150} height={60} style={styles.logo} wordmarkSize={11} fontFamily="Cinzel_600SemiBold" fontsReady />
          <Text style={styles.kicker}>ACENTE KAYIT</Text>
          <Text style={styles.title}>Kurulumu tamamlayın</Text>
          <Text style={styles.note}>
            CV havuzuna erişmek için vergi levhanızı (PDF) yükleyin; yetkili bilgilerinizi ve iki iletişim telefonunu girin.
          </Text>

          <Text style={styles.lbl}>Şirket / işletme adı *</Text>
          <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="Örn. ABC Turizm Ltd." placeholderTextColor="#9aa1ac" />

          <Text style={styles.sec}>Yetkili kişi</Text>
          <Text style={styles.lbl}>Ad *</Text>
          <TextInput style={styles.input} value={first} onChangeText={setFirst} placeholder="Ad" placeholderTextColor="#9aa1ac" />
          <Text style={styles.lbl}>Soyad *</Text>
          <TextInput style={styles.input} value={last} onChangeText={setLast} placeholder="Soyad" placeholderTextColor="#9aa1ac" />

          <Text style={styles.sec}>İletişim telefonları</Text>
          <Text style={styles.lbl}>Yetkili telefon *</Text>
          <TextInput style={styles.input} value={phoneAuth} onChangeText={setPhoneAuth} placeholder="+90 5xx xxx xx xx" placeholderTextColor="#9aa1ac" keyboardType="phone-pad" />
          <Text style={styles.lbl}>Temsilci telefon *</Text>
          <TextInput style={styles.input} value={phoneRep} onChangeText={setPhoneRep} placeholder="+90 5xx xxx xx xx" placeholderTextColor="#9aa1ac" keyboardType="phone-pad" />

          <Text style={styles.sec}>Vergi levhası (PDF) *</Text>
          <TouchableOpacity style={styles.pdfBtn} onPress={pickTaxPdf} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={NAVY} /> : (
              <Text style={styles.pdfBtnText}>{taxPath ? `✓ ${taxName || 'PDF yüklendi'}` : 'PDF seç ve yükle'}</Text>
            )}
          </TouchableOpacity>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <TouchableOpacity style={[styles.save, busy && { opacity: 0.6 }]} onPress={save} disabled={busy} activeOpacity={0.85}>
            <Text style={styles.saveText}>{busy ? '…' : 'Kaydet ve Devam Et'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logout} onPress={() => onLogout?.()} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Çıkış</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: NAVY, paddingHorizontal: 24 },
  scroll: { flexGrow: 1, paddingBottom: 24 },
  logo: { width: 150, height: 60, alignSelf: 'center', marginBottom: 14 },
  kicker: { color: GOLD, fontWeight: '800', letterSpacing: 3, fontSize: 11, textAlign: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 6 },
  note: { color: '#aeb6c2', fontSize: 13.5, textAlign: 'center', marginTop: 8, marginBottom: 10, lineHeight: 19 },
  sec: { color: GOLD, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 18, marginBottom: 4 },
  lbl: { color: '#cbd2db', fontSize: 12.5, fontWeight: '700', marginBottom: 5, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12, fontSize: 16, color: NAVY },
  pdfBtn: {
    backgroundColor: '#fff', borderRadius: 11, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(194,162,90,.45)', borderStyle: 'dashed', marginTop: 6,
  },
  pdfBtnText: { color: NAVY, fontWeight: '800', fontSize: 14.5 },
  err: { color: '#ff9a8d', fontSize: 13, fontWeight: '600', marginTop: 12 },
  save: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  logout: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  logoutText: { color: '#9aa1ac', fontSize: 14, fontWeight: '700' },
});
