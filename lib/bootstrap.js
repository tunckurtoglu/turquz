// lib/bootstrap.js
// Açılışta ağ çağrılarının sonsuza takılmasını önler.

export function withTimeout(promise, ms, label = 'timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);
}
