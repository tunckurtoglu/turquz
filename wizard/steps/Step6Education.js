// wizard/steps/Step6Education.js
import React from 'react';
import { View } from 'react-native';
import { Field, SectionTitle, RepeatableGroup, Toggle } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { langOptions, WORK_YEARS } from '../../cv/options';

const EMPTY = { startYear: '', endYear: '', ongoing: false, level: '', school: '', description: '', date: '' };

export default function Step6Education({ data, update }) {
  const { t, lang } = useLanguage();
  const O = langOptions(lang);
  const items = data.education?.length ? data.education : [EMPTY];

  const composeDate = (it) => {
    const start = it.startYear || '';
    const end = it.ongoing ? t('ongoing_edu') : (it.endYear || '');
    return [start, end].filter(Boolean).join(' - ');
  };

  return (
    <View>
      <SectionTitle>{t('step_education')}</SectionTitle>
      <RepeatableGroup
        items={items}
        emptyItem={EMPTY}
        addLabel={t('add_edu')}
        limitLabel={t('limit_max', { n: 3 })}
        maxItems={3}
        onChange={(next) => update({ education: next })}
        renderItem={(item, patch) => {
          const set = (p) => patch({ ...p, date: composeDate({ ...item, ...p }) });
          return (
            <View>
              <Select label={t('f_startYear')} value={item.startYear} options={WORK_YEARS} onChange={(v) => set({ startYear: v })} placeholder={t('f_year')} />
              <Toggle label={t('ongoing_edu')} value={item.ongoing} onChange={(v) => set({ ongoing: v })} />
              {!item.ongoing && (
                <Select label={t('f_endYear')} value={item.endYear} options={WORK_YEARS} onChange={(v) => set({ endYear: v })} placeholder={t('f_year')} />
              )}
              <Select label={t('f_edu_level')} value={item.level} options={O.EDUCATION_LEVELS} onChange={(v) => patch({ level: v })} placeholder={t('select')} />
              <Field label={t('f_school')} value={item.school} onChangeText={(v) => patch({ school: v })} />
              <Field label={t('f_edu_desc')} value={item.description} onChangeText={(v) => patch({ description: v })} />
            </View>
          );
        }}
      />
    </View>
  );
}
