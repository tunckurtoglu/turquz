import { registerRootComponent } from 'expo';
import { Alert } from 'react-native';

import App from './App';

// Release'te yakalanmamış JS fatal → ExceptionsManager abort etmesin; log + uyarı.
try {
  const ErrorUtils = global.ErrorUtils;
  if (ErrorUtils?.setGlobalHandler) {
    const prev = ErrorUtils.getGlobalHandler?.();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      const msg = error?.message || String(error);
      console.error('[JS]', isFatal ? 'FATAL' : 'error', msg, error?.stack);
      if (isFatal) {
        try {
          Alert.alert('Turquz', msg.slice(0, 280));
        } catch { /* yoksay */ }
        return;
      }
      if (typeof prev === 'function') prev(error, isFatal);
    });
  }
} catch { /* yoksay */ }

registerRootComponent(App);
