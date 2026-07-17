const LETTER_PATTERN = /[A-Za-zÇĞİÖŞÜçğıöşü]/g;
const WORD_PATTERN = /[A-Za-zÇĞİÖŞÜçğıöşü]+/g;
const VOWEL_PATTERN = /[aeıioöuüAEIİOÖUÜ]/;

export function isMeaningfulText(value) {
  const cleaned = value.trim().replace(/\s+/g, ' ');
  const letters = cleaned.match(LETTER_PATTERN) || [];
  const words = cleaned.match(WORD_PATTERN) || [];

  if (letters.length < 6) return false;
  if (words.length === 1 && words[0].length < 8) return false;
  if (!VOWEL_PATTERN.test(cleaned)) return false;
  if (/(.)\1{4,}/i.test(cleaned)) return false;
  if (new Set(letters.map((letter) => letter.toLocaleLowerCase('tr-TR'))).size < 3) return false;
  return true;
}

export function getLocalIsoDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getInclusiveDayCount(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) return null;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  return Math.round((end - start) / 86400000) + 1;
}
