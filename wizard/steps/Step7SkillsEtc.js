// wizard/steps/Step7SkillsEtc.js
// Adım 7: beceriler & pozisyonlar = çoklu seçim (filtre için).
// Pozisyon: önce sektör (Turizm / Diğer), sonra o sektörün alanları.
// Sertifikalar = AD + KURUM iki ayrı alan. (çok dilli)
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Field, SectionTitle, RepeatableGroup } from '../../components/fields';
import { MultiSelect } from '../../components/Select';
import { useLanguage } from '../../i18n/LanguageContext';
import { langOptions, sectorOfPosition } from '../../cv/options';

const EMPTY_CERT = { name: '', institution: '' };
const GOLD = '#c2a25a';
const INK = '#1b2533';

export default function Step7SkillsEtc({ data, update }) {
  const { t, lang } = useLanguage();
  const opts = langOptions(lang);
  const certs = data.certificates?.length ? data.certificates : [EMPTY_CERT];
  const positions = data.positions || [];

  const initialSector = useMemo(() => {
    const first = positions[0];
    return first && sectorOfPosition(first) === 'other' ? 'other' : 'tourism';
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- sadece ilk açılış

  const [sector, setSector] = useState(initialSector);

  const sectorOpts = opts.POSITIONS_BY_SECTOR[sector] || [];
  const otherSelected = positions.filter((p) => sectorOfPosition(p) !== sector);
  const sectorSelected = positions.filter((p) => sectorOfPosition(p) === sector);
  const remainingSlots = Math.max(0, 3 - otherSelected.length);
  const labelMap = Object.fromEntries(opts.POSITIONS.map((o) => [o.value, o.label]));

  return (
    <View>
      <SectionTitle>{t('sec_skills')}</SectionTitle>
      <MultiSelect
        label={t('pick_skills')}
        values={data.skills || []}
        options={opts.SKILLS}
        onChange={(next) => update({ skills: next })}
      />

      <SectionTitle>{t('sec_positions')}</SectionTitle>
      <Text style={styles.sectorLabel}>{t('pick_work_sector')}</Text>
      <View style={styles.seg}>
        {opts.POSITION_SECTORS.map((o) => {
          const on = sector === o.value;
          return (
            <TouchableOpacity
              key={o.value}
              style={[styles.segBtn, on && styles.segBtnOn]}
              onPress={() => setSector(o.value)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <MultiSelect
        label={t('pick_positions')}
        values={sectorSelected}
        options={sectorOpts}
        maxValues={remainingSlots}
        onChange={(next) => update({ positions: [...otherSelected, ...next] })}
      />
      {otherSelected.length ? (
        <Text style={styles.alsoSelected}>
          {otherSelected.map((p) => labelMap[p] || p).join(' · ')}
        </Text>
      ) : null}

      <SectionTitle>{t('sec_certs')}</SectionTitle>
      <RepeatableGroup
        items={certs}
        emptyItem={EMPTY_CERT}
        addLabel={t('add_cert')}
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

const styles = StyleSheet.create({
  sectorLabel: { color: '#5c6570', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 2 },
  seg: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#eef1f5', borderWidth: 1.5, borderColor: '#eef1f5',
  },
  segBtnOn: { backgroundColor: 'rgba(194,162,90,0.18)', borderColor: GOLD },
  segText: { color: '#5c6570', fontSize: 14, fontWeight: '700' },
  segTextOn: { color: INK },
  alsoSelected: { color: '#6f7b8a', fontSize: 12, fontWeight: '600', marginTop: -4, marginBottom: 8, lineHeight: 17 },
});
