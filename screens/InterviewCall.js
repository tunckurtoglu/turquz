// screens/InterviewCall.js
// App-İÇİ görüntülü mülakat (LiveKit).
// NOT: livekit-client >= 2.19.2 RN'de uzak videoyu siyah gösterir → singlePeerConnection:false + 2.19.1 pin.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator,
  Platform, PermissionsAndroid, ScrollView, Dimensions, Animated, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  registerGlobals, LiveKitRoom, useTracks, VideoTrack, isTrackReference,
  useLocalParticipant, useRoomContext, useRemoteParticipants, AudioSession,
} from '@livekit/react-native';
import { Track, ParticipantKind, RoomEvent } from 'livekit-client';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getCallToken, CALL_MINUTES, EXTEND_SECS, callEndAtMs, extendInterviewCall,
} from '../lib/livekitCall';

registerGlobals();

const INK = '#0e1622';
const GOLD = '#c2a25a';

const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const decodeUtf8 = (u8) => { try { return new TextDecoder().decode(u8); } catch (e) { return String.fromCharCode.apply(null, Array.from(u8)); } };
const isCaptionAgent = (p) =>
  p?.kind === ParticipantKind.Agent
  || /^(agent|AG_|caption)/i.test(p?.identity || '')
  || p?.name === 'agent';

function ensureRemoteSubscribed(room) {
  if (!room) return;
  for (const p of room.remoteParticipants.values()) {
    if (isCaptionAgent(p)) continue;
    for (const pub of p.trackPublications.values()) {
      if ((pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio) && !pub.isSubscribed) {
        try { pub.setSubscribed(true); } catch (e) { /* yoksay */ }
      }
    }
  }
}

/** Bağlantı sonrası uzak track aboneliği + kamera/mic açık kalsın. */
function MediaBootstrap() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 250));
      if (cancelled || !localParticipant) return;
      try { await localParticipant.setMicrophoneEnabled(true); } catch (e) { /* yoksay */ }
      try { await localParticipant.setCameraEnabled(true); } catch (e) { /* yoksay */ }
      ensureRemoteSubscribed(room);
    })();
    const id = setInterval(() => ensureRemoteSubscribed(room), 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, [room, localParticipant]);
  return null;
}

function CallStage({ onHangup, candidateLabel, candidateUserId, endAtMs, isHost }) {
  const { t, lang } = useLanguage();
  const insets = useSafeAreaInsets();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const initialLeft = Math.max(1, Math.ceil(((endAtMs || 0) - Date.now()) / 1000));
  const [secs, setSecs] = useState(initialLeft);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [lines, setLines] = useState([]);
  const [live, setLive] = useState(null);
  const [capDown, setCapDown] = useState(false);
  const [pipBig, setPipBig] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [linkState, setLinkState] = useState('ok'); // ok | reconnecting
  const [remotePane, setRemotePane] = useState({ w: 0, h: 0 });
  const [localPane, setLocalPane] = useState({ w: 0, h: 0 });
  const tipPulse = useRef(new Animated.Value(1)).current;
  const [, setCamTick] = useState(0);
  const lastSeqRef = useRef(0);
  const idSeqRef = useRef(0);
  const chatScrollRef = useRef(null);
  const [lockedByHost, setLockedByHost] = useState(false);
  const [lockedSet, setLockedSet] = useState(new Set());
  const onHangupRef = useRef(onHangup);
  onHangupRef.current = onHangup;
  const roomRef = useRef(room);
  roomRef.current = room;
  const langRef = useRef(lang);
  langRef.current = lang;
  const endAtRef = useRef(endAtMs || (Date.now() + CALL_MINUTES * 60 * 1000));
  useEffect(() => { if (endAtMs) endAtRef.current = endAtMs; }, [endAtMs]);

  const handlePayload = useCallback((payload) => {
    try {
      const d = JSON.parse(decodeUtf8(payload));
      if (!d?.type) return;
      if (d.type === 'extend') {
        const add = d.addSecs || EXTEND_SECS;
        endAtRef.current += add * 1000;
        setSecs((s) => s + add);
        return;
      }
      if (d.type === 'mute' && d.target === roomRef.current?.localParticipant?.identity) {
        if (d.lock) { roomRef.current?.localParticipant?.setMicrophoneEnabled(false); setMic(false); }
        setLockedByHost(!!d.lock);
        return;
      }
      if (d.type === 'caption_status') { setCapDown(!d.ok); return; }
      if (d.type !== 'caption') return;
      const who = d.role === 'agency' ? t('role_agency') : (candidateLabel || '');
      if (d.final === false) {
        const text = d.text || d.original || ''; if (!text) return;
        setLive({ who, text });
        return;
      }
      if (d.target && d.target !== '*' && d.target !== langRef.current) return;
      const text = d.text || d.original || ''; if (!text) return;
      if (d.seq && d.seq < lastSeqRef.current) return;
      if (d.seq) lastSeqRef.current = d.seq;
      setCapDown(false);
      setLive(null);
      const id = `${d.seq || ''}-${idSeqRef.current++}`;
      setLines((prev) => [...prev, { id, who, text }].slice(-200));
      setTimeout(() => chatScrollRef.current?.scrollToEnd?.({ animated: true }), 50);
    } catch (e) { /* yoksay */ }
  }, [t, candidateLabel]);

  useEffect(() => {
    const r = room;
    if (!r) return undefined;
    const onData = (payload) => handlePayload(payload);
    const bump = () => setCamTick((n) => n + 1);
    const onPub = (pub) => {
      try {
        if (pub?.kind === Track.Kind.Video || pub?.kind === Track.Kind.Audio) pub.setSubscribed?.(true);
      } catch (e) { /* yoksay */ }
      bump();
    };
    const onPeer = (p) => {
      if (p && !isCaptionAgent(p)) {
        for (const pub of p.trackPublications.values()) {
          if ((pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio) && !pub.isSubscribed) {
            try { pub.setSubscribed(true); } catch (e) { /* yoksay */ }
          }
        }
      }
      bump();
    };
    const onReconnecting = () => setLinkState('reconnecting');
    const onReconnected = () => setLinkState('ok');
    r.on(RoomEvent.DataReceived, onData);
    r.on(RoomEvent.TrackSubscribed, bump);
    r.on(RoomEvent.TrackUnsubscribed, bump);
    r.on(RoomEvent.TrackPublished, onPub);
    r.on(RoomEvent.LocalTrackPublished, bump);
    r.on(RoomEvent.ParticipantConnected, onPeer);
    r.on(RoomEvent.ParticipantDisconnected, bump);
    r.on(RoomEvent.Reconnecting, onReconnecting);
    r.on(RoomEvent.Reconnected, onReconnected);
    ensureRemoteSubscribed(r);
    return () => {
      r.off(RoomEvent.DataReceived, onData);
      r.off(RoomEvent.TrackSubscribed, bump);
      r.off(RoomEvent.TrackUnsubscribed, bump);
      r.off(RoomEvent.TrackPublished, onPub);
      r.off(RoomEvent.LocalTrackPublished, bump);
      r.off(RoomEvent.ParticipantConnected, onPeer);
      r.off(RoomEvent.ParticipantDisconnected, bump);
      r.off(RoomEvent.Reconnecting, onReconnecting);
      r.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, handlePayload]);

  // Arka plandan dönüşte ses oturumu + yayınları toparla (iOS kopmalarını azaltır).
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      try { await AudioSession.startAudioSession(); } catch (e) { /* yoksay */ }
      try { await localParticipant?.setMicrophoneEnabled(mic); } catch (e) { /* yoksay */ }
      try { await localParticipant?.setCameraEnabled(cam); } catch (e) { /* yoksay */ }
      ensureRemoteSubscribed(roomRef.current);
    });
    return () => sub.remove();
  }, [localParticipant, mic, cam]);

  useEffect(() => {
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecs(left);
      if (left <= 0) {
        clearInterval(id);
        try { roomRef.current?.disconnect(); } catch (e) { /* yoksay */ }
        onHangupRef.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!chatOpen) {
      tipPulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tipPulse, { toValue: 0.28, duration: 850, useNativeDriver: true }),
        Animated.timing(tipPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); tipPulse.setValue(1); };
  }, [chatOpen, tipPulse]);

  const sendControl = (obj) => {
    try {
      roomRef.current?.localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify(obj)),
        { reliable: true, topic: 'control' },
      );
    } catch (e) { /* yoksay */ }
  };
  const extend = async () => {
    try {
      if (candidateUserId) await extendInterviewCall(candidateUserId, EXTEND_SECS);
    } catch (e) { /* peer duyurusu yine gider; DB yoksa en azından oturum uzar */ }
    endAtRef.current += EXTEND_SECS * 1000;
    setSecs((s) => s + EXTEND_SECS);
    sendControl({ type: 'extend', addSecs: EXTEND_SECS });
  };
  const toggleLock = (identity) => {
    setLockedSet((prev) => {
      const n = new Set(prev);
      const willLock = !n.has(identity);
      if (willLock) n.add(identity); else n.delete(identity);
      sendControl({ type: 'mute', target: identity, lock: willLock });
      return n;
    });
  };

  // Resmi LiveKit deseni: useTracks + isTrackReference.
  const remoteTracks = tracks.filter((tr) => (
    isTrackReference(tr)
    && tr.participant
    && !tr.participant.isLocal
    && !isCaptionAgent(tr.participant)
    && !!tr.publication?.track
  ));
  const localTrack = tracks.find((tr) => isTrackReference(tr) && tr.participant?.isLocal && tr.publication?.track);
  // Katılımcı geldi ama track henüz yoksa bekleyenleri göster.
  const remotesWaiting = (remoteParticipants || []).filter((p) => (
    p && !p.isLocal && !isCaptionAgent(p)
    && !remoteTracks.some((tr) => tr.participant.identity === p.identity)
  ));

  const low = secs <= 60;
  const labelFor = (p) => (p?.name === 'agency' ? t('role_agency') : (candidateLabel || t('role_candidate')));
  const win = Dimensions.get('window');
  const tileCount = Math.max(remoteTracks.length + remotesWaiting.length, 1);
  const tileLayout = (n, areaW, areaH) => {
    if (n <= 1) return { width: areaW, height: areaH };
    if (n === 2) return { width: areaW, height: Math.floor(areaH / 2) };
    return { width: Math.floor(areaW / 2), height: Math.floor(areaH / 2) };
  };

  const toggleMic = () => {
    if (lockedByHost) return;
    const v = !mic; setMic(v); localParticipant?.setMicrophoneEnabled(v);
  };
  const toggleCam = () => {
    const v = !cam; setCam(v); localParticipant?.setCameraEnabled(v);
  };
  const hangup = () => {
    try { roomRef.current?.disconnect(); } catch (e) { /* yoksay */ }
    onHangupRef.current?.();
  };

  const areaW = chatOpen ? remotePane.w : win.width;
  const areaH = chatOpen ? remotePane.h : win.height;
  const size = tileLayout(tileCount, areaW || win.width, areaH || win.height);
  const nobody = remoteTracks.length === 0 && remotesWaiting.length === 0;

  const renderRemotes = (containerStyle, zOrder = 0) => {
    if (nobody) {
      return (
        <View style={[containerStyle, styles.waitBox]}>
          <ActivityIndicator color={GOLD} />
          <Text style={styles.waitText}>{t('call_waiting')}</Text>
        </View>
      );
    }
    return (
      <View style={containerStyle}>
        {remoteTracks.map((tr) => (
          <View key={tr.participant.identity} style={[styles.tile, size]}>
            <VideoTrack
              trackRef={tr}
              style={{ width: size.width, height: size.height }}
              objectFit="cover"
              zOrder={zOrder}
            />
            {labelFor(tr.participant) ? (
              <View style={styles.tileTag}><Text style={styles.tileTagText} numberOfLines={1}>{labelFor(tr.participant)}</Text></View>
            ) : null}
            {isHost ? (
              <TouchableOpacity
                style={[styles.tileMute, lockedSet.has(tr.participant.identity) && styles.tileMuteOn]}
                onPress={() => toggleLock(tr.participant.identity)}
                activeOpacity={0.85}
              >
                <Text style={styles.tileMuteText}>{lockedSet.has(tr.participant.identity) ? '🔒' : '🔇'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        {remotesWaiting.map((p) => (
          <View key={p.identity} style={[styles.tile, size, styles.noCam]}>
            <Text style={styles.noCamIcon}>📷</Text>
            <Text style={styles.noCamText}>{labelFor(p)}</Text>
            <Text style={styles.noCamHint}>Bağlanıyor…</Text>
          </View>
        ))}
      </View>
    );
  };

  const chatBody = (
    <>
      <View style={styles.chatHead}>
        <Text style={styles.chatTitle}>{t('call_captions')}</Text>
        <TouchableOpacity onPress={() => setChatOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.chatClose}>✕</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={[styles.chatTip, { opacity: tipPulse }]}>
        <Text style={styles.chatTipText}>{t('call_captions_tip')}</Text>
      </Animated.View>
      {capDown ? <Text style={styles.chatCapDown}>⚠️ Altyazı şu an kullanılamıyor</Text> : null}
      <ScrollView
        ref={chatScrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatScrollContent}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd?.({ animated: true })}
      >
        {lines.length === 0 && !live ? (
          <Text style={styles.chatEmpty}>{t('call_captions_empty')}</Text>
        ) : null}
        {lines.map((l) => (
          <View key={l.id} style={styles.chatBubble}>
            {l.who ? <Text style={styles.chatWho}>{l.who}</Text> : null}
            <Text style={styles.chatText}>{l.text}</Text>
          </View>
        ))}
        {live ? (
          <View style={[styles.chatBubble, styles.chatBubbleLive]}>
            {live.who ? <Text style={styles.chatWho}>{live.who}</Text> : null}
            <Text style={[styles.chatText, styles.chatTextLive]}>{live.text}</Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );

  return (
    <View style={styles.stage}>
      <MediaBootstrap />

      {chatOpen ? (
        <View style={[styles.splitRow, { paddingTop: insets.top + 52, paddingBottom: insets.bottom + 92 }]}>
          <View style={styles.splitVideos}>
            <View
              style={styles.splitPane}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setRemotePane({ w: Math.floor(width), h: Math.floor(height) });
              }}
            >
              {renderRemotes(styles.gridFill, 0)}
            </View>
            <View
              style={[styles.splitPane, styles.splitLocal]}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                setLocalPane({ w: Math.floor(width), h: Math.floor(height) });
              }}
            >
              {localTrack && cam ? (
                <VideoTrack
                  trackRef={localTrack}
                  style={{ width: localPane.w || '100%', height: localPane.h || '100%' }}
                  objectFit="cover"
                  mirror
                  zOrder={1}
                />
              ) : (
                <View style={[styles.paneFill, styles.pipOff]}><Text style={styles.pipOffText}>📷</Text></View>
              )}
              <View style={styles.tileTag}><Text style={styles.tileTagText}>{t('call_you')}</Text></View>
            </View>
          </View>
          <View style={styles.splitChat}>
            {chatBody}
          </View>
        </View>
      ) : (
        <>
          {renderRemotes(nobody ? styles.remote : styles.grid, 0)}
          <TouchableOpacity
            style={[styles.pip, pipBig ? styles.pipBig : null, { top: insets.top + 60 }]}
            onPress={() => setPipBig((v) => !v)}
            activeOpacity={0.95}
          >
            {localTrack && cam ? (
              <VideoTrack trackRef={localTrack} style={styles.pipVideo} objectFit="cover" mirror zOrder={1} />
            ) : (
              <View style={[styles.pipVideo, styles.pipOff]}><Text style={styles.pipOffText}>📷</Text></View>
            )}
            <View style={styles.pipTag}><Text style={styles.pipTagText}>{t('call_you')}</Text></View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chatFab, { top: insets.top + 60 }]} onPress={() => setChatOpen(true)} activeOpacity={0.85}>
            <Text style={styles.chatFabText}>💬</Text>
          </TouchableOpacity>
        </>
      )}

      {linkState === 'reconnecting' ? (
        <View style={[styles.linkBanner, { top: insets.top + 8 }]}>
          <ActivityIndicator color="#1b2533" size="small" />
          <Text style={styles.linkBannerText}>{t('call_reconnecting')}</Text>
        </View>
      ) : null}

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

export default function InterviewCall({ visible, candidateUserId, groupId, candidateLabel, slotISO, onClose }) {
  const { t, lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [cred, setCred] = useState(null);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState(''); // '' | reconnecting | failed
  const [roomKey, setRoomKey] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const intentionalRef = useRef(false);
  const recoveringRef = useRef(false);
  const reconnectTries = useRef(0);
  const fetchCredRef = useRef(null);

  const leave = useCallback(() => {
    intentionalRef.current = true;
    onCloseRef.current?.();
  }, []);

  const fetchCred = useCallback(async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
    }
    await AudioSession.startAudioSession();
    const c = await getCallToken(groupId ? { groupId } : { candidateUserId }, langRef.current);
    const minutes = Number(c.minutes) || CALL_MINUTES;
    const extraSecs = Number(c.extraSecs) || 0;
    const endAtMs = c.endsAt
      ? new Date(c.endsAt).getTime()
      : (slotISO ? callEndAtMs(slotISO, { minutes, extraSecs }) : Date.now() + minutes * 60 * 1000);
    if (!(endAtMs > Date.now())) throw new Error(t('call_ended') || 'Mülakat süresi doldu');
    return { ...c, endAtMs, minutes, extraSecs };
  }, [candidateUserId, groupId, slotISO, t]);
  fetchCredRef.current = fetchCred;

  const start = useCallback(async () => {
    setError('');
    setBanner('');
    try {
      const c = await fetchCred();
      reconnectTries.current = 0;
      setCred(c);
    } catch (e) {
      setError(e?.message || 'error');
    }
  }, [fetchCred]);

  useEffect(() => {
    if (!visible) {
      intentionalRef.current = false;
      recoveringRef.current = false;
      reconnectTries.current = 0;
      setCred(null);
      setError('');
      setBanner('');
      return undefined;
    }
    intentionalRef.current = false;
    start();
    return () => { AudioSession.stopAudioSession().catch(() => {}); };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const recover = useCallback(async () => {
    if (intentionalRef.current || recoveringRef.current) return;
    recoveringRef.current = true;
    setBanner('reconnecting');
    setCred(null);
    try {
      for (let i = 0; i < 3; i += 1) {
        if (intentionalRef.current) return;
        try {
          const c = await fetchCredRef.current?.();
          if (intentionalRef.current || !c) return;
          reconnectTries.current = 0;
          setCred(c);
          setRoomKey((k) => k + 1);
          setBanner('');
          setError('');
          return;
        } catch (e) {
          await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
        }
      }
      if (!intentionalRef.current) {
        setBanner('failed');
        setError(t('call_reconnect_failed'));
      }
    } finally {
      recoveringRef.current = false;
    }
  }, [t]);

  const onDisconnected = useCallback(() => {
    if (intentionalRef.current) {
      onCloseRef.current?.();
      return;
    }
    recover();
  }, [recover]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={leave}>
      <View style={styles.wrap}>
        {error && !cred ? (
          <View style={styles.center}>
            <Text style={styles.errTitle}>{banner === 'failed' ? t('call_reconnect_failed') : t('call_error')}</Text>
            <Text style={styles.errMsg}>{error}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => { setError(''); start(); }} activeOpacity={0.85}>
              <Text style={styles.closeBtnText}>{t('call_retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.closeBtn, { marginTop: 12, backgroundColor: '#3a4554' }]} onPress={leave}>
              <Text style={styles.closeBtnText}>{t('consent_cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : !cred ? (
          <View style={styles.center}>
            <ActivityIndicator color={GOLD} size="large" />
            <Text style={styles.connecting}>{banner === 'reconnecting' ? t('call_reconnecting') : t('call_connecting')}</Text>
            <TouchableOpacity style={[styles.closeBtn, { marginTop: 24 }]} onPress={leave}><Text style={styles.closeBtnText}>{t('consent_cancel')}</Text></TouchableOpacity>
          </View>
        ) : (
          <LiveKitRoom
            key={roomKey}
            serverUrl={cred.url}
            token={cred.token}
            connect
            audio
            video
            options={{
              // livekit-client 2.19.2 RN black-video regressiyonu: tek PC yolu bozuk.
              singlePeerConnection: false,
              adaptiveStream: false,
              dynacast: false,
              publishDefaults: { simulcast: false },
            }}
            onDisconnected={onDisconnected}
            onError={(e) => {
              // Geçici hatalarda hemen kapatma; SDK reconnect dener.
              if (__DEV__) console.warn('LiveKit error', e?.message);
            }}
          >
            <CallStage
              onHangup={leave}
              candidateLabel={candidateLabel}
              candidateUserId={candidateUserId}
              endAtMs={cred.endAtMs}
              isHost={cred.role === 'agency'}
            />
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
  linkBanner: {
    position: 'absolute', left: 16, right: 16, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(194,162,90,0.95)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  linkBannerText: { color: '#1b2533', fontWeight: '800', fontSize: 13, flex: 1 },

  stage: { flex: 1, backgroundColor: '#000' },
  remote: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0b1119' },
  waitBox: { alignItems: 'center', justifyContent: 'center' },
  waitText: { color: '#8b95a3', fontSize: 14, fontWeight: '600', marginTop: 12 },
  grid: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#0b1119' },
  gridFill: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#0b1119', overflow: 'hidden' },
  paneFill: { ...StyleSheet.absoluteFillObject },
  splitRow: { flex: 1, flexDirection: 'row', gap: 3, backgroundColor: '#000' },
  splitVideos: { flex: 1, minWidth: 0, gap: 3 },
  splitPane: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#0b1119' },
  splitLocal: { borderTopWidth: 1, borderColor: 'rgba(194,162,90,0.25)' },
  splitChat: {
    width: '36%',
    maxWidth: 168,
    minWidth: 120,
    backgroundColor: 'rgba(10,14,20,0.96)',
    borderLeftWidth: 1,
    borderColor: 'rgba(194,162,90,0.35)',
  },
  tile: { backgroundColor: '#11161e', overflow: 'hidden' },
  noCam: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#151b24' },
  noCamIcon: { fontSize: 36, marginBottom: 8 },
  noCamText: { color: '#cbd2db', fontSize: 14, fontWeight: '700' },
  noCamHint: { color: '#6f7b8a', fontSize: 12, marginTop: 6, fontWeight: '600' },
  tileTag: { position: 'absolute', left: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  tileTagText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 8, zIndex: 6 },
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

  pip: { position: 'absolute', left: 14, width: 104, height: 150, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1b2533', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', zIndex: 5 },
  pipBig: { width: 180, height: 260 },
  pipVideo: { width: '100%', height: '100%' },
  pipOff: { alignItems: 'center', justifyContent: 'center' },
  pipOffText: { fontSize: 26 },
  pipTag: { position: 'absolute', bottom: 5, left: 5, right: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 7, paddingVertical: 2, alignItems: 'center' },
  pipTagText: { color: '#fff', fontSize: 10.5, fontWeight: '700' },

  chatHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  chatTitle: { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  chatTip: {
    marginHorizontal: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(194,162,90,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(194,162,90,0.28)',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  chatTipText: {
    color: 'rgba(232,214,170,0.92)',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    letterSpacing: 0.1,
  },
  chatClose: { color: '#9aa4b1', fontSize: 13, fontWeight: '800' },
  chatCapDown: { color: '#ffd9a8', fontSize: 10.5, fontWeight: '700', paddingHorizontal: 10, paddingTop: 6 },
  chatScroll: { flex: 1 },
  chatScrollContent: { padding: 10, paddingBottom: 14, gap: 8 },
  chatEmpty: { color: '#6f7b8a', fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  chatBubble: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7 },
  chatBubbleLive: { opacity: 0.75 },
  chatWho: { color: GOLD, fontSize: 10, fontWeight: '800', marginBottom: 2 },
  chatText: { color: '#fff', fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  chatTextLive: { color: '#d7dce3', fontStyle: 'italic', fontWeight: '500' },
  chatFab: { position: 'absolute', right: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(10,14,20,0.85)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  chatFabText: { fontSize: 18 },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 22, zIndex: 6 },
  ctrl: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(40,48,60,0.92)', alignItems: 'center', justifyContent: 'center' },
  ctrlOff: { backgroundColor: 'rgba(217,52,43,0.9)' },
  ctrlIcon: { fontSize: 22 },
  hangup: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#d9342b', alignItems: 'center', justifyContent: 'center' },
  hangupIcon: { color: '#fff', fontSize: 28, fontWeight: '800' },
});
