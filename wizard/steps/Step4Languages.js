// wizard/steps/Step4Languages.js
import React from 'react';
import { View } from 'react-native';
import { SectionTitle, RepeatableGroup } from '../../components/fields';
import { Select } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { langOptions } from '../../cv/options';

const EMPTY = { name: '', level: '' };

export default function Step4Languages({ data, update }) {
  const { t, lang } = useLanguage();
  const O = langOptions(lang);
  const items = data.languages?.length ? data.languages : [EMPTY];

  return (
    <View>
      <SectionTitle>{t('step_languages')}</SectionTitle>
      <RepeatableGroup
        items={items}
        emptyItem={EMPTY}
        addLabel={t('add_lang')}
        onChange={(next) => update({ languages: next })}
        renderItem={(item, patch) => (
          <View>
            <Select label={t('f_language')} value={item.name} options={O.LANGUAGES} onChange={(v) => patch({ name: v })} placeholder={t('select')} />
            <Select label={t('f_level')} value={item.level} options={O.LANGUAGE_LEVELS} onChange={(v) => patch({ level: v })} placeholder={t('select')} />
          </View>
        )}
      />
    </View>
  );
}
