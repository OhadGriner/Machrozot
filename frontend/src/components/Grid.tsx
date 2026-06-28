import { useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useSelection } from '../hooks/useSelection'
import Cell from './Cell'
import SelectionLine from './SelectionLine'

export default function Grid() {
  const { puzzle, cellStates, selectedCells, foundWordLines } = useGameStore()
  const { onCellPointerDown, onCellPointerEnter, onPointerUp } = useSelection()
  const containerRef = useRef<HTMLDivElement>(null)

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
    <div className="relative inline-block" style={{ zIndex: 0 }}>
      <SelectionLine
        selectedCells={selectedCells}
        foundWordLines={foundWordLines}
        containerRef={containerRef}
      />
      <div
        ref={containerRef}
        className="flex flex-col items-center gap-2 select-none touch-none"
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
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
  )
}
