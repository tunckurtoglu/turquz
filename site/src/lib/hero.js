// Hero arka plan görselini src/hero/ klasöründen OTOMATİK alır.
// İçine bir görsel (jpg/png/webp) atınca hero arka planı olur; boşsa CSS gradient kullanılır.
// Birden çok görsel varsa dosya adına göre ilki seçilir.

const modules = import.meta.glob('../hero/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

const keys = Object.keys(modules).sort();
export const HERO_IMAGE = keys.length ? modules[keys[0]] : null;
