// wizard/steps/Step7SkillsEtc.js
import React from 'react';
import { View } from 'react-native';
import { Field, SectionTitle, RepeatableGroup } from '../../components/fields';
import { MultiSelect } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { langOptions } from '../../cv/options';

const EMPTY_CERT = { name: '', institution: '' };

export default function Step7SkillsEtc({ data, update }) {
  const { t, lang } = useLanguage();
  const O = langOptions(lang);
  const certs = data.certificates?.length ? data.certificates : [EMPTY_CERT];

  return (
    <View>
      <SectionTitle>{t('sec_skills')}</SectionTitle>
      <MultiSelect label={t('pick_skills')} values={data.skills || []} options={O.SKILLS} onChange={(next) => update({ skills: next })} placeholder={t('select')} />

      <SectionTitle>{t('sec_positions')}</SectionTitle>
      <MultiSelect label={t('pick_positions')} values={data.positions || []} options={O.POSITIONS} maxValues={3} onChange={(next) => update({ positions: next })} placeholder={t('select')} />

      <SectionTitle>{t('sec_certs')}</SectionTitle>
      <RepeatableGroup
        items={certs}
        emptyItem={EMPTY_CERT}
        addLabel={t('add_cert')}
        limitLabel={t('limit_max', { n: 4 })}
        maxItems={4}
        onChange={(next) => update({ certificates: next })}
        renderItem={(item, patch) => (
          <View>
            <Field label={t('f_cert_name')} value={item.name} onChangeText={(v) => patch({ name: v })} />
            <Field label={t('f_cert_inst')} value={item.institution} onChangeText={(v) => patch({ institution: v })} />
          </View>
        )}
      />
    </View>
  );
}
