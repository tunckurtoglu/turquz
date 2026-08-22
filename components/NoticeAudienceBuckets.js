import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';

const NATION_FLAG = {
  Türkiye: require('../assets/flags/tr.png'),
  Kazakistan: require('../assets/flags/kk.png'),
  Kırgızistan: require('../assets/flags/ky.png'),
  Özbekistan: require('../assets/flags/uz.png'),
  Rusya: require('../assets/flags/ru.png'),
  Tayland: require('../assets/flags/th.png'),
  Türkmenistan: require('../assets/flags/tk.png'),
};

function PersonCard({ p, on, mode, onPress, onDrop, dropLabel }) {
  const flag = NATION_FLAG[p.nationality];
  const label = p.name ? `${p.name} · ${p.code}` : p.code;
  const inner = (
    <>
      <View style={styles.avatar}>
        {p.photo ? <Image source={{ uri: p.photo }} style={styles.avatarImg} /> : <Text style={styles.ph}>👤</Text>}
      </View>
      <View style={styles.main}>
        <Text style={styles.personCode} numberOfLines={1}>{label}</Text>
        <View style={styles.sub}>
          {flag ? <Image source={flag} style={styles.flag} /> : null}
          <Text style={styles.subText} numberOfLines={1}>{p.nationality || p.title || '—'}</Text>
        </View>
      </View>
      {mode === 'read' ? (
        <Text style={[styles.readMark, on && styles.readMarkOn]}>{on ? '✓' : '·'}</Text>
      ) : mode === 'pick' ? (
        <View style={[styles.miniCheck, on && styles.miniCheckOn]}>
          <Text style={[styles.miniMark, on && styles.miniMarkOn]}>{on ? '✓' : ''}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.dropBtn}
          onPress={onDrop}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={dropLabel}
        >
          <Text style={styles.dropX}>✕</Text>
        </TouchableOpacity>
      )}
    </>
  );
  if (mode === 'pick') {
    return (
      <TouchableOpacity style={[styles.person, on && styles.personOn]} onPress={onPress} activeOpacity={0.88}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.person}>{inner}</View>;
}

export function NoticePersonRow(props) {
  return <PersonCard {...props} />;
}

export default function NoticeAudienceBuckets({
  buckets = [],
  mode = 'send',
  picked,
  onToggleGroup,
  onTogglePerson,
  onSendGroup,
  theme = 'dark',
  t,
}) {
  const [open, setOpen] = useState({});
  const [dropped, setDropped] = useState({});
  const dark = theme === 'dark';
  const pickedSet = picked instanceof Set ? picked : new Set(picked || []);
  const visible = (buckets || []).filter((b) => b.id === 'pool' || b.id === 'fav' || (b.people || []).length);

  const dropOf = (id) => dropped[id] || new Set();
  const remainingOf = (b) => (b.people || []).filter((p) => !dropOf(b.id).has(p.userId));
  const dropOne = (bucketId, userId) => {
    setDropped((prev) => {
      const next = new Set(prev[bucketId] || []);
      next.add(userId);
      return { ...prev, [bucketId]: next };
    });
  };
  const restore = (bucketId) => {
    setDropped((prev) => ({ ...prev, [bucketId]: new Set() }));
  };

  if (!visible.length) return null;

  return (
    <View style={styles.wrap}>
      {visible.map((b) => {
        const people = remainingOf(b);
        const total = (b.people || []).length;
        const n = people.length;
        const droppedN = total - n;
        const isPool = b.id === 'pool';
        const expanded = !isPool && !!open[b.id];
        const allOn = n > 0 && people.every((p) => pickedSet.has(p.userId));
        const someOn = people.some((p) => pickedSet.has(p.userId));
        return (
          <View key={b.id} style={[styles.card, dark ? styles.cardDark : styles.cardLight, isPool && (dark ? styles.cardPoolDark : styles.cardPoolLight)]}>
            <View style={styles.head}>
              {mode === 'pick' ? (
                <TouchableOpacity
                  style={[styles.check, allOn && styles.checkOn, someOn && !allOn && styles.checkSome]}
                  onPress={() => onToggleGroup?.(b)}
                  disabled={!n}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.checkMark, allOn && styles.checkMarkOn]}>{allOn ? '✓' : someOn ? '–' : ''}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.headMain}
                onPress={() => { if (!isPool) setOpen((p) => ({ ...p, [b.id]: !p[b.id] })); }}
                activeOpacity={isPool ? 1 : 0.85}
                disabled={isPool}
              >
                <Text style={[styles.title, dark ? styles.titleDark : styles.titleLight]} numberOfLines={1}>
                  {b.id === 'fav' ? '★ ' : ''}{t(b.labelKey)}
                </Text>
                <Text style={[styles.count, dark ? styles.countDark : styles.countLight]}>
                  {droppedN ? `${n}/${total}` : n}
                </Text>
                {isPool ? null : (
                  <Text style={[styles.chev, dark ? styles.chevDark : styles.chevLight]}>{expanded ? '▴' : '▾'}</Text>
                )}
              </TouchableOpacity>
              {mode === 'send' ? (
                <TouchableOpacity
                  style={[styles.send, !n && styles.sendOff]}
                  onPress={() => n && onSendGroup?.({ ...b, people })}
                  disabled={!n}
                  activeOpacity={0.88}
                >
                  <Text style={styles.sendText}>{t('agency_notice_send')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {isPool ? (
              <Text style={[styles.hint, dark ? styles.hintDark : styles.hintLight]}>{t('agency_notice_aud_pool_hint')}</Text>
            ) : null}
            {expanded ? (
              n || droppedN ? (
                <View style={styles.people}>
                  {mode === 'send' && droppedN ? (
                    <TouchableOpacity onPress={() => restore(b.id)} activeOpacity={0.85}>
                      <Text style={[styles.hint, dark ? styles.hintDark : styles.hintLight]}>
                        {t('agency_notice_dropped', { n: String(droppedN) })} · {t('agency_notice_restore')}
                      </Text>
                    </TouchableOpacity>
                  ) : mode === 'send' ? (
                    <Text style={[styles.hint, dark ? styles.hintDark : styles.hintLight]}>{t('agency_notice_trim_hint')}</Text>
                  ) : null}
                  {people.map((p) => (
                    <PersonCard
                      key={p.userId}
                      p={p}
                      mode={mode}
                      on={pickedSet.has(p.userId)}
                      onPress={() => onTogglePerson?.(p.userId)}
                      onDrop={() => dropOne(b.id, p.userId)}
                      dropLabel={t('agency_notice_drop')}
                    />
                  ))}
                </View>
              ) : (
                <Text style={[styles.hint, dark ? styles.hintDark : styles.hintLight]}>
                  {b.id === 'fav' ? t('fav_empty') : t('agency_notice_need_people')}
                </Text>
              )
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 16 },
  card: { borderRadius: 14, padding: 10, borderWidth: StyleSheet.hairlineWidth },
  cardDark: { backgroundColor: '#0a1524', borderColor: 'rgba(90,130,170,0.28)' },
  cardLight: { backgroundColor: '#fff', borderColor: '#ece7db' },
  cardPoolDark: { borderColor: 'rgba(194,162,90,0.45)' },
  cardPoolLight: { borderColor: 'rgba(184,149,74,0.45)', backgroundColor: '#fffdf4' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  title: { flex: 1, fontSize: 14, fontWeight: '800' },
  titleDark: { color: '#fff' },
  titleLight: { color: '#142033' },
  count: { fontSize: 13, fontWeight: '800' },
  countDark: { color: '#c2a25a' },
  countLight: { color: '#8a6a1f' },
  chev: { fontSize: 12, fontWeight: '800' },
  chevDark: { color: '#7a8796' },
  chevLight: { color: '#9aa3b0' },
  check: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#c2a25a',
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#c2a25a' },
  checkSome: { backgroundColor: 'rgba(194,162,90,0.35)' },
  checkMark: { fontSize: 13, fontWeight: '900', color: '#c2a25a' },
  checkMarkOn: { color: '#0e141c' },
  send: { backgroundColor: '#c2a25a', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  sendOff: { opacity: 0.4 },
  sendText: { fontSize: 12, fontWeight: '800', color: '#0e141c' },
  hint: { marginTop: 6, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  hintDark: { color: '#7a8796' },
  hintLight: { color: '#6e7684' },
  people: { marginTop: 10, gap: 8 },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fffdf8', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(20,32,51,0.07)',
  },
  personOn: { borderColor: 'rgba(194,162,90,0.55)', backgroundColor: '#fff8e8' },
  avatar: {
    width: 48, height: 48, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#ebe4d6', alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 14 },
  ph: { fontSize: 20 },
  main: { flex: 1, minWidth: 0 },
  personCode: { fontSize: 15, fontWeight: '800', color: '#142033' },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  flag: { width: 16, height: 11, borderRadius: 2 },
  subText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#6e7684' },
  miniCheck: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#c2a25a',
    alignItems: 'center', justifyContent: 'center',
  },
  miniCheckOn: { backgroundColor: '#c2a25a' },
  miniMark: { fontSize: 13, fontWeight: '900', color: '#c2a25a' },
  miniMarkOn: { color: '#0e141c' },
  dropBtn: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f3ece0',
  },
  dropX: { fontSize: 14, fontWeight: '800', color: '#8a6a1f' },
  readMark: { fontSize: 16, fontWeight: '800', color: '#9aa3b0', width: 20, textAlign: 'center' },
  readMarkOn: { color: '#1f7a4d' },
});
