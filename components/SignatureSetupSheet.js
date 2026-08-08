// components/SignatureSetupSheet.js
// Acente/otel: imza + kaşe tanımlama. İki yöntem: parmakla ÇİZ (WebView canvas) veya GÖRSEL YÜKLE.
// Kaydedilen PNG data URI + imzalayan adı/unvanı business_signatures'a yazılır (lib/esign).
// Native paket yok: çizim WebView <canvas> ile, görsel expo-image-manipulator ile PNG'ye çevrilir.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLanguage } from '../i18n/LanguageContext';
import { getMySignature, saveMySignature } from '../lib/esign';

const INK = '#1b2533';
const GOLD = '#c2a25a';

// WebView içi imza tuvali. Strok bitince (pointerup) güncel PNG'yi RN'e yollar; boşsa '' yollar.
const PAD_HTML = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>html,body{margin:0;height:100%;background:#fff;overscroll-behavior:none;touch-action:none}
#c{display:block;width:100%;height:100%}</style></head>
<body><canvas id="c"></canvas>
<script>
var cv=document.getElementById('c'),ctx=cv.getContext('2d'),drawing=false,dirty=false,ratio=window.devicePixelRatio||1;
function fit(){cv.width=cv.clientWidth*ratio;cv.height=cv.clientHeight*ratio;ctx.scale(ratio,ratio);ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#10243f';}
fit();
function pos(e){var r=cv.getBoundingClientRect();var t=e.touches?e.touches[0]:e;return{x:t.clientX-r.left,y:t.clientY-r.top};}
function start(e){e.preventDefault();drawing=true;dirty=true;var p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);}
function move(e){if(!drawing)return;e.preventDefault();var p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();}
function end(e){if(!drawing)return;drawing=false;post();}
function post(){var data=dirty?cv.toDataURL('image/png'):'';if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(data);}
function clearCanvas(){ctx.clearRect(0,0,cv.width,cv.height);dirty=false;post();}
cv.addEventListener('touchstart',start,{passive:false});cv.addEventListener('touchmove',move,{passive:false});cv.addEventListener('touchend',end);
cv.addEventListener('mousedown',start);cv.addEventListener('mousemove',move);window.addEventListener('mouseup',end);
</script></body></html>`;

export default function SignatureSetupSheet({ visible, onClose, onSaved }) {
  const { t, dir } = useLanguage();
  const insets = useSafeAreaInsets();
  const backChevron = dir === 'rtl' ? '›' : '‹';
  const webRef = useRef(null);

  const [method, setMethod] = useState('draw'); // 'draw' | 'upload'
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [drawn, setDrawn] = useState('');   // çizilen PNG data URI
  const [uploaded, setUploaded] = useState(''); // yüklenen PNG data URI
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Açılışta mevcut imzayı yükle (varsa düzenleme).
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const sig = await getMySignature();
      if (!alive) return;
      if (sig) {
        setName(sig.signerName || '');
        setTitle(sig.signerTitle || '');
        setUploaded(sig.image || '');
        setMethod('upload');
      } else {
        setName(''); setTitle(''); setUploaded(''); setMethod('draw');
      }
      setDrawn('');
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [visible]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert(t('perm_needed'), t('perm_msg')); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    try {
      const out = await ImageManipulator.manipulateAsync(res.assets[0].uri, [{ resize: { width: 900 } }], {
        compress: 1, format: ImageManipulator.SaveFormat.PNG, base64: true,
      });
      setUploaded('data:image/png;base64,' + out.base64);
    } catch (e) {
      Alert.alert(t('esign_setup_title'), e?.message || 'error');
    }
  };

  const currentImage = method === 'draw' ? drawn : uploaded;

  const save = async () => {
    if (!name.trim()) { Alert.alert(t('esign_setup_title'), t('esign_need_name')); return; }
    if (!currentImage) { Alert.alert(t('esign_setup_title'), t('esign_need_image')); return; }
    setSaving(true);
    try {
      await saveMySignature({ image: currentImage, signerName: name, signerTitle: title });
      onSaved?.();
      onClose?.();
    } catch (e) {
      Alert.alert(t('esign_setup_title'), e?.message || 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backChevron}>{backChevron}</Text>
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{t('esign_setup_title')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.accent} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={GOLD} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('esign_signer_name')}</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('esign_signer_name')} placeholderTextColor="#9aa1ac" />

            <Text style={styles.label}>{t('esign_signer_title')}</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder={t('esign_signer_title')} placeholderTextColor="#9aa1ac" />

            <View style={styles.tabs}>
              <TouchableOpacity style={[styles.tab, method === 'draw' && styles.tabOn]} onPress={() => setMethod('draw')} activeOpacity={0.85}>
                <Text style={[styles.tabText, method === 'draw' && styles.tabTextOn]}>✍️ {t('esign_method_draw')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tab, method === 'upload' && styles.tabOn]} onPress={() => setMethod('upload')} activeOpacity={0.85}>
                <Text style={[styles.tabText, method === 'upload' && styles.tabTextOn]}>🖼️ {t('esign_method_upload')}</Text>
              </TouchableOpacity>
            </View>

            {method === 'draw' ? (
              <>
                <Text style={styles.hint}>{t('esign_draw_hint')}</Text>
                <View style={styles.padBox}>
                  <WebView
                    ref={webRef}
                    source={{ html: PAD_HTML }}
                    style={styles.pad}
                    originWhitelist={['*']}
                    scrollEnabled={false}
                    onMessage={(e) => setDrawn(e.nativeEvent.data || '')}
                  />
                </View>
                <TouchableOpacity style={styles.clearBtn} onPress={() => webRef.current?.injectJavaScript('clearCanvas();true;')} activeOpacity={0.8}>
                  <Text style={styles.clearText}>{t('esign_clear')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.uploadBox} onPress={pickImage} activeOpacity={0.85}>
                  {uploaded ? (
                    <Image source={{ uri: uploaded }} style={styles.uploadPreview} resizeMode="contain" />
                  ) : (
                    <View style={styles.uploadEmpty}>
                      <Text style={styles.uploadPlus}>＋</Text>
                      <Text style={styles.uploadHint}>{t('esign_method_upload')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
              {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.saveText}>{t('esign_save')}</Text>}
            </TouchableOpacity>
            <View style={{ height: insets.bottom + 16 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f6f3ec' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  backBtn: { width: 28, alignItems: 'flex-start' },
  backChevron: { fontSize: 28, color: INK, fontWeight: '700', marginTop: -4 },
  title: { fontSize: 17, fontWeight: '800', color: INK, flex: 1, textAlign: 'center' },
  accent: { height: 2.5, backgroundColor: GOLD },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18 },
  label: { fontSize: 13, fontWeight: '700', color: INK, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0ddd2', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  tabs: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 12 },
  tab: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e0ddd2', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  tabOn: { backgroundColor: INK, borderColor: INK },
  tabText: { fontSize: 14, fontWeight: '800', color: INK },
  tabTextOn: { color: '#fff' },
  hint: { fontSize: 12.5, color: '#7c7361', marginBottom: 8 },
  padBox: { height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#cfc8b6', backgroundColor: '#fff' },
  pad: { flex: 1, backgroundColor: '#fff' },
  clearBtn: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#efeadd', borderRadius: 10 },
  clearText: { color: INK, fontWeight: '700', fontSize: 13 },
  uploadBox: { height: 200, borderRadius: 14, borderWidth: 1, borderColor: '#cfc8b6', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  uploadPreview: { width: '100%', height: '100%' },
  uploadEmpty: { alignItems: 'center' },
  uploadPlus: { fontSize: 38, color: GOLD, fontWeight: '300' },
  uploadHint: { fontSize: 13, color: GOLD, fontWeight: '700', marginTop: 4 },
  saveBtn: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 26 },
  saveText: { color: INK, fontWeight: '800', fontSize: 16 },
});
