import { useGameStore } from '../store/gameStore'

export default function CurrentWordBanner() {
  const { puzzle, selectedCells } = useGameStore()

  const currentWord = puzzle ? selectedCells.map((c) => puzzle.grid[c.row][c.col]).join('') : ''

  return (
    <div className="h-11 flex items-center justify-center">
      {currentWord && (
        <div className="flex items-center justify-center px-6 py-1 rounded-full bg-blue-100 border border-blue-300">
          <span className="text-xl font-bold text-blue-700 tracking-widest">{currentWord}</span>
        </div>
      )}
    </div>
  )
}
