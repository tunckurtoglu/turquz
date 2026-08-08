// wizard/steps/Step1Personal.js
// Adım 1: kimlik, iletişim, kişisel bilgiler. (çok dilli)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Field, SectionTitle } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  HEIGHTS, WEIGHTS, DAYS, monthOptions, BIRTH_YEARS,
  langOptions, licenseOptions, bloodOptions, ageFromBirth, MIN_AGE, MAX_AGE,
  normalizeWorkAvailability,
} from '../../cv/options';

// Telefon: kullanıcı yazmaya başlayınca başına otomatik "+" koy.
const withPlus = (t) => {
  if (t == null) return '';
  let s = String(t).replace(/[^\d+]/g, '');
  s = s.replace(/\+/g, (m, i) => (i === 0 ? '+' : ''));
  if (s && !s.startsWith('+')) s = '+' + s;
  return s;
};

// Özel nitelikli veri (kan grubu) için toplama anında açık rıza kutusu.
function ConsentCheck({ checked, label, onToggle }) {
  return (
    <TouchableOpacity style={styles.consentRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.cbox, checked && styles.cboxOn]}>{checked ? <Text style={styles.cbtick}>✓</Text> : null}</View>
      <Text style={styles.consentLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function Step1Personal({ data, update }) {
  const { t, lang } = useLanguage();
  const opts = langOptions(lang);

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

  // Yaş kontrolü: tam tarih girilince yaşı hesapla; aralık dışındaysa uyar.
  const age = ageFromBirth(data.birthDay, data.birthMonth, data.birthYear);
  const ageInvalid = age != null && (age < MIN_AGE || age > MAX_AGE);

  return (
    <View>
      <SectionTitle>{t('sec_about')}</SectionTitle>
      <Field label={t('f_firstName')} value={data.firstName} onChangeText={(v) => update({ firstName: v })} placeholder={t('ph_firstName')} />
      <Field label={t('f_lastName')} value={data.lastName} onChangeText={(v) => update({ lastName: v })} placeholder={t('ph_lastName')} />
      <Field label={t('f_title')} value={data.title} onChangeText={(v) => update({ title: v })} placeholder={t('ph_title')} />

      <SectionTitle>{t('sec_contact')}</SectionTitle>
      <Field label={t('f_email')} value={data.email} onChangeText={(v) => update({ email: v })} placeholder={t('ph_email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t('f_phone')} value={data.phone} onChangeText={(v) => update({ phone: withPlus(v) })} placeholder="+90 5xx xxx xx xx" keyboardType="phone-pad" />
      <Field label={t('f_phone2')} value={data.phoneConfirm} onChangeText={(v) => update({ phoneConfirm: withPlus(v) })} placeholder="+90 5xx xxx xx xx" keyboardType="phone-pad" />
      {mismatch ? (
        <Text style={styles.warn}>{t('phone_mismatch')}</Text>
      ) : matched ? (
        <Text style={styles.ok}>{t('phone_ok')}</Text>
      ) : null}

      <Field label={t('f_address')} value={data.location} onChangeText={(v) => update({ location: v })} maxLength={60} />

      {/* Pasaport CV'de sorulmaz — teklif sonrası "Belgeler" bölümünde yüklenir. */}

      <SectionTitle>{t('sec_birth')}</SectionTitle>
      <Select label={t('f_day')} value={data.birthDay} options={DAYS} onChange={(v) => setBirth({ birthDay: v })} />
      <Select label={t('f_month')} value={data.birthMonth} options={monthOptions(lang)} onChange={(v) => setBirth({ birthMonth: v })} />
      <Select label={t('f_year')} value={data.birthYear} options={BIRTH_YEARS} onChange={(v) => setBirth({ birthYear: v })} />
      {ageInvalid ? (
        <Text style={styles.warn}>{t('age_limit', { min: MIN_AGE, max: MAX_AGE })}</Text>
      ) : null}

      <SectionTitle>{t('sec_hw')}</SectionTitle>
      <Select label={t('f_height')} value={data.height} options={HEIGHTS} onChange={setHeight} />
      <Select label={t('f_weight')} value={data.weight} options={WEIGHTS} onChange={setWeight} />

      <SectionTitle>{t('sec_other')}</SectionTitle>
      <Select
        label={t('f_gender')}
        value={data.gender}
        options={[
          { label: t('gender_male'), value: 'male' },
          { label: t('gender_female'), value: 'female' },
        ]}
        onChange={(v) => update({ gender: v })}
      />
      <Select label={t('f_nationality')} value={data.nationality} options={opts.NATIONALITIES} onChange={(v) => update({ nationality: v })} />

      <Select
        label={t('f_employment_status')}
        value={data.employmentStatus}
        options={opts.EMPLOYMENT_STATUS}
        onChange={(v) => update({ employmentStatus: v })}
      />
      <Select
        label={t('f_work_duration')}
        value={normalizeWorkAvailability(data.availableMonths) || data.availableMonths}
        options={opts.WORK_AVAILABILITY}
        onChange={(v) => update({ availableMonths: v })}
      />

      <Select
        label={t('f_lic_country')}
        value={data.driverLicenseCountry}
        options={opts.NATIONALITIES}
        onChange={(v) => update({ driverLicenseCountry: v, driverLicense: '' })}
      />
      {data.driverLicenseCountry ? (
        <Select
          label={t('f_lic_class')}
          value={data.driverLicense}
          options={licenseOptions(data.driverLicenseCountry, lang)}
          onChange={(v) => update({ driverLicense: v })}
        />
      ) : null}

      {/* Kan grubu özel nitelikli veridir — açık rıza olmadan toplanmaz. */}
      <ConsentCheck
        checked={!!data.bloodConsent}
        label={t('f_blood_consent')}
        onToggle={() =>
          data.bloodConsent
            ? update({ bloodConsent: false, bloodCountry: '', bloodType: '' })
            : update({ bloodConsent: true })
        }
      />
      {/* Alanlar her zaman görünür; onay kutusu işaretlenene kadar PASİF (tıklanamaz). */}
      <Select
        label={t('f_blood_country')}
        value={data.bloodCountry}
        options={opts.NATIONALITIES}
        onChange={(v) => update({ bloodCountry: v, bloodType: '' })}
        disabled={!data.bloodConsent}
      />
      <Select
        label={t('f_blood')}
        value={data.bloodType}
        options={data.bloodCountry ? bloodOptions(data.bloodCountry) : []}
        onChange={(v) => update({ bloodType: v })}
        disabled={!data.bloodConsent || !data.bloodCountry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  warn: { color: '#c0392b', fontSize: 13, fontWeight: '600', marginTop: -4, marginBottom: 10 },
  ok: { color: '#1f8a4c', fontSize: 13, fontWeight: '600', marginTop: -4, marginBottom: 10 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, marginBottom: 8 },
  cbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#c9ccd2', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  cboxOn: { backgroundColor: '#c2a25a', borderColor: '#c2a25a' },
  cbtick: { color: '#fff', fontWeight: '800', fontSize: 14 },
  consentLabel: { flex: 1, fontSize: 13, color: '#1b2533', lineHeight: 18 },
});
