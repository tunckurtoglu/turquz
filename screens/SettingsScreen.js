// screens/SettingsScreen.js
// Ayarlar: Dil, Bildirimler (aday: tek; acente: genel + mesaj ayrı), KVKK, Çıkış.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { nameOf } from '../i18n/languages';
import { openPrivacy } from '../lib/config';
import { getAgencyNotifPrefs, setAgencyNotifPrefs } from '../lib/agencyNotifPrefs';

function Switch({ on, onPress }) {
  return (
    <TouchableOpacity style={[styles.switch, on && styles.switchOn]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen({
  onBack, onChangeLanguage, onLogout, notifications, onToggleNotifications, fontsReady, isAgency,
}) {
  const { t, lang, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const fwdChevron = dir === 'rtl' ? '‹' : '›';

  const [prefsLoading, setPrefsLoading] = useState(!!isAgency);
  const [generalPush, setGeneralPush] = useState(true);
  const [chatPush, setChatPush] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAgency) return;
    let alive = true;
    (async () => {
      setPrefsLoading(true);
      const p = await getAgencyNotifPrefs();
      if (!alive) return;
      setGeneralPush(p.generalPush);
      setChatPush(p.chatPush);
      setPrefsLoading(false);
    })();
    return () => { alive = false; };
  }, [isAgency]);

  const savePrefs = async (next) => {
    setSaving(true);
    try {
      await setAgencyNotifPrefs({ ...next, preferredLang: lang });
    } catch (e) {
      console.warn('prefs save', e?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>{backChevron}</Text>
        </TouchableOpacity>
        <Text style={[styles.title, fontsReady && styles.titleFont]}>{t('settings')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.row} onPress={onChangeLanguage} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>🌐</Text>
          <Text style={styles.rowLabel}>{t('set_language')}</Text>
          <Text style={styles.rowValue}>{nameOf(lang)}</Text>
          <Text style={styles.chev}>{fwdChevron}</Text>
        </TouchableOpacity>

        {isAgency ? (
          prefsLoading ? (
            <View style={[styles.row, { justifyContent: 'center' }]}><ActivityIndicator color="#c2a25a" /></View>
          ) : (
            <>
              <View style={styles.row}>
                <Text style={styles.rowIcon}>🔔</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t('set_notif_general')}</Text>
                  <Text style={styles.rowDesc}>{t('set_notif_general_desc')}</Text>
                </View>
                <Switch
                  on={generalPush}
                  onPress={() => {
                    const v = !generalPush;
                    setGeneralPush(v);
                    savePrefs({ generalPush: v, chatPush });
                  }}
                />
              </View>
              <View style={styles.row}>
                <Text style={styles.rowIcon}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{t('set_notif_chat')}</Text>
                  <Text style={styles.rowDesc}>{t('set_notif_chat_desc')}</Text>
                </View>
                <Switch
                  on={chatPush}
                  onPress={() => {
                    const v = !chatPush;
                    setChatPush(v);
                    savePrefs({ generalPush, chatPush: v });
                  }}
                />
              </View>
              {saving ? <Text style={styles.saving}>{t('chat_saving')}</Text> : null}
            </>
          )
        ) : (
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t('set_notifications')}</Text>
              <Text style={styles.rowDesc}>{t('set_notifications_desc')}</Text>
            </View>
            <Switch on={notifications} onPress={() => onToggleNotifications(!notifications)} />
          </View>
        )}

        <TouchableOpacity style={styles.row} onPress={openPrivacy} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>🔒</Text>
          <Text style={styles.rowLabel}>{t('set_privacy')}</Text>
          <Text style={styles.chev}>{fwdChevron}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.row, styles.rowLast]} onPress={onLogout} activeOpacity={0.7}>
          <Text style={styles.rowIcon}>↩︎</Text>
          <Text style={[styles.rowLabel, styles.logout]}>{t('set_logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f4f5f7' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff',
    borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec',
  },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: '#1b2533', fontWeight: '700', marginTop: -4 },
  title: { fontSize: 20, fontWeight: '800', color: '#1b2533' },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },

  content: { padding: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec',
    borderRadius: 12, padding: 14, marginBottom: 10,
  },
  rowLast: { marginTop: 8 },
  rowIcon: { fontSize: 19, marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: '#1b2533', fontWeight: '600' },
  rowDesc: { fontSize: 12, color: '#9aa1ac', marginTop: 2 },
  rowValue: { fontSize: 14, color: '#737373', marginRight: 6 },
  chev: { fontSize: 20, color: '#c2a25a', fontWeight: '700' },
  logout: { color: '#a32d2d', flex: 0 },
  saving: { fontSize: 12, color: '#9aa1ac', marginBottom: 8, marginLeft: 4 },

  switch: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#cfd3d8', padding: 2, justifyContent: 'center' },
  switchOn: { backgroundColor: '#c2a25a' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { alignSelf: 'flex-end' },
});
