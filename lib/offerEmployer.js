import { supabase } from './supabase';

/** Aday: teklif kartında gösterilecek işletme (ödeme öncesi sansürlü). */
export async function getCandidateOfferDisplay(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.rpc('candidate_offer_employer');
  if (error) throw error;
  return data || null;
}

/** Aday: mülakat davetinde gösterilecek işletme (ödeme öncesi sansürlü). */
export async function getCandidateInterviewDisplay(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.rpc('candidate_interview_employer');
  if (error) throw error;
  return data || null;
}

/** Aday: ödeme sonrası sözleşmedeki işletmenin güvenli iletişim özeti. */
export async function getCandidateContractEmployer(candidateUserId) {
  if (!candidateUserId) return null;
  const { data, error } = await supabase.rpc('candidate_contract_employer');
  if (error) throw error;
  return data || null;
}
