// wizard/steps/Step5Experience.js
import React from 'react';
import { View } from 'react-native';
import { Field, SectionTitle, RepeatableGroup, Toggle } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { MONTHS, WORK_YEARS } from '../../cv/options';

const EMPTY = { startMonth: '', startYear: '', endMonth: '', endYear: '', ongoing: false, company: '', position: '', date: '' };

export default function Step5Experience({ data, update }) {
  const { t } = useLanguage();
  const items = data.experience?.length ? data.experience : [EMPTY];

  const composeDate = (it) => {
    const start = it.startMonth && it.startYear ? `${it.startMonth}.${it.startYear}` : (it.startYear || '');
    const end = it.ongoing ? t('ongoing_work') : (it.endMonth && it.endYear ? `${it.endMonth}.${it.endYear}` : (it.endYear || ''));
    return [start, end].filter(Boolean).join(' - ');
  };

  return (
    <View>
      <SectionTitle>{t('step_experience')}</SectionTitle>
      <RepeatableGroup
        items={items}
        emptyItem={EMPTY}
        addLabel={t('add_exp')}
        limitLabel={t('limit_max', { n: 3 })}
        maxItems={3}
        onChange={(next) => update({ experience: next })}
        renderItem={(item, patch) => {
          const set = (p) => patch({ ...p, date: composeDate({ ...item, ...p }) });
          return (
            <View>
              <SectionTitle>{t('sec_start')}</SectionTitle>
              <Select label={t('f_month')} value={item.startMonth} options={MONTHS} onChange={(v) => set({ startMonth: v })} placeholder={t('f_month')} />
              <Select label={t('f_year')} value={item.startYear} options={WORK_YEARS} onChange={(v) => set({ startYear: v })} placeholder={t('f_year')} />
              <Toggle label={t('ongoing_work')} value={item.ongoing} onChange={(v) => set({ ongoing: v })} />
              {!item.ongoing && (
                <>
                  <SectionTitle>{t('sec_end')}</SectionTitle>
                  <Select label={t('f_month')} value={item.endMonth} options={MONTHS} onChange={(v) => set({ endMonth: v })} placeholder={t('f_month')} />
                  <Select label={t('f_year')} value={item.endYear} options={WORK_YEARS} onChange={(v) => set({ endYear: v })} placeholder={t('f_year')} />
                </>
              )}
              <Field label={t('f_company')} value={item.company} onChangeText={(v) => patch({ company: v })} />
              <Field label={t('f_position')} value={item.position} onChangeText={(v) => patch({ position: v })} />
            </View>
          );
        }}
      />
    </View>
  );
}
