import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearOldProgress,
  clearProgress,
  loadProgress,
  saveProgress,
  type SavedProgress,
} from '../src/utils/persistence'

function makeProgress(overrides?: Partial<SavedProgress>): SavedProgress {
  return {
    cellStates: { '0-0': 'found' },
    foundWords: ['כחול'],
    foundWordLines: [{ cells: [{ row: 0, col: 0 }], state: 'found' }],
    hintWordLines: [],
    foundBonusWords: [],
    nonThemeCount: 0,
    hintsEarned: 0,
    hintsUsed: 0,
    isComplete: false,
    solveOrder: [{ type: 'word', hinted: false }],
    activeSeconds: 42,
    lastSavedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('saveProgress / loadProgress', () => {
  it('round-trips saved progress', () => {
    const progress = makeProgress()
    saveProgress(7, progress)

    expect(loadProgress(7)).toEqual(progress)
  })

  it('returns null when nothing was saved', () => {
    expect(loadProgress(7)).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('gameProgress-7', '{not json')

    expect(loadProgress(7)).toBeNull()
  })

  it('returns null for JSON that is not a progress shape', () => {
    localStorage.setItem('gameProgress-7', JSON.stringify({ hello: 'world' }))

    expect(loadProgress(7)).toBeNull()
  })

  it('keeps different puzzles separate', () => {
    saveProgress(1, makeProgress({ foundWords: ['אדומ'] }))
    saveProgress(2, makeProgress({ foundWords: ['כחול', 'צהוב'] }))

    expect(loadProgress(1)?.foundWords).toEqual(['אדומ'])
    expect(loadProgress(2)?.foundWords).toEqual(['כחול', 'צהוב'])
  })
})

describe('clearProgress', () => {
  it('removes only the given puzzle', () => {
    saveProgress(1, makeProgress())
    saveProgress(2, makeProgress())
    clearProgress(1)

    expect(loadProgress(1)).toBeNull()
    expect(loadProgress(2)).not.toBeNull()
  })
})

describe('clearOldProgress', () => {
  it('keeps recent entries and drops week-old ones', () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    saveProgress(1, makeProgress({ lastSavedAt: eightDaysAgo }))
    saveProgress(2, makeProgress())
    clearOldProgress()

    expect(loadProgress(1)).toBeNull()
    expect(loadProgress(2)).not.toBeNull()
  })

  it('drops entries whose saved payload is corrupt', () => {
    localStorage.setItem('gameProgress-9', '{corrupt')
    clearOldProgress()

    expect(localStorage.getItem('gameProgress-9')).toBeNull()
  })

  it('leaves unrelated localStorage keys alone', () => {
    localStorage.setItem('hasSeenTutorial', '1')
    clearOldProgress()

    expect(localStorage.getItem('hasSeenTutorial')).toBe('1')
  })
})
