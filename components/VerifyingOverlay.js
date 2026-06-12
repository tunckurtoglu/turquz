// components/VerifyingOverlay.js
// Pasaport doğrulama overlay'i. status: 'verifying' (dönen altın halka) | 'success' (✓ onay animasyonu).
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

const GOLD = '#c2a25a';
const GREEN = '#1f8a4c';

export default function VerifyingOverlay({ status }) {
  const { t } = useLanguage();
  const visible = !!status;
  const success = status === 'success';
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;
    if (success) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
      return undefined;
    }
    const spinLoop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    spin.setValue(0); pulse.setValue(0);
    spinLoop.start(); pulseLoop.start();
    return () => { spinLoop.stop(); pulseLoop.stop(); };
  }, [visible, success, spin, pulse, pop]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {success ? (
            <>
              <Animated.View style={[styles.checkCircle, { transform: [{ scale: popScale }], opacity: pop }]}>
                <Text style={styles.checkMark}>✓</Text>
              </Animated.View>
              <Text style={styles.title}>{t('verify_success_title')}</Text>
              <Text style={styles.sub}>{t('verify_success_sub')}</Text>
            </>
          ) : (
            <>
              <View style={styles.ringWrap}>
                <Animated.View style={[styles.glow, { opacity: glow, transform: [{ scale }] }]} />
                <Animated.View style={[styles.ring, { transform: [{ rotate }] }]} />
                <Animated.Text style={[styles.icon, { transform: [{ scale }] }]}>🛂</Animated.Text>
              </View>
              <Text style={styles.title}>{t('verify_overlay_title')}</Text>
              <Text style={styles.sub}>{t('verify_overlay_sub')}</Text>
              <View style={styles.dots}>
                <Dot anim={pulse} /><Dot anim={pulse} /><Dot anim={pulse} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Dot({ anim }) {
  const o = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  return <Animated.View style={[styles.dot, { opacity: o }]} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,12,20,0.82)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  card: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 34, borderRadius: 24, backgroundColor: '#141d2b', borderWidth: 1, borderColor: 'rgba(194,162,90,0.25)', width: '100%', maxWidth: 340 },
  ringWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  glow: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: GOLD },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(194,162,90,0.18)', borderTopColor: GOLD },
  icon: { fontSize: 34 },
  checkCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', marginBottom: 22, shadowColor: GREEN, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  checkMark: { color: '#fff', fontSize: 48, fontWeight: '900', marginTop: -4 },
  title: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
  sub: { color: '#9aa4b1', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 8, lineHeight: 19 },
  dots: { flexDirection: 'row', gap: 7, marginTop: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD },
});
