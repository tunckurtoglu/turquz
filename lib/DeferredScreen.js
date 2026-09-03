// lib/DeferredScreen.js
// React.lazy kullanma — React 19'da "promise resolves to undefined" fatal üretiyor.
// Bunun yerine state ile dinamik import.
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

/**
 * @param {() => Promise<{ default: React.ComponentType<any> }>} loader
 * @param {string} [name]
 */
export function deferScreen(loader, name = 'Ekran') {
  return function Deferred(props) {
    const [Comp, setComp] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      let live = true;
      loader()
        .then((m) => {
          const C = m?.default;
          if (!live) return;
          if (typeof C !== 'function') {
            console.warn('[defer]', name, 'default missing');
            setFailed(true);
            return;
          }
          setComp(() => C);
        })
        .catch((e) => {
          console.warn('[defer]', name, e?.message || e);
          if (live) setFailed(true);
        });
      return () => { live = false; };
    }, []);

    if (failed) return <LoadError name={name} />;
    if (!Comp) return <Fallback />;
    return <Comp {...props} />;
  };
}
