// Hero: src/hero/hero.jpg (görsel) + public/hero/hero.mp4 (ana sayfa video)
const modules = import.meta.glob('../hero/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  import: 'default',
});

const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));
export const HERO_IMAGE = entries[0]?.[1] || null;

export const HERO_VIDEO = '/hero/hero.mp4';
