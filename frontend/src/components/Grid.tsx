import { useGameStore } from '../store/gameStore'
import { useSelection } from '../hooks/useSelection'
import Cell from './Cell'

export default function Grid() {
  const { puzzle, cellStates } = useGameStore()
  const { onCellPointerDown, onCellPointerEnter, onPointerUp } = useSelection()

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
    <div
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
  )
}
