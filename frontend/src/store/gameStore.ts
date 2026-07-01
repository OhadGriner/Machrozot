import { create } from 'zustand'
import type { CellPosition, PuzzlePublic } from '../api/client'

export type { CellPosition }

export type CellState = 'default' | 'selected' | 'found' | 'spangram' | 'hint'

export interface WordLine {
  cells: CellPosition[]
  state: 'found' | 'spangram'
}

interface GameState {
  puzzle: PuzzlePublic | null
  selectedCells: CellPosition[]
  cellStates: Record<string, CellState>
  foundWords: string[]
  foundWordLines: WordLine[]
  nonThemeCount: number
  hintsEarned: number
  hintsUsed: number
  isComplete: boolean

  setPuzzle: (puzzle: PuzzlePublic) => void
  selectCell: (cell: CellPosition) => void
  clearSelection: () => void
  submitSelection: () => void
  useHint: () => void
}

function cellKey(cell: CellPosition) {
  return `${cell.row}-${cell.col}`
}

// Position-and-order match against the real answer path — a spelled-out
// string match isn't enough, since a repeated letter could let a player
// substitute the wrong (but identically-lettered) cell.
function pathsEqual(a: CellPosition[], b: CellPosition[]): boolean {
  return a.length === b.length && a.every((cell, i) => cell.row === b[i].row && cell.col === b[i].col)
}

export const useGameStore = create<GameState>((set, get) => ({
  puzzle: null,
  selectedCells: [],
  cellStates: {},
  foundWords: [],
  foundWordLines: [],
  nonThemeCount: 0,
  hintsEarned: 0,
  hintsUsed: 0,
  isComplete: false,

  setPuzzle: (puzzle) =>
    set({ puzzle, selectedCells: [], cellStates: {}, foundWords: [], foundWordLines: [], isComplete: false }),

  selectCell: (cell) => {
    const { selectedCells, cellStates } = get()
    const key = cellKey(cell)

    if (cellStates[key] === 'found' || cellStates[key] === 'spangram') return
    if (selectedCells.some((c) => cellKey(c) === key)) return

    const updated = selectedCells.map((c) => ({ ...c }))
    updated.push(cell)

    const updatedStates = { ...cellStates }
    updated.forEach((c) => {
      if (!updatedStates[cellKey(c)] || updatedStates[cellKey(c)] === 'default') {
        updatedStates[cellKey(c)] = 'selected'
      }
    })

    set({ selectedCells: updated, cellStates: updatedStates })
  },

  clearSelection: () => {
    const { cellStates, selectedCells } = get()
    const updatedStates = { ...cellStates }
    selectedCells.forEach((c) => {
      if (updatedStates[cellKey(c)] === 'selected') {
        updatedStates[cellKey(c)] = 'default'
      }
    })
    set({ selectedCells: [], cellStates: updatedStates })
  },

  submitSelection: () => {
    const { puzzle, selectedCells, cellStates, foundWords, nonThemeCount } = get()
    if (!puzzle || selectedCells.length < 2) {
      get().clearSelection()
      return
    }

    const isSpangram = pathsEqual(selectedCells, puzzle.spangram_cells)
    const isThemeWord = !isSpangram && puzzle.word_cells.some((cells) => pathsEqual(selectedCells, cells))

    if (isSpangram || isThemeWord) {
      const selectedWord = selectedCells.map((c) => puzzle.grid[c.row][c.col]).join('')
      const newState: CellState = isSpangram ? 'spangram' : 'found'
      const updatedStates = { ...cellStates }
      selectedCells.forEach((c) => { updatedStates[cellKey(c)] = newState })
      const updatedFoundWords = [...foundWords, selectedWord]
      const { foundWordLines } = get()
      const totalWords = puzzle.words.length + 1 // words + spangram
      set({
        cellStates: updatedStates,
        foundWords: updatedFoundWords,
        foundWordLines: [...foundWordLines, { cells: [...selectedCells], state: newState }],
        selectedCells: [],
        isComplete: updatedFoundWords.length === totalWords,
      })
    } else {
      const newNonThemeCount = selectedCells.length >= 4 ? nonThemeCount + 1 : nonThemeCount
      const newHintsEarned = Math.floor(newNonThemeCount / 3)
      get().clearSelection()
      set({ nonThemeCount: newNonThemeCount, hintsEarned: newHintsEarned })
    }
  },

  useHint: () => {
    const { puzzle, hintsEarned, hintsUsed, foundWords } = get()
    if (!puzzle || hintsUsed >= hintsEarned) return

    const allWords = [...puzzle.words, puzzle.spangram]
    const undiscoveredWord = allWords.find((w) => !foundWords.includes(w))
    if (!undiscoveredWord) return

    // TODO: hint needs word_cells from backend to reveal a specific cell
    // For now just increment hintsUsed
    set({ hintsUsed: hintsUsed + 1 })
  },
}))
