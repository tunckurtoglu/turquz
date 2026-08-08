// Galeri görsellerini src/gallery/ klasöründen OTOMATİK toplar.
// Kullanıcı klasöre foto attığında build sırasında otomatik dâhil edilir.
// Dosya adı altyazıya çevrilir: "01-almaty-bulusma.jpg" -> "Almaty Bulusma"

const modules = import.meta.glob('../gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

function captionFromPath(path) {
  const file = path.split('/').pop() || '';
  const base = file.replace(/\.[^.]+$/, '');          // uzantıyı at
  const noOrder = base.replace(/^\d+[-_.\s]*/, '');    // baştaki "01-" sırasını at

  // UUID / rastgele hex dosya adları (ör. telefon fotoğrafları) → altyazı GÖSTERME.
  const compact = noOrder.replace(/[-_\s]+/g, '');
  if (!compact || /^[0-9a-f]+$/i.test(compact)) return '';

  const words = noOrder.replace(/[-_]+/g, ' ').trim(); // tire/alt çizgiyi boşluğa çevir
  if (!words) return '';
  return words.replace(/\b\w/g, (c) => c.toUpperCase()); // baş harfleri büyüt
}

// [{ src, caption }] — dosya adına göre sıralı
export const GALLERY = Object.keys(modules)
  .sort()
  .map((path) => ({ src: modules[path], caption: captionFromPath(path) }));
