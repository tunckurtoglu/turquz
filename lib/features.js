// lib/features.js — özellik bayrakları (dosyalar silinmez, sadece UI'dan kapatılır).

/** Turquz markalı uçuş bilgi kartı (buildFlightHtml + FlightForm + FlightPreview). */
export const FLIGHT_INFO_CARD_ENABLED = false;

/** Çerçeveli pasaport kamerası (PassportCamera). Pasaport yalnızca PDF ile yüklenir. */
export const PASSPORT_CAMERA_ENABLED = false;

/** Onboarding portalında "Otel Girişi" kartı. Altyapı (auth portal=hotel) durur; true yapınca tekrar görünür. */
export const HOTEL_PORTAL_ENABLED = false;

/**
 * Sözleşme görüntüleme/indirme web portalı + ödeme.
 * false = mevcut app içi ContractPreview (değişmez).
 * true  = "Görüntüle" Safari/Chrome'da contract portalını açar; PDF indirme ödemeden sonra.
 * Açmadan önce: 0055 SQL, contract-portal + webhook deploy, Stripe secrets, site-contract host.
 */
export const CONTRACT_WEB_PAYMENT_ENABLED = true;

/**
 * Süreç sohbeti: sözleşme ödemesi (paid/waived) sonrası acente ↔ aday.
 * Açmadan önce: 0058 + 0091 + 0101 SQL + process-chat edge deploy.
 */
export const PROCESS_CHAT_ENABLED = true;

/** Sohbet FAB / ekran: yalnız sözleşme ödendiğinde (veya waived). */
export function processChatUnlocked(status, contract) {
  if (!PROCESS_CHAT_ENABLED) return false;
  return !!contract?.isPaid;
}
