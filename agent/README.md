# Turquz Mülakat Çevirmen Ajanı

Görüntülü mülakatta **canlı altyazı** ve **yazılı transkript** üretir. Uygulamanın içinde
DEĞİL, ayrı küçük bir Node servisi olarak çalışır; LiveKit odasına görünmez katılır.

## Ne yapar
1. Odadaki her katılımcının sesini **Deepgram** ile yazıya çevirir (çok dilli).
2. Metni **karşı tarafın diline** çevirir (**Gemini** `gemini-2.0-flash`).
3. Çeviriyi `captions` data kanalına basar → uygulama **altyazı şeridinde** gösterir
   (her kullanıcı kendi dilinde).
4. Tüm konuşmayı **Supabase `interview_transcripts`** tablosuna yazar.

Katılımcı dili, LiveKit token'ındaki `metadata.lang` üzerinden okunur
(bunu `supabase/functions/livekit-token` yazıyor).

## Gerekenler (API anahtarları)
- **LiveKit** URL + API Key + Secret (uygulamayla aynı proje)
- **Deepgram** API key — https://console.deepgram.com (ücretsiz başlangıç kredisi var)
- **Gemini** API key — https://aistudio.google.com/apikey
- **Supabase** service role key — Project Settings → API

## Yerelde çalıştır (test)
```bash
cd agent
npm install
cp .env.example .env     # ve değerleri doldur
npm run dev
```
Çalışınca, biri mülakat odasına (`iv-...`) girdiğinde ajan **otomatik** o odaya atanır,
konuşmaya başlayınca altyazılar uygulamada görünür ve transkript Supabase'e düşer.

> Önce SQL `0024_transcripts.sql` çalıştırılmış olmalı.

## Üretim (sürekli açık)
Ajanın 7/24 çalışması gerekir. Seçenekler:
- **LiveKit Cloud Agents**: `lk agent create` ile bu klasörü deploy et (önerilen).
- **Container/VM**: herhangi bir sunucuda `npm start` (Fly.io, Railway, Render, vb.).

## Kayıt (Faz 2e) + 30 gün otomatik silme
Ajan, odaya katılınca görüşmeyi **LiveKit Egress** ile kaydedip **S3'e** yükler
(oda boşalınca otomatik durur). S3 env'leri boşsa kayıt yapılmaz.

**Kurulum:**
1. Bir **S3 uyumlu bucket** aç: AWS S3, Cloudflare R2, Backblaze B2 veya Supabase Storage (S3).
2. Erişim anahtarı/secret al, `.env`'e yaz (`S3_*`). AWS dışı için `S3_ENDPOINT` de gir.
3. **30 gün sonra otomatik silme** = bucket'ın **Lifecycle / Expiration** kuralı:
   - **AWS S3:** Bucket → Management → Lifecycle rule → "Expire current versions after **30 days**" (prefix: `interviews/`).
   - **Cloudflare R2:** Bucket → Settings → Object lifecycle rules → Delete after 30 days.
   - **Backblaze B2:** Lifecycle Settings → Keep only last version, delete after 30 days.
4. Kayıtlar `interviews/<oda>-<zaman>.mp4` yolunda birikir, 30 gün sonra kendiliğinden silinir.

> İlerisi: kaydı app içinde izlemek için LiveKit **egress webhook**'u ile dosya URL'sini
> Supabase'e yazıp acente paneline "Kaydı İzle" ekleyebiliriz.

## Notlar
- **Türkmence/Kırgızca** STT desteği sınırlı olabilir; bu dillerde altyazı kalitesi düşebilir.
- Maliyet: STT (dakika başı) + çeviri (token başı). 10 dk'lık görüşme için düşük.
- `@livekit/agents` Node API'si sürümle değişebilir; ilk çalıştırmada sürüm uyumu için
  küçük düzeltme gerekebilir — `npm run dev` çıktısındaki hatayı paylaş, birlikte ayarlarız.
```
