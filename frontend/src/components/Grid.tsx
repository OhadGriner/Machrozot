import { useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { useSelection } from '../hooks/useSelection'
import Cell from './Cell'
import SelectionLine from './SelectionLine'
import CurrentWordBanner from './CurrentWordBanner'

export default function Grid() {
  const { puzzle, cellStates, selectedCells, foundWordLines } = useGameStore()
  const { onCellPointerDown, onCellPointerEnter, onPointerUp } = useSelection()

  // Listen on window (not just the grid container) so a drag that briefly
  // overshoots the grid's edge — very common with real mouse/finger movement,
  // especially along an edge row — doesn't get cut short: the gesture only
  // ends on the actual pointer release, wherever it happens.
  useEffect(() => {
    window.addEventListener('pointerup', onPointerUp)
    return () => window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerUp])

  if (!puzzle) return null

  const handlePointerMove = (e: React.PointerEvent) => {
    const element = document.elementFromPoint(e.clientX, e.clientY)
    const row = element?.getAttribute('data-row')
    const col = element?.getAttribute('data-col')
    if (row !== null && col !== null && row !== undefined && col !== undefined) {
      onCellPointerEnter({ row: Number(row), col: Number(col) })
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <CurrentWordBanner />
      <div className="relative inline-block" style={{ zIndex: 0 }}>
        <SelectionLine
          cols={puzzle.grid[0]?.length ?? 0}
          selectedCells={selectedCells}
          foundWordLines={foundWordLines}
        />
        <div
          className="flex flex-col items-center gap-2 select-none touch-none"
          onPointerMove={handlePointerMove}
        >
          {puzzle.grid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex gap-2">
              {row.map((letter, colIndex) => {
                const key = `${rowIndex}-${colIndex}`
                return (
                  <Cell
                    key={key}
                    letter={letter}
                    state={cellStates[key] ?? 'default'}
                    row={rowIndex}
                    col={colIndex}
                    onPointerDown={() => onCellPointerDown({ row: rowIndex, col: colIndex })}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
