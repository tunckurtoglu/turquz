// wizard/steps/Step3Family.js
// Adım 3: aile (anne/baba) — ad, soyad, telefon + telefon tekrar (eşleşme uyarısı).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Field, SectionTitle } from '../../components/fields';
import { useLanguage } from '../../i18n/LanguageContext';

const withPlus = (t) => {
  if (t == null) return '';
  let s = String(t).replace(/[^\d+]/g, '');
  s = s.replace(/\+/g, (m, i) => (i === 0 ? '+' : ''));
  if (s && !s.startsWith('+')) s = '+' + s;
  return s;
};

function PersonPhone({ title, person, onChange, t }) {
  const p = person || {};
  const phone = p.phone || '';
  const phone2 = p.phoneConfirm || '';
  const mismatch = phone2.length > 0 && phone !== phone2;
  const matched = phone2.length > 0 && phone === phone2 && phone.length > 3;

  return (
    <View>
      <SectionTitle>{title}</SectionTitle>
      <Field label={t('f_firstName')} value={p.name} onChangeText={(v) => onChange({ name: v })} />
      <Field label={t('f_lastName')} value={p.lastName} onChangeText={(v) => onChange({ lastName: v })} />
      <Field label={t('f_phone')} value={p.phone} onChangeText={(v) => onChange({ phone: withPlus(v) })} keyboardType="phone-pad" />
      <Field label={t('f_phone2')} value={p.phoneConfirm} onChangeText={(v) => onChange({ phoneConfirm: withPlus(v) })} keyboardType="phone-pad" />
      {mismatch ? (
        <Text style={styles.warn}>{t('phone_mismatch')}</Text>
      ) : matched ? (
        <Text style={styles.ok}>{t('phone_ok')}</Text>
      ) : null}
    </View>
  );
}

export default function Step3Family({ data, update }) {
  const { t } = useLanguage();
  const fam = data.family || { mother: {}, father: {} };
  const setMother = (patch) => update({ family: { ...fam, mother: { ...(fam.mother || {}), ...patch } } });
  const setFather = (patch) => update({ family: { ...fam, father: { ...(fam.father || {}), ...patch } } });

  return (
    <View>
      <PersonPhone title={t('parent_mother')} person={fam.mother} onChange={setMother} t={t} />
      <PersonPhone title={t('parent_father')} person={fam.father} onChange={setFather} t={t} />
    </View>
  );
}

const styles = StyleSheet.create({
  warn: { color: '#c0392b', fontSize: 13, fontWeight: '600', marginTop: -4, marginBottom: 10 },
  ok: { color: '#1f8a4c', fontSize: 13, fontWeight: '600', marginTop: -4, marginBottom: 10 },
});
