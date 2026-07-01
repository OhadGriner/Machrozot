import { useGameStore } from '../store/gameStore'

export default function CurrentWordBanner() {
  const { puzzle, selectedCells } = useGameStore()

  const currentWord = puzzle ? selectedCells.map((c) => puzzle.grid[c.row][c.col]).join('') : ''

  return (
    <div className="h-11 flex items-center justify-center">
      {currentWord && (
        <span className="text-2xl font-bold text-gray-800 tracking-widest">{currentWord}</span>
      )}
    </div>
  )
}
