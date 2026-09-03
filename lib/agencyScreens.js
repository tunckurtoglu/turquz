// lib/agencyScreens.js
// Acente ekranları App boot'ta statik import edilmez (beyaz ekran / JS takılması).
// React.lazy kullanma — RN19 undefined fatal.
// Strateji: preload ile modülleri yükle, cache'le, wrapper doğrudan cache'den oku.

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

// Modül cache — preload sonrası dolu olur.
const _cache = {};
let preloadPromise = null;

export function preloadAgencyScreens() {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      import('../screens/AgencyHomeScreen'),
      import('../screens/AgencySetupScreen'),
      import('../screens/AgencyCandidateScreen'),
    ]).then(([home, setup, candidate]) => {
      _cache.AgencyHomeScreen = home?.default;
      _cache.AgencySetupScreen = setup?.default;
      _cache.AgencyCandidateScreen = candidate?.default;
    }).catch((e) => {
      preloadPromise = null;
      throw e;
    });
  }
  return preloadPromise;
}

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

/**
 * Cache-first wrapper: preload bittiyse cache'den anında oku,
 * yoksa import() ile yükle.
 */
function makeCachedScreen(cacheKey, loader, name) {
  return function CachedScreen(props) {
    const cached = _cache[cacheKey];
    const [Comp, setComp] = useState(typeof cached === 'function' ? () => cached : null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      if (Comp) return;
      // Cache'de varsa hemen al
      const c = _cache[cacheKey];
      if (typeof c === 'function') { setComp(() => c); return; }
      // Yoksa yükle
      let live = true;
      loader()
        .then((m) => {
          const C = m?.default;
          if (!live) return;
          if (typeof C !== 'function') {
            console.warn('[agencyScreen]', name, 'default missing', Object.keys(m || {}));
            setFailed(true);
            return;
          }
          _cache[cacheKey] = C;
          setComp(() => C);
        })
        .catch((e) => {
          console.warn('[agencyScreen]', name, e?.message || e);
          if (live) setFailed(true);
        });
      return () => { live = false; };
    }, [Comp]);

    if (failed) return <LoadError name={name} />;
    if (!Comp) return <Fallback />;
    return <Comp {...props} />;
  };
}

export const AgencyHomeScreen = makeCachedScreen(
  'AgencyHomeScreen',
  () => import('../screens/AgencyHomeScreen'),
  'Acente',
);
export const AgencySetupScreen = makeCachedScreen(
  'AgencySetupScreen',
  () => import('../screens/AgencySetupScreen'),
  'Acente kurulum',
);
export const AgencyCandidateScreen = makeCachedScreen(
  'AgencyCandidateScreen',
  () => import('../screens/AgencyCandidateScreen'),
  'Aday',
);
