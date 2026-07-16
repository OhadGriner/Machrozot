const FINAL_TO_REGULAR: Record<string, string> = {
  'ך': 'כ',
  'ם': 'מ',
  'ן': 'נ',
  'ף': 'פ',
  'ץ': 'צ',
}

// Must stay in sync with backend/app/services/hebrew_utils.py's normalize_word.
export function normalizeWord(word: string): string {
  return word.split('').map((ch) => FINAL_TO_REGULAR[ch] ?? ch).join('')
}
