const transliteration = {
  ğ: 'g', Ğ: 'G', ü: 'u', Ü: 'U', ş: 's', Ş: 'S',
  ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ç: 'c', Ç: 'C',
};

export function safeFilePart(value, fallback = 'belge') {
  const text = String(value || '')
    .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (char) => transliteration[char] || char)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  return text || fallback;
}

export function documentDownloadName({ code, name, label, extension = 'pdf' } = {}) {
  const parts = [
    safeFilePart(code, 'aday'),
    safeFilePart(name, 'aday'),
    safeFilePart(label, 'belge'),
  ];
  const ext = safeFilePart(extension, 'bin').toLowerCase();
  return `${parts.join('-')}.${ext}`;
}
