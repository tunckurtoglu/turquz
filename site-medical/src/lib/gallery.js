// src/gallery/ klasörüne .jpg/.png/.webp koy — otomatik slayta düşer.
// Partner klinik markası / logosu içeren görsel kullanma.
const modules = import.meta.glob('../gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

function captionFromPath(path) {
  const base = path.split('/').pop().replace(/\.[^.]+$/, '');
  return base
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function loadGallery() {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, src]) => ({ src, caption: captionFromPath(path) }));
}
