// wizard/steps/Step1Personal.js
// Adım 1: kimlik, iletişim, kişisel bilgiler. Tüm etiketler seçili dilden gelir.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Field, SectionTitle } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { langOptions, licenseOptions, HEIGHTS, WEIGHTS, DAYS, MONTHS, BIRTH_YEARS } from '../../cv/options';

const withPlus = (t) => {
  if (t == null) return '';
  let s = String(t).replace(/[^\d+]/g, '');
  s = s.replace(/\+/g, (m, i) => (i === 0 ? '+' : ''));
  if (s && !s.startsWith('+')) s = '+' + s;
  return s;
};

export default function Step1Personal({ data, update }) {
  const { t, lang } = useLanguage();
  const O = langOptions(lang);

  const hwText = (h, w) =>
    [h ? `${h} cm` : null, w ? `${w} kg` : null].filter(Boolean).join(' / ');
  const setHeight = (v) => update({ height: v, heightWeight: hwText(v, data.weight) });
  const setWeight = (v) => update({ weight: v, heightWeight: hwText(data.height, v) });

  const setBirth = (patch) => {
    const b = { birthDay: data.birthDay, birthMonth: data.birthMonth, birthYear: data.birthYear, ...patch };
    update({ ...patch, birthDate: [b.birthDay, b.birthMonth, b.birthYear].filter(Boolean).join('.') });
  };

  const phone = data.phone || '';
  const phone2 = data.phoneConfirm || '';
  const mismatch = phone2.length > 0 && phone !== phone2;
  const matched = phone2.length > 0 && phone === phone2 && phone.length > 3;

  return (
    <View>
      <SectionTitle>{t('sec_about')}</SectionTitle>
      <Field label={t('f_firstName')} value={data.firstName} onChangeText={(v) => update({ firstName: v })} placeholder={t('ph_firstName')} />
      <Field label={t('f_lastName')} value={data.lastName} onChangeText={(v) => update({ lastName: v })} placeholder={t('ph_lastName')} />
      <Field label={t('f_title')} value={data.title} onChangeText={(v) => update({ title: v })} placeholder={t('ph_title')} />

      <SectionTitle>{t('sec_contact')}</SectionTitle>
      <Field label={t('f_email')} value={data.email} onChangeText={(v) => update({ email: v })} placeholder={t('ph_email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t('f_phone')} value={data.phone} onChangeText={(v) => update({ phone: withPlus(v) })} placeholder="+90 5xx xxx xx xx" keyboardType="phone-pad" />
      <Field label={t('f_phone2')} value={data.phoneConfirm} onChangeText={(v) => update({ phoneConfirm: withPlus(v) })} keyboardType="phone-pad" />
      {mismatch ? (
        <Text style={styles.warn}>{t('phone_mismatch')}</Text>
      ) : matched ? (
        <Text style={styles.ok}>{t('phone_ok')}</Text>
      ) : null}
      <Field label={t('f_address')} value={data.location} onChangeText={(v) => update({ location: v })} placeholder="Antalya" maxLength={60} />

      <SectionTitle>{t('sec_personal')}</SectionTitle>
      <Field label={t('f_passport')} value={data.passportNo} onChangeText={(v) => update({ passportNo: v })} />

      <SectionTitle>{t('sec_birth')}</SectionTitle>
      <Select label={t('f_day')} value={data.birthDay} options={DAYS} onChange={(v) => setBirth({ birthDay: v })} placeholder={t('f_day')} />
      <Select label={t('f_month')} value={data.birthMonth} options={MONTHS} onChange={(v) => setBirth({ birthMonth: v })} placeholder={t('f_month')} />
      <Select label={t('f_year')} value={data.birthYear} options={BIRTH_YEARS} onChange={(v) => setBirth({ birthYear: v })} placeholder={t('f_year')} />

      <SectionTitle>{t('sec_hw')}</SectionTitle>
      <Select label={t('f_height')} value={data.height} options={HEIGHTS} onChange={setHeight} placeholder={t('f_height')} />
      <Select label={t('f_weight')} value={data.weight} options={WEIGHTS} onChange={setWeight} placeholder={t('f_weight')} />

      <SectionTitle>{t('sec_other')}</SectionTitle>
      <Select label={t('f_nationality')} value={data.nationality} options={O.NATIONALITIES} onChange={(v) => update({ nationality: v })} placeholder={t('select')} />
      <Select label={t('f_lic_country')} value={data.driverLicenseCountry} options={O.NATIONALITIES} onChange={(v) => update({ driverLicenseCountry: v, driverLicense: '' })} placeholder={t('select')} />
      {data.driverLicenseCountry ? (
        <Select label={t('f_lic_class')} value={data.driverLicense} options={licenseOptions(data.driverLicenseCountry, lang)} onChange={(v) => update({ driverLicense: v })} placeholder={t('select')} />
      ) : null}
      <Select label={t('f_criminal')} value={data.criminalRecord} options={O.YES_NO} onChange={(v) => update({ criminalRecord: v })} placeholder={t('select')} />
    </View>
  );
}

const styles = StyleSheet.create({
  warn: { color: '#c0392b', fontSize: 13, fontWeight: '600', marginTop: -4, marginBottom: 10 },
  ok: { color: '#1f8a4c', fontSize: 13, fontWeight: '600', marginTop: -4, marginBottom: 10 },
});
