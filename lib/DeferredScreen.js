// lib/DeferredScreen.js
// React.lazy ve dynamic import() kullanma — RN19 + Metro HBC'de default undefined olabiliyor.
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

function Fallback() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1b2533', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#c2a25a" size="large" />
    </View>
  );
}

function LoadError({ name }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#1b2533', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#f0ece4', textAlign: 'center' }}>{name || 'Ekran'} yüklenemedi.</Text>
    </View>
  );
}

function resolveDefault(mod, label) {
  const C = mod?.default ?? mod;
  if (typeof C !== 'function') {
    throw new Error(`${label}: bileşen bulunamadı`);
  }
  return C;
}

/**
 * @param {() => object} requireFn — Metro static require, örn. () => require('../screens/HomeScreen')
 * @param {string} [name]
 */
export function deferScreen(requireFn, name = 'Ekran') {
  return function Deferred(props) {
    const [Comp, setComp] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      let live = true;
      try {
        const C = resolveDefault(requireFn(), name);
        if (live) setComp(() => C);
      } catch (e) {
        console.warn('[defer]', name, e?.message || e);
        if (live) setFailed(true);
      }
      return () => { live = false; };
    }, [name, requireFn]);

    if (failed) return <LoadError name={name} />;
    if (!Comp) return <Fallback />;
    return <Comp {...props} />;
  };
}
