/** Dental & eye treatment catalog — slugs + images for detail routes. No clinic names. */

export const DENTAL_TREATMENTS = [
  { id: 1, slug: 'hollywood-gulus', image: '/treatments/dental/hollywood-gulus.jpg' },
  { id: 2, slug: 'lamina', image: '/treatments/dental/lamina.jpg' },
  { id: 3, slug: 'ultra-ince-veneer', image: '/treatments/dental/ultra-ince-veneer.jpg' },
  { id: 4, slug: 'zirkonyum', image: '/treatments/dental/zirkonyum.jpg' },
  { id: 5, slug: 'kompozit-bonding', image: '/treatments/dental/kompozit-bonding.jpg' },
  { id: 6, slug: 'dis-beyazlatma', image: '/treatments/dental/dis-beyazlatma.jpg' },
  { id: 7, slug: 'dis-eti-sekillendirme', image: '/treatments/dental/dis-eti-sekillendirme.jpg' },
  { id: 8, slug: 'implant', image: '/treatments/dental/implant.jpg' },
  { id: 9, slug: 'all-on-4-6', image: '/treatments/dental/all-on-4-6.jpg' },
  { id: 10, slug: 'sinus-lifting', image: '/treatments/dental/sinus-lifting.jpg' },
  { id: 11, slug: 'cene-cerrahisi', image: '/treatments/dental/cene-cerrahisi.jpg' },
  { id: 12, slug: 'tek-ziyarette-gulus', image: '/treatments/dental/tek-ziyarette-gulus.jpg' },
  { id: 13, slug: 'seffaf-plak', image: '/treatments/dental/seffaf-plak.jpg' },
  { id: 14, slug: 'gbt', image: '/treatments/dental/gbt.jpg' },
];

export const EYE_TREATMENTS = [
  { id: 1, slug: 'lazer', image: '/treatments/eye/lazer.jpg' },
  { id: 2, slug: 'katarakt', image: '/treatments/eye/katarakt.jpg' },
  { id: 3, slug: 'goz-ici-lens', image: '/treatments/eye/goz-ici-lens.jpg' },
  { id: 4, slug: 'kornea', image: '/treatments/eye/kornea.jpg' },
  { id: 5, slug: 'goz-kapagi', image: '/treatments/eye/goz-kapagi.jpg' },
  { id: 6, slug: 'genel-muayene', image: '/treatments/eye/genel-muayene.jpg' },
];

export function dentalPath(slug) {
  return `/dis/${slug}`;
}

export function eyePath(slug) {
  return `/goz/${slug}`;
}

export function findDentalBySlug(slug) {
  return DENTAL_TREATMENTS.find((t) => t.slug === slug) || null;
}

export function findEyeBySlug(slug) {
  return EYE_TREATMENTS.find((t) => t.slug === slug) || null;
}

export function parseTreatmentPath(path) {
  const m = path.match(/^\/(dis|dental|goz|eye)\/([^/]+)$/);
  if (!m) return null;
  const root = m[1];
  const slug = m[2];
  if (root === 'dis' || root === 'dental') {
    const item = findDentalBySlug(slug);
    return item ? { variant: 'dental', parent: '/dis', item } : null;
  }
  const item = findEyeBySlug(slug);
  return item ? { variant: 'eye', parent: '/goz', item } : null;
}
