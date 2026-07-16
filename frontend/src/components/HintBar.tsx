import { useGameStore } from '../store/gameStore'

export default function HintBar() {
  const { hintsEarned, hintsUsed, nonThemeCount, useHint } = useGameStore()
  const available = hintsEarned - hintsUsed
  const progress = nonThemeCount % 3
  const fillPercent = (progress / 3) * 100

  return (
    <button
      onClick={useHint}
      disabled={available <= 0}
      className={`
        relative overflow-hidden px-4 py-1.5 rounded-lg font-bold text-sm
        transition-colors
        ${available > 0
          ? 'bg-orange-400 text-white hover:bg-orange-500 cursor-pointer ring-2 ring-orange-300 shadow-md'
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'}
      `}
    >
      {available <= 0 && (
        <span
          className="absolute inset-y-0 left-0 bg-orange-200 transition-all duration-300"
          style={{ width: `${fillPercent}%` }}
        />
      )}
      <span className="relative">💡 רמז</span>
    </button>
  )
}
