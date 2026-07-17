import { describe, expect, it } from 'vitest'
import { fromServerResponse, pickRicherProgress, toServerPayload } from '../src/utils/progressSync'
import type { SavedProgress } from '../src/utils/persistence'
import type { ProgressResponse } from '../src/api/client'

function makeProgress(foundWords: string[], overrides?: Partial<SavedProgress>): SavedProgress {
  return {
    cellStates: {},
    foundWords,
    foundWordLines: [],
    hintWordLines: [],
    foundBonusWords: [],
    nonThemeCount: 0,
    hintsEarned: 0,
    hintsUsed: 0,
    isComplete: false,
    solveOrder: foundWords.map(() => ({ type: 'word' as const, hinted: false })),
    activeSeconds: 10,
    lastSavedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('pickRicherProgress', () => {
  it('returns null when neither side has progress', () => {
    expect(pickRicherProgress(null, null)).toBeNull()
  })

  it('returns local when there is no server copy', () => {
    const local = makeProgress(['כחול'])
    expect(pickRicherProgress(local, null)).toBe(local)
  })

  it('returns server when there is no local copy', () => {
    const server = makeProgress(['כחול'])
    expect(pickRicherProgress(null, server)).toBe(server)
  })

  it('picks the side with more found words', () => {
    const local = makeProgress(['כחול'])
    const server = makeProgress(['כחול', 'אדומ'])
    expect(pickRicherProgress(local, server)).toBe(server)
  })

  it('prefers local on a tie', () => {
    const local = makeProgress(['כחול'], { activeSeconds: 99 })
    const server = makeProgress(['אדומ'])
    expect(pickRicherProgress(local, server)).toBe(local)
  })
})

describe('server payload conversion', () => {
  it('round-trips through payload and response', () => {
    const progress = makeProgress(['כחול'], { activeSeconds: 42.7, isComplete: true })
    const payload = toServerPayload(progress)

    expect(payload.active_seconds).toBe(43)
    expect(payload.is_complete).toBe(true)

    const response: ProgressResponse = { ...payload, updated_at: new Date().toISOString() }
    const restored = fromServerResponse(response)

    expect(restored?.foundWords).toEqual(['כחול'])
    expect(restored?.activeSeconds).toBe(43)
    expect(restored?.isComplete).toBe(true)
  })

  it('returns null for a malformed server blob', () => {
    const response: ProgressResponse = {
      progress: { junk: true },
      active_seconds: 0,
      is_complete: false,
      updated_at: new Date().toISOString(),
    }
    expect(fromServerResponse(response)).toBeNull()
  })
})
