// screens/HomeScreen.js
// Ana sayfa: "Aday kartı" — otelin gördüğü görünümün birebir önizlemesi.
// Üstte kimlik (vesikalık + isim/ünvan + foto sayısı), altında 3'lü foto şeridi
// (vesikalık / boydan / yakın; dolu olana dokununca tam ekran açılır, boş olan
// "Ekle" / "⋯ Değiştir" ile fotoğraflar profilde güncellenir), en altta "CV'yi Gör" butonu.
// Kartın altında ileriki modüller (duyuru, asistan, mülakat) "Yakında" olarak listelenir.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Modal, Animated, Switch, Alert, ActivityIndicator, Pressable } from 'react-native';
import Svg, { Path, Polyline, Line } from 'react-native-svg';
import { LANGUAGES_SUPPORTED } from '../i18n/languages';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { WebView } from 'react-native-webview';
import { uploadIntroVideo, getIntroVideoUrl, removeIntroVideo, INTRO_VIDEO_MAX_SEC } from '../lib/introVideo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../i18n/LanguageContext';
import { nameOf } from '../i18n/languages';
import { listDocuments } from '../lib/documents';
import InterviewModal from '../components/InterviewModal';
import { getInterview } from '../lib/interviews';
import { callWindow, getCallWindowOpts } from '../lib/livekitCall';
import { supabase } from '../lib/supabase';
import NotificationBell from '../components/NotificationBell';
import PhotoWatermark from '../components/PhotoWatermark';
import { getCandidateStatus, docsUnlocked, reactivateCandidate, workInfo } from '../lib/candidate';
import { acceptOffer, rejectOffer } from '../lib/roles';
import { notifyOffer } from '../lib/push';
import { candidatePendingCount } from '../lib/pipeline';

// Modül satırı. onPress verilirse tıklanabilir (chevron), yoksa "Yakında" rozeti.
function LogoutIcon({ color = '#b5413a', size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="16 17 21 12 16 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function ModuleRow({ icon, label, soonLabel, last, onPress, rightExtra }) {
  const inner = (
    <>
      <Text style={styles.modIcon}>{icon}</Text>
      <Text style={styles.modLabel}>{label}</Text>
      {rightExtra}
      {onPress ? <Text style={styles.modChev}>›</Text> : <View style={styles.soonBadge}><Text style={styles.soonText}>{soonLabel}</Text></View>}
    </>
  );
  return onPress
    ? <TouchableOpacity style={[styles.modRow, !last && styles.modBorder]} onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
    : <View style={[styles.modRow, !last && styles.modBorder]}>{inner}</View>;
}

// Foto şeridi: dolu = görüntüle + ⋯ menü (değiştir); boş = yerinde ekle (CV'ye gitmez).
function PhotoCell({ uri, caption, addLabel, busy, onView, onAdd, onMenu }) {
  return (
    <View style={styles.cell}>
      {uri ? (
        <View style={styles.cellBox}>
          <TouchableOpacity activeOpacity={0.85} onPress={onView} onLongPress={onMenu} delayLongPress={280} style={StyleSheet.absoluteFill}>
            <Image source={{ uri }} style={styles.cellImg} resizeMode="cover" />
            <PhotoWatermark size={26} margin={6} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.videoCellMenu} onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.8}>
            <Text style={styles.videoCellMenuIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity activeOpacity={0.7} onPress={onAdd} disabled={busy} style={[styles.cellBox, styles.cellEmpty]}>
          {busy ? <ActivityIndicator color="#c2a25a" /> : (
            <>
              <Text style={styles.cellPlus}>＋</Text>
              <Text style={styles.cellAdd}>{addLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
      <Text style={styles.cellCap}>{caption}</Text>
    </View>
  );
}

async function optimizeHomePhoto(uri) {
  const actions = [{ resize: { width: 800 } }];
  try {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82, format: ImageManipulator.SaveFormat.WEBP, base64: true,
    });
    return `data:image/webp;base64,${out.base64}`;
  } catch {
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true,
    });
    return `data:image/jpeg;base64,${out.base64}`;
  }
}

// Galeride fotoğrafların yanında duran tanıtım videosu hücresi: ilk kare + ▶ rozet.
// Dokun -> tam ekran oynat; basılı tut -> değiştir/kaldır menüsü.
function VideoCell({ url, caption, onPlay, onMenu }) {
  return (
    <View style={styles.cell}>
      <View style={styles.cellBox}>
        <TouchableOpacity activeOpacity={0.85} onPress={onPlay} onLongPress={onMenu} delayLongPress={280} style={StyleSheet.absoluteFill}>
          {url ? (
            <View pointerEvents="none" style={styles.videoCellMedia}>
              <WebView
                source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;overflow:hidden"><video src="${url}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;background:#000"></video></body></html>` }}
                style={styles.videoCellMedia}
                originWhitelist={['*']}
                allowsInlineMediaPlayback
                scrollEnabled={false}
              />
            </View>
          ) : (
            <View style={[styles.videoCellMedia, styles.videoCellLoading]}><ActivityIndicator color="#c2a25a" /></View>
          )}
          <View style={styles.videoCellOverlay} pointerEvents="none">
            <View style={styles.videoCellBadge}><Text style={styles.videoCellPlay}>▶</Text></View>
          </View>
        </TouchableOpacity>
        {/* Görünür yönetim düğmesi: değiştir / kaldır */}
        <TouchableOpacity style={styles.videoCellMenu} onPress={onMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.8}>
          <Text style={styles.videoCellMenuIcon}>⋯</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cellCap}>{caption}</Text>
    </View>
  );
}

export default function HomeScreen({ data, userId, onPreview, onEdit, onOpenSettings, onOpenDocs, onLogout, onSaveData, fontsReady }) {
  const { t, lang, setLang } = useLanguage();
  const insets = useSafeAreaInsets();
  const [viewer, setViewer] = useState(null); // tam ekranda gösterilecek uri
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0); // ilerleme 0..1
  const [videoPhase, setVideoPhase] = useState(''); // '' | 'compress' | 'upload'
  const [videoError, setVideoError] = useState(''); // belirgin uyarı (ör. çok uzun)
  const [videoPlayUrl, setVideoPlayUrl] = useState(null); // tam ekran oynatma için imzalı url
  const [pendingVideo, setPendingVideo] = useState(''); // yüklendi ama henüz KAYDEDİLMEDİ (yol)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(''); // önizleme için imzalı url
  const [missingDocs, setMissingDocs] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false); // ⋮ menü (dil + çıkış)
  const [offerPending, setOfferPending] = useState(false); // acente teklif gönderdi, aday cevabı bekleniyor
  const [inProcess, setInProcess] = useState(false); // teklifi kabul etti, belge sürecinde
  const [offerBusy, setOfferBusy] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [ivPending, setIvPending] = useState(false); // adaya gönderilmiş, henüz seçilmemiş mülakat
  const [ivJoinable, setIvJoinable] = useState(false); // planlandı + katılım penceresi açık
  const [work, setWork] = useState({ hired: false }); // çalışma/personel durumu
  const [photoBusy, setPhotoBusy] = useState(null); // 'photo' | 'photoClose' | 'photoFull' | null
  const blink = useRef(new Animated.Value(1)).current;
  const ivBlink = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current; // spotlight radar nabzı

  // Durumu yükle: çalışma (personel) durumu + belge yükleme kapısı + eksik belge sayısı.
  const loadStatus = useCallback(async () => {
    const status = await getCandidateStatus(userId);
    setWork(workInfo(status));
    setOfferPending(status?.status === 'offered'); // bekleyen teklif var mı
    setInProcess(status?.status === 'accepted'); // kabul etti, belge sürecinde
    if (!docsUnlocked(status)) { setMissingDocs(0); return; }
    const rows = await listDocuments(userId);
    const have = new Set(rows.map((r) => r.kind));
    setMissingDocs(candidatePendingCount((k) => have.has(k)));
  }, [userId]);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Durum anlık değişsin (teklif gelince/değişince kart güncellensin).
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`home-status-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_status', filter: `user_id=eq.${userId}` }, () => loadStatus())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadStatus]);

  // Teklifi KABUL et -> belgeler açılır, acenteye bildirim.
  const doAcceptOffer = () => {
    Alert.alert(t('offer_card_title'), t('offer_accept_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('offer_accept'), onPress: async () => {
          setOfferBusy(true);
          try { await acceptOffer(); notifyOffer(userId, 'offer_accepted'); await loadStatus(); }
          catch (e) { Alert.alert(t('offer_card_title'), e?.message || 'error'); }
          finally { setOfferBusy(false); }
        } },
    ]);
  };

  // Teklifi REDDET -> havuza döner.
  const doRejectOffer = () => {
    Alert.alert(t('offer_card_title'), t('offer_reject_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('offer_reject'), style: 'destructive', onPress: async () => {
          setOfferBusy(true);
          try {
            const { data: st } = await supabase.from('candidate_status').select('accepted_by').eq('user_id', userId).maybeSingle();
            await rejectOffer();
            notifyOffer(userId, 'offer_rejected', st?.accepted_by);
            await loadStatus();
          }
          catch (e) { Alert.alert(t('offer_card_title'), e?.message || 'error'); }
          finally { setOfferBusy(false); }
        } },
    ]);
  };

  // Tekrar çalışmaya hazır: süreci sıfırla, havuza dön (CV kalır).
  const doReactivate = () => {
    Alert.alert(t('work_title'), t('work_reactivate_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('work_reactivate'), onPress: async () => {
          try { await reactivateCandidate(); await loadStatus(); }
          catch (e) { Alert.alert(t('work_title'), e?.message || 'error'); }
        } },
    ]);
  };

  // Eksik belge varsa uyarıyı sürekli yanıp söndür.
  useEffect(() => {
    if (missingDocs > 0) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 650, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    blink.setValue(1);
    return undefined;
  }, [missingDocs, blink]);

  // Bekleyen mülakat daveti / katılım penceresi. Anlık dinle.
  const loadInterview = useCallback(async () => {
    const iv = await getInterview(userId);
    setIvPending(iv?.status === 'proposed');
    if (iv?.status === 'scheduled' && iv.selectedSlot) {
      const opts = await getCallWindowOpts(iv);
      setIvJoinable(callWindow(iv.selectedSlot, opts).joinable);
    } else {
      setIvJoinable(false);
    }
  }, [userId]);
  useEffect(() => { loadInterview(); }, [loadInterview]);
  useEffect(() => {
    if (!userId) return undefined;
    const ch = supabase
      .channel(`home-iv-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interviews', filter: `user_id=eq.${userId}` }, () => loadInterview())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, loadInterview]);
  // Katılım penceresi saniyede bir yenilensin.
  useEffect(() => {
    const id = setInterval(() => { loadInterview(); }, 15000);
    return () => clearInterval(id);
  }, [loadInterview]);

  // Mülakat daveti / katıl penceresi: kutuyu yanıp söndür.
  useEffect(() => {
    if (ivPending || ivJoinable) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(ivBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(ivBlink, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
    ivBlink.setValue(1);
    return undefined;
  }, [ivPending, ivJoinable, ivBlink]);

  // Spotlight radar nabzı — sürekli (havuzda canlı olduğunuz hissi).
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2200, useNativeDriver: true }));
    pulse.setValue(0); loop.start();
    return () => loop.stop();
  }, [pulse]);

  const d = data || {};
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || t('home_cv_card');
  const subtitle = [d.title, nameOf(lang)].filter(Boolean).join(' · ');

  // Spotlight içeriği aşamaya göre: süreçte ise "süreç" mesajı, değilse "havuzda canlı".
  const spotData = inProcess
    ? { kicker: t('spotlight_proc_kicker'), title: t('spotlight_proc_title'), emoji: '🚀', coreIcon: '📋', sub: t('spotlight_proc_sub'), dot: '#5566d6' }
    : { kicker: t('spotlight_kicker'), title: t('spotlight_title'), emoji: '✨', coreIcon: '👁', sub: t('spotlight_sub'), dot: '#5fd08a' };
  const savedVideo = data?.introVideo || '';
  const showVideo = pendingVideo || savedVideo;   // önizlenecek yol (bekleyen öncelikli)
  const isPending = !!pendingVideo;               // yüklendi ama kaydedilmedi

  // Önizleme için imzalı URL (bekleyen ya da kayıtlı video).
  useEffect(() => {
    let alive = true;
    if (!showVideo) { setVideoPreviewUrl(''); return undefined; }
    getIntroVideoUrl(showVideo).then((u) => { if (alive) setVideoPreviewUrl(u || ''); });
    return () => { alive = false; };
  }, [showVideo]);

  // Seç + yükle -> KAYDETME, sadece önizlemeye al (Kaydet/Vazgeç çıkar).
  const pickVideo = async () => {
    setVideoError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('perm_needed'), t('perm_msg')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: INTRO_VIDEO_MAX_SEC,
        videoExportPreset: ImagePicker.VideoExportPreset?.Passthrough, // yeniden kodlama YOK -> hızlı + dikey/orijinal korunur
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      const a = res.assets[0];
      if (a.duration && a.duration > (INTRO_VIDEO_MAX_SEC + 0.5) * 1000) {
        setVideoError(t('intro_video_too_long', { n: INTRO_VIDEO_MAX_SEC })); return;
      }
      setVideoBusy(true);
      // 1) Sıkıştır (faststart, dikey, net). Sıkıştırıcı build'de yoksa orijinali yükle (çökmez).
      let uploadUri = a.uri;
      try {
        setVideoPhase('compress'); setVideoProgress(0);
        const { Video } = await import('react-native-compressor');
        uploadUri = await Video.compress(a.uri, { compressionMethod: 'manual', maxSize: 1920, bitrate: 6000000 }, (p) => setVideoProgress(p));
      } catch (ce) {
        console.warn('compressor yok, orijinal yükleniyor:', ce?.message);
        uploadUri = a.uri;
      }
      // 2) Akıtarak yükle.
      setVideoPhase('upload'); setVideoProgress(0);
      const prevPending = pendingVideo;
      const path = await uploadIntroVideo(userId, uploadUri, setVideoProgress);
      setPendingVideo(path);
      if (prevPending) removeIntroVideo(prevPending); // önceki bekleyeni temizle
    } catch (e) {
      Alert.alert(t('intro_video_label'), t('doc_upload_error'));
    } finally {
      setVideoBusy(false); setVideoPhase('');
    }
  };
  // Kaydet: bekleyeni profile yaz; varsa eski kayıtlıyı sil.
  const saveVideo = () => {
    if (!pendingVideo) return;
    const old = savedVideo;
    onSaveData?.({ introVideo: pendingVideo });
    setPendingVideo('');
    if (old && old !== pendingVideo) removeIntroVideo(old);
  };
  // Vazgeç: bekleyeni at (storage'dan da sil).
  const cancelVideo = () => {
    const p = pendingVideo;
    setPendingVideo('');
    if (p) removeIntroVideo(p);
  };
  const playVideo = async () => {
    if (!showVideo) return;
    const url = videoPreviewUrl || await getIntroVideoUrl(showVideo);
    if (url) setVideoPlayUrl(url);
  };
  // Videoyu sil: storage'dan kaldır + profilden temizle (kart yeniden "Video Ekle"ye döner).
  const doRemoveVideo = async () => {
    try { await removeIntroVideo(savedVideo); onSaveData?.({ introVideo: '' }); } catch (e) { /* yoksay */ }
  };
  const removeVideo = () => {
    Alert.alert(t('intro_video_label'), t('intro_video_remove_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('intro_video_remove'), style: 'destructive', onPress: doRemoveVideo },
    ]);
  };
  // Galerideki video hücresinin ⋯ düğmesi / basılı tut: değiştir / kaldır.
  const videoMenu = () => {
    Alert.alert(t('intro_video_label'), '', [
      { text: t('intro_video_change'), onPress: pickVideo },
      { text: t('intro_video_remove'), style: 'destructive', onPress: doRemoveVideo },
      { text: t('consent_cancel'), style: 'cancel' },
    ]);
  };

  const pickHomePhoto = async (field, aspect) => {
    if (!onSaveData || photoBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('perm_needed'), t('perm_msg'));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect, quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      setPhotoBusy(field);
      const optimized = await optimizeHomePhoto(res.assets[0].uri);
      onSaveData({ [field]: optimized });
    } catch (e) {
      Alert.alert(t('err_title'), t('err_photo'));
    } finally {
      setPhotoBusy(null);
    }
  };

  const photoMenu = (field, aspect, caption) => {
    Alert.alert(caption, '', [
      { text: t('photo_change'), onPress: () => pickHomePhoto(field, aspect) },
      { text: t('consent_cancel'), style: 'cancel' },
    ]);
  };

  const cells = [
    { field: 'photo', aspect: [1, 1], uri: d.photo, caption: t('photo_cap_id') },
    { field: 'photoClose', aspect: [3, 4], uri: d.photoClose, caption: t('photo_cap_close') },
    { field: 'photoFull', aspect: [3, 4], uri: d.photoFull, caption: t('photo_cap_full') },
  ];
  const photoCount = cells.filter((c) => c.uri).length;

  return (
    <View style={styles.wrap}>
      {/* Aurora hero — altın kicker + serif başlık */}
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroHi} numberOfLines={1}>{t('home_panel_sub')}</Text>
            <Text style={[styles.heroTitle, fontsReady && styles.heroTitleFont]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t('home_panel_title')}</Text>
          </View>
          <View style={styles.headerActions}>
          <NotificationBell userId={userId} color="#e7dcc4" onNavigate={(n) => {
            if (['reupload', 'document', 'accepted'].includes(n.type)) onOpenDocs?.();
            else if (n.type === 'interview_proposed' || n.type === 'interview_respond_remind' || String(n.type || '').startsWith('interview_reminder') || n.type === 'interview_scheduled') setInterviewOpen(true);
            // 'offer' -> teklif kartı zaten ana sayfada
          }} />
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.accent} />

      {/* ⋮ menü: dil + çıkış (acente ile aynı premium) */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable style={[styles.menuSheet, { paddingBottom: insets.bottom + 14 }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.menuHandle} />
            <View style={styles.menuBrand}>
              <Image source={require('../assets/turquz-logo.png')} style={styles.menuBrandLogo} resizeMode="contain" />
              <View style={styles.menuBrandRule} />
            </View>
            <Text style={styles.menuTitle}>{t('set_language')}</Text>
            <ScrollView style={styles.menuLangList} keyboardShouldPersistTaps="handled">
              {LANGUAGES_SUPPORTED.map((l) => (
                <TouchableOpacity key={l.code} style={[styles.menuLangRow, l.code === lang && styles.menuLangRowOn]} onPress={() => { setLang(l.code); setMenuOpen(false); }} activeOpacity={0.7}>
                  <Text style={[styles.menuLangName, l.code === lang && styles.menuLangNameOn]}>{l.name}</Text>
                  {l.code === lang ? <Text style={styles.menuCheck}>✓</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.menuSep} />
            <TouchableOpacity style={styles.menuLogout} onPress={() => { setMenuOpen(false); onLogout?.(); }} activeOpacity={0.85}>
              <View style={styles.menuLogoutIcon}><LogoutIcon color="#b5413a" size={18} /></View>
              <Text style={styles.menuLogoutText}>{t('set_logout')}</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.menuLogoutHint}>→</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 18, paddingBottom: insets.bottom + 24 }]}>
        {/* Bekleyen TEKLİF: aday kabul/ret verir. Kabul edene kadar belgeler açılmaz. */}
        {offerPending ? (
          <View style={styles.offerCard}>
            <Text style={styles.offerKicker}>📩 {t('offer_card_kicker')}</Text>
            <Text style={styles.offerCardTitle}>{t('offer_card_title')}</Text>
            <Text style={styles.offerCardDesc}>{t('offer_card_desc')}</Text>
            <View style={styles.offerBtns}>
              <TouchableOpacity style={styles.offerDecline} onPress={doRejectOffer} disabled={offerBusy} activeOpacity={0.85}>
                <Text style={styles.offerDeclineText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('offer_reject')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.offerAccept} onPress={doAcceptOffer} disabled={offerBusy} activeOpacity={0.9}>
                {offerBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.offerAcceptText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t('offer_accept')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Spotlight — havuzda canlı (pool) ya da süreçte; teklif/işe alım yokken */}
        {!work.hired && !offerPending ? (
          <View style={styles.spot}>
            <View style={styles.spotRadar}>
              <Animated.View style={[styles.spotRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.1] }) }] }]} />
              <Animated.View style={[styles.spotRing, styles.spotRing2, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }) }] }]} />
              <View style={styles.spotCore}><Text style={styles.spotEye}>{spotData.coreIcon}</Text></View>
            </View>
            <View style={styles.spotBody}>
              <View style={styles.spotKickerRow}>
                <View style={[styles.spotLiveDot, { backgroundColor: spotData.dot }]} />
                <Text style={styles.spotKicker} numberOfLines={1}>{spotData.kicker}</Text>
              </View>
              <Text style={styles.spotTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{spotData.title} {spotData.emoji}</Text>
              <Text style={styles.spotSub} numberOfLines={1}>{spotData.sub}</Text>
            </View>
          </View>
        ) : null}

        {/* Çalışma / personel durumu */}
        {work.hired ? (
          <View style={styles.workCard}>
            <View style={styles.workAccent} />
            <Text style={styles.workKicker}>🚀 {t('career_started')}</Text>
            <View style={styles.workRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.workActive}>{t('work_active')}</Text>
                {work.end ? (
                  <Text style={styles.workSub}>{t('work_until', { date: `${String(work.end.getDate()).padStart(2, '0')}.${String(work.end.getMonth() + 1).padStart(2, '0')}.${work.end.getFullYear()}` })}</Text>
                ) : null}
              </View>
              <Switch value={!work.expired} onValueChange={doReactivate} trackColor={{ true: '#c2a25a', false: '#3a4a5e' }} thumbColor="#fff" />
            </View>
            {work.expired ? (
              <View style={styles.workExpired}>
                <Text style={styles.workExpiredText}>{t('work_expired')}</Text>
                <TouchableOpacity style={styles.workReBtn} onPress={doReactivate} activeOpacity={0.9}>
                  <Text style={styles.workReText}>{t('work_reactivate')}  →</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Aday kartı */}
        <View style={styles.card}>
          {/* Kimlik satırı */}
          <View style={styles.cardHead}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => (d.photo
                ? photoMenu('photo', [1, 1], t('photo_cap_id'))
                : pickHomePhoto('photo', [1, 1]))}
              disabled={!!photoBusy}
            >
              {d.photo ? (
                <Image source={{ uri: d.photo }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  {photoBusy === 'photo'
                    ? <ActivityIndicator color="#c2a25a" />
                    : <Text style={styles.avatarIcon}>👤</Text>}
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.cardId}>
              <Text style={[styles.name, fontsReady && styles.nameFont]} numberOfLines={2}>{fullName}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
              <Text style={styles.count}>📷 {photoCount} {t('photo_unit')}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Foto + video galerisi — tanıtım videosu en başta (en solda) */}
          <View style={styles.strip}>
            {savedVideo && !isPending ? (
              <VideoCell
                url={videoPreviewUrl}
                caption={t('intro_video_cap')}
                onPlay={playVideo}
                onMenu={videoMenu}
              />
            ) : null}
            {cells.map((c) => (
              <PhotoCell
                key={c.field}
                uri={c.uri}
                caption={c.caption}
                addLabel={t('photo_add')}
                busy={photoBusy === c.field}
                onView={() => setViewer(c.uri)}
                onAdd={() => pickHomePhoto(c.field, c.aspect)}
                onMenu={() => photoMenu(c.field, c.aspect, c.caption)}
              />
            ))}
          </View>

          {/* CV'yi Gör — video bölümünün ÜSTÜNDE */}
          <TouchableOpacity style={styles.cvBtn} onPress={onPreview} activeOpacity={0.85}>
            <Text style={styles.cvBtnText}>{t('home_view_cv')}  →</Text>
          </TouchableOpacity>

          {/* Tanıtım videosu — premium sinema paneli.
              Kaydedilip boştayken kart gizlenir; video yukarıda galeride görünür. */}
          {(videoBusy || videoError || isPending || !savedVideo) ? (
          <View style={styles.videoCard}>
            <View style={styles.videoHead}>
              <View style={styles.videoIconCircle}><Text style={styles.videoIcon}>🎬</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.videoKicker} numberOfLines={1}>{t('intro_video_label')}</Text>
                <Text style={styles.videoSubtitle} numberOfLines={1}>{t('intro_video_subtitle', { n: INTRO_VIDEO_MAX_SEC })}</Text>
              </View>
            </View>

            {videoError ? (
              <View style={styles.videoWarn}>
                <Text style={styles.videoWarnIcon}>⚠</Text>
                <Text style={styles.videoWarnText}>{videoError}</Text>
              </View>
            ) : null}

            {videoBusy ? (
              <View style={styles.videoUploading}>
                <View style={styles.videoBarTrack}><View style={[styles.videoBarFill, { width: `${Math.max(4, Math.round(videoProgress * 100))}%` }]} /></View>
                <Text style={styles.videoUploadingText}>{videoPhase === 'compress' ? t('intro_video_processing') : t('intro_video_uploading')}  %{Math.round(videoProgress * 100)}</Text>
              </View>
            ) : showVideo ? (
              <>
                {/* Dikey önizleme (oynatılabilir) + tam ekran */}
                <View style={styles.videoPreview}>
                  {videoPreviewUrl ? (
                    <WebView
                      source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000"><video src="${videoPreviewUrl}" controls playsinline preload="metadata" style="width:100%;height:100%;object-fit:contain;background:#000"></video></body></html>` }}
                      style={{ flex: 1, backgroundColor: '#000' }}
                      originWhitelist={['*']}
                      allowsInlineMediaPlayback
                      mediaPlaybackRequiresUserAction
                      scrollEnabled={false}
                    />
                  ) : (
                    <View style={styles.videoPreviewLoading}><ActivityIndicator color="#9a7b1f" /></View>
                  )}
                  {isPending ? <View style={styles.videoPendingTag}><Text style={styles.videoPendingText}>{t('intro_video_unsaved')}</Text></View> : null}
                  <TouchableOpacity style={styles.videoFsBtn} onPress={playVideo} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.videoFsIcon}>⛶</Text>
                  </TouchableOpacity>
                </View>

                {isPending ? (
                  <View style={styles.videoActions}>
                    <TouchableOpacity style={styles.videoCancelBtn} onPress={cancelVideo} activeOpacity={0.85}>
                      <Text style={styles.videoCancelText}>{t('intro_video_cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.videoSaveBtn} onPress={saveVideo} activeOpacity={0.9}>
                      <Text style={styles.videoSaveText}>✓  {t('intro_video_save')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.videoSaved}>
                    <Text style={styles.videoSavedLabel}>✓ {t('intro_video_saved_label')}</Text>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity onPress={pickVideo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                      <Text style={styles.videoLink}>{t('intro_video_change')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.videoLinkSep}>·</Text>
                    <TouchableOpacity onPress={removeVideo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                      <Text style={[styles.videoLink, { color: '#a32d2d' }]}>{t('intro_video_remove')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.videoMotiv}>{t('intro_video_motiv')}</Text>
                <View style={styles.videoFullbody}>
                  <Text style={styles.videoFullbodyIcon}>🧍</Text>
                  <Text style={styles.videoFullbodyText}>{t('intro_video_fullbody')}</Text>
                </View>
                <TouchableOpacity style={styles.videoCta} onPress={pickVideo} activeOpacity={0.9}>
                  <Text style={styles.videoCtaText}>{t('intro_video_add')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          ) : null}
        </View>

        {/* Hızlı erişim ikon ızgarası */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.gridTile} onPress={onOpenDocs} activeOpacity={0.85}>
            <View style={styles.gridIconWrap}><Text style={styles.gridIcon}>🗂️</Text></View>
            <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('home_documents')}</Text>
            {missingDocs > 0 ? (
              <Animated.View style={[styles.gridBadge, { opacity: blink }]}><Text style={styles.gridBadgeText}>{missingDocs}</Text></Animated.View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridTile} onPress={() => setInterviewOpen(true)} activeOpacity={0.85}>
            <View style={styles.gridIconWrap}><Text style={styles.gridIcon}>🎥</Text></View>
            <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('home_interviews')}</Text>
            {(ivPending || ivJoinable) ? (
              <Animated.View style={[styles.gridBadge, styles.gridBadgeGold, { opacity: ivBlink }]}><Text style={styles.gridBadgeText}>{ivJoinable ? '▶' : '!'}</Text></Animated.View>
            ) : null}
          </TouchableOpacity>

          <View style={[styles.gridTile, styles.gridTileSoon]}>
            <View style={styles.gridIconWrap}><Text style={styles.gridIcon}>📢</Text></View>
            <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('home_announcements')}</Text>
            <View style={styles.gridSoon}><Text style={styles.gridSoonText}>{t('soon')}</Text></View>
          </View>

          <View style={[styles.gridTile, styles.gridTileSoon]}>
            <View style={styles.gridIconWrap}><Text style={styles.gridIcon}>💬</Text></View>
            <Text style={styles.gridLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('home_assistant')}</Text>
            <View style={styles.gridSoon}><Text style={styles.gridSoonText}>{t('soon')}</Text></View>
          </View>
        </View>
      </ScrollView>

      {/* Tam ekran foto görüntüleyici */}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <TouchableOpacity style={styles.viewerOverlay} activeOpacity={1} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImg} resizeMode="contain" /> : null}
          {viewer ? <PhotoWatermark size={46} margin={16} /> : null}
          <View style={styles.viewerClose}><Text style={styles.viewerCloseText}>✕</Text></View>
        </TouchableOpacity>
      </Modal>

      {/* Tanıtım videosu oynatıcı (WebView + HTML5 video) */}
      <Modal visible={!!videoPlayUrl} transparent animationType="fade" onRequestClose={() => setVideoPlayUrl(null)}>
        <View style={styles.videoModalWrap}>
          <View style={[styles.videoModalHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity onPress={() => setVideoPlayUrl(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.videoModalX}>✕</Text>
            </TouchableOpacity>
          </View>
          {videoPlayUrl ? (
            <WebView
              source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><video src="${videoPlayUrl}" controls autoplay playsinline style="max-width:100%;max-height:100vh"></video></body></html>` }}
              style={{ flex: 1, backgroundColor: '#000' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
            />
          ) : null}
        </View>
      </Modal>

      <InterviewModal
        visible={interviewOpen}
        role="candidate"
        userId={userId}
        fontsReady={fontsReady}
        onClose={() => { setInterviewOpen(false); loadInterview(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f3ec' },
  hero: { paddingLeft: 22, paddingRight: 16, paddingBottom: 22, backgroundColor: '#16202e', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 8, zIndex: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroHi: { color: '#c2a25a', fontSize: 11, fontWeight: '800', letterSpacing: 2.5, marginBottom: 4, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: 0.3 },
  heroTitleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  menuDots: { fontSize: 26, color: '#e7dcc4', fontWeight: '900', marginTop: -4 },

  // ⋮ menü (acente ile aynı)
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(8,12,20,0.45)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: '#fbf8f1', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 18, paddingTop: 12 },
  menuHandle: { alignSelf: 'center', width: 44, height: 4.5, borderRadius: 3, backgroundColor: '#e0d6bd', marginBottom: 6 },
  menuBrand: { alignItems: 'center', paddingTop: 10, paddingBottom: 14 },
  menuBrandLogo: { width: 128, height: 88 },
  menuBrandRule: { width: 46, height: 2.5, borderRadius: 2, backgroundColor: '#c2a25a', marginTop: 12, opacity: 0.85 },
  menuTitle: { fontSize: 12, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8, marginLeft: 6 },
  menuLangList: { maxHeight: 300 },
  menuLangRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 13, marginBottom: 3 },
  menuLangRowOn: { backgroundColor: '#f3ecdc' },
  menuLangName: { fontSize: 16, fontWeight: '600', color: '#2a3342' },
  menuLangNameOn: { fontWeight: '800', color: '#9a7b1f' },
  menuCheck: { fontSize: 16, fontWeight: '900', color: '#c2a25a' },
  menuSep: { height: 1, backgroundColor: '#ece4d2', marginTop: 10, marginBottom: 6, marginHorizontal: 4 },
  menuLogout: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#fff', shadowColor: '#16202e', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  menuLogoutIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fbeae8', alignItems: 'center', justifyContent: 'center' },
  menuLogoutText: { color: '#1b2533', fontWeight: '800', fontSize: 15 },
  menuLogoutHint: { color: '#c9a9a4', fontSize: 19, fontWeight: '800' },

  // Hızlı erişim ikon ızgarası
  grid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  gridTile: { flex: 1, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 4, alignItems: 'center', gap: 8, shadowColor: '#16202e', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  gridTileSoon: { opacity: 0.6 },
  gridIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#f3ecdc', alignItems: 'center', justifyContent: 'center' },
  gridIcon: { fontSize: 22 },
  gridLabel: { fontSize: 11, fontWeight: '700', color: '#1b2533', textAlign: 'center' },
  gridBadge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#b5413a', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  gridBadgeGold: { backgroundColor: '#c2a25a' },
  gridBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  gridSoon: { position: 'absolute', top: 8, right: 6, backgroundColor: '#ece4d2', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  gridSoonText: { fontSize: 8.5, fontWeight: '800', color: '#9a7b1f' },

  // Spotlight — havuzda canlı
  spot: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#16202e', borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: '#c2a25a', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  spotRadar: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  spotRing: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#c2a25a' },
  spotRing2: { borderColor: '#dcc187' },
  spotCore: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(194,162,90,0.18)', borderWidth: 1.5, borderColor: '#c2a25a', alignItems: 'center', justifyContent: 'center' },
  spotEye: { fontSize: 22 },
  spotBody: { flex: 1 },
  spotKickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  spotLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5fd08a' },
  spotKicker: { color: '#dcc187', fontSize: 10.5, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  spotTitle: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  spotSub: { color: '#9fb0c4', fontSize: 12.5, fontWeight: '500', lineHeight: 17, marginTop: 3 },

  // Tanıtım videosu kartı
  videoCard: { backgroundColor: '#16202e', borderRadius: 20, padding: 18, marginTop: 14, shadowColor: '#c2a25a', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  videoHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  videoIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(194,162,90,0.16)', borderWidth: 1.5, borderColor: '#c2a25a', alignItems: 'center', justifyContent: 'center' },
  videoIcon: { fontSize: 20 },
  videoKicker: { fontSize: 15.5, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  videoSubtitle: { fontSize: 10.5, fontWeight: '800', color: '#dcc187', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 3 },
  videoOkBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e7f3ec', alignItems: 'center', justifyContent: 'center' },
  videoOkText: { color: '#1f8a4c', fontSize: 12, fontWeight: '900' },
  videoMotiv: { fontSize: 12.5, color: '#a8b6c8', fontWeight: '500', lineHeight: 18, marginBottom: 12 },
  videoFullbody: {
    flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16,
    backgroundColor: 'rgba(194,162,90,0.13)', borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
    borderRadius: 12, paddingVertical: 11, paddingHorizontal: 12,
  },
  videoFullbodyIcon: { fontSize: 18 },
  videoFullbodyText: { flex: 1, color: '#e7cf93', fontWeight: '800', fontSize: 12.5, lineHeight: 17 },
  videoCta: { backgroundColor: '#c2a25a', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#a8842f', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  videoCtaText: { color: '#16202e', fontWeight: '800', fontSize: 15 },
  videoActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoPreview: { alignSelf: 'center', width: 174, height: 309, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', marginBottom: 14, borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)' },
  videoPreviewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  videoFsBtn: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  videoFsIcon: { color: '#fff', fontSize: 16, fontWeight: '900' },
  videoWarn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#c0392b', borderRadius: 13, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: '#e05b4d' },
  videoWarnIcon: { fontSize: 18 },
  videoWarnText: { flex: 1, color: '#fff', fontWeight: '800', fontSize: 13.5, lineHeight: 18 },
  videoUploading: { paddingVertical: 8 },
  videoBarTrack: { height: 8, borderRadius: 4, backgroundColor: '#283648', overflow: 'hidden' },
  videoBarFill: { height: '100%', backgroundColor: '#c2a25a', borderRadius: 4 },
  videoUploadingText: { fontSize: 12, color: '#dcc187', fontWeight: '800', marginTop: 8, textAlign: 'center' },
  videoSaved: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoSavedLabel: { fontSize: 12.5, fontWeight: '800', color: '#5fd08a' },
  videoLink: { fontSize: 13, fontWeight: '800', color: '#dcc187' },
  videoLinkSep: { color: '#56657a', fontSize: 13 },
  videoPendingTag: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(194,162,90,0.95)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  videoPendingText: { color: '#16202e', fontSize: 10.5, fontWeight: '800' },
  videoCancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  videoCancelText: { color: '#cdd6e2', fontWeight: '800', fontSize: 13.5 },
  videoSaveBtn: { flex: 2, backgroundColor: '#1f8a4c', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  videoSaveText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  videoPlayBtn: { flex: 1, backgroundColor: '#16202e', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  videoPlayText: { color: '#fff', fontWeight: '800', fontSize: 13.5 },
  videoSmallBtn: { paddingHorizontal: 10, paddingVertical: 11 },
  videoSmallText: { color: '#9a7b1f', fontWeight: '800', fontSize: 12.5 },
  videoAddBtn: { backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 13, alignItems: 'center', shadowColor: '#a8842f', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  videoAddText: { color: '#16202e', fontWeight: '800', fontSize: 14.5 },
  videoModalWrap: { flex: 1, backgroundColor: '#000' },
  videoModalHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#000' },
  videoModalX: { color: '#fff', fontSize: 24, fontWeight: '800' },
  content: { paddingHorizontal: 22 },

  // --- Üst başlık (acente paneliyle aynı) ---
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 18, paddingBottom: 14, backgroundColor: '#1b2533', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5, zIndex: 2 },
  headerLogo: { width: 96, height: 60 },
  titleBox: { marginLeft: 6, marginRight: 14, flexShrink: 1 },
  acente: { color: '#c2a25a', fontSize: 27, fontWeight: '800' },
  acenteFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  acenteSub: { color: '#9aa4b1', fontSize: 10.5, fontWeight: '700', letterSpacing: 1.8, marginTop: 1, textTransform: 'uppercase' },
  accent: { height: 3, backgroundColor: '#c2a25a', zIndex: 2 },
  settingsIcon: { fontSize: 22, color: '#e7dcc4' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },

  // --- Çalışma / personel kartı ---
  workCard: { backgroundColor: '#1b2533', borderRadius: 18, padding: 18, marginBottom: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  workAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, backgroundColor: '#c2a25a' },
  workKicker: { color: '#c2a25a', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  workRow: { flexDirection: 'row', alignItems: 'center' },
  workActive: { color: '#fff', fontSize: 18, fontWeight: '800' },
  workSub: { color: '#9aa4b1', fontSize: 13, fontWeight: '600', marginTop: 3 },
  workExpired: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 },
  workExpiredText: { color: '#e8b5b0', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  workReBtn: { backgroundColor: '#c2a25a', borderRadius: 11, paddingVertical: 13, alignItems: 'center' },
  workReText: { color: '#1b2533', fontWeight: '800', fontSize: 15 },

  // --- Teklif kartı (kabul/ret) ---
  offerCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#d6e0ec', shadowColor: '#1b2533', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  offerKicker: { color: '#1f3a63', fontSize: 11.5, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  offerCardTitle: { color: '#1b2533', fontSize: 18, fontWeight: '800' },
  offerCardDesc: { color: '#5a5a6b', fontSize: 13.5, fontWeight: '500', lineHeight: 20, marginTop: 6 },
  offerBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  offerDecline: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  offerDeclineText: { color: '#a32d2d', fontWeight: '800', fontSize: 14 },
  offerAccept: { flex: 2, backgroundColor: '#1f3a63', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  offerAcceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // --- Grup mülakatı daveti ---
  grpCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#eadfc2', shadowColor: '#1b2533', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  grpKicker: { color: '#9a7b1f', fontSize: 11.5, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  grpWhen: { color: '#1b2533', fontSize: 16, fontWeight: '800' },
  grpBtns: { flexDirection: 'row', gap: 10, marginTop: 14 },
  grpDecline: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  grpDeclineText: { color: '#a32d2d', fontWeight: '800', fontSize: 14 },
  grpAccept: { flex: 2, backgroundColor: '#1f8a4c', borderRadius: 11, paddingVertical: 12, alignItems: 'center' },
  grpAcceptText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  grpDeclinedNote: { color: '#a32d2d', fontWeight: '700', fontSize: 13, marginTop: 10 },
  grpAcceptedNote: { color: '#1f8a4c', fontWeight: '800', fontSize: 14, marginTop: 10 },
  grpJoinBtn: { backgroundColor: '#1f8a4c', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  grpJoinText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  // --- Aday kartı ---
  card: {
    backgroundColor: '#fff', borderRadius: 22, padding: 18, marginTop: 8,
    shadowColor: '#1b2533', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 4,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#e9ebee' },
  avatarPlaceholder: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: '#1b2533', alignItems: 'center', justifyContent: 'center',
  },
  avatarIcon: { fontSize: 30 },
  cardId: { flex: 1, marginLeft: 14 },
  name: { fontSize: 21, fontWeight: '800', color: '#1b2533' },
  nameFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  subtitle: { fontSize: 13, color: '#737373', marginTop: 3 },
  count: { fontSize: 12.5, color: '#c2a25a', fontWeight: '700', marginTop: 6 },

  divider: { height: 1, backgroundColor: '#eef0f2', marginVertical: 16 },

  strip: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  cellBox: { width: '100%', aspectRatio: 0.78, borderRadius: 14, overflow: 'hidden', backgroundColor: '#eef0f2' },
  cellImg: { width: '100%', height: '100%' },
  cellEmpty: {
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#c2a25a', borderStyle: 'dashed', backgroundColor: '#fafbfc',
  },
  cellPlus: { fontSize: 24, color: '#c2a25a', fontWeight: '700' },
  cellAdd: { fontSize: 11.5, color: '#c2a25a', fontWeight: '700', marginTop: 2 },
  cellCap: { fontSize: 11.5, color: '#9aa1ac', fontWeight: '600', textAlign: 'center', marginTop: 6 },
  // Galerideki tanıtım videosu hücresi (foto hücreleriyle aynı boy: cell + cellBox)
  videoCellMedia: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoCellLoading: { alignItems: 'center', justifyContent: 'center' },
  videoCellOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  videoCellBadge: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  videoCellPlay: { color: '#fff', fontSize: 13, marginLeft: 2 },
  videoCellMenu: {
    position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  videoCellMenuIcon: { color: '#fff', fontSize: 16, fontWeight: '900', marginTop: -4 },

  cvBtn: { marginTop: 16, backgroundColor: '#c2a25a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  cvBtnText: { color: '#1b2533', fontSize: 15, fontWeight: '800' },

  docsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#1b2533', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  docsIcon: { fontSize: 20, marginRight: 12 },
  docsLabel: { flex: 1, fontSize: 15, color: '#1b2533', fontWeight: '700' },
  docsChev: { fontSize: 22, color: '#c2a25a', fontWeight: '700', marginLeft: 8 },
  missBadge: { marginLeft: 8 },
  missBadgeText: { fontSize: 12.5, fontWeight: '800', color: '#a32d2d', backgroundColor: '#fbeaea', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, overflow: 'hidden' },

  modList: { marginTop: 26, borderTopWidth: 0.5, borderTopColor: '#dfe2e7' },
  modRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  modBorder: { borderBottomWidth: 0.5, borderBottomColor: '#dfe2e7' },
  modIcon: { fontSize: 20, marginRight: 14 },
  modLabel: { flex: 1, fontSize: 15, color: '#1b2533' },
  soonBadge: { backgroundColor: '#eef0f2', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
  soonText: { fontSize: 11, fontWeight: '700', color: '#9aa1ac' },
  modChev: { fontSize: 22, color: '#c2a25a', fontWeight: '700' },
  ivBadge: { backgroundColor: '#d24b40', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, marginRight: 8 },
  ivBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // --- Tam ekran görüntüleyici ---
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: 50, right: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  viewerCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
