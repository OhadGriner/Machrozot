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
  spangram: 'דב',
  words: ['אבג'],
  spangram_cells: [
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

  it('accepts the spangram by its real cell path', () => {
    const { selectCell, submitSelection } = useGameStore.getState()
    selectCell({ row: 1, col: 0 })
    selectCell({ row: 1, col: 1 })
    submitSelection()

    expect(useGameStore.getState().foundWords).toEqual(['דב'])
    expect(useGameStore.getState().cellStates['1-0']).toBe('spangram')
  })
})
