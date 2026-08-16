// components/ZoomableImage.js
// Tam ekran foto: iOS native pinch-zoom; Android pinch + pan (OTA, extra native yok).
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Image, PanResponder, Platform, ScrollView, StyleSheet, View,
} from 'react-native';

const MIN = 1;
const MAX = 4;

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function touchDist(touches) {
  if (!touches || touches.length < 2) return 0;
  const a = touches[0];
  const b = touches[1];
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

function AndroidZoom({ uri, style, resizeMode, onZoomChange }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const last = useRef({ s: 1, x: 0, y: 0, pinch: false, startDist: 0, startS: 1 });
  const lastTap = useRef(0);
  const box = useRef({ w: 1, h: 1 });

  const apply = (s, x, y, animated) => {
    const ns = clamp(s, MIN, MAX);
    const maxX = ((ns - 1) * box.current.w) / 2;
    const maxY = ((ns - 1) * box.current.h) / 2;
    const nx = ns <= 1.02 ? 0 : clamp(x, -maxX, maxX);
    const ny = ns <= 1.02 ? 0 : clamp(y, -maxY, maxY);
    last.current.s = ns;
    last.current.x = nx;
    last.current.y = ny;
    onZoomChange?.(ns > 1.05);
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: ns, useNativeDriver: true, bounciness: 0, speed: 18 }),
        Animated.spring(tx, { toValue: nx, useNativeDriver: true, bounciness: 0, speed: 18 }),
        Animated.spring(ty, { toValue: ny, useNativeDriver: true, bounciness: 0, speed: 18 }),
      ]).start();
    } else {
      scale.setValue(ns);
      tx.setValue(nx);
      ty.setValue(ny);
    }
  };

  const reset = () => apply(1, 0, 0, true);

  useEffect(() => {
    last.current = { s: 1, x: 0, y: 0, pinch: false, startDist: 0, startS: 1 };
    scale.setValue(1);
    tx.setValue(0);
    ty.setValue(0);
    onZoomChange?.(false);
  }, [uri]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => {
        const n = e.nativeEvent.touches?.length || 0;
        if (n >= 2) return true;
        if (last.current.s > 1.05) return true;
        const now = Date.now();
        if (now - lastTap.current < 280) return true;
        lastTap.current = now;
        return false;
      },
      onMoveShouldSetPanResponder: (e, g) => {
        const n = e.nativeEvent.touches?.length || 0;
        if (n >= 2) return true;
        if (last.current.s > 1.05 && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4)) return true;
        return false;
      },
      onPanResponderGrant: (e) => {
        const n = e.nativeEvent.touches?.length || 0;
        last.current.pinch = n >= 2;
        if (n >= 2) {
          last.current.startDist = touchDist(e.nativeEvent.touches);
          last.current.startS = last.current.s;
        }
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches || [];
        if (touches.length >= 2) {
          last.current.pinch = true;
          const d = touchDist(touches);
          const base = last.current.startDist || d;
          if (base < 8) return;
          const next = last.current.startS * (d / base);
          apply(next, last.current.x, last.current.y, false);
          return;
        }
        if (last.current.s > 1.05) {
          apply(last.current.s, last.current.x + g.dx, last.current.y + g.dy, false);
        }
      },
      onPanResponderRelease: (e, g) => {
        const wasPinch = last.current.pinch;
        last.current.pinch = false;
        if (!wasPinch && last.current.s <= 1.05 && Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) {
          const now = Date.now();
          if (now - lastTap.current < 280 || lastTap.current === 0) {
            apply(2.4, 0, 0, true);
            lastTap.current = 0;
            return;
          }
        }
        if (last.current.s < 1.08) reset();
        else apply(last.current.s, last.current.x, last.current.y, true);
      },
      onPanResponderTerminate: () => {
        last.current.pinch = false;
        if (last.current.s < 1.08) reset();
      },
    }),
  ).current;

  return (
    <View
      style={[styles.fill, style]}
      onLayout={(e) => { box.current = e.nativeEvent.layout; }}
      {...responder.panHandlers}
    >
      <Animated.Image
        source={{ uri }}
        resizeMode={resizeMode}
        style={[styles.fill, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
      />
    </View>
  );
}

function IosZoom({ uri, style, resizeMode, onZoomChange }) {
  const scroll = useRef(null);
  const [box, setBox] = useState(() => Dimensions.get('window'));
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    setZoomed(false);
    onZoomChange?.(false);
  }, [uri]);

  return (
    <View
      style={[styles.fill, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 1 && height > 1) setBox({ width, height });
      }}
    >
      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentContainerStyle={{ width: box.width, height: box.height }}
        maximumZoomScale={MAX}
        minimumZoomScale={MIN}
        scrollEnabled={zoomed}
        bounces={zoomed}
        bouncesZoom
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const z = e.nativeEvent?.zoomScale;
          if (typeof z === 'number') {
            const on = z > 1.05;
            setZoomed(on);
            onZoomChange?.(on);
          }
        }}
      >
        <Image
          source={{ uri }}
          style={{ width: box.width, height: box.height }}
          resizeMode={resizeMode}
        />
      </ScrollView>
    </View>
  );
}

export default function ZoomableImage({ uri, style, resizeMode = 'contain', onZoomChange }) {
  if (!uri) return <View style={[styles.fill, style]} />;
  if (Platform.OS === 'ios') {
    return <IosZoom uri={uri} style={style} resizeMode={resizeMode} onZoomChange={onZoomChange} />;
  }
  return <AndroidZoom uri={uri} style={style} resizeMode={resizeMode} onZoomChange={onZoomChange} />;
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
});
