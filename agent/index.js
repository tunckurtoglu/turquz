// agent/index.js
// Turquz mülakat ÇEVİRMEN AJANI (app dışı küçük servis). @livekit/agents 1.x
// Akış: odaya görünmez katılır -> her katılımcının sesini Deepgram ile yazıya çevirir
//       -> Gemini ile KARŞI tarafın diline çevirir -> 'captions' data kanalına basar
//       -> transkripti Supabase'e yazar (interview_transcripts).
//
// Katılımcı dili: token metadata.lang üzerinden okunur (livekit-token fonksiyonu yazıyor).
// Oda adı "iv-<acente>-<slotKey>" (aynı slotu seçen 1-3 aday + acente aynı odada). Transkript oda bazlı tutulur.
//
// ÇALIŞTIRMA:  cd agent && npm install ; .env doldur ; npm run dev
import { WorkerOptions, cli, defineAgent, stt as sttNs } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
// NOT: deepgram yalnızca STT_PROVIDER=deepgram iken TEMBEL (dynamic) import edilir.
// Üstte koşulsuz import edilseydi, paket yüklenemezse Deepgram kullanılmasa bile ajan çökerdi.
import { AudioStream, RoomEvent, TrackKind } from '@livekit/rtc-node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload, EncodingOptions } from 'livekit-server-sdk';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Çeviri için en hızlı model (kısa metinler) + düşük gecikme ayarları.
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({
  model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite',
  generationConfig: { temperature: 0, maxOutputTokens: 512 },
});

// Güvenlik ağı: tek bir geçici hata (örn. stream teardown) ajan/iş sürecini ÖLDÜRMESİN.
process.on('unhandledRejection', (e) => console.warn('unhandledRejection:', e?.message || e));
process.on('uncaughtException', (e) => console.warn('uncaughtException:', e?.message || e));

const LANG_NAME = {
  tr: 'Turkish', en: 'English', ru: 'Russian', kk: 'Kazakh', ky: 'Kyrgyz',
  uz: 'Uzbek', th: 'Thai', fa: 'Persian', de: 'German', tk: 'Turkmen',
};

// STT: Groq Whisper (whisper-large-v3-turbo) + Silero VAD.
// VAD sadece KONUŞMA parçalarını Groq'a yollar -> sessizlik faturalanmaz (ucuz) + düşük gecikme.
// Groq ~$0.04/saat; çok dilli (Whisper). Whisper'ın desteklediği dillerde dili sabitleriz (doğruluk),
// desteklemediğinde (ky/tk) otomatik algılamaya bırakırız.
const WHISPER_LANGS = new Set(['tr', 'en', 'ru', 'de', 'th', 'kk', 'uz', 'fa', 'uk', 'az', 'hy']);
let vadPromise = null;
// Cümle bütünlüğü + halüsinasyon önleme:
//  - minSilenceDuration 500ms: cümle içi kısa duraklamalarda KESMEZ (clause aralarında kişi nefes alır);
//    cümleyi bütün yakalar -> çeviri tutarlı olur. (Eskiden 250ms idi, cümleyi ortadan biçiyordu.)
//  - maxBufferedSpeech 15000ms: 15sn'ye kadar kesintisiz konuşmayı TEK parça olarak yakalar
//    -> uzun cümleler yarıda kesilmez ("ignoring further data" yaşanmaz). (Eskiden 6sn idi.)
//  - activationThreshold 0.6 + minSpeechDuration 250ms: gürültü/çok kısa sesler Whisper'a gitmez
//    (Whisper sessizlik/gürültüde "izlediğiniz için teşekkürler" gibi uydurmalar üretir; kaynağı keseriz).
// Bedeli: 15sn boyunca HİÇ durmadan konuşulursa o altyazı 15sn gecikir; ama doğal konuşmada
// duraklamalar daha erken keser, bu yüzden pratikte yalnızca çok uzun monologları etkiler.
const getVad = () => (vadPromise ||= silero.VAD.load({
  minSilenceDuration: 500, maxBufferedSpeech: 15000, prefixPaddingDuration: 300,
  activationThreshold: 0.6, minSpeechDuration: 250,
}));

// Kaynak metni hedef dile çevir (Gemini). Hata olursa orijinali döndür.
// context = konuşmacının ÖNCEKİ cümlesi (varsa). Bölünmüş/devam eden cümleler bağlamla daha tutarlı çevrilir.
async function translate(text, targetLang, context = '') {
  const target = LANG_NAME[targetLang] || 'English';
  try {
    const prompt =
      `You are a faithful live interpreter translating an interview into ${target}.\n` +
      (context
        ? `CONTEXT (the speaker's previous line — use ONLY to understand the continuation; do NOT translate, repeat, or include it):\n"${context}"\n\n`
        : '') +
      `Translate ONLY the NEW line below into ${target}.\n` +
      `Rules: translate EXACTLY what is written in NEW; do NOT add, remove, explain, merge, or invent anything. ` +
      `If NEW is already in ${target} or cannot be translated, return it unchanged. ` +
      `Output ONLY the translation of NEW — no quotes, no notes, no context.\n\nNEW:\n${text}`;
    const r = await gemini.generateContent(prompt);
    return r.response.text().trim() || text;
  } catch (e) {
    console.warn('translate error:', e?.message);
    return text;
  }
}

// Görüşmeyi S3'e kaydet (LiveKit Egress, sunucuda). S3 env yoksa atlanır.
// Oda boşalınca egress otomatik durur. 30 gün sonra silme: S3 lifecycle kuralıyla (bkz. README).
async function startRecording(roomName) {
  if (!process.env.S3_BUCKET) { console.log('S3 ayarlı değil — kayıt atlandı.'); return; }
  try {
    const httpUrl = (process.env.LIVEKIT_URL || '').replace('wss://', 'https://').replace('ws://', 'http://');
    const eg = new EgressClient(httpUrl, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `interviews/${roomName}-{time}.mp4`,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: process.env.S3_ACCESS_KEY,
          secret: process.env.S3_SECRET,
          bucket: process.env.S3_BUCKET,
          region: process.env.S3_REGION,
          endpoint: process.env.S3_ENDPOINT || undefined,         // R2/B2/Supabase için
          forcePathStyle: !!process.env.S3_ENDPOINT,
        }),
      },
    });
    // Ekonomik kodlama: 720p / 24 fps / ~1200 kbps. Mülakat için yeterli, dosya küçük.
    // Daha da küçük istersen: width:854, height:480, videoBitrate:700.
    const encodingOptions = new EncodingOptions({
      width: 1280, height: 720, framerate: 24,
      videoBitrate: 1200, audioBitrate: 64, keyFrameInterval: 4,
    });
    await eg.startRoomCompositeEgress(roomName, output, { layout: 'grid', encodingOptions });
    console.log('Kayıt başladı:', roomName);
  } catch (e) {
    console.warn('Kayıt başlatılamadı:', e?.message);
  }
}

// Whisper'ın sessizlik/gürültüde ürettiği BİLİNEN uydurma kalıpları (YouTube altyazısı artığı).
// Bütün segment buysa atlanır (gerçek konuşmada bu kalıplar tek başına çıkmaz).
const HALLUCINATION_RE = [
  /izlediğiniz için te[şs]ekk[üu]r/i, /abone olmay[ıi] unutmay/i, /altyaz[ıi]\s*m\.?k\.?/i,
  /thanks?\s+for\s+watching/i, /please\s+subscribe/i, /subscribe\s+to/i, /subtitles?\s+by/i, /amara\.org/i,
  /спасибо\s+за\s+просмотр/i, /подписывайтесь/i, /продолжение\s+следует/i,
  /субтитр/i, /dimatorzok/i, /редактор/i, /корректор/i, /перевод[чи]/i, // Rusça altyazı/çeviri artıkları
  /字幕/, /ご視聴/,
];
// Aynı kelime/öbeğin döngüde tekrarı (Whisper "что я говорю, что я говорю...") -> uydurma.
const isRepetitionLoop = (t) => {
  const words = t.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const uniq = new Set(words).size;
  return uniq / words.length < 0.4; // kelimelerin %60+'sı tekrar -> döngü
};
const isHallucination = (text) => {
  const t = String(text || '').trim();
  if (t.length < 2) return true;                 // tek harf/noktalama
  if (/^[\s\p{P}\p{S}]+$/u.test(t)) return true; // sadece noktalama/sembol
  if (HALLUCINATION_RE.some((re) => re.test(t))) return true;
  if (isRepetitionLoop(t)) return true;
  return false;
};

const metaOf = (p) => { try { return JSON.parse(p?.metadata || '{}'); } catch { return {}; } };
const langOf = (p) => metaOf(p).lang || 'en';
const roleOf = (p) => metaOf(p).role || p?.name || 'candidate';

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect();
    const room = ctx.room;
    console.log('Ajan odaya katıldı:', room.name);

    // Görüşmeyi kaydet (S3'e). Oda boşalınca otomatik durur.
    startRecording(room.name);

    // TÜM katılımcıların seçtiği diller (çeviri hedefleri) — konuşmacı dahil.
    // Böylece her cihaz, konuşan kim olursa olsun, kendi dilinde altyazı bulur.
    const allTargetLangs = () => {
      const langs = new Set();
      for (const p of room.remoteParticipants.values()) langs.add(langOf(p));
      // Kimse metadata göndermediyse en azından en ile yayınla (chat boş kalmasın).
      if (!langs.size) langs.add('en');
      return [...langs];
    };

    const enc = (o) => new TextEncoder().encode(JSON.stringify(o));
    const publish = (o, topic = 'captions') => {
      room.localParticipant.publishData(enc(o), { reliable: true, topic }).catch((e) => console.warn('publish err', e?.message));
    };
    // Altyazı sağlık sinyali: STT hatasında false, akış geldiğinde true. İstemci "kullanılamıyor" gösterir.
    const publishStatus = (ok, reason) => publish({ type: 'caption_status', ok, reason, ts: Date.now() });
    let seq = 0; // her FINAL cümleye monoton sıra no — istemci eski (stale) altyazıyı düşürür.

    // Bir katılımcının ses parçasını dinle: STT -> çeviri -> altyazı + transkript.
    const handleAudio = async (track, participant) => {
      const role = roleOf(participant);
      const appLang = langOf(participant);
      const speaker = participant.identity;
      // Akış motoru seçimi:
      //  - STT_PROVIDER=deepgram + DEEPGRAM_API_KEY  -> Deepgram streaming (INTERIM altyazı, "canlı" his).
      //  - aksi halde (varsayılan)                    -> Groq Whisper batch + Silero VAD (ucuz, final-only).
      const useDeepgram = process.env.STT_PROVIDER === 'deepgram' && !!process.env.DEEPGRAM_API_KEY;
      const supported = WHISPER_LANGS.has(appLang);
      console.log('Ses dinleniyor:', speaker, `(${role}, dil: ${appLang}${supported ? '' : ' -> otomatik algıla'}, motor: ${useDeepgram ? 'deepgram' : 'groq'})`);

      let sttStream;
      if (useDeepgram) {
        const deepgram = await import('@livekit/agents-plugin-deepgram');
        const dg = new deepgram.STT({
          apiKey: process.env.DEEPGRAM_API_KEY,
          model: process.env.DEEPGRAM_MODEL || 'nova-2',
          interimResults: true, punctuate: true,
          ...(supported ? { language: appLang, detectLanguage: false } : { detectLanguage: true }),
        });
        try { dg.on?.('error', (e) => { console.warn('STT hata:', e?.message || e); publishStatus(false, 'stt'); }); } catch { /* yoksay */ }
        sttStream = dg.stream();
      } else {
        const vad = await getVad();
        const groq = openai.STT.withGroq({
          model: process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo',
          apiKey: process.env.GROQ_API_KEY,
          ...(supported ? { language: appLang, detectLanguage: false } : { detectLanguage: true }),
        });
        const engine = new sttNs.StreamAdapter(groq, vad);
        try { engine.on?.('error', (e) => { console.warn('STT hata:', e?.message || e); publishStatus(false, 'stt'); }); } catch { /* yoksay */ }
        sttStream = engine.stream();
      }
      let lastText = '';      // ardışık aynı FINAL metni (Whisper tekrarı) atlamak için
      let lastInterim = '';   // aynı interim'i tekrar yayınlamamak için
      let prevFinal = '';     // konuşmacının önceki cümlesi -> çeviriye bağlam olarak verilir

      // Ses çerçevelerini 16kHz mono olarak STT'ye akıt.
      (async () => {
        const audio = new AudioStream(track, 16000, 1);
        try { for await (const frame of audio) { try { sttStream.pushFrame(frame); } catch { break; } } } catch (e) { /* track bitti */ }
        try { sttStream.endInput(); } catch { /* zaten kapalı (WritableStream locked) — yoksay */ }
      })();

      for await (const ev of sttStream) {
        const alt = ev.alternatives?.[0];
        const text = alt?.text?.trim();
        const srcLang = alt?.language || appLang;

        // INTERIM: konuşma bitmeden kaynak dilde "canlı" satır (çeviri YOK — hızlı/titremesiz). Tüm cihazlara.
        if (ev.type === sttNs.SpeechEventType.INTERIM_TRANSCRIPT) {
          if (!text || text === lastInterim || isHallucination(text)) continue;
          lastInterim = text;
          publish({ type: 'caption', role, speaker, lang: srcLang, target: '*', text, original: text, final: false, ts: Date.now() });
          continue;
        }
        if (ev.type !== sttNs.SpeechEventType.FINAL_TRANSCRIPT) continue;
        if (!text) continue;
        if (isHallucination(text)) { console.log('⤫ uydurma atlandı:', text); continue; }
        if (text === lastText) continue; // aynı metnin tekrarını atla
        lastText = text; lastInterim = '';
        const mySeq = ++seq;

        // Her dile AYRI yayınla: çeviri biten dil hemen gönderilir; bir cihaz başka dilin çevirisini beklemez.
        // Aynı anda transkript için tüm çevirileri topla, hepsi bitince tek satır olarak kaydet.
        // Çeviriye konuşmacının ÖNCEKİ cümlesi (prevFinal) bağlam olarak verilir -> bölünmüş cümleler tutarlı.
        const ctx = prevFinal;
        prevFinal = text;
        const targets = allTargetLangs();
        const translations = {};
        await Promise.all(targets.map(async (lg) => {
          let out;
          try { out = (lg === srcLang) ? text : await translate(text, lg, ctx); } catch { out = text; }
          translations[lg] = out;
          publish({ type: 'caption', role, speaker, lang: srcLang, target: lg, text: out, original: text, final: true, seq: mySeq, ts: Date.now() });
        }));
        publishStatus(true); // akış çalışıyor -> istemcideki "kullanılamıyor" uyarısını temizle
        console.log(`[${role}/${srcLang}] #${mySeq} "${text}" -> hedef diller: [${targets.join(', ')}]`);

        // Transkript: oda bazlı (paylaşımlı oda birden çok adayı barındırabilir).
        // speaker_user_id = konuşan kişi; candidate_user_id geriye dönük uyumluluk için aynı değer.
        const row = {
          candidate_user_id: speaker, speaker_user_id: speaker, room: room.name,
          speaker_role: role, src_lang: srcLang, text_original: text, translations,
        };
        supabase.from('interview_transcripts').insert(row).then(({ error }) => {
          if (!error) return;
          // Migration 0036 henüz çalışmadıysa (speaker_user_id kolonu yok) o alansız tekrar dene.
          if (/speaker_user_id/.test(error.message || '')) {
            const { speaker_user_id, ...legacy } = row;
            supabase.from('interview_transcripts').insert(legacy).then(({ error: e2 }) => { if (e2) console.warn('transcript err', e2.message); });
          } else { console.warn('transcript err', error.message); }
        });
      }
    };

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === TrackKind.KIND_AUDIO) handleAudio(track, participant).catch((e) => { console.warn('stt err', e?.message); publishStatus(false, 'stt'); });
    });

    // Ajan bağlanmadan önce yayında olan sesler için.
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.trackPublications.values()) {
        if (pub.track && pub.kind === TrackKind.KIND_AUDIO) handleAudio(pub.track, p).catch(() => {});
      }
    }
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
