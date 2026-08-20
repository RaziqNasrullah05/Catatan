/**
 * Menahan hasil sebentar supaya kerangka pemuatan tidak berkedip.
 * Tanpa ini, respons yang sangat cepat membuat skeleton muncul lalu hilang
 * dalam puluhan milidetik — terlihat seperti kedipan, bukan pemuatan.
 */
export const MIN_SKELETON = 500;

export function withMinDelay(promise, ms = MIN_SKELETON) {
  return Promise.all([promise, new Promise((r) => setTimeout(r, ms))]).then(([hasil]) => hasil);
}