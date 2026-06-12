// wizard/steps/Step5Experience.js
// Adım 5: iş deneyimleri. Tarih = başlangıç (ay+yıl) - bitiş (ay+yıl) / Devam. (çok dilli)
import React from 'react';
import { View } from 'react-native';
import { Field, SectionTitle, RepeatableGroup, Toggle } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { monthOptions, WORK_YEARS } from '../../cv/options';

const EMPTY = {
  startMonth: '', startYear: '', endMonth: '', endYear: '', ongoing: false,
  company: '', position: '', date: '',
};

// presentLabel: "Devam" karşılığı (o anki dile göre)
const composeDate = (it, presentLabel) => {
  const start = it.startMonth && it.startYear ? `${it.startMonth}.${it.startYear}` : (it.startYear || '');
  const end = it.ongoing
    ? presentLabel
    : (it.endMonth && it.endYear ? `${it.endMonth}.${it.endYear}` : (it.endYear || ''));
  return [start, end].filter(Boolean).join(' - ');
};

export default function Step5Experience({ data, update }) {
  const { t, lang } = useLanguage();
  const items = data.experience?.length ? data.experience : [EMPTY];
  const present = t('present');
  const months = monthOptions(lang);

  return (
    <View>
      <SectionTitle>{t('step_experience')}</SectionTitle>
      <RepeatableGroup
        items={items}
        emptyItem={EMPTY}
        addLabel={t('add_exp')}
        maxItems={3}
        onChange={(next) => update({ experience: next })}
        renderItem={(item, patch) => {
          const set = (p) => patch({ ...p, date: composeDate({ ...item, ...p }, present) });
          return (
            <View>
              <SectionTitle>{t('sec_start')}</SectionTitle>
              <Select label={t('f_month')} value={item.startMonth} options={months} onChange={(v) => set({ startMonth: v })} />
              <Select label={t('f_year')} value={item.startYear} options={WORK_YEARS} onChange={(v) => set({ startYear: v })} />

              <Toggle label={t('ongoing_work')} value={item.ongoing} onChange={(v) => set({ ongoing: v })} />

              {!item.ongoing && (
                <>
                  <SectionTitle>{t('sec_end')}</SectionTitle>
                  <Select label={t('f_month')} value={item.endMonth} options={months} onChange={(v) => set({ endMonth: v })} />
                  <Select label={t('f_year')} value={item.endYear} options={WORK_YEARS} onChange={(v) => set({ endYear: v })} />
                </>
              )}

              <Field label={t('f_company')} value={item.company} onChangeText={(v) => patch({ company: v })} placeholder="Titanic Hotel Lara" />
              <Field label={t('f_position')} value={item.position} onChangeText={(v) => patch({ position: v })} />
            </View>
          );
        }}
      />
    </View>
  );
}
