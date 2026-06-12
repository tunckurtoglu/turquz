// wizard/steps/Step6Education.js
// Adım 6: eğitim. Tarih = başlangıç yılı - bitiş yılı / Devam (yıl bazlı). (çok dilli)
import React from 'react';
import { View } from 'react-native';
import { Field, SectionTitle, RepeatableGroup, Toggle } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { WORK_YEARS, langOptions } from '../../cv/options';

const EMPTY = {
  startYear: '', endYear: '', ongoing: false,
  level: '', school: '', description: '', date: '',
};

const composeDate = (it, presentLabel) => {
  const start = it.startYear || '';
  const end = it.ongoing ? presentLabel : (it.endYear || '');
  return [start, end].filter(Boolean).join(' - ');
};

export default function Step6Education({ data, update }) {
  const { t, lang } = useLanguage();
  const opts = langOptions(lang);
  const items = data.education?.length ? data.education : [EMPTY];
  const present = t('present');

  return (
    <View>
      <SectionTitle>{t('step_education')}</SectionTitle>
      <RepeatableGroup
        items={items}
        emptyItem={EMPTY}
        addLabel={t('add_edu')}
        maxItems={3}
        onChange={(next) => update({ education: next })}
        renderItem={(item, patch) => {
          const set = (p) => patch({ ...p, date: composeDate({ ...item, ...p }, present) });
          return (
            <View>
              <Select label={t('f_startYear')} value={item.startYear} options={WORK_YEARS} onChange={(v) => set({ startYear: v })} />
              <Toggle label={t('ongoing_edu')} value={item.ongoing} onChange={(v) => set({ ongoing: v })} />
              {!item.ongoing && (
                <Select label={t('f_endYear')} value={item.endYear} options={WORK_YEARS} onChange={(v) => set({ endYear: v })} />
              )}

              <Select label={t('f_edu_level')} value={item.level} options={opts.EDUCATION_LEVELS} onChange={(v) => patch({ level: v })} />
              <Field label={t('f_school')} value={item.school} onChangeText={(v) => patch({ school: v })} />
              <Field label={t('f_edu_desc')} value={item.description} onChangeText={(v) => patch({ description: v })} />
            </View>
          );
        }}
      />
    </View>
  );
}
