import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Room, RoomEvent, Track, ParticipantKind, VideoPresets } from 'livekit-client';
import { useLang } from '../i18n.jsx';
import {
  getCallToken, CALL_MINUTES, EXTEND_SECS, callEndAtMs, extendInterviewCall,
} from '../lib/interviews';

const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
const dec = (u8) => { try { return new TextDecoder().decode(u8); } catch { return ''; } };
const isCaptionAgent = (p) => p?.kind === ParticipantKind.Agent || /^(agent|AG_|caption)/i.test(p?.identity || '') || p?.name === 'agent';
function ensureRemoteSubscribed(room) {
  if (!room) return;
  for (const p of room.remoteParticipants.values()) {
    if (isCaptionAgent(p)) continue;
    for (const pub of p.trackPublications.values()) {
      if ((pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio) && !pub.isSubscribed) {
        try { pub.setSubscribed(true); } catch { /* yoksay */ }
      }
    }
  }
}

function cameraPub(p) {
  const pubs = Array.from(p.trackPublications?.values?.() || []);
  return pubs.find((x) => x.kind === 'video' && x.source === Track.Source.Camera && x.track) || pubs.find((x) => x.kind === 'video' && x.track);
}

const VideoTile = memo(function VideoTile({ participant, sig, label, mirror, isHost, locked, onToggleLock, audioHostRef }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; const pub = cameraPub(participant);
    if (el && pub?.track) pub.track.attach(el);
    let audioTrack = null;
    if (!participant.isLocal && audioHostRef?.current) {
      const apub = Array.from(participant.trackPublications.values()).find((x) => x.kind === 'audio' && x.track);
      if (apub?.track) { audioTrack = apub.track; const a = apub.track.attach(); audioHostRef.current.appendChild(a); }
    }
    return () => { if (el && pub?.track) pub.track.detach(el); if (audioTrack) audioTrack.detach().forEach((e) => e.remove()); };
  }, [participant, sig, audioHostRef]);
  const hasCam = !!cameraPub(participant);
  return (
    <div className="callTile">
      {hasCam ? <video ref={ref} autoPlay playsInline muted={participant.isLocal} className={`callVideo ${mirror ? 'mirror' : ''}`} />
        : <div className="callNoCam">📷</div>}
      {label ? <span className="callTag">{label}</span> : null}
      {isHost && !participant.isLocal ? (
        <button className={`callTileMute ${locked ? 'on' : ''}`} onClick={() => onToggleLock(participant.identity)} title="Sustur">{locked ? '🔒' : '🔇'}</button>
      ) : null}
    </div>
  );
});
const camSig = (p) => { const pub = cameraPub(p); return pub ? `${pub.trackSid || ''}:${pub.isMuted ? 'm' : 'a'}` : ''; };

export default function CallRoom({ candidateUserId, candidateLabel, slotISO, onClose }) {
  const { t, lang } = useLang();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [status, setStatus] = useState('connecting'); // connecting|connected|reconnecting|error
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [, force] = useState(0);
  const bump = useCallback(() => force((v) => v + 1), []);
  const [secs, setSecs] = useState(CALL_MINUTES * 60);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const [lines, setLines] = useState([]);
  const [live, setLive] = useState(null);
  const [capDown, setCapDown] = useState(false);
  const [pipBig, setPipBig] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [linkBanner, setLinkBanner] = useState(false);
  const chatScrollRef = useRef(null);
  const lastSeqRef = useRef(0);
  const idSeq = useRef(0);
  const [isHost, setIsHost] = useState(false);
  const [lockedByHost, setLockedByHost] = useState(false);
  const [lockedSet, setLockedSet] = useState(new Set());
  const audioHostRef = useRef(null);
  const roomRef = useRef(null);
  const intentionalRef = useRef(false);
  const recoveringRef = useRef(false);
  const connectGen = useRef(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const endAtRef = useRef(0);
  const candidateRef = useRef(candidateUserId);
  candidateRef.current = candidateUserId;
  const slotRef = useRef(slotISO);
  slotRef.current = slotISO;

  const hangup = useCallback(() => {
    intentionalRef.current = true;
    try { roomRef.current?.disconnect(); } catch { /* yoksay */ }
    onCloseRef.current?.();
  }, []);

  const bindRoomEvents = useCallback((r) => {
    const onData = (payload) => {
      let d; try { d = JSON.parse(dec(payload)); } catch { return; }
      if (!d) return;
      if (d.type === 'caption') {
        const who = d.role === 'agency' ? (t('role_agency') || 'Acente') : (candidateLabel || '');
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
        const id = `${d.seq || ''}-${idSeq.current++}`;
        setLines((prev) => [...prev, { id, who, text }].slice(-200));
        setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, 40);
      } else if (d.type === 'caption_status') {
        setCapDown(!d.ok);
      } else if (d.type === 'extend') {
        const add = d.addSecs || EXTEND_SECS;
        endAtRef.current += add * 1000;
        setSecs((s) => s + add);
      } else if (d.type === 'mute' && d.target === r.localParticipant?.identity) {
        if (d.lock) { r.localParticipant?.setMicrophoneEnabled(false); setMic(false); }
        setLockedByHost(!!d.lock);
      }
    };
    const onPub = (pub) => {
      try {
        if (pub?.kind === Track.Kind.Video || pub?.kind === Track.Kind.Audio) pub.setSubscribed?.(true);
      } catch { /* yoksay */ }
      bump();
    };
    const onPeer = (p) => {
      if (p && !isCaptionAgent(p)) {
        for (const pub of p.trackPublications.values()) {
          if ((pub.kind === Track.Kind.Video || pub.kind === Track.Kind.Audio) && !pub.isSubscribed) {
            try { pub.setSubscribed(true); } catch { /* yoksay */ }
          }
        }
      }
      bump();
    };
    r.on(RoomEvent.ParticipantConnected, onPeer).on(RoomEvent.ParticipantDisconnected, bump)
      .on(RoomEvent.TrackSubscribed, bump).on(RoomEvent.TrackUnsubscribed, bump)
      .on(RoomEvent.TrackMuted, bump).on(RoomEvent.TrackUnmuted, bump)
      .on(RoomEvent.TrackPublished, onPub)
      .on(RoomEvent.LocalTrackPublished, bump)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.Reconnecting, () => setLinkBanner(true))
      .on(RoomEvent.Reconnected, () => { setLinkBanner(false); bump(); });
  }, [bump, candidateLabel, t]);

  const connectOnce = useCallback(async (gen) => {
    try { roomRef.current?.disconnect(); } catch { /* yoksay */ }
    const r = new Room({
      adaptiveStream: false,
      dynacast: false,
      singlePeerConnection: false,
      publishDefaults: { simulcast: false, videoEncoding: VideoPresets.h360.encoding },
      disconnectOnPageLeave: false,
    });
    roomRef.current = r;
    bindRoomEvents(r);
    r.on(RoomEvent.Disconnected, () => {
      if (intentionalRef.current) {
        onCloseRef.current?.();
        return;
      }
      // SDK reconnect tükendi → üst katman recover eder (iç içe connect yok).
      setRoom(null);
      setLinkBanner(true);
      setStatus('reconnecting');
      window.dispatchEvent(new CustomEvent('turquz-call-drop', { detail: { gen } }));
    });

    const cred = await getCallToken(candidateRef.current, langRef.current);
    if (intentionalRef.current || connectGen.current !== gen) {
      try { r.disconnect(); } catch { /* yoksay */ }
      return;
    }
    setIsHost(cred.role === 'agency');
    const minutes = Number(cred.minutes) || CALL_MINUTES;
    const extraSecs = Number(cred.extraSecs) || 0;
    endAtRef.current = cred.endsAt
      ? new Date(cred.endsAt).getTime()
      : (slotRef.current ? callEndAtMs(slotRef.current, { minutes, extraSecs }) : Date.now() + minutes * 60 * 1000);
    if (!(endAtRef.current > Date.now())) throw new Error(t('call_ended') || 'Mülakat süresi doldu');
    setSecs(Math.max(1, Math.ceil((endAtRef.current - Date.now()) / 1000)));

    await r.connect(cred.url, cred.token);
    if (intentionalRef.current || connectGen.current !== gen) {
      try { r.disconnect(); } catch { /* yoksay */ }
      return;
    }
    try { await r.localParticipant.setCameraEnabled(true); }
    catch (e) { console.warn('Kamera açılamadı:', e?.message); setCam(false); }
    try { await r.localParticipant.setMicrophoneEnabled(true); }
    catch (e) { console.warn('Mikrofon açılamadı:', e?.message); setMic(false); }
    ensureRemoteSubscribed(r);
    setRoom(r);
    setStatus('connected');
    setLinkBanner(false);
    setError('');
    bump();
  }, [bindRoomEvents, bump, t]);

  useEffect(() => {
    intentionalRef.current = false;
    recoveringRef.current = false;
    const gen = ++connectGen.current;
    setStatus('connecting');
    setError('');
    const poll = setInterval(() => { ensureRemoteSubscribed(roomRef.current); bump(); }, 2000);

    const recover = async () => {
      if (intentionalRef.current || recoveringRef.current || connectGen.current !== gen) return;
      recoveringRef.current = true;
      setStatus('reconnecting');
      setLinkBanner(true);
      try {
        for (let i = 0; i < 3; i += 1) {
          if (intentionalRef.current || connectGen.current !== gen) return;
          try {
            await connectOnce(gen);
            return;
          } catch {
            await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
          }
        }
        if (!intentionalRef.current && connectGen.current === gen) {
          setError(t('call_reconnect_failed') || 'Bağlantı kurtarılamadı');
          setStatus('error');
        }
      } finally {
        recoveringRef.current = false;
      }
    };

    const onDrop = (ev) => {
      if (ev?.detail?.gen !== gen) return;
      recover();
    };
    window.addEventListener('turquz-call-drop', onDrop);

    (async () => {
      try {
        await connectOnce(gen);
      } catch (e) {
        if (!intentionalRef.current && connectGen.current === gen) {
          setError(e?.message || 'connection error');
          setStatus('error');
        }
      }
    })();
    return () => {
      connectGen.current += 1;
      intentionalRef.current = true;
      clearInterval(poll);
      window.removeEventListener('turquz-call-drop', onDrop);
      try { roomRef.current?.disconnect(); } catch { /* yoksay */ }
      roomRef.current = null;
    };
  }, [candidateUserId, slotISO]); // eslint-disable-line react-hooks/exhaustive-deps — lang değişince yeniden bağlanma

  useEffect(() => {
    if (status !== 'connected' && status !== 'reconnecting') return undefined;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setSecs(left);
      if (left <= 0) { clearInterval(id); hangup(); }
    }, 250);
    return () => clearInterval(id);
  }, [status, hangup]);

  // Sekme geri gelince yayınları tazele.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const r = roomRef.current;
      if (!r) return;
      ensureRemoteSubscribed(r);
      try { r.localParticipant?.setMicrophoneEnabled(mic); } catch { /* yoksay */ }
      try { r.localParticipant?.setCameraEnabled(cam); } catch { /* yoksay */ }
      bump();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [mic, cam, bump]);

  const sendControl = (obj) => { try { roomRef.current?.localParticipant?.publishData(enc(obj), { reliable: true, topic: 'control' }); } catch {} };
  const extend = async () => {
    try { await extendInterviewCall(candidateUserId, EXTEND_SECS); } catch { /* yoksay */ }
    endAtRef.current += EXTEND_SECS * 1000;
    setSecs((s) => s + EXTEND_SECS);
    sendControl({ type: 'extend', addSecs: EXTEND_SECS });
  };
  const toggleLock = useCallback((identity) => setLockedSet((prev) => {
    const n = new Set(prev);
    const willLock = !n.has(identity);
    if (willLock) n.add(identity); else n.delete(identity);
    sendControl({ type: 'mute', target: identity, lock: willLock });
    return n;
  }), []);
  const toggleMic = () => { if (lockedByHost) return; const v = !mic; setMic(v); roomRef.current?.localParticipant?.setMicrophoneEnabled(v); };
  const toggleCam = () => { const v = !cam; setCam(v); roomRef.current?.localParticipant?.setCameraEnabled(v); };

  const remotes = room ? Array.from(room.remoteParticipants.values()).filter((p) => !isCaptionAgent(p)) : [];
  const low = secs <= 60;
  const labelFor = (p) => (p?.name === 'agency' ? (t('role_agency') || 'Acente') : (candidateLabel || (t('role_candidate') || 'Aday')));

  return (
    <div className="callOverlay">
      <div ref={audioHostRef} style={{ display: 'none' }} />
      {status === 'error' ? (
        <div className="callCenter">
          <div className="callErrT">{t('call_error') || 'Görüşme başlatılamadı'}</div>
          <div className="callErrM">{error}</div>
          <button className="ghostBtn" onClick={() => {
            intentionalRef.current = false;
            recoveringRef.current = false;
            const gen = ++connectGen.current;
            setStatus('connecting');
            setError('');
            connectOnce(gen).catch((e) => { setError(e?.message || 'error'); setStatus('error'); });
          }}>{t('call_retry') || 'Tekrar dene'}</button>
          <button className="ghostBtn" onClick={onClose} style={{ marginTop: 10 }}>Kapat</button>
        </div>
      ) : status === 'connecting' || status === 'reconnecting' ? (
        <div className="callCenter">
          <div className="spinner" />
          <div className="callConnecting">{status === 'reconnecting' ? (t('call_reconnecting') || 'Yeniden bağlanıyor…') : (t('call_connecting') || 'Bağlanıyor…')}</div>
          <button className="ghostBtn" onClick={hangup} style={{ marginTop: 20 }}>Vazgeç</button>
        </div>
      ) : (
        <div className={`callStage ${chatOpen ? 'split' : ''}`}>
          {linkBanner ? (
            <div className="callLinkBanner">{t('call_reconnecting') || 'Yeniden bağlanıyor…'}</div>
          ) : null}
          {chatOpen ? (
            <div className="callSplit">
              <div className="callSplitVideos">
                <div className="callSplitPane">
                  {remotes.length === 0 ? (
                    <div className="callWaiting fill"><div className="spinner" /><div className="callWaitText">{t('call_waiting') || 'Karşı taraf bekleniyor…'}</div></div>
                  ) : (
                    <div className={`callGrid fill g${Math.min(remotes.length, 4)}`}>
                      {remotes.map((p) => (
                        <VideoTile key={p.identity} participant={p} sig={camSig(p)} label={labelFor(p)} isHost={isHost} locked={lockedSet.has(p.identity)} onToggleLock={toggleLock} audioHostRef={audioHostRef} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="callSplitPane local">
                  {room?.localParticipant && cam
                    ? <VideoTile participant={room.localParticipant} sig={camSig(room.localParticipant)} label={t('call_you') || 'Siz'} mirror />
                    : <div className="callPipOff">📷</div>}
                </div>
              </div>
              <aside className="callSplitPane chat">
                <div className="callChatHead">
                  <span>{t('call_captions') || 'Çeviri'}</span>
                  <button type="button" onClick={() => setChatOpen(false)}>✕</button>
                </div>
                <div className="callChatTip pulse">
                  {t('call_captions_tip') || 'Çevirinin doğru çalışması için lütfen yavaş ve tane tane konuşun.'}
                </div>
                {capDown ? <div className="callChatWarn">⚠️ Altyazı şu an kullanılamıyor</div> : null}
                <div className="callChatBody" ref={chatScrollRef}>
                  {!lines.length && !live ? <div className="callChatEmpty">{t('call_captions_empty') || 'Konuşmalar burada görünecek'}</div> : null}
                  {lines.map((l) => (
                    <div key={l.id} className="callChatBubble">
                      {l.who ? <div className="callChatWho">{l.who}</div> : null}
                      <div className="callChatText">{l.text}</div>
                    </div>
                  ))}
                  {live ? (
                    <div className="callChatBubble live">
                      {live.who ? <div className="callChatWho">{live.who}</div> : null}
                      <div className="callChatText">{live.text}</div>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          ) : (
            <>
              {remotes.length === 0 ? (
                <div className="callWaiting"><div className="spinner" /><div className="callWaitText">{t('call_waiting') || 'Karşı taraf bekleniyor…'}</div></div>
              ) : (
                <div className={`callGrid g${Math.min(remotes.length, 4)}`}>
                  {remotes.map((p) => (
                    <VideoTile key={p.identity} participant={p} sig={camSig(p)} label={labelFor(p)} isHost={isHost} locked={lockedSet.has(p.identity)} onToggleLock={toggleLock} audioHostRef={audioHostRef} />
                  ))}
                </div>
              )}
              <button type="button" className={`callPip ${pipBig ? 'big' : ''}`} onClick={() => setPipBig((v) => !v)} title="Büyüt / küçült">
                {room?.localParticipant && cam ? <VideoTile participant={room.localParticipant} sig={camSig(room.localParticipant)} label={t('call_you') || 'Siz'} mirror /> : <div className="callPipOff">📷</div>}
              </button>
              <button type="button" className="callChatFab" onClick={() => setChatOpen(true)} title="Çeviri">💬</button>
            </>
          )}

          <div className="callTop">
            <span className={`callTimer ${low ? 'low' : ''}`}>🎥 {mmss(secs)}</span>
            {isHost ? <button className="callExtend" onClick={extend}>{t('call_extend') || '+5 dk'}</button> : null}
          </div>

          <div className="callControls">
            <button className={`callCtrl ${!mic ? 'off' : ''} ${lockedByHost ? 'locked' : ''}`} onClick={toggleMic}>{lockedByHost ? '🔒' : (mic ? '🎤' : '🔇')}</button>
            <button className="callHangup" onClick={hangup}>✕</button>
            <button className={`callCtrl ${!cam ? 'off' : ''}`} onClick={toggleCam}>{cam ? '📷' : '🚫'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
