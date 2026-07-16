import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../src/store/gameStore'
import type { PuzzlePublic } from '../src/api/client'

// Grid has a repeated letter pair (ב/ג at row 0 and row 1) so a "decoy" path
// can spell the exact same string as the real word via different cells.
const puzzle: PuzzlePublic = {
  id: 1,
  theme: 'בדיקה',
  grid: [
    ['א', 'ב', 'ג'],
    ['ד', 'ב', 'ג'],
  ],
  word_count: 1,
  mega_machrozet: 'דב',
  words: ['אבג'],
  bonus_words: ['אדבג'],
  mega_machrozet_cells: [
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ],
  word_cells: [
    [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ],
  ],
}

beforeEach(() => {
  useGameStore.getState().setPuzzle(puzzle)
})

describe('submitSelection', () => {
  it('accepts the real word_cells path', () => {
    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 0, col: 0 })
    selectCell({ row: 0, col: 1 })
    selectCell({ row: 0, col: 2 })
    submitSelection()

    expect(useGameStore.getState().foundWords).toEqual(['אבג'])
  })

  it('rejects a decoy path that spells the same letters via different cells', () => {
    // (0,0)=א -> (1,1)=ב -> (1,2)=ג also spells "אבג", but these are not the
    // stored word_cells — a player must not be able to substitute one
    // occurrence of a repeated letter for another.
    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 0, col: 0 })
    selectCell({ row: 1, col: 1 })
    selectCell({ row: 1, col: 2 })
    submitSelection()

    expect(useGameStore.getState().foundWords).toEqual([])
  })

  it('accepts the mega machrozet by its real cell path', () => {
    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 1, col: 0 })
    selectCell({ row: 1, col: 1 })
    submitSelection()

    expect(useGameStore.getState().foundWords).toEqual(['דב'])
    expect(useGameStore.getState().cellStates['1-0']).toBe('megaMachrozet')
  })
})

describe('bonus word gating', () => {
  it('increments nonThemeCount when a real bonus word is selected', () => {
    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 0, col: 0 })
    selectCell({ row: 1, col: 0 })
    selectCell({ row: 1, col: 1 })
    selectCell({ row: 1, col: 2 })
    submitSelection()

    expect(useGameStore.getState().nonThemeCount).toBe(1)
    expect(useGameStore.getState().foundBonusWords).toEqual(['אדבג'])
  })

  it('does not increment nonThemeCount for a nonsense 4+ letter selection', () => {
    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 0, col: 0 })
    selectCell({ row: 0, col: 1 })
    selectCell({ row: 1, col: 1 })
    selectCell({ row: 1, col: 2 })
    submitSelection()

    expect(useGameStore.getState().nonThemeCount).toBe(0)
    expect(useGameStore.getState().foundBonusWords).toEqual([])
  })

  it('does not double-count re-selecting the same bonus word', () => {
    const { selectCell, submitSelection } = useGameStore.getState()
    for (let i = 0; i < 2; i++) {
      selectCell({ row: 0, col: 0 })
      selectCell({ row: 1, col: 0 })
      selectCell({ row: 1, col: 1 })
      selectCell({ row: 1, col: 2 })
      submitSelection()
    }

    expect(useGameStore.getState().nonThemeCount).toBe(1)
  })

  it('does not clobber a hint granted through another means (e.g. the tutorial) when a wrong selection is submitted', () => {
    useGameStore.setState({ hintsEarned: 1 })
    const { selectCell, submitSelection } = useGameStore.getState()
    // A nonsense selection that isn't the theme word, mega machrozet, or a bonus word.
    selectCell({ row: 0, col: 1 })
    selectCell({ row: 1, col: 1 })
    selectCell({ row: 1, col: 2 })
    submitSelection()

    expect(useGameStore.getState().hintsEarned).toBe(1)
  })
})

describe('useHint', () => {
  it('does nothing when no hint credits are available', () => {
    useGameStore.getState().useHint()

    const state = useGameStore.getState()
    expect(state.hintsUsed).toBe(0)
    expect(state.hintWordLines).toEqual([])
  })

  it('reveals a not-yet-found word\'s cells and connecting line', () => {
    useGameStore.setState({ hintsEarned: 1 })
    useGameStore.getState().useHint()

    const state = useGameStore.getState()
    expect(state.hintsUsed).toBe(1)
    expect(state.cellStates['0-0']).toBe('hint')
    expect(state.cellStates['0-1']).toBe('hint')
    expect(state.cellStates['0-2']).toBe('hint')
    expect(state.hintWordLines).toEqual([{ cells: puzzle.word_cells[0], state: 'hint' }])
  })

  it('reveals the mega machrozet only after the theme word has already been hinted', () => {
    useGameStore.setState({ hintsEarned: 2 })
    useGameStore.getState().useHint()
    useGameStore.getState().useHint()

    const state = useGameStore.getState()
    expect(state.hintWordLines).toHaveLength(2)
    expect(state.hintWordLines[0].cells).toEqual(puzzle.word_cells[0])
    expect(state.hintWordLines[1].cells).toEqual(puzzle.mega_machrozet_cells)
  })

  it('no-ops without consuming a credit once every remaining word is already hinted', () => {
    useGameStore.setState({ hintsEarned: 3 })
    useGameStore.getState().useHint()
    useGameStore.getState().useHint()
    useGameStore.getState().useHint()

    expect(useGameStore.getState().hintsUsed).toBe(2)
  })

  it('clears the hint outline once the word is actually found', () => {
    useGameStore.setState({ hintsEarned: 1 })
    useGameStore.getState().useHint()
    expect(useGameStore.getState().hintWordLines).toHaveLength(1)

    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 0, col: 0 })
    selectCell({ row: 0, col: 1 })
    selectCell({ row: 0, col: 2 })
    submitSelection()

    expect(useGameStore.getState().hintWordLines).toEqual([])
    expect(useGameStore.getState().cellStates['0-0']).toBe('found')
  })
})

describe('setPuzzle', () => {
  it('resets hint/non-theme progress so it cannot leak across puzzles', () => {
    useGameStore.setState({ nonThemeCount: 5, hintsEarned: 1, hintsUsed: 1, hintWordLines: [{ cells: [], state: 'hint' }] })

    useGameStore.getState().setPuzzle(puzzle)

    const state = useGameStore.getState()
    expect(state.nonThemeCount).toBe(0)
    expect(state.hintsEarned).toBe(0)
    expect(state.hintsUsed).toBe(0)
    expect(state.hintWordLines).toEqual([])
  })
})
