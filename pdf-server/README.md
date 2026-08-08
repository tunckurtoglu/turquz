# Turquz PDF servisi

CV HTML'ini **gerçek Chrome (Puppeteer)** ile A4 PDF'e çevirir. Üçüncü taraf servis yok, PDF
başına ücret/limit yok, veri sende kalır.

## Neden ayrı bir servis?
- Tarayıcı içi `html2pdf`/`html2canvas` bu CV'nin `grid` düzenini Chrome ve Safari'de çizemiyor
  (boş PDF). Supabase Edge Functions (Deno) ise headless Chrome çalıştıramıyor.
- Bu küçük Node servisi gerçek Chrome kullandığı için her tarayıcıdan gelen istekte kusursuz,
  kesin 2 sayfa PDF üretir.

## Kurulum (bir kez)
```bash
cd pdf-server
npm install        # Puppeteer ~200MB Chromium indirir
```

## Çalıştır
```bash
npm start          # http://localhost:8787
```

## Web tarafı
`web/.env` içine PDF servisinin adresini yaz:
```
VITE_PDF_URL=http://localhost:8787
# (opsiyonel) servise PDF_TOKEN verdiysen aynısını buraya da yaz:
VITE_PDF_TOKEN=
```
Sonra paneli yeniden başlat. Aday → CV → **⬇ İndir** artık dolu PDF indirir (Safari + Chrome).

## Ayarlar (ortam değişkeni)
| Değişken      | Varsayılan        | Açıklama                                        |
|---------------|-------------------|-------------------------------------------------|
| `PORT`        | `8787`            | Dinlenen port                                   |
| `CORS_ORIGIN` | `*`               | Canlıda panelin alan adını yaz (örn. https://panel.turquz.com) |
| `PDF_TOKEN`   | _(boş)_           | Doluysa istekte `Authorization: Bearer <token>` zorunlu olur (canlı için önerilir) |

## Canlıya çıkarken
- Servisi panelin erişebileceği bir yerde çalıştır (kendi VPS'in, Railway/Render/Fly gibi bir Node host, vb.).
- `CORS_ORIGIN`'i panelin alan adına sabitle, `PDF_TOKEN` belirle (web/.env'deki `VITE_PDF_TOKEN` ile aynı).
- `VITE_PDF_URL`'i bu servisin genel adresine ayarla.
- Süreç kalıcı çalışsın diye `pm2` veya systemd kullanabilirsin: `pm2 start index.js --name turquz-pdf`.
