import type { PuzzlePublic } from '../api/client'

// A tiny hardcoded 4x4 puzzle used only for the onboarding tutorial — never
// fetched from the backend. Colors theme. The tutorial (TutorialScreen.tsx)
// walks through it in a fixed order: find "כחול" manually first, then the
// mega machrozet "צבעימ" (its purpose explained), then use the hint
// mechanic to reveal and find "אדומ".
export const tutorialPuzzle: PuzzlePublic = {
  id: -1,
  theme: 'צבעים',
  grid: [
    ['צ', 'ח', 'מ', 'ו'],
    ['ז', 'ב', 'א', 'ד'],
    ['ט', 'ע', 'י', 'מ'],
    ['כ', 'ח', 'ו', 'ל'],
  ],
  word_count: 2,
  mega_machrozet: 'צבעימ',
  words: ['כחול', 'אדומ'],
  mega_machrozet_cells: [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
    { row: 2, col: 1 },
    { row: 2, col: 2 },
    { row: 2, col: 3 },
  ],
  word_cells: [
    [
      { row: 3, col: 0 },
      { row: 3, col: 1 },
      { row: 3, col: 2 },
      { row: 3, col: 3 },
    ],
    [
      { row: 1, col: 2 },
      { row: 1, col: 3 },
      { row: 0, col: 3 },
      { row: 0, col: 2 },
    ],
  ],
  bonus_words: [],
}
