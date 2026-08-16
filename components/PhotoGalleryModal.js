// components/PhotoGalleryModal.js
// Tam ekran slayt: kaydırarak foto geçişi + pinch zoom.
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, FlatList, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PhotoWatermark from './PhotoWatermark';
import ZoomableImage from './ZoomableImage';

const SCREEN_W = Dimensions.get('window').width;

export default function PhotoGalleryModal({ visible, photos = [], index = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);
  const [page, setPage] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const items = (photos || []).filter((p) => p?.uri);

  useEffect(() => {
    if (!visible) return;
    const start = Math.max(0, Math.min(index ?? 0, Math.max(0, items.length - 1)));
    setPage(start);
    setZoomed(false);
    requestAnimationFrame(() => {
      try { listRef.current?.scrollToIndex?.({ index: start, animated: false }); } catch { /* layout yok */ }
    });
  }, [visible, index, items.length]);

  if (!items.length) return null;

  return (
    <Modal visible={!!visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.wrap}>
        <FlatList
          ref={listRef}
          key={visible ? `g-${index}` : 'g'}
          data={items}
          extraData={page}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(p, i) => p.uri || String(i)}
          initialScrollIndex={Math.max(0, Math.min(index ?? 0, items.length - 1))}
          getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              listRef.current?.scrollToIndex?.({ index: info.index, animated: false });
            }, 80);
          }}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setPage(i);
            setZoomed(false);
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { paddingBottom: insets.bottom + 56 }]}>
              <View style={styles.imgWrap}>
                <ZoomableImage uri={item.uri} style={styles.img} onZoomChange={setZoomed} />
                <PhotoWatermark size={46} margin={16} />
                {item.cap ? <Text style={styles.cap} numberOfLines={1}>{item.cap}</Text> : null}
              </View>
            </View>
          )}
        />

        {items.length > 1 ? (
          <View style={[styles.dots, { bottom: insets.bottom + 22 }]} pointerEvents="none">
            <View style={styles.dotRow}>
              {items.map((_, i) => (
                <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
              ))}
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.back, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backChev}>‹</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  page: { width: SCREEN_W, flex: 1 },
  imgWrap: { flex: 1, width: SCREEN_W, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_W, height: '100%' },
  cap: {
    position: 'absolute',
    left: 64,
    right: 64,
    bottom: 28,
    color: '#e7dcc4',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  dots: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  count: { color: 'rgba(255,255,255,0.85)', fontWeight: '800', fontSize: 13, marginBottom: 8 },
  dotRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotOn: { backgroundColor: '#c2a25a', width: 22, height: 7, borderRadius: 4 },
  back: {
    position: 'absolute', left: 16, width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(194,162,90,0.45)',
  },
  backChev: { color: '#e7dcc4', fontSize: 28, fontWeight: '400', marginTop: -2, marginLeft: -2 },
  close: {
    position: 'absolute', right: 18, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  closeX: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
