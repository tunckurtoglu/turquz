// lib/fatalGuard.js
// MUST be imported first from index.js — before App.
// Production'da NativeExceptionsManager.reportException → abort() kesilir;
// aksi halde yakalanmamış JS hatası uygulamayı öldürür (ExceptionsManagerQueue).

function install() {
  try {
    // RN handleException: true dönünce native report/abort atlanır.
    global.RN$handleException = (e, isFatal) => {
      const msg = e?.message || String(e);
      console.error('[fatalGuard]', isFatal ? 'FATAL' : 'error', msg, e?.stack);
      return true;
    };
  } catch { /* yoksay */ }

  try {
    const ErrorUtils = global.ErrorUtils;
    if (ErrorUtils?.setGlobalHandler) {
      ErrorUtils.setGlobalHandler((error, isFatal) => {
        const msg = error?.message || String(error);
        console.error('[ErrorUtils]', isFatal ? 'FATAL' : 'error', msg, error?.stack);
        // Alert.alert YOK — fatal sırasında Alert yeniden exception üretip abort tetikliyor.
      });
    }
  } catch { /* yoksay */ }

  try {
    // console.error → exception yolu da abort edebilir
    // eslint-disable-next-line no-console
    if (typeof console !== 'undefined') console.reportErrorsAsExceptions = false;
  } catch { /* yoksay */ }
}

install();
// RN InitializeCore handler'ı sonra ezmesin diye tekrar kur
setTimeout(install, 0);
setTimeout(install, 500);

export {};
