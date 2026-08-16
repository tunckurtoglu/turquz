// Native yazdır → PDF (app’teki expo-print kalitesi).
// ÖNEMLİ: Safari / in-app tarayıcıda print(), kullanıcı jesti bozulunca (await sonrası)
// sessizce yok sayılır. window.open() jest sırasında senkron çağrılmalı.

/** Jest henüz canlıyken çağır: boş pencere aç (popup engeli için). */
export function openPrintWindow() {
  try {
    return window.open('', '_blank');
  } catch (_) {
    return null;
  }
}

function writeAndPrint(win, html) {
  win.document.open();
  win.document.write(html);
  win.document.close();
  const tryPrint = () => {
    try {
      win.focus();
      win.print();
    } catch (_) { /* ignore */ }
  };
  if (win.document.readyState === 'complete') {
    setTimeout(tryPrint, 250);
  } else {
    win.onload = () => setTimeout(tryPrint, 250);
    setTimeout(tryPrint, 800);
  }
}

/** Popup yoksa: body’ye gizli iframe (transform dışında) + print. */
function printHiddenIframe(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none;',
  );
  iframe.setAttribute('title', 'print');
  document.body.appendChild(iframe);
  const cleanup = () => {
    setTimeout(() => { try { iframe.remove(); } catch (_) { /* ignore */ } }, 60_000);
  };
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (_) { /* ignore */ }
    cleanup();
  };
  iframe.srcdoc = `${html}\n<!-- ${Date.now()} -->`;
  setTimeout(() => {
    if (iframe.contentDocument?.readyState === 'complete') {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (_) { /* ignore */ }
      cleanup();
    }
  }, 900);
  return true;
}

/**
 * @param {string} html
 * @param {Window|null} [preopened] - onClick içinde senkron açılmış pencere
 */
export function printContractHtml(html, preopened = null) {
  const win = preopened && !preopened.closed ? preopened : openPrintWindow();
  if (win) {
    try {
      writeAndPrint(win, html);
      return 'window';
    } catch (_) {
      try { win.close(); } catch (__) { /* ignore */ }
    }
  }
  printHiddenIframe(html);
  return 'iframe';
}
