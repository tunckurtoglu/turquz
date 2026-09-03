// lib/agencyScreens.js
// Acente ekranları App boot'ta statik import edilmez.
// Metro bu dosyaları async chunk yapabiliyor — Promise'i React'e ELEMENT olarak
// asla verme (RN19: "Lazy element type resolves to undefined").

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, TouchableOpacity } from 'react-native';

const _cache = {};
let preloadPromise = null;

function describeMod(mod) {
  if (mod == null) return String(mod);
  if (typeof mod.then === 'function') return 'Promise';
  if (typeof mod === 'function') return 'function';
  if (typeof mod === 'object') return `keys:${Object.keys(mod).slice(0, 12).join(',')}`;
  return typeof mod;
}

async function unwrapModule(raw, label) {
  let mod = raw;
  for (let i = 0; i < 4; i += 1) {
    if (mod && typeof mod.then === 'function') {
      mod = await mod;
      continue;
    }
    const C = (mod && typeof mod === 'object' && 'default' in mod) ? mod.default : mod;
    if (typeof C === 'function') return C;
    if (C && typeof C.then === 'function') {
      mod = C;
      continue;
    }
    throw new Error(`${label} çözülemedi (${describeMod(mod)})`);
  }
  throw new Error(`${label} çözülemedi (çok katmanlı Promise)`);
}

function loadAgencyModule(requireFn, cacheKey) {
  if (typeof _cache[cacheKey] === 'function') return Promise.resolve(_cache[cacheKey]);
  return unwrapModule(requireFn(), cacheKey).then((C) => {
    _cache[cacheKey] = C;
    return C;
  });
}

export function preloadAgencyScreens() {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      loadAgencyModule(() => require('../screens/AgencyHomeScreen'), 'AgencyHomeScreen'),
      loadAgencyModule(() => require('../screens/AgencySetupScreen'), 'AgencySetupScreen'),
      loadAgencyModule(() => require('../screens/AgencyCandidateScreen'), 'AgencyCandidateScreen'),
    ]).catch((e) => {
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

function LoadError({ name, detail, onRetry }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#1b2533', justifyContent: 'center', padding: 24, alignItems: 'center' }}>
      <Text style={{ color: '#f0ece4', textAlign: 'center', fontSize: 16, fontWeight: '700' }}>
        {name || 'Ekran'} yüklenemedi.
      </Text>
      {detail ? (
        <Text selectable style={{ color: '#9aa3b0', textAlign: 'center', fontSize: 12, marginTop: 10, lineHeight: 17 }}>
          {detail}
        </Text>
      ) : null}
      {onRetry ? (
        <TouchableOpacity
          onPress={onRetry}
          style={{ marginTop: 18, backgroundColor: '#c2a25a', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}
        >
          <Text style={{ color: '#0e141c', fontWeight: '800' }}>Tekrar dene</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function makeCachedScreen(cacheKey, requireFn, name) {
  return function CachedScreen(props) {
    const [Comp, setComp] = useState(() => (
      typeof _cache[cacheKey] === 'function' ? _cache[cacheKey] : null
    ));
    const [failed, setFailed] = useState('');
    const [tick, setTick] = useState(0);

    useEffect(() => {
      if (typeof Comp === 'function') return undefined;
      let live = true;
      loadAgencyModule(requireFn, cacheKey)
        .then((C) => {
          if (live) setComp(() => C);
        })
        .catch((e) => {
          console.warn('[agencyScreen]', name, e?.message || e);
          if (live) setFailed(String(e?.message || e));
        });
      return () => { live = false; };
    }, [Comp, tick]);

    if (failed) {
      return (
        <LoadError
          name={name}
          detail={failed}
          onRetry={() => {
            delete _cache[cacheKey];
            preloadPromise = null;
            setFailed('');
            setComp(null);
            setTick((n) => n + 1);
          }}
        />
      );
    }
    if (typeof Comp !== 'function') return <Fallback />;
    return <Comp {...props} />;
  };
}

export const AgencyHomeScreen = makeCachedScreen(
  'AgencyHomeScreen',
  () => require('../screens/AgencyHomeScreen'),
  'Acente',
);
export const AgencySetupScreen = makeCachedScreen(
  'AgencySetupScreen',
  () => require('../screens/AgencySetupScreen'),
  'Acente kurulum',
);
export const AgencyCandidateScreen = makeCachedScreen(
  'AgencyCandidateScreen',
  () => require('../screens/AgencyCandidateScreen'),
  'Aday',
);
