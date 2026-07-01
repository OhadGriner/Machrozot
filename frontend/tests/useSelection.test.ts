import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSelection } from '../src/hooks/useSelection'
import { useGameStore } from '../src/store/gameStore'
import type { PuzzlePublic } from '../src/api/client'

const puzzle: PuzzlePublic = {
  id: 1,
  theme: 'בדיקה',
  grid: [
    ['א', 'ב', 'ג'],
    ['ד', 'ה', 'ו'],
  ],
  word_count: 1,
  spangram: 'זז',
  words: ['אבג'],
  spangram_cells: [],
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

describe('useSelection', () => {
  it('submits the word on a normal, uninterrupted drag', () => {
    const { result } = renderHook(() => useSelection())

    act(() => {
      result.current.onCellPointerDown({ row: 0, col: 0 })
      result.current.onCellPointerEnter({ row: 0, col: 1 })
      result.current.onCellPointerEnter({ row: 0, col: 2 })
      result.current.onPointerUp()
    })

    expect(useGameStore.getState().foundWords).toEqual(['אבג'])
  })

  it('stays armed for tap-continuation when released right after the first letter (no drag)', () => {
    const { result } = renderHook(() => useSelection())

    act(() => {
      result.current.onCellPointerDown({ row: 0, col: 0 })
      result.current.onPointerUp() // no movement happened — should not submit or clear
    })

    expect(useGameStore.getState().selectedCells).toEqual([{ row: 0, col: 0 }])
    expect(useGameStore.getState().foundWords).toEqual([])
  })
})
