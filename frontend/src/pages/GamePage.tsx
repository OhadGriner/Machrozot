import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useGameStore } from '../store/gameStore'
import Grid from '../components/Grid'
import HintBar from '../components/HintBar'

export default function GamePage() {
  const { date } = useParams<{ date?: string }>()
  const { puzzle, setPuzzle, foundWords, isComplete } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const request = date ? api.getPuzzleByDate(date) : api.getTodayPuzzle()
    request
      .then(setPuzzle)
      .catch(() => setError(date ? 'לא נמצאה חידה לתאריך זה' : 'לא נמצאה חידה להיום'))
      .finally(() => setLoading(false))
  }, [date, setPuzzle])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-gray-500 text-lg">טוען...</p>
      </div>
    )
  }

  if (error || !puzzle) {
    return (
      <div className="flex items-center justify-center min-h-dvh">
        <p className="text-red-500 text-lg">{error ?? 'שגיאה לא צפויה'}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 min-h-dvh">
      <header className="text-center mt-0">
        <img src="/complete-logo-01.png" alt="מחרוזות" className="h-12 mx-auto" />
        <p className="text-gray-500 mt-1">מצא את המילים בנושא</p>
      </header>

      {isComplete && (
        <div className="bg-green-100 border border-green-300 rounded-xl px-6 py-4 text-center">
          <p className="text-green-700 text-xl font-bold">כל הכבוד! סיימת את החידה 🎉</p>
        </div>
      )}

      <div className="bg-blue-50 rounded-xl px-6 py-3 text-center">
        <p className="text-sm text-blue-400 font-medium">נושא</p>
        <p className="text-2xl font-bold text-blue-700">{puzzle.theme}</p>
      </div>

      <HintBar />

      <Grid />

      <p className="text-sm text-gray-400 font-medium">
        נמצאו {foundWords.length} מתוך {puzzle.word_count + 1} מילים
      </p>
    </div>
  )
}
