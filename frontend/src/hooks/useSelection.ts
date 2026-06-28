import { useCallback, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import type { CellPosition } from '../store/gameStore'

function isAdjacent(a: CellPosition, b: CellPosition): boolean {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1
}

export function useSelection() {
  const isDragging = useRef(false)
  const { selectCell, clearSelection, submitSelection, selectedCells } = useGameStore()

  const onCellPointerDown = useCallback(
    (cell: CellPosition) => {
      isDragging.current = true
      clearSelection()
      selectCell(cell)
    },
    [clearSelection, selectCell],
  )

  const onCellPointerEnter = useCallback(
    (cell: CellPosition) => {
      if (!isDragging.current) return
      const last = selectedCells.at(-1)
      if (last && isAdjacent(last, cell)) {
        selectCell(cell)
      }
    },
    [selectCell, selectedCells],
  )

  const onPointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    submitSelection()
  }, [submitSelection])

  return { onCellPointerDown, onCellPointerEnter, onPointerUp }
}
