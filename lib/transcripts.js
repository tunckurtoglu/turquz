// lib/transcripts.js
// Mülakat konuşma transkripti (yazılı kayıt). Ajan yazar; iki taraf okur (RLS). Bkz. 0024.
import { supabase } from './supabase';

// Adayın mülakat ODASININ tüm transkripti (aday + acente + varsa diğer adaylar). RPC, RLS-güvenli.
export async function getTranscript(candidateUserId) {
  if (!candidateUserId) return [];
  const { data, error } = await supabase.rpc('session_transcript', { p_candidate: candidateUserId });
  if (error) { console.warn('Transkript okunamadı:', error.message); return []; }
  return data || [];
}
