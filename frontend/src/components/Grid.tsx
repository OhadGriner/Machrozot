import { useGameStore } from '../store/gameStore'
import { useSelection } from '../hooks/useSelection'
import Cell from './Cell'

export default function Grid() {
  const { puzzle, cellStates } = useGameStore()
  const { onCellPointerDown, onCellPointerEnter, onPointerUp } = useSelection()

  if (!puzzle) return null

  return (
    <div
      className="flex flex-col items-center gap-2 select-none"
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
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
                onPointerDown={() => onCellPointerDown({ row: rowIndex, col: colIndex })}
                onPointerEnter={() => onCellPointerEnter({ row: rowIndex, col: colIndex })}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
