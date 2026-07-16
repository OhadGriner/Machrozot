import { create } from 'zustand'
import type { CellPosition, PuzzlePublic } from '../api/client'
import { normalizeWord } from '../utils/hebrewUtils'

export type { CellPosition }

export type CellState = 'default' | 'selected' | 'found' | 'megaMachrozet' | 'hint'

export interface WordLine {
  cells: CellPosition[]
  state: 'found' | 'megaMachrozet' | 'hint'
}

export interface SolveStep {
  type: 'word' | 'megaMachrozet'
  hinted: boolean
}

interface GameState {
  puzzle: PuzzlePublic | null
  selectedCells: CellPosition[]
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
  hintWordLines: [],
  foundBonusWords: [],
  nonThemeCount: 0,
  hintsEarned: 0,
  hintsUsed: 0,
  isComplete: false,
  solveOrder: [],

  setPuzzle: (puzzle) =>
    set({
      puzzle, selectedCells: [], cellStates: {}, foundWords: [], foundWordLines: [],
      isComplete: false, solveOrder: [],
      hintWordLines: [], foundBonusWords: [], nonThemeCount: 0, hintsEarned: 0, hintsUsed: 0,
    }),

  selectCell: (cell) => {
    const { selectedCells, cellStates } = get()
    const key = cellKey(cell)

    if (cellStates[key] === 'found' || cellStates[key] === 'megaMachrozet') return
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
    const { puzzle, selectedCells, cellStates, foundWords, nonThemeCount, foundBonusWords } = get()
    if (!puzzle || selectedCells.length < 2) {
      get().clearSelection()
      return
    }

    const isMegaMachrozet = pathsEqual(selectedCells, puzzle.mega_machrozet_cells)
    const isThemeWord = !isMegaMachrozet && puzzle.word_cells.some((cells) => pathsEqual(selectedCells, cells))

    if (isMegaMachrozet || isThemeWord) {
      const selectedWord = selectedCells.map((c) => puzzle.grid[c.row][c.col]).join('')
      const newState: CellState = isMegaMachrozet ? 'megaMachrozet' : 'found'
      const updatedStates = { ...cellStates }
      selectedCells.forEach((c) => { updatedStates[cellKey(c)] = newState })
      const updatedFoundWords = [...foundWords, selectedWord]
      const { foundWordLines, hintWordLines, solveOrder } = get()
      const wasHinted = hintWordLines.some((line) => pathsEqual(line.cells, selectedCells))
      const totalWords = puzzle.words.length + 1 // words + mega machrozet
      set({
        cellStates: updatedStates,
        foundWords: updatedFoundWords,
        foundWordLines: [...foundWordLines, { cells: [...selectedCells], state: newState }],
        hintWordLines: hintWordLines.filter((line) => !pathsEqual(line.cells, selectedCells)),
        solveOrder: [
          ...solveOrder,
          { type: isMegaMachrozet ? 'megaMachrozet' : 'word', hinted: wasHinted },
        ],
        selectedCells: [],
        isComplete: updatedFoundWords.length === totalWords,
      })
    } else {
      const normalizedSelected = normalizeWord(
        selectedCells.map((c) => puzzle.grid[c.row][c.col]).join('')
      )
      const isBonusWord =
        selectedCells.length >= 4 &&
        puzzle.bonus_words.includes(normalizedSelected) &&
        !foundBonusWords.includes(normalizedSelected)

      const newNonThemeCount = isBonusWord ? nonThemeCount + 1 : nonThemeCount
      const newHintsEarned = Math.floor(newNonThemeCount / 3)
      const newFoundBonusWords = isBonusWord ? [...foundBonusWords, normalizedSelected] : foundBonusWords
      get().clearSelection()
      set({ nonThemeCount: newNonThemeCount, hintsEarned: newHintsEarned, foundBonusWords: newFoundBonusWords })
    }
  },

  useHint: () => {
    const { puzzle, hintsEarned, hintsUsed, foundWords, hintWordLines, cellStates } = get()
    if (!puzzle || hintsUsed >= hintsEarned) return

    const wordEntries = [
      ...puzzle.words.map((word, i) => ({ word, cells: puzzle.word_cells[i] })),
      { word: puzzle.mega_machrozet, cells: puzzle.mega_machrozet_cells },
    ]
    const alreadyHinted = new Set(hintWordLines.map((line) => line.cells.map(cellKey).join('|')))
    const target = wordEntries.find(
      ({ word, cells }) => !foundWords.includes(word) && !alreadyHinted.has(cells.map(cellKey).join('|'))
    )
    if (!target) return

    const updatedStates = { ...cellStates }
    target.cells.forEach((c) => {
      const key = cellKey(c)
      if (updatedStates[key] !== 'selected') updatedStates[key] = 'hint'
    })

    set({
      hintsUsed: hintsUsed + 1,
      cellStates: updatedStates,
      hintWordLines: [...hintWordLines, { cells: target.cells, state: 'hint' }],
    })
  },
}))
