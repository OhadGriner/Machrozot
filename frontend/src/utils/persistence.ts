import type { CellState, SolveStep, WordLine } from '../store/gameStore'

export interface SavedProgress {
  cellStates: Record<string, CellState>
  foundWords: string[]
  foundWordLines: WordLine[]
  hintWordLines: WordLine[]
  foundBonusWords: string[]
  nonThemeCount: number
  hintsEarned: number
  hintsUsed: number
  isComplete: boolean
  solveOrder: SolveStep[]
  activeSeconds: number
  lastSavedAt: string
}

const KEY_PREFIX = 'gameProgress-'

function key(puzzleId: number) {
  return `${KEY_PREFIX}${puzzleId}`
}

// localStorage can be full or blocked (private browsing) — persistence is a
// nice-to-have, so every failure mode degrades to "no save" rather than a crash.
export function saveProgress(puzzleId: number, progress: SavedProgress): void {
  try {
    localStorage.setItem(key(puzzleId), JSON.stringify(progress))
  } catch {
    // ignore
  }
}

export function loadProgress(puzzleId: number): SavedProgress | null {
  try {
    const raw = localStorage.getItem(key(puzzleId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.foundWords)) return null
    return parsed as SavedProgress
  } catch {
    return null
  }
}

export function clearProgress(puzzleId: number): void {
  try {
    localStorage.removeItem(key(puzzleId))
  } catch {
    // ignore
  }
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Prune by age rather than "everything but the current puzzle" — a player can
// hop between today's puzzle and archive puzzles, and switching must not wipe
// the other one's progress. A week covers any realistic back-and-forth while
// still keeping localStorage from growing forever.
export function clearOldProgress(): void {
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(KEY_PREFIX)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(k) ?? '')
        const savedAt = Date.parse(parsed?.lastSavedAt ?? '')
        if (Number.isNaN(savedAt) || Date.now() - savedAt > MAX_AGE_MS) stale.push(k)
      } catch {
        stale.push(k)
      }
    }
    stale.forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
