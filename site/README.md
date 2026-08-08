# Turquz — Vitrin Sitesi (Marketing)

Turquz markasını temsil eden, mobil uyumlu, premium kurumsal tanıtım sitesi.
Acente paneli (`web/`) ve mobil uygulamadan **bağımsızdır**; tek başına deploy edilir.

## Çalıştırma

```bash
cd site
npm install
npm run dev      # http://localhost:5180
```

Üretim derlemesi:

```bash
npm run build    # çıktı: site/dist  → statik host'a yükle
npm run preview  # derlemeyi yerelde dene
```

## İçeriği nasıl düzenlerim?

| Ne | Nerede |
|----|--------|
| **İletişim bilgileri, e-posta, telefon, mağaza linkleri, panel adresi** | `src/lib/config.js` |
| **Tüm metinler (10 dil)** | `src/i18n/content.js` |
| **Renkler, tipografi, animasyon** | `src/styles.css` (en üstteki `:root` değişkenleri) |
| **Galeri fotoğrafları** | `src/gallery/` klasörüne dosya at — otomatik slayta düşer |
| **Logo / favicon** | `public/brand/` |

## Diller

10 dil: Türkçe, İngilizce, Rusça, Kazakça, Kırgızca, Özbekçe, Türkmençe, Almanca, Tayca, Farsça (RTL).
Tarayıcı dili otomatik seçilir; sağ üstten değiştirilebilir. Eksik bir çeviri otomatik
olarak İngilizce'ye düşer (`src/i18n/LangContext.jsx`).

## Galeri (Kazakistan fotoğrafları)

`src/gallery/` klasörüne `.jpg/.png/.webp` koyun — kod değiştirmeden slaytta görünür.
- Sıra: dosya adına göre (`01-...`, `02-...`).
- Altyazı: dosya adından üretilir (`01-almaty-bulusma.jpg` → "Almaty Bulusma").
- Klasör boşken zarif bir yer-tutucu gösterilir; site bozulmaz.

## İletişim formu

- `.env` içine `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` verirseniz, form
  mesajları Supabase'deki **`contact_requests`** tablosuna yazılır (lead kutusu).
  Önce migration'ı çalıştırın: `supabase/migrations/0037_contact_requests.sql`.
- `.env` yoksa form otomatik olarak **e-posta (mailto)** yöntemine düşer; hedef adres
  `src/lib/config.js` içindeki `emailAgency`/`email` alanından gelir.

## Deploy

Statik bir SPA'dır; `dist/` klasörünü herhangi bir statik host'a yükleyin:
Netlify, Vercel, Cloudflare Pages, GitHub Pages. Tek sayfa olduğundan özel
yönlendirme kuralı gerekmez.
