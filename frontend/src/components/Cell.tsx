import type { CellState } from '../store/gameStore'

interface CellProps {
  letter: string
  state: CellState
  onPointerDown: () => void
  onPointerEnter: () => void
}

const stateStyles: Record<CellState, string> = {
  default:  'bg-white border-gray-200 text-gray-800',
  selected: 'bg-blue-400 border-blue-400 text-white scale-105',
  found:    'bg-green-400 border-green-400 text-white',
  spangram: 'bg-yellow-400 border-yellow-400 text-white',
  hint:     'bg-orange-300 border-orange-300 text-white',
}

export default function Cell({ letter, state, onPointerDown, onPointerEnter }: CellProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      className={`
        flex items-center justify-center
        w-12 h-12 rounded-full border-2
        text-lg font-bold cursor-pointer select-none
        transition-all duration-100
        ${stateStyles[state]}
      `}
    >
      {letter}
    </div>
  )
}
