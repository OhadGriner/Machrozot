import { useCallback, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { CellPosition } from '../store/gameStore'

function isAdjacent(a: CellPosition, b: CellPosition): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1
}

function cellKey(cell: CellPosition) {
  return `${cell.row}-${cell.col}`
}

/**
 * Single unified selection gesture: pressing and dragging across letters works
 * as a normal stroke. If the pointer is released right after the first letter
 * (no drag), the selection stays armed and each subsequent tap on an adjacent
 * letter appends to it; tapping the last letter again locks/submits the word.
 */
export function useSelection() {
  const isPointerDown = useRef(false)
  const movedDuringStroke = useRef(false)
  const { selectCell, clearSelection, submitSelection } = useGameStore()

  const onCellPointerDown = useCallback(
    (cell: CellPosition) => {
      isPointerDown.current = true
      movedDuringStroke.current = false

      const { selectedCells: current } = useGameStore.getState()
      const last = current.at(-1)

      if (!last) {
        clearSelection()
        selectCell(cell)
        return
      }

      if (cellKey(last) === cellKey(cell)) {
        submitSelection()
        isPointerDown.current = false
        return
      }

      if (isAdjacent(last, cell) && !current.some((c) => cellKey(c) === cellKey(cell))) {
        selectCell(cell)
        return
      }

      clearSelection()
      selectCell(cell)
    },
    [clearSelection, selectCell, submitSelection],
  )

  const onCellPointerEnter = useCallback(
    (cell: CellPosition) => {
      if (!isPointerDown.current) return
      const { selectedCells: current } = useGameStore.getState()
      const last = current.at(-1)
      if (last && isAdjacent(last, cell) && cellKey(last) !== cellKey(cell)) {
        selectCell(cell)
        movedDuringStroke.current = true
      }
    },
    [selectCell],
  )

  const onPointerUp = useCallback(() => {
    if (!isPointerDown.current) return
    isPointerDown.current = false
    if (movedDuringStroke.current) {
      submitSelection()
    }
    movedDuringStroke.current = false
  }, [submitSelection])

  return { onCellPointerDown, onCellPointerEnter, onPointerUp }
}
