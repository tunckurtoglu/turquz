# Turquz Sağlık (`site-medical`)

Diş ve göz bilgilendirme landing’i. Ana site ile aynı AURORA teması (lacivert + altın).

## Önemli kural

**Partner klinik adı, logosu veya sitesi bu projede hiçbir yerde geçmez** (iç geliştirme kuralı; sitede “klinik adını paylaşmıyoruz” diye yazma).  
İletişim: `saglik@turquz.app` / WhatsApp. Turquz bir klinik değildir; tedavi kliniklerde yürür.

## Çalıştırma

```bash
cd site-medical
npm install
npm run dev      # http://127.0.0.1:5182
```

## İçerik

| Ne | Nerede |
|----|--------|
| E-posta / WhatsApp / ana site | `src/lib/config.js` |
| Metinler (10 dil) | `src/i18n/content.js` |
| Galeri fotoğrafları | `src/gallery/` (klinik markası yok) |
| Stil | `src/styles.css` |

Ana sitede `serviceUrls.medical` alanını canlı domain ile doldurun.
