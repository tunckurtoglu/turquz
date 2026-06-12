// screens/AgencyCandidateScreen.js
// Acente — aday detayı. İki sekme:
//  CV: 3 fotoğraf + maskeli CV önizleme (+ Teklif Gönder).
//  Belgeler: adayın yüklediği belgeleri gör/indir + acenta belgesi (sözleşme/bilet) yükle + aşama.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, RefreshControl, FlatList, Dimensions, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLanguage } from '../i18n/LanguageContext';
import CVPreview from './CVPreview';
import ContractForm from '../components/ContractForm';
import ContractPreview from '../components/ContractPreview';
import FlightForm from '../components/FlightForm';
import FlightPreview from '../components/FlightPreview';
import InterviewModal from '../components/InterviewModal';
import TranscriptModal from '../components/TranscriptModal';
import { WebView } from 'react-native-webview';
import PhotoWatermark from '../components/PhotoWatermark';
import { offerCandidate, withdrawCandidate } from '../lib/roles';
import { candidateCode, maskedName } from '../lib/candidateCode';
import { listDocuments, uploadDocument, getSignedUrl, removeAllDocuments, removeDocument, submitDocuments, requestReupload } from '../lib/documents';
import { getContract, saveContract, deleteContract } from '../lib/contracts';
import { getFlight, saveFlight, deleteFlight } from '../lib/flights';
import { supabase } from '../lib/supabase';
import { notifyDocument } from '../lib/push';
import { PIPELINE, kindState, activeStep } from '../lib/pipeline';
import { getInterview, fromISO } from '../lib/interviews';
import { getIntroVideoUrl } from '../lib/introVideo';

// Tanzim/teklif tarihi: bugünün "gg/aa/yyyy" hali
function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

async function readableJpeg(uri) {
  const out = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
    compress: 0.9, format: ImageManipulator.SaveFormat.JPEG, base64: true,
  });
  return out.base64;
}

export default function AgencyCandidateScreen({ candidate, agencyUserId, accepted, offered: offeredProp, onBack, onAccepted, fontsReady }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [busy, setBusy] = useState(false);
  const [isAccepted, setIsAccepted] = useState(!!accepted);
  const [offered, setOffered] = useState(!!offeredProp); // teklif gitti, aday cevabı bekleniyor
  const [hasInterview, setHasInterview] = useState(false); // bu adayla mülakat YAPILDI mı (transcript butonu için)
  const offerBlink = useRef(new Animated.Value(1)).current;
  const [viewer, setViewer] = useState(null);
  const [viewerPdf, setViewerPdf] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null); // foto galeri (kaydırmalı) açık indeks
  const [introVideoUrl, setIntroVideoUrl] = useState(''); // adayın tanıtım videosu (imzalı url)
  const [videoPlay, setVideoPlay] = useState(false);      // tam ekran video oynatıcı
  const [tab, setTab] = useState('cv');
  const [docs, setDocs] = useState({});
  const [uploading, setUploading] = useState(null);
  const [contract, setContract] = useState(null); // sözleşme verisi (acentenin doldurduğu)
  const [formVisible, setFormVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sending, setSending] = useState(false);  // "Belgeleri Gönder" sırasında
  const [flight, setFlight] = useState(null);     // uçuş bilgisi (acentenin doldurduğu)
  const [flightForm, setFlightForm] = useState(false);
  const [flightPrev, setFlightPrev] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  // Tüm adımlar (sözleşme dâhil) DOSYA ile tamamlanır. isUploaded: satır var (taslak da olabilir).
  // isSubmitted: gönderilmiş (karşı tarafa geçmiş). İmzalı sözleşme de bir belgedir artık.
  const isUploaded = (k) => !!docs[k];
  const isSubmitted = (k) => !!docs[k]?.submitted_at;
  // Akış GÖNDERİLEN belgeyle ilerler; karşı taraf taslağı görmez.
  const has = isSubmitted;
  // Kabul edilmeden Belgeler sekmesi yok; her zaman CV göster.
  const activeTab = isAccepted ? tab : 'cv';

  // Bu adayla mülakat YAPILDI mı? (slot seçilmiş + zamanı geçmiş) -> Konuşma Kaydı butonu o zaman çıkar.
  useEffect(() => {
    let alive = true;
    (async () => {
      const iv = await getInterview(candidate?.user_id);
      const chosen = iv?.selectedSlot;
      const done = !!(chosen && new Date(fromISO(chosen)).getTime() < Date.now());
      if (alive) setHasInterview(done);
    })();
    return () => { alive = false; };
  }, [candidate?.user_id]);

  // Teklif beklerken kutu yanıp sönsün (cevap gelene kadar).
  useEffect(() => {
    if (!offered) { offerBlink.setValue(1); return undefined; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(offerBlink, { toValue: 0.35, duration: 650, useNativeDriver: true }),
      Animated.timing(offerBlink, { toValue: 1, duration: 650, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [offered, offerBlink]);

  const data = candidate?.data || {};
  const code = candidateCode(data.nationality, candidate?.reg_no);

  const photos = [
    { uri: data.photoClose, cap: t('photo_cap_close') },
    { uri: data.photoFull, cap: t('photo_cap_full') },
    { uri: data.photo, cap: t('photo_cap_id') },
  ].filter((p) => p.uri);

  // Tanıtım videosu: storage yolundan imzalı oynatma URL'i çöz (galeride göster).
  useEffect(() => {
    let alive = true;
    const path = data?.introVideo;
    if (!path) { setIntroVideoUrl(''); return undefined; }
    getIntroVideoUrl(path).then((u) => { if (alive) setIntroVideoUrl(u || ''); });
    return () => { alive = false; };
  }, [data?.introVideo]);

  const refreshDocs = useCallback(async () => {
    const [rows, con, fl] = await Promise.all([listDocuments(candidate.user_id), getContract(candidate.user_id), getFlight(candidate.user_id)]);
    const map = {};
    rows.forEach((r) => { map[r.kind] = r; });
    setDocs(map);
    setContract(con);
    setFlight(fl);
  }, [candidate]);

  useEffect(() => { refreshDocs(); }, [refreshDocs]);

  // Elle yenile (aşağı çek).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshDocs(); } finally { setRefreshing(false); }
  }, [refreshDocs]);

  // ANLIK yansıma: adayın belge/sözleşme/uçuş değişikliklerini realtime dinle.
  // (Supabase'de realtime açık olmalı — bkz. 0020_realtime.sql. Değilse aşağı çekerek yenile.)
  useEffect(() => {
    const uid = candidate?.user_id;
    if (!uid) return undefined;
    const ch = supabase
      .channel(`cand-docs-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_documents', filter: `user_id=eq.${uid}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts', filter: `user_id=eq.${uid}` }, () => refreshDocs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flights', filter: `user_id=eq.${uid}` }, () => refreshDocs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [candidate?.user_id, refreshDocs]);

  // "Sözleşme Oluştur" -> formu aç (varsa düzenle).
  const openContractForm = () => setFormVisible(true);

  // "Teklif Gönder" -> adaya TEKLİF gider. Belgeler/sözleşme AÇILMAZ; aday kabul edene kadar bekler.
  const acceptOffer = () => {
    Alert.alert(t('agency_offer'), `${t('agency_offer')}?`, [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('agency_offer'),
        onPress: async () => {
          setBusy(true);
          try {
            await offerCandidate(candidate.user_id);
            setOffered(true);
            onAccepted?.(); // listeleri tazele (durum 'offered' oldu)
          } catch (e) {
            Alert.alert(t('agency_offer'), e?.message || 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // Form: sözleşme BİLGİLERİNİ kaydet (KABUL ETMEZ). İmza+gönderim Belgeler adımında.
  const saveContractData = async (fields) => {
    try {
      const issueDate = contract?.issueDate || todayStr();
      const full = { ...fields, issueDate };
      await saveContract(candidate.user_id, full, agencyUserId);
      setContract(full);
    } catch (e) {
      Alert.alert(t('contract_form_title'), e?.message || 'error');
    }
  };

  // İmzalı sözleşmeyi GÖNDER: belgeyi gönderildi işaretle + adayı KABUL ET + bildir.
  // Bu an, teklifin resmî olarak gittiği andır; sonrası adayın sürecidir.
  const sendSignedContract = () => {
    if (!docs.contract_unsigned) return;
    Alert.alert(t('docs_send_confirm_title'), t('docs_send_confirm_msg'), [
      { text: t('docs_send_review'), style: 'cancel' },
      {
        text: t('docs_send'),
        onPress: async () => {
          setBusy(true);
          try {
            // Bu aşamaya yalnız aday teklifi KABUL ettikten sonra gelinir (isAccepted=true).
            const rows = await submitDocuments(candidate.user_id, ['contract_unsigned']);
            setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
            setIsAccepted(true);
            notifyDocument(candidate.user_id, 'contract_unsigned');
            onAccepted?.();
          } catch (e) {
            Alert.alert(t('contract_form_title'), e?.message || 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // Sözleşme önizlemesini aç (WebView + PDF paylaş).
  const viewContractPdf = () => setPreviewVisible(true);

  const withdrawOffer = () => {
    Alert.alert(t('agency_withdraw'), t('agency_withdraw_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      {
        text: t('agency_withdraw'),
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeAllDocuments(candidate.user_id);
            await deleteContract(candidate.user_id);
            await deleteFlight(candidate.user_id);
            await withdrawCandidate(candidate.user_id);
            setDocs({});
            setContract(null);
            setFlight(null);
            setIsAccepted(false);
            setOffered(false);
            onAccepted?.(); // havuz/durumları tazele
          } catch (e) {
            Alert.alert(t('agency_withdraw'), e?.message || 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const viewDoc = async (kind) => {
    const row = docs[kind];
    if (!row) return;
    try {
      const url = await getSignedUrl(row.storage_path, 120);
      setViewerPdf((row.mime_type || '').includes('pdf') || (row.storage_path || '').toLowerCase().endsWith('.pdf'));
      setViewer(url);
    } catch (e) {
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    }
  };

  const uploadAgencyDoc = async (kind) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert(t('perm_needed'), t('perm_msg')); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 1 });
      if (res.canceled || !res.assets || !res.assets.length) return;
      setUploading(kind);
      const base64 = await readableJpeg(res.assets[0].uri);
      const row = await uploadDocument(candidate.user_id, kind, base64, 'image/jpeg');
      setDocs((m) => ({ ...m, [kind]: row }));
      // Not: adaya bildirim YÜKLEMEDE değil, "Belgeleri Gönder"de gider (submitStep).
    } catch (e) {
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    } finally {
      setUploading(null);
    }
  };

  // Taslak acente belgesini kaldır (gönderilmeden önce).
  const removeAgencyDoc = async (kind) => {
    const row = docs[kind];
    if (!row) return;
    setUploading(kind);
    try {
      await removeDocument(candidate.user_id, kind, row.storage_path);
      setDocs((m) => { const n = { ...m }; delete n[kind]; return n; });
    } catch (e) {
      Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
    } finally {
      setUploading(null);
    }
  };

  // Uçuş adımı: bilgileri kaydet + bileti gönder (submit) + adaya bildir. Form içinden çağrılır.
  const submitFlight = async (fields) => {
    setSending(true);
    try {
      await saveFlight(candidate.user_id, fields, agencyUserId);
      const rows = await submitDocuments(candidate.user_id, ['flight_ticket']);
      setFlight(fields);
      setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
      notifyDocument(candidate.user_id, 'flight_ticket');
      setFlightForm(false);
    } catch (e) {
      Alert.alert(t('flight_form_title'), e?.message || 'error');
    } finally {
      setSending(false);
    }
  };

  // "Belgeleri Gönder": adımın yüklü belgelerini adaya ilet (onaylı). Gönderince adım kilitlenir.
  // Acente: adayın gönderdiği belgeyi beğenmedi -> tekrar iste (silinir + adaya bildirim).
  const doRequestReupload = (kind) => {
    Alert.alert(t('reupload_btn'), t('reupload_confirm'), [
      { text: t('agency_cancel'), style: 'cancel' },
      { text: t('reupload_btn'), style: 'destructive', onPress: async () => {
          try { await requestReupload(candidate.user_id, kind); await refreshDocs(); }
          catch (e) { Alert.alert(t('reupload_btn'), e?.message || 'error'); }
        } },
    ]);
  };

  const submitStep = (s) => {
    const kinds = s.kinds.filter((k) => k !== 'contract_unsigned' && docs[k]);
    if (!kinds.length) return;
    Alert.alert(t('docs_send_confirm_title'), t('docs_send_confirm_msg'), [
      { text: t('docs_send_review'), style: 'cancel' },
      {
        text: t('docs_send'),
        onPress: async () => {
          setSending(true);
          try {
            const rows = await submitDocuments(candidate.user_id, kinds);
            setDocs((m) => { const n = { ...m }; rows.forEach((r) => { n[r.kind] = r; }); return n; });
            kinds.forEach((k) => notifyDocument(candidate.user_id, k)); // adaya "belge geldi"
          } catch (e) {
            Alert.alert(t('agency_tab_docs'), t('doc_upload_error'));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  };

  // Aday tarafıyla aynı düzen: PIPELINE adım kartları (sahip etiketi + alt satırlar).
  // Perspektif acente: "mine" = acentenin yükleyeceği adım.
  const StepCard = ({ s }) => {
    const mine = s.owner === 'agency';
    const act = activeStep(has);
    const mode = s.kinds.every(has) ? 'done' : s.step === act ? 'active' : 'locked';
    // Adaydan gelen tamamlanmış adım: gri "Tamamlandı" değil, belirgin "geldi".
    const candidateDone = mode === 'done' && !mine;
    const cardStyle = mode === 'active' ? [styles.stepCard, mine ? styles.prowYou : styles.prowOther]
      : candidateDone ? [styles.stepCard, styles.prowOther]
        : mode === 'done' ? [styles.stepCard, styles.cardDone]
          : [styles.stepCard, styles.cardLocked];
    const circleStyle = candidateDone ? styles.circleOther : mode === 'done' ? styles.circleDone : mode === 'active' ? (mine ? styles.circleYou : styles.circleOther) : styles.circleLocked;
    return (
      <View style={cardStyle}>
        <View style={styles.stepHead}>
          <View style={[styles.stepNo, circleStyle]}><Text style={styles.stepNoText}>{mode === 'done' && mine ? '✓' : s.step}</Text></View>
          {candidateDone ? (
            <View style={[styles.ownerChip, styles.ownerOther]}><Text style={[styles.ownerChipText, styles.ownerOtherText]}>{t('doc_from_candidate')}</Text></View>
          ) : mode === 'done' ? (
            <Text style={styles.doneLabel}>✓ {mine ? t('doc_sent') : t('doc_done_label')}</Text>
          ) : (
            <View style={[styles.ownerChip, mode === 'locked' ? styles.ownerMuted : mine ? styles.ownerYou : styles.ownerOther]}>
              <Text style={[styles.ownerChipText, mode === 'locked' ? styles.ownerMutedText : mine ? styles.ownerYouText : styles.ownerOtherText]}>{mine ? t('doc_owner_agency') : t('doc_owner_candidate')}</Text>
            </View>
          )}
        </View>

        {s.kinds.map((kind) => {
          // İmzalı Hizmet Sözleşmesi (acente): bilgileri doldur -> önizle/indir -> imzalı yükle -> gönder.
          if (kind === 'contract_unsigned') {
            // Kilitli (aday henüz pasaportunu göndermedi): sözleşme açılmaz.
            if (mode === 'locked') {
              return (
                <View key={kind} style={styles.subRow}>
                  <View style={styles.subMain}>
                    <Text style={styles.subBullet}>🔒</Text>
                    <Text style={[styles.subLabel, styles.subLabelMuted]}>{t('doc_contract_unsigned')}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.lockedHint}>{t('doc_wait_passport')}</Text>
                  </View>
                </View>
              );
            }
            const up2 = isUploaded('contract_unsigned');
            const sent = isSubmitted('contract_unsigned');
            const cbusy = uploading === 'contract_unsigned';
            return (
              <View key={kind} style={styles.subRow}>
                <View style={styles.subMain}>
                  <Text style={[styles.subBullet, (sent || up2) && styles.subBulletDone]}>{(sent || up2) ? '✓' : '•'}</Text>
                  <Text style={[styles.subLabel, mode === 'locked' && styles.subLabelMuted]}>{t('doc_contract_unsigned')}</Text>
                  {up2 && !sent ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                  <View style={{ flex: 1 }} />
                  {sent ? (
                    <TouchableOpacity onPress={() => viewDoc('contract_unsigned')}><Text style={styles.linkView}>{t('doc_view')}</Text></TouchableOpacity>
                  ) : !up2 ? (
                    <TouchableOpacity style={styles.addBtnSm} onPress={() => uploadAgencyDoc('contract_unsigned')} disabled={cbusy} activeOpacity={0.8}>
                      {cbusy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.addBtnText}>{t('contract_upload')}</Text>}
                    </TouchableOpacity>
                  ) : null}
                </View>
                {up2 && !sent ? (
                  <>
                    <View style={styles.subLinks}>
                      <TouchableOpacity style={styles.changeBtn} onPress={() => viewDoc('contract_unsigned')} activeOpacity={0.85}>
                        <Text style={styles.changeBtnText}>👁 {t('doc_view')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.changeBtn} onPress={() => uploadAgencyDoc('contract_unsigned')} disabled={cbusy} activeOpacity={0.85}>
                        <Text style={styles.changeBtnText}>✎ {t('photo_change')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.changeBtn} onPress={() => removeAgencyDoc('contract_unsigned')} activeOpacity={0.85}>
                        <Text style={[styles.changeBtnText, styles.removeText]}>🗑 {t('photo_remove')}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={[styles.sendBtn, busy && { opacity: 0.6 }]} onPress={sendSignedContract} disabled={busy} activeOpacity={0.9}>
                      {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sendBtnText}>{t('docs_send')}  →</Text>}
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            );
          }
          const kst = kindState(kind, has);
          const busy = uploading === kind;
          // Uçuş kendi formuyla yönetilir; genel taslak/gönder akışı dışında.
          const draft = mine && kind !== 'flight_ticket' && isUploaded(kind) && !isSubmitted(kind);
          const muteLabel = mode === 'locked' || (mode === 'done' && mine);
          return (
            <View key={kind} style={styles.subRow}>
              <View style={styles.subMain}>
                <Text style={[styles.subBullet, (kst === 'done' || draft) && styles.subBulletDone]}>{(kst === 'done' || draft) ? '✓' : '•'}</Text>
                <Text style={[styles.subLabel, muteLabel && styles.subLabelMuted]}>{t(`doc_${kind}`)}</Text>
                {draft ? <View style={styles.draftBadge}><Text style={styles.draftText}>{t('doc_draft')}</Text></View> : null}
                <View style={{ flex: 1 }} />
                {kst === 'done' && kind === 'flight_ticket' ? (
                  <View style={styles.viewLinks}>
                    <TouchableOpacity onPress={() => setFlightPrev(true)}><Text style={styles.linkView}>{t('flight_info_title')}</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => viewDoc(kind)}><Text style={styles.linkView}>{t('doc_view')}</Text></TouchableOpacity>
                  </View>
                ) : kst === 'done' ? (
                  <View style={styles.viewLinks}>
                    <TouchableOpacity onPress={() => (kind === 'contract_unsigned' ? viewContractPdf() : viewDoc(kind))}>
                      <Text style={styles.linkView}>{t('doc_view')}</Text>
                    </TouchableOpacity>
                    {!mine ? (
                      <TouchableOpacity onPress={() => doRequestReupload(kind)}>
                        <Text style={styles.linkReject}>{t('reupload_btn')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : draft ? (
                  <TouchableOpacity onPress={() => viewDoc(kind)}>
                    <Text style={styles.linkView}>{t('doc_view')}</Text>
                  </TouchableOpacity>
                ) : kst === 'active' && mine ? (
                  <TouchableOpacity style={styles.addBtnSm} onPress={() => (kind === 'contract_unsigned' ? setFormVisible(true) : kind === 'flight_ticket' ? setFlightForm(true) : uploadAgencyDoc(kind))} disabled={busy} activeOpacity={0.8}>
                    {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.addBtnText}>{t('doc_upload')}</Text>}
                  </TouchableOpacity>
                ) : kst === 'locked' ? (
                  <Text style={styles.lockedIcon}>🔒</Text>
                ) : null}
              </View>
              {draft ? (
                <View style={styles.subLinks}>
                  <TouchableOpacity style={styles.changeBtn} onPress={() => uploadAgencyDoc(kind)} activeOpacity={0.85}>
                    <Text style={styles.changeBtnText}>✎ {t('photo_change')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.changeBtn} onPress={() => removeAgencyDoc(kind)} activeOpacity={0.85}>
                    <Text style={[styles.changeBtnText, styles.removeText]}>🗑 {t('photo_remove')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Belgeleri Gönder: sıra acentede + adımın tüm (dosya) belgeleri yüklü (taslak).
            Sözleşme ve uçuş kendi formlarıyla gönderildiği için bu genel butonun dışında. */}
        {mode === 'active' && mine && !s.kinds.includes('contract_unsigned') && !s.kinds.includes('flight_ticket') && s.kinds.every((k) => isUploaded(k)) ? (
          <TouchableOpacity style={[styles.sendBtn, sending && { opacity: 0.6 }]} onPress={() => submitStep(s)} disabled={sending} activeOpacity={0.9}>
            {sending ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.sendBtnText}>{t('docs_send')}  →</Text>}
          </TouchableOpacity>
        ) : null}

        {mode === 'active' && !mine ? (
          <View style={styles.waitBanner}><Text style={styles.waitBannerText}>⏳ {t('doc_candidate_turn')}</Text></View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backChevron}>{backChevron}</Text>
        </TouchableOpacity>
        <View style={styles.titleBox}>
          <Text style={[styles.title, fontsReady && styles.titleFont]} numberOfLines={1}>{maskedName(data) || code}</Text>
          <Text style={styles.titleCode} numberOfLines={1}>{code}</Text>
        </View>
        {isAccepted ? (
          <TouchableOpacity style={[styles.withdrawBtn, busy && styles.dim]} onPress={withdrawOffer} disabled={busy}>
            {busy ? <ActivityIndicator color="#a32d2d" /> : <Text style={styles.withdrawText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('agency_withdraw')}</Text>}
          </TouchableOpacity>
        ) : offered ? (
          <TouchableOpacity style={[styles.withdrawBtn, busy && styles.dim]} onPress={withdrawOffer} disabled={busy}>
            {busy ? <ActivityIndicator color="#a32d2d" /> : <Text style={styles.withdrawText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('offer_withdraw_btn')}</Text>}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.offerBtn, busy && styles.dim]} onPress={acceptOffer} disabled={busy}>
            {busy ? <ActivityIndicator color="#1b2533" /> : <Text style={styles.offerText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('agency_offer')}</Text>}
          </TouchableOpacity>
        )}
      </View>

      {/* Teklif bekleniyor: tam genişlik, yanıp sönen bilgi şeridi (cevap gelene kadar) */}
      {offered ? (
        <Animated.View style={[styles.offerBanner, { opacity: offerBlink }]}>
          <Text style={styles.offerBannerText}>⏳ {t('offer_sent_note')}</Text>
        </Animated.View>
      ) : null}

      {/* Mülakat planla hep erişilebilir; Konuşma Kaydı YALNIZCA mülakat yapıldıysa */}
      <View style={styles.interviewBar}>
        <TouchableOpacity style={styles.interviewBtn} onPress={() => setInterviewOpen(true)} activeOpacity={0.85}>
          <Text style={styles.interviewBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>🎥 {t('iv_propose_title')}</Text>
        </TouchableOpacity>
        {hasInterview ? (
          <TouchableOpacity style={styles.transcriptBtn} onPress={() => setTranscriptOpen(true)} activeOpacity={0.85}>
            <Text style={styles.transcriptBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>📝 {t('transcript_btn')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Sekmeler — yalnızca teklif gönderildikten sonra (CV ve Belgeler birlikte) */}
      {isAccepted ? (
        <View style={styles.tabs}>
          {['cv', 'docs'].map((tk) => (
            <TouchableOpacity key={tk} style={[styles.tab, activeTab === tk && styles.tabOn]} onPress={() => { setTab(tk); if (tk === 'docs') refreshDocs(); }} activeOpacity={0.8}>
              <Text style={[styles.tabText, activeTab === tk && styles.tabTextOn]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{tk === 'cv' ? t('agency_tab_cv') : t('agency_tab_docs')}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {activeTab === 'cv' ? (
        <View style={styles.body}>
          {(photos.length || data.introVideo) ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
              {data.introVideo ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => introVideoUrl && setVideoPlay(true)} style={styles.thumbBox}>
                  <View style={styles.thumbWrap}>
                    {introVideoUrl ? (
                      <View pointerEvents="none" style={styles.thumb}>
                        <WebView
                          source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;overflow:hidden"><video src="${introVideoUrl}" muted playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover;background:#000"></video></body></html>` }}
                          style={styles.thumb}
                          originWhitelist={['*']}
                          allowsInlineMediaPlayback
                          scrollEnabled={false}
                        />
                      </View>
                    ) : (
                      <View style={[styles.thumb, styles.thumbVideoLoading]}><ActivityIndicator color="#c2a25a" /></View>
                    )}
                    <View style={styles.thumbVideoOverlay} pointerEvents="none">
                      <View style={styles.thumbVideoBadge}><Text style={styles.thumbVideoPlay}>▶</Text></View>
                    </View>
                  </View>
                  <Text style={styles.thumbCap}>{t('intro_video_cap')}</Text>
                </TouchableOpacity>
              ) : null}
              {photos.map((p, i) => (
                <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setGalleryIndex(i)} style={styles.thumbBox}>
                  <View style={styles.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={styles.thumb} resizeMode="cover" />
                    <PhotoWatermark size={24} margin={6} />
                  </View>
                  <Text style={styles.thumbCap}>{p.cap}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          {isAccepted ? (
            <View style={styles.cvActions}>
              {has('passport') ? (
                <TouchableOpacity style={styles.contractBtn} onPress={openContractForm} activeOpacity={0.85}>
                  <Text style={styles.contractBtnText}>📄 {t('contract_create')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.contractWait}>
                  <Text style={styles.contractWaitText}>🔒 {t('doc_wait_passport')}</Text>
                </View>
              )}
            </View>
          ) : null}
          <View style={styles.cv}><CVPreview data={data} masked candidateNo={code} /></View>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.docsContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c2a25a" colors={['#c2a25a']} />}
        >
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.ownerChip, styles.ownerYou]}><Text style={[styles.ownerChipText, styles.ownerYouText]}>{t('doc_owner_agency')}</Text></View>
              <Text style={styles.legendText}>{t('doc_legend_agency_does')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.ownerChip, styles.ownerOther]}><Text style={[styles.ownerChipText, styles.ownerOtherText]}>{t('doc_owner_candidate')}</Text></View>
              <Text style={styles.legendText}>{t('doc_legend_candidate_does')}</Text>
            </View>
          </View>
          {PIPELINE.map((s) => <StepCard key={s.step} s={s} />)}
        </ScrollView>
      )}

      <Modal visible={!!viewer} animationType="slide" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewerWrap}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.viewerTitle}>{t('doc_view')}</Text>
            <TouchableOpacity onPress={() => setViewer(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}><Text style={styles.viewerX}>✕</Text></TouchableOpacity>
          </View>
          {viewerPdf ? (
            viewer ? <WebView source={{ uri: viewer }} style={styles.viewerBody} originWhitelist={['*']} /> : null
          ) : (
            <ScrollView
              style={styles.viewerBody}
              contentContainerStyle={styles.viewerZoom}
              maximumZoomScale={5}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              {viewer ? <Image source={{ uri: viewer }} style={{ width: SCREEN_W, height: SCREEN_H }} resizeMode="contain" /> : null}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Foto galeri: parmakla sağa/sola kaydırarak fotoğraflar arası geçiş */}
      <Modal visible={galleryIndex !== null} animationType="fade" onRequestClose={() => setGalleryIndex(null)}>
        <View style={styles.galWrap}>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            initialScrollIndex={galleryIndex || 0}
            getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
            renderItem={({ item }) => (
              <View style={styles.galPage}>
                <View style={styles.galImgWrap}>
                  <Image source={{ uri: item.uri }} style={styles.galImg} resizeMode="contain" />
                  <PhotoWatermark size={46} margin={16} />
                </View>
                <Text style={styles.galCap}>{item.cap}</Text>
              </View>
            )}
          />
          <TouchableOpacity style={[styles.galClose, { top: insets.top + 8 }]} onPress={() => setGalleryIndex(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.viewerX}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Tanıtım videosu — tam ekran oynatıcı (WebView + HTML5 video) */}
      <Modal visible={videoPlay} animationType="fade" onRequestClose={() => setVideoPlay(false)}>
        <View style={styles.galWrap}>
          {introVideoUrl ? (
            <WebView
              source={{ html: `<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"></head><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><video src="${introVideoUrl}" controls autoplay playsinline style="max-width:100%;max-height:100vh;background:#000"></video></body></html>` }}
              style={{ flex: 1, backgroundColor: '#000' }}
              originWhitelist={['*']}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              scrollEnabled={false}
            />
          ) : null}
          <TouchableOpacity style={[styles.galClose, { top: insets.top + 8 }]} onPress={() => setVideoPlay(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.viewerX}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <ContractForm
        visible={formVisible}
        initial={contract}
        data={data}
        onSaveData={saveContractData}
        onClose={() => setFormVisible(false)}
      />

      <ContractPreview
        visible={previewVisible}
        data={data}
        contract={contract}
        onEsign={() => Alert.alert(t('esign_btn'), t('esign_soon'))}
        onClose={() => setPreviewVisible(false)}
      />

      <FlightForm
        visible={flightForm}
        initial={flight}
        data={data}
        ticketUploaded={!!docs.flight_ticket}
        uploadingTicket={uploading === 'flight_ticket'}
        busy={sending}
        onPickTicket={() => uploadAgencyDoc('flight_ticket')}
        onSubmit={submitFlight}
        onClose={() => { if (!sending) setFlightForm(false); }}
      />

      <FlightPreview
        visible={flightPrev}
        data={data}
        flight={flight}
        onClose={() => setFlightPrev(false)}
      />

      <InterviewModal
        visible={interviewOpen}
        role="agency"
        userId={candidate.user_id}
        agencyId={agencyUserId}
        fontsReady={fontsReady}
        candidateLabel={[maskedName(data), code].filter(Boolean).join(' · ')}
        onClose={() => setInterviewOpen(false)}
      />

      <TranscriptModal
        visible={transcriptOpen}
        candidateUserId={candidate.user_id}
        candidateLabel={[maskedName(data), code].filter(Boolean).join(' · ')}
        onClose={() => setTranscriptOpen(false)}
      />
    </View>
  );
}

const INK = '#1b2533';
const GOLD = '#c2a25a';

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f3ec' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fffdf9', borderBottomWidth: 0.5, borderBottomColor: '#ece7db' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  titleBox: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800', color: INK },
  titleFont: { fontFamily: 'PlayfairDisplay_700Bold', fontWeight: '400' },
  titleCode: { fontSize: 12.5, fontWeight: '800', color: '#9a7b1f', letterSpacing: 1, marginTop: 1 },
  offerBtn: { backgroundColor: GOLD, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 16 },
  dim: { opacity: 0.6 },
  offerText: { color: INK, fontWeight: '800', fontSize: 14 },
  sentBadge: { backgroundColor: '#e6f4ec', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  sentText: { color: '#1f8a4c', fontWeight: '800', fontSize: 12.5 },
  withdrawBtn: { backgroundColor: '#fbeaea', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e8b5b0' },
  withdrawText: { color: '#a32d2d', fontWeight: '800', fontSize: 13 },
  offerBanner: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#e7ecf3', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  offerBannerText: { color: '#1f3a63', fontWeight: '800', fontSize: 13, textAlign: 'center' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: 'transparent' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: '#ebe4d5' },
  tabOn: { backgroundColor: '#16202e', shadowColor: '#0c1320', shadowOpacity: 0.2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  tabText: { fontSize: 14, fontWeight: '800', color: '#737373' },
  tabTextOn: { color: '#fff' },

  body: { flex: 1 },
  strip: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  stripContent: { padding: 12, gap: 10 },
  thumbBox: { width: 96 },
  thumbWrap: { width: 96, height: 124, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e9ebee' },
  thumb: { width: '100%', height: '100%' },
  thumbCap: { fontSize: 11, color: '#737373', fontWeight: '600', textAlign: 'center', marginTop: 4 },
  thumbVideoLoading: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  thumbVideoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  thumbVideoBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbVideoPlay: { color: '#fff', fontSize: 15, marginLeft: 2 },
  cv: { flex: 1 },
  interviewBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e6e8ec' },
  interviewBtn: { flex: 1, backgroundColor: '#243042', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  interviewBtnText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  transcriptBtn: { backgroundColor: '#eef0f2', borderWidth: 1, borderColor: '#d3d8df', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  transcriptBtnText: { color: INK, fontWeight: '800', fontSize: 13.5 },
  cvActions: { marginHorizontal: 12, marginTop: 10 },
  contractBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  contractBtnText: { color: INK, fontWeight: '800', fontSize: 14.5 },
  contractWait: { backgroundColor: '#f1f2f4', borderWidth: 1, borderColor: '#e0e2e6', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  contractWaitText: { color: '#737373', fontWeight: '700', fontSize: 13.5 },
  lockedHint: { color: '#9aa1ac', fontWeight: '700', fontSize: 12 },

  docsContent: { padding: 16 },

  legend: { gap: 8, marginBottom: 14, backgroundColor: '#fff', borderRadius: 10, borderWidth: 0.5, borderColor: '#e6e8ec', padding: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 12.5, color: '#737373', fontWeight: '600', flexShrink: 1 },

  stepCard: { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e6e8ec', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#e6e8ec' },
  prowYou: { borderLeftColor: '#c2a25a' },
  prowOther: { borderLeftColor: '#2a9db8' },
  cardDone: { backgroundColor: '#f5f6f8', borderColor: '#eceef1', borderLeftColor: '#cdd4cf' },
  cardLocked: { backgroundColor: '#f7f8f9', borderColor: '#eceef1', borderLeftColor: '#e1e4e9' },

  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  stepNo: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  stepNoText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  circleYou: { backgroundColor: '#c2a25a' },
  circleOther: { backgroundColor: '#2a9db8' },
  circleDone: { backgroundColor: '#9bb8a6' },
  circleLocked: { backgroundColor: '#cfd3da' },
  doneLabel: { fontSize: 12.5, fontWeight: '800', color: '#6f8a78', letterSpacing: 0.3 },

  ownerChip: { alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  ownerYou: { backgroundColor: '#f6efdd' },
  ownerOther: { backgroundColor: '#e4f1f5' },
  ownerMuted: { backgroundColor: '#eceef1' },
  ownerChipText: { fontSize: 11, fontWeight: '800' },
  ownerYouText: { color: '#9a7b1f' },
  ownerOtherText: { color: '#1f7d96' },
  ownerMutedText: { color: '#9aa1ac' },

  subRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#f0f1f3' },
  subMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subBullet: { fontSize: 15, color: '#c9ccd2', fontWeight: '800', width: 14, textAlign: 'center' },
  subBulletDone: { color: '#1f8a4c' },
  subLabel: { fontSize: 14.5, fontWeight: '700', color: INK, flexShrink: 1 },
  subLabelMuted: { color: '#9aa1ac', fontWeight: '600' },
  linkView: { fontSize: 13, color: '#2a9db8', fontWeight: '700', marginLeft: 10 },
  linkReject: { fontSize: 13, color: '#a32d2d', fontWeight: '700', marginLeft: 10 },
  addBtnSm: { backgroundColor: GOLD, borderRadius: 9, paddingVertical: 7, paddingHorizontal: 14, minWidth: 60, alignItems: 'center' },
  addBtnText: { color: INK, fontWeight: '800', fontSize: 13 },
  lockedIcon: { fontSize: 15, marginLeft: 10 },
  waitBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e4f1f5', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  waitBannerText: { color: '#1f7d96', fontSize: 13, fontWeight: '700' },
  subLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginLeft: 22 },
  viewLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  changeBtn: { backgroundColor: '#f6efdd', borderWidth: 1, borderColor: '#e3d2a3', borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  changeBtnText: { color: '#9a7b1f', fontWeight: '800', fontSize: 13 },
  removeText: { color: '#a32d2d' },
  draftBadge: { backgroundColor: '#fcf2e2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  draftText: { color: '#9a6b16', fontSize: 10.5, fontWeight: '800' },
  sendBtn: { backgroundColor: GOLD, borderRadius: 11, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  sendBtnText: { color: INK, fontSize: 15, fontWeight: '800' },

  viewerWrap: { flex: 1, backgroundColor: '#111' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10, backgroundColor: '#1b2533' },
  viewerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  viewerX: { color: '#fff', fontSize: 20, fontWeight: '700' },
  viewerBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },

  galWrap: { flex: 1, backgroundColor: '#000' },
  galPage: { width: SCREEN_W, flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewerZoom: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  galImgWrap: { width: SCREEN_W, height: '82%', alignItems: 'center', justifyContent: 'center' },
  galImg: { width: SCREEN_W, height: '100%' },
  galCap: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, textTransform: 'uppercase' },
  galClose: { position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
