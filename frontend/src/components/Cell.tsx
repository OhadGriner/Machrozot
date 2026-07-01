import type { CellState } from '../store/gameStore'

interface CellProps {
  letter: string
  state: CellState
  row: number
  col: number
  onPointerDown: () => void
}

const stateStyles: Record<CellState, string> = {
  default:  'bg-transparent border-transparent text-gray-800',
  selected: 'bg-[#eedccd] border-[#eedccd] text-gray-800 scale-105',
  found:    'bg-green-400 border-green-400 text-gray-800',
  spangram: 'bg-purple-400 border-purple-400 text-gray-800',
  hint:     'bg-orange-300 border-orange-300 text-gray-800',
}

export default function Cell({ letter, state, row, col, onPointerDown }: CellProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      data-row={row}
      data-col={col}
      className={`
        flex items-center justify-center
        w-12 h-12 rounded-full border-2
        text-xl font-bold cursor-pointer select-none
        transition-all duration-100
        ${stateStyles[state]}
      `}
    >
      {letter}
    </div>
  )
}
