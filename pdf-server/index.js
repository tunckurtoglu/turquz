// Turquz PDF servisi — CV HTML'ini GERÇEK Chrome (Puppeteer) ile A4 PDF'e çevirir.
// Neden ayrı servis: tarayıcı içi html2canvas bu CV'nin grid düzenini çizemiyor (boş PDF);
// Supabase Edge (Deno) ise headless Chrome çalıştıramıyor. Bu küçük Node servisi gerçek
// Chrome kullandığı için her tarayıcıdan gelen istekte kusursuz, kesin 2 sayfa PDF üretir.
//
// Çalıştır:  cd pdf-server && npm install && npm start   (varsayılan http://localhost:8787)
// Ayarlar:   PORT, CORS_ORIGIN, PDF_TOKEN  (pdf-server/.env değil; ortam değişkeni ya da shell'den)
import express from 'express';
import puppeteer from 'puppeteer';

const PORT = process.env.PORT || 8787;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const PDF_TOKEN = process.env.PDF_TOKEN || ''; // boşsa koruma yok (lokal için uygun)

const app = express();
app.use(express.json({ limit: '25mb' })); // CV HTML + gömülü fotoğraflar büyük olabilir

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.set('Access-Control-Allow-Headers', 'content-type, authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Tek bir Chrome örneğini paylaş (her istekte yeniden başlatma maliyetinden kaçın).
let browserP = null;
const getBrowser = async () => {
  if (!browserP) {
    browserP = puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserP;
};

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/cv-pdf', async (req, res) => {
  try {
    if (PDF_TOKEN && req.headers.authorization !== `Bearer ${PDF_TOKEN}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { html, filename } = req.body || {};
    if (!html || typeof html !== 'string') return res.status(400).json({ error: 'html gerekli' });

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      // Fontlar ve fotoğraflar yüklensin; sonra @media print'i etkinleştir (kesin 2 sayfa CSS'imiz çalışsın).
      await page.setContent(html, { waitUntil: 'networkidle0' });
      await page.evaluateHandle('document.fonts.ready');
      await page.emulateMediaType('print');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        preferCSSPageSize: true,
      });
      const safe = String(filename || 'cv').replace(/[^\w.-]/g, '_');
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="${safe}.pdf"`);
      // Puppeteer Uint8Array döndürür; Express bunu JSON'a çevirmesin diye Buffer'a sar.
      res.send(Buffer.from(pdf));
    } finally {
      await page.close();
    }
  } catch (e) {
    console.error('[pdf-server] hata:', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(PORT, () => console.log(`[pdf-server] dinlemede: http://localhost:${PORT}`));
