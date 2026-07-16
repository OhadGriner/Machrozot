import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Grid from '../src/components/Grid'
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
  mega_machrozet: 'זז',
  words: ['אבג'],
  bonus_words: [],
  mega_machrozet_cells: [],
  word_cells: [
    [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ],
  ],
}

function getCell(row: number, col: number) {
  return document.querySelector(`[data-row="${row}"][data-col="${col}"]`) as HTMLElement
}

beforeEach(() => {
  useGameStore.getState().setPuzzle(puzzle)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Grid drag gesture', () => {
  it('completes a drag word even if the pointer briefly leaves the grid mid-drag', () => {
    render(<Grid />)

    const cellA = getCell(0, 0)
    const cellB = getCell(0, 1)
    const cellC = getCell(0, 2)
    // jsdom has no real layout, so Grid's document.elementFromPoint-based hit
    // testing needs a stub — we control which cell is "under the cursor" per move.
    let hovered: HTMLElement = cellA
    document.elementFromPoint = vi.fn(() => hovered) as typeof document.elementFromPoint

    fireEvent.pointerDown(cellA)

    hovered = cellB
    fireEvent.pointerMove(cellA.parentElement!.parentElement!, { clientX: 1, clientY: 1 })

    // pointer drifts outside the grid edge for a moment — very common with real
    // mouse/finger movement — while the mouse button is still held down.
    fireEvent.pointerLeave(cellA.parentElement!.parentElement!, { buttons: 1 })

    // cursor re-enters and the drag continues to the last letter
    hovered = cellC
    fireEvent.pointerMove(cellA.parentElement!.parentElement!, { clientX: 1, clientY: 1 })

    // the mouse button is actually released now
    fireEvent.pointerUp(window)

    expect(useGameStore.getState().foundWords).toEqual(['אבג'])
  })
})
