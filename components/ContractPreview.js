// components/ContractPreview.js
// Sözleşme önizlemesi (WebView) + PDF indir/paylaş + e-imza.
// Form (bilgileri düzenle) ve imza/kaşe ekranı bu modalın İÇİNDE açılır (iç içe modal),
// çünkü iOS, açık bir modalın üstüne KARDEŞ modal sunmuyor.
import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLanguage } from '../i18n/LanguageContext';
import { buildContractHtml } from '../cv/buildContractHtml';
import { withLatinName } from '../lib/translit';
import { getMySignature, getLatestContractSignature, buildAuditLine } from '../lib/esign';
import ContractForm from './ContractForm';
import SignatureSetupSheet from './SignatureSetupSheet';

const INK = '#1b2533';
const GOLD = '#c2a25a';

export default function ContractPreview({
  visible, data, contract, candidateUserId, esigned = false,
  onClose, onEsign, onSaveContract, onCancelEsign, onDownloaded,
}) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const [sharing, setSharing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [signature, setSignature] = useState(null); // {image,name,subtitle,auditLine} -> imzalı çiz
  const [formOpen, setFormOpen] = useState(false);   // iç içe: bilgileri düzenle
  const [sigOpen, setSigOpen] = useState(false);     // iç içe: imza & kaşe
  const [pdfUri, setPdfUri] = useState(null);        // önizleme GERÇEK PDF olarak gösterilir (indirilen/kaydedilenle birebir)

  // Açılışta: sözleşme zaten e-imzalıysa kayıtlı imza + son denetim kaydıyla imzalı göster.
  useEffect(() => {
    if (!visible) return undefined;
    let alive = true;
    if (!esigned) { setSignature(null); return undefined; }
    (async () => {
      const [sig, log] = await Promise.all([getMySignature(), getLatestContractSignature(candidateUserId)]);
      if (!alive) return;
      if (sig && log) {
        setSignature({ image: sig.image, name: sig.signerName, subtitle: sig.signerTitle, auditLine: buildAuditLine(log) });
      }
    })();
    return () => { alive = false; };
  }, [visible, esigned, candidateUserId]);

  const html = useMemo(
    () => buildContractHtml(withLatinName(data || {}), contract || {}, signature ? { signature } : {}),
    [data, contract, signature],
  );

  // Önizlemeyi GERÇEK PDF olarak üret -> indirilen/imzalanan belgeyle birebir aynı format.
  // (Eskiden HTML ekran stiliyle gösteriliyordu; o yüzden iki farklı görünüm oluşuyordu.)
  useEffect(() => {
    if (!visible) { setPdfUri(null); return undefined; }
    let alive = true;
    setPdfUri(null);
    Print.printToFileAsync({ html })
      .then(({ uri }) => { if (alive) setPdfUri(uri); })
      .catch((e) => console.warn('önizleme pdf üretilemedi:', e?.message));
    return () => { alive = false; };
  }, [visible, html]);

  const hasInfo = !!(contract?.title?.trim() && contract?.position?.trim());

  // E-imza: önce bilgi + imza var mı (yoksa ilgili ekranı aç). Sonra ebeveyn imzalar, sonuç önizlemeye işlenir.
  const doSign = async () => {
    if (signing || !onEsign) return;
    if (!hasInfo) { Alert.alert(t('contract_form_title'), t('contract_required')); setFormOpen(true); return; }
    const mine = await getMySignature();
    if (!mine) { Alert.alert(t('esign_setup_title'), t('esign_need_setup')); setSigOpen(true); return; }
    setSigning(true);
    try {
      const info = await onEsign();
      if (info) setSignature(info);
    } finally { setSigning(false); }
  };

  // İmza/kaşe kaydedilince: zaten imzalıysa YENİ imzayı otomatik uygula (ayrı "yeniden imzala" gerekmez).
  const onSigSaved = async () => {
    setSigOpen(false);
    if (signature) await doSign();
  };

  // E-imzadan vazgeç: imzalı PDF'i kaldır, önizleme imzasıza döner (sonra indir + elle imzala + yükle).
  const cancelEsign = () => {
    Alert.alert(t('esign_cancel'), t('esign_cancel_confirm'), [
      { text: t('consent_cancel'), style: 'cancel' },
      { text: t('esign_cancel'), style: 'destructive', onPress: async () => {
          setCanceling(true);
          try { await onCancelEsign?.(); setSignature(null); }
          finally { setCanceling(false); }
        } },
    ]);
  };

  const share = async () => {
    setSharing(true);
    try {
      const uri = pdfUri || (await Print.printToFileAsync({ html })).uri;
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('contract_title'), UTI: 'com.adobe.pdf' });
      }
      onDownloaded?.(); // indirildi -> kapanınca "imzalı halini yükle" görünsün
    } catch (e) {
      Alert.alert(t('doc_contract_unsigned'), e?.message || 'error');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{t('contract_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        <View style={styles.webWrap}>
          {pdfUri ? (
            <WebView originWhitelist={['*']} source={{ uri: pdfUri }} style={styles.web} showsVerticalScrollIndicator />
          ) : (
            <View style={styles.previewLoading}><ActivityIndicator size="large" color={GOLD} /></View>
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {/* Bilgileri düzenle (formu iç içe aç) */}
          {onSaveContract ? (
            <TouchableOpacity style={styles.editInfo} onPress={() => setFormOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
              <Text style={styles.editInfoText}>✎ {t('contract_edit_info')}</Text>
            </TouchableOpacity>
          ) : null}

          {/* İndir ve (elle) imzala — e-imzalandıysa gizlenir (gerek yok). */}
          {!signature ? (
            <TouchableOpacity style={[styles.shareBtn, sharing && { opacity: 0.6 }]} onPress={share} disabled={sharing} activeOpacity={0.9}>
              {sharing ? <ActivityIndicator color={INK} /> : <Text style={styles.shareText}>{t('contract_download_sign')}</Text>}
            </TouchableOpacity>
          ) : null}

          {/* Altında: e-imza */}
          {onEsign ? (
            signature ? (
              <>
                <View style={styles.esignedRow}><Text style={styles.esignedText}>✓ {t('esign_done_badge')}</Text></View>
                <View style={styles.linkRow}>
                  <TouchableOpacity onPress={() => setSigOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                    <Text style={styles.linkGold}>{t('esign_edit_mine')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.linkSep}>·</Text>
                  <TouchableOpacity onPress={cancelEsign} disabled={canceling} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                    {canceling ? <ActivityIndicator color="#a32d2d" /> : <Text style={styles.linkRed}>{t('esign_cancel')}</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.esignBtn, signing && { opacity: 0.6 }]} onPress={doSign} disabled={signing} activeOpacity={0.9}>
                  {signing ? <ActivityIndicator color="#fff" /> : <Text style={styles.esignText}>✍️ {t('esign_now')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSig} onPress={() => setSigOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                  <Text style={styles.linkGold}>{t('esign_edit_mine')}</Text>
                </TouchableOpacity>
              </>
            )
          ) : null}
        </View>

        {/* İÇ İÇE: bilgileri düzenle + imza/kaşe (modal-üstü-modal sorunu olmasın diye burada). */}
        {onSaveContract ? (
          <ContractForm
            visible={formOpen}
            initial={contract}
            data={data}
            onSaveData={onSaveContract}
            onClose={() => setFormOpen(false)}
          />
        ) : null}
        <SignatureSetupSheet visible={sigOpen} onClose={() => setSigOpen(false)} onSaved={onSigSaved} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#e9ebee' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  webWrap: { flex: 1, backgroundColor: '#e9ebee' },
  web: { flex: 1, backgroundColor: 'transparent' },
  previewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#e6e8ec' },
  editInfo: { alignSelf: 'center', paddingBottom: 10 },
  editInfoText: { color: INK, fontWeight: '800', fontSize: 13.5, textDecorationLine: 'underline' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 12 },
  linkSep: { color: '#c8c8c8', fontSize: 14 },
  linkGold: { color: GOLD, fontWeight: '800', fontSize: 13.5, textDecorationLine: 'underline' },
  linkRed: { color: '#a32d2d', fontWeight: '800', fontSize: 13.5, textDecorationLine: 'underline' },
  shareBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  shareText: { color: INK, fontWeight: '800', fontSize: 16 },
  esignBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: INK, borderRadius: 14, paddingVertical: 16, marginTop: 10 },
  esignText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  esignedRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 10, backgroundColor: 'rgba(31,138,76,0.12)', borderWidth: 1, borderColor: 'rgba(31,138,76,0.45)', borderRadius: 14 },
  esignedText: { color: '#1a5c2a', fontWeight: '800', fontSize: 15 },
  editSig: { alignItems: 'center', paddingVertical: 12 },
});
