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
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { AudioStream, RoomEvent, TrackKind } from '@livekit/rtc-node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EgressClient, EncodedFileOutput, EncodedFileType, S3Upload, EncodingOptions } from 'livekit-server-sdk';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY).getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.5-flash' });

const LANG_NAME = {
  tr: 'Turkish', en: 'English', ru: 'Russian', kk: 'Kazakh', ky: 'Kyrgyz',
  uz: 'Uzbek', th: 'Thai', fa: 'Persian', de: 'German', tk: 'Turkmen',
};

// Kaynak metni hedef dile çevir (Gemini). Hata olursa orijinali döndür.
async function translate(text, targetLang) {
  const target = LANG_NAME[targetLang] || 'English';
  try {
    const r = await gemini.generateContent(
      `You are a live interpreter. Translate the following text to ${target}. Output ONLY the translation, no quotes, no notes.\n\n${text}`,
    );
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

    // Konuşmacı dışındaki katılımcıların dilleri (çeviri hedefleri).
    const targetsExcept = (speakerIdentity) => {
      const langs = new Set();
      for (const p of room.remoteParticipants.values()) {
        if (p.identity !== speakerIdentity) langs.add(langOf(p));
      }
      return [...langs];
    };

    // Bir katılımcının ses parçasını dinle: STT -> çeviri -> altyazı + transkript.
    const handleAudio = async (track, participant) => {
      const role = roleOf(participant);
      console.log('Ses dinleniyor:', participant.identity, `(${role})`);
      const engine = new deepgram.STT({ model: 'nova-2', language: 'multi', interimResults: false, punctuate: true });
      const sttStream = engine.stream();

      // Ses çerçevelerini 16kHz mono olarak STT'ye akıt.
      (async () => {
        const audio = new AudioStream(track, 16000, 1);
        try { for await (const frame of audio) sttStream.pushFrame(frame); } catch (e) { /* track bitti */ }
        sttStream.endInput();
      })();

      for await (const ev of sttStream) {
        if (ev.type !== sttNs.SpeechEventType.FINAL_TRANSCRIPT) continue;
        const alt = ev.alternatives?.[0];
        const text = alt?.text?.trim();
        if (!text) continue;
        const srcLang = alt?.language || langOf(participant);

        const targets = targetsExcept(participant.identity);
        const translations = {};
        await Promise.all(targets.map(async (lg) => { translations[lg] = await translate(text, lg); }));

        const payload = new TextEncoder().encode(JSON.stringify({
          type: 'caption', role, original: text, lang: srcLang, tr: translations, final: true, ts: Date.now(),
        }));
        try { await room.localParticipant.publishData(payload, { reliable: true, topic: 'captions' }); } catch (e) { console.warn('publish err', e?.message); }

        // Transkript: oda bazlı (paylaşımlı oda birden çok adayı barındırabilir).
        // candidate_user_id = konuşan kişinin user_id'si (participant.identity).
        supabase.from('interview_transcripts').insert({
          candidate_user_id: participant.identity,
          room: room.name,
          speaker_role: role,
          src_lang: srcLang,
          text_original: text,
          translations,
        }).then(({ error }) => { if (error) console.warn('transcript err', error.message); });

        console.log(`[${role}/${srcLang}] ${text}`);
      }
    };

    room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
      if (track.kind === TrackKind.KIND_AUDIO) handleAudio(track, participant).catch((e) => console.warn('stt err', e?.message));
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
