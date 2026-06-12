// screens/InterviewCall.js
// App-İÇİ görüntülü mülakat (LiveKit). 10 dk geri sayım + otomatik kapanış.
// Token'ı Edge Function 'livekit-token' üretir. Gerçek/dev build gerekir (Expo Go değil).
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Platform, PermissionsAndroid } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  registerGlobals, LiveKitRoom, useTracks, VideoTrack, isTrackReference,
  useLocalParticipant, useRoomContext, useDataChannel, AudioSession,
} from '@livekit/react-native';
import { Track } from 'livekit-client';
import { useLanguage } from '../i18n/LanguageContext';
import { getCallToken, CALL_MINUTES } from '../lib/livekitCall';

registerGlobals();

const INK = '#0e1622';
const GOLD = '#c2a25a';

const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const decodeUtf8 = (u8) => { try { return new TextDecoder().decode(u8); } catch (e) { return String.fromCharCode.apply(null, Array.from(u8)); } };

// LiveKitRoom bağlamı içindeki gerçek görüşme arayüzü.
function CallStage({ onClose, candidateLabel, minutes, isHost }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const [secs, setSecs] = useState(minutes * 60);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [caption, setCaption] = useState(null); // { who, text }
  const [lockedByHost, setLockedByHost] = useState(false); // benim mikrofonum host tarafından kilitli mi
  const [lockedSet, setLockedSet] = useState(new Set());   // host: kilitlediği katılımcılar

  // Kontrol kanalı: +5 dk uzatma + acentenin KİLİTLİ susturması.
  const sendControl = (obj) => {
    try { room?.localParticipant?.publishData(new TextEncoder().encode(JSON.stringify(obj)), { reliable: true, topic: 'control' }); } catch (e) { /* yoksay */ }
  };
  useDataChannel('control', (msg) => {
    try {
      const d = JSON.parse(decodeUtf8(msg.payload));
      if (d?.type === 'extend') setSecs((s) => s + (d.addSecs || 300));
      else if (d?.type === 'mute' && d.target === localParticipant?.identity) {
        if (d.lock) { localParticipant?.setMicrophoneEnabled(false); setMic(false); }
        setLockedByHost(!!d.lock);
      }
    } catch (e) { /* yoksay */ }
  });
  const extend = () => { setSecs((s) => s + 300); sendControl({ type: 'extend', addSecs: 300 }); };
  // Host: bir katılımcıyı kilitli sustur / kilidi aç (toggle).
  const toggleLock = (identity) => {
    setLockedSet((prev) => {
      const n = new Set(prev);
      const willLock = !n.has(identity);
      if (willLock) n.add(identity); else n.delete(identity);
      sendControl({ type: 'mute', target: identity, lock: willLock });
      return n;
    });
  };

  // Çevirmen ajanın bastığı altyazılar ('captions' kanalı). İzleyenin diline çevrilmiş halini göster.
  useDataChannel('captions', (msg) => {
    try {
      const d = JSON.parse(decodeUtf8(msg.payload));
      if (d?.type !== 'caption') return;
      const text = (d.tr && d.tr[lang]) || d.original || '';
      if (!text) return;
      const who = d.role === 'agency' ? t('role_agency') : (candidateLabel || '');
      setCaption({ who, text });
    } catch (e) { /* yoksay */ }
  });

  // 10 dk geri sayım → bitince otomatik kapan.
  useEffect(() => {
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { clearInterval(id); try { room?.disconnect(); } catch (e) {} onClose(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [room, onClose]);

  const remotes = tracks.filter((tr) => isTrackReference(tr) && tr.participant && !tr.participant.isLocal);
  const local = tracks.find((tr) => isTrackReference(tr) && tr.participant && tr.participant.isLocal);
  const low = secs <= 60;
  // Etiket: acente ise "Acente"; aday ise (bireyselde) maskeli ad, grupta genel "Aday". Gizlilik: tam isim yok.
  const labelFor = (tr) => (tr?.participant?.name === 'agency' ? t('role_agency') : (candidateLabel || t('role_candidate')));
  const tileSize = (n) => (n <= 1 ? { width: '100%', height: '100%' } : n === 2 ? { width: '100%', height: '50%' } : { width: '50%', height: '50%' });

  const toggleMic = () => { if (lockedByHost) return; const v = !mic; setMic(v); localParticipant?.setMicrophoneEnabled(v); };
  const toggleCam = () => { const v = !cam; setCam(v); localParticipant?.setCameraEnabled(v); };
  const hangup = () => { try { room?.disconnect(); } catch (e) {} onClose(); };

  return (
    <View style={styles.stage}>
      {/* Karşı taraf(lar) — 1 kişi tam ekran, çok kişi ızgara */}
      {remotes.length === 0 ? (
        <View style={[styles.remote, styles.waitBox]}>
          <ActivityIndicator color={GOLD} />
          <Text style={styles.waitText}>{t('call_waiting')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {remotes.map((tr) => (
            <View key={tr.participant.identity} style={[styles.tile, tileSize(remotes.length)]}>
              <VideoTrack trackRef={tr} style={StyleSheet.absoluteFill} objectFit="cover" />
              {labelFor(tr) ? (
                <View style={styles.tileTag}><Text style={styles.tileTagText} numberOfLines={1}>{labelFor(tr)}</Text></View>
              ) : null}
              {isHost ? (
                <TouchableOpacity style={[styles.tileMute, lockedSet.has(tr.participant.identity) && styles.tileMuteOn]} onPress={() => toggleLock(tr.participant.identity)} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.tileMuteText}>{lockedSet.has(tr.participant.identity) ? '🔒' : '🔇'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {/* Üst: süre (+ acente için süre uzatma) */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <View style={[styles.timer, low && styles.timerLow]}>
            <Text style={styles.timerText}>🎥 {mmss(secs)}</Text>
          </View>
          {isHost ? (
            <TouchableOpacity style={styles.extendBtn} onPress={extend} activeOpacity={0.85}>
              <Text style={styles.extendText}>{t('call_extend')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Kendi görüntün (küçük) */}
      <View style={[styles.pip, { top: insets.top + 60 }]}>
        {local && cam ? (
          <VideoTrack trackRef={local} style={styles.pipVideo} objectFit="cover" mirror />
        ) : (
          <View style={[styles.pipVideo, styles.pipOff]}><Text style={styles.pipOffText}>📷</Text></View>
        )}
        <View style={styles.pipTag}><Text style={styles.pipTagText}>{t('call_you')}</Text></View>
      </View>

      {/* Canlı altyazı */}
      {caption ? (
        <View style={[styles.subBand, { bottom: insets.bottom + 96 }]}>
          {caption.who ? <Text style={styles.subWho}>{caption.who}</Text> : null}
          <Text style={styles.subText}>{caption.text}</Text>
        </View>
      ) : null}

      {/* Alt kontroller */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.ctrl, !mic && styles.ctrlOff, lockedByHost && styles.ctrlLocked]} onPress={toggleMic} activeOpacity={lockedByHost ? 1 : 0.85}>
          <Text style={styles.ctrlIcon}>{lockedByHost ? '🔒' : (mic ? '🎤' : '🔇')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.hangup} onPress={hangup} activeOpacity={0.9}>
          <Text style={styles.hangupIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ctrl, !cam && styles.ctrlOff]} onPress={toggleCam} activeOpacity={0.85}>
          <Text style={styles.ctrlIcon}>{cam ? '📷' : '🚫'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function InterviewCall({ visible, candidateUserId, groupId, candidateLabel, onClose }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [cred, setCred] = useState(null);
  const [error, setError] = useState('');

  const start = useCallback(async () => {
    setError(''); setCred(null);
    try {
      if (Platform.OS === 'android') {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
      }
      await AudioSession.startAudioSession();
      const c = await getCallToken(groupId ? { groupId } : { candidateUserId }, lang);
      setCred(c);
    } catch (e) {
      setError(e?.message || 'error');
    }
  }, [candidateUserId, groupId, lang]);

  useEffect(() => {
    if (visible) start();
    return () => { AudioSession.stopAudioSession().catch(() => {}); };
  }, [visible, start]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errTitle}>{t('call_error')}</Text>
            <Text style={styles.errMsg}>{error}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeBtnText}>{t('consent_cancel')}</Text></TouchableOpacity>
          </View>
        ) : !cred ? (
          <View style={styles.center}>
            <ActivityIndicator color={GOLD} size="large" />
            <Text style={styles.connecting}>{t('call_connecting')}</Text>
            <TouchableOpacity style={[styles.closeBtn, { marginTop: 24 }]} onPress={onClose}><Text style={styles.closeBtnText}>{t('consent_cancel')}</Text></TouchableOpacity>
          </View>
        ) : (
          <LiveKitRoom
            serverUrl={cred.url}
            token={cred.token}
            connect
            audio
            video
            options={{ adaptiveStream: true }}
            onDisconnected={onClose}
            onError={(e) => setError(e?.message || 'connection error')}
          >
            <CallStage onClose={onClose} candidateLabel={candidateLabel} minutes={cred.minutes || CALL_MINUTES} isHost={cred.role === 'agency'} />
          </LiveKitRoom>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  connecting: { color: '#cbd2db', fontSize: 15, fontWeight: '600', marginTop: 16 },
  errTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  errMsg: { color: '#e8806f', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  closeBtn: { backgroundColor: '#22303f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  closeBtnText: { color: '#fff', fontWeight: '800' },

  stage: { flex: 1, backgroundColor: '#000' },
  remote: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0b1119' },
  waitBox: { alignItems: 'center', justifyContent: 'center' },
  waitText: { color: '#8b95a3', fontSize: 14, fontWeight: '600', marginTop: 12 },
  grid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#0b1119' },
  tile: { backgroundColor: '#11161e', borderWidth: 0.5, borderColor: '#000' },
  tileTag: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  tileTagText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timer: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(194,162,90,0.5)' },
  timerLow: { borderColor: '#e8806f', backgroundColor: 'rgba(120,30,20,0.6)' },
  timerText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  extendBtn: { backgroundColor: 'rgba(194,162,90,0.92)', borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7 },
  extendText: { color: '#1b2533', fontWeight: '800', fontSize: 13 },
  tileMute: { position: 'absolute', top: 8, right: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  tileMuteOn: { backgroundColor: 'rgba(217,52,43,0.9)' },
  tileMuteText: { fontSize: 15 },
  ctrlLocked: { backgroundColor: 'rgba(217,52,43,0.9)' },

  pip: { position: 'absolute', right: 14, width: 104, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1b2533', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },
  pipVideo: { width: '100%', height: '100%' },
  pipOff: { alignItems: 'center', justifyContent: 'center' },
  pipOffText: { fontSize: 26 },
  pipTag: { position: 'absolute', bottom: 5, left: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 7, paddingVertical: 2, alignItems: 'center' },
  pipTagText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },
  nameTag: { position: 'absolute', left: 14, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)' },
  nameTagText: { color: '#fff', fontSize: 13.5, fontWeight: '800', letterSpacing: 0.3 },

  subBand: { position: 'absolute', left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 },
  subWho: { color: GOLD, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5, marginBottom: 3, textTransform: 'uppercase' },
  subText: { color: '#fff', fontSize: 16, fontWeight: '600', lineHeight: 22 },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  ctrl: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  ctrlOff: { backgroundColor: 'rgba(232,128,111,0.9)' },
  ctrlIcon: { fontSize: 23 },
  hangup: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#d9342b', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  hangupIcon: { color: '#fff', fontSize: 28, fontWeight: '900' },
});
