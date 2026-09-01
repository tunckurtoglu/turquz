# Turquz — KVKK Aydınlatma Metni & Açık Rıza Taslağı

> ⚠️ **UYARI — Bu bir taslaktır, hukuki tavsiye değildir.**
> Bu metni yayına almadan önce KVKK alanında deneyimli bir **avukata onaylatın**.
> Veri sorumlusu kimlik bilgileri vergi levhasından doldurulmuştur; kalan
> `[köşeli parantez]` alanlar (saklama süreleri vb.) avukat onayıyla tamamlanmalıdır.
> Metin değiştikçe uygulamadaki `CONSENT_VERSION` (bkz. `lib/consent.js`) artırılmalı ki
> kullanıcıya güncel metin yeniden onaylatılsın.

---

## BÖLÜM A — AYDINLATMA METNİ (KVKK md. 10)

### 1. Veri Sorumlusu
- **Unvan:** TURQUZ ULUSLARARASI DANIŞMANLIK TİCARET LİMİTED ŞİRKETİ
- **Adres:** Liman Mah. Boğaçayı Cad. No: 30 İç Kapı No: 14 Konyaaltı / Antalya
- **Vergi dairesi / VKN:** Antalya Kurumlar — 8711330554
- **İletişim / Başvuru:** info@turquz.com, +7 919 011 55 66

### 2. İşlenen Kişisel Veriler
Turquz uygulaması üzerinden, işe yerleştirme amacıyla aşağıdaki veriler işlenir:

**Genel nitelikli veriler**
- Kimlik: ad, soyad, doğum tarihi, uyruk, pasaport numarası
- İletişim: e-posta, telefon, adres
- Özgeçmiş: unvan, profil yazısı, iş deneyimi, eğitim, diller, beceriler, ehliyet, boy/kilo
- **Görseller:** vesikalık fotoğraf, boydan fotoğraf, yakın çekim fotoğraf

**Özel nitelikli veriler (KVKK md. 6)**
- **Kan grubu** (sağlık verisi) — yalnızca aday açık rıza verirse
- **Adli sicil belgesi** (ceza mahkûmiyeti verisi) — yalnızca işe alım aşamasında, açık rızayla
- **Pasaport belgesi** (yüklenen görüntü/PDF)

> Not: Belge yükleme alanı her adaya açık değildir; yalnızca bir otel/acenta adayı
> **kabul ettiğinde** etkinleşir.

### 3. İşleme Amaçları
- Turizm/otelcilik sektöründe **işe yerleştirme** ve aday-işveren eşleştirmesi
- İşverenlerin (otel/acenta) adayı değerlendirmesi
- İşe alım sonrası süreçler (sözleşme, vize/çalışma izni, seyahat/transfer organizasyonu)
- Belgelerin geçerlilik/uygunluk kontrolü

### 4. Hukuki Sebep
- Genel veriler: ilgili kişinin **açık rızası** ve/veya sözleşmenin kurulması/ifası
- Özel nitelikli veriler: yalnızca ilgili kişinin **açık rızası** (KVKK md. 6/2)

### 5. Aktarılan Taraflar
- **Oteller / acenta(lar):** aday eşleştiğinde, değerlendirme ve işe alım amacıyla
- **Altyapı sağlayıcısı:** Supabase (barındırma; sunucu konumu **Avrupa Birliği — Frankfurt**)
- **(Kullanılması hâlinde) belge doğrulama için yapay zeka hizmet sağlayıcısı**
  *(Şu an etkin değildir; etkinleştirilirse pasaport doğrulama amacıyla kullanılabilir.)*

### 6. Yurt Dışına Aktarım
Veriler, **yurt dışındaki** sunucu ve hizmet sağlayıcılarda (AB — Frankfurt; ve kullanılması
hâlinde yapay zeka sağlayıcısı) işlenebilir/saklanabilir. Bu aktarım **açık rıza** ile yapılır.

### 7. Saklama Süresi
- Belgeler ve kişisel veriler, işe yerleştirme amacı sürdükçe ve **[ör. hesabın silinmesi
  veya 2 yıl işlem görmemesi]** hâline kadar saklanır; sonrasında silinir/anonimleştirilir.
- Açık rıza kayıtları, ispat amacıyla **[saklama süresi]** boyunca tutulur.

### 8. İlgili Kişinin Hakları (KVKK md. 11)
İlgili kişi; verilerinin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme,
işlemeye itiraz ve zararın giderilmesini talep etme haklarına sahiptir. Başvurular
**info@turquz.com** üzerinden yapılır.

---

## BÖLÜM B — AÇIK RIZA METNİ (granüler)

> Uygulamada bu onaylar **ayrı kutucuklar** olarak sunulur; her biri reddedilebilir ve
> ilgili kişinin **kendi dilinde** gösterilir.

**1) Genel veri işleme ve paylaşım**
> Kişisel verilerimin (fotoğraflarım dâhil) yukarıda belirtilen amaçlarla işlenmesine ve
> eşleştiğim otel/acentalarla paylaşılmasına açık rıza veriyorum.

**2) Özel nitelikli veri**
> Özel nitelikli kişisel verilerimin — **kan grubum** ve **adli sicil belgem** — yukarıdaki
> amaçlarla işlenmesine açık rıza veriyorum.
> *(Uygulamada kan grubu rızası CV adımında, adli sicil rızası belge yükleme adımında ayrı
> ayrı alınır.)*

**3) Yurt dışına aktarım**
> Verilerimin, yurt dışındaki sunucu ve hizmet sağlayıcılarda (AB — Frankfurt ve kullanılması
> hâlinde doğrulama amaçlı yapay zeka sağlayıcısı) işlenmesine/aktarılmasına açık rıza veriyorum.

---

## Uygulama–metin eşleşmesi (geliştirici notu)
- Kayıt (aday): zorunlu genel + yurt dışı kutuları → `screens/AuthScreen.js`; oturum açılırsa `consents` yazılır
- Hesap/CV kapısı (rıza yoksa ana ekran/CV öncesi): `App.js` + `ConsentSheet`
- Belge yükleme rızası (genel + yurt dışı + adli sicil): `components/ConsentSheet.js`, `lib/consent.js`, tablo: `consents`
- Kan grubu rızası: `wizard/steps/Step1Personal.js` (`f_blood_consent`)
- Belge yükleme kapısı (otel/acenta kabulü): `candidate_status` tablosu
- Sunucu konumu: Supabase projesi **Frankfurt (eu-central-1)**
- Metin sürümü: `CONSENT_VERSION` — bu doküman değişince artır.
