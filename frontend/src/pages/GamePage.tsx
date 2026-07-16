import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useGameStore } from '../store/gameStore'
import Grid from '../components/Grid'
import HintBar from '../components/HintBar'
import Fireworks from '../components/Fireworks'
import FeedbackPopup from '../components/FeedbackPopup'
import TutorialScreen from '../components/TutorialScreen'
import { buildShareText } from '../utils/shareUtils'

const TUTORIAL_SEEN_KEY = 'hasSeenTutorial'

export default function GamePage() {
  const { date } = useParams<{ date?: string }>()
  const { puzzle, setPuzzle, foundWords, isComplete, solveOrder } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [showFireworks, setShowFireworks] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem(TUTORIAL_SEEN_KEY))
  const [showTutorialReplay, setShowTutorialReplay] = useState(false)
  const savedStateRef = useRef<ReturnType<typeof useGameStore.getState> | null>(null)

  const finishTutorial = () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
    setShowTutorial(false)
  }

  const openTutorialReplay = () => {
    savedStateRef.current = useGameStore.getState()
    setShowTutorialReplay(true)
  }

  const closeTutorialReplay = () => {
    if (savedStateRef.current) useGameStore.setState(savedStateRef.current)
    savedStateRef.current = null
    setShowTutorialReplay(false)
  }

  const handleShare = async () => {
    if (!puzzle) return
    const text = buildShareText(puzzle.theme, solveOrder)
    await navigator.clipboard.writeText(text)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  useEffect(() => {
    if (showTutorial) return
    setLoading(true)
    setError(null)
    const request = date ? api.getPuzzleByDate(date) : api.getTodayPuzzle()
    request
      .then(setPuzzle)
      .catch(() => setError(date ? 'לא נמצאה חידה לתאריך זה' : 'לא נמצאה חידה להיום'))
      .finally(() => setLoading(false))
  }, [date, setPuzzle, showTutorial])

  useEffect(() => {
    if (!isComplete || showTutorial || showTutorialReplay) return
    setShowFireworks(true)
    const timer = setTimeout(() => setShowFireworks(false), 3000)
    return () => clearTimeout(timer)
  }, [isComplete, showTutorial, showTutorialReplay])

  useEffect(() => {
    if (isComplete && !showTutorial && !showTutorialReplay) setShowFeedback(true)
  }, [isComplete, showTutorial, showTutorialReplay])

  if (showTutorial) {
    return <TutorialScreen onFinish={finishTutorial} />
  }

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
      {showFireworks && <Fireworks />}

      {showTutorialReplay && (
        <div className="fixed inset-0 z-30 bg-white">
          <TutorialScreen onFinish={closeTutorialReplay} />
        </div>
      )}

      <header className="text-center mt-0 relative w-full">
        <button
          onClick={openTutorialReplay}
          aria-label="איך משחקים"
          className="absolute left-2 top-0 w-7 h-7 rounded-full bg-blue-100 text-blue-600 font-bold hover:bg-blue-200"
        >
          ?
        </button>
        <img src="/complete-logo-01.png" alt="מחרוזות" className="h-12 mx-auto" />
        <p className="text-gray-500 mt-1">מצא את המילים בנושא</p>
      </header>

      <div className="bg-blue-50 rounded-xl px-6 py-3 text-center">
        <p className="text-sm text-blue-400 font-medium">נושא</p>
        <p className="text-2xl font-bold text-blue-700">{puzzle.theme}</p>
      </div>

      {isComplete ? (
        <div className="bg-green-100 border border-green-300 rounded-xl px-6 py-4 text-center flex flex-col items-center gap-3">
          <p className="text-green-700 text-xl font-bold">כל הכבוד! סיימת את החידה 🎉</p>
          <button
            onClick={handleShare}
            className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg px-4 py-2"
          >
            שתף תוצאה
          </button>
        </div>
      ) : (
        <HintBar />
      )}

      <div className="relative">
        <Grid />
        {showFeedback && (
          <FeedbackPopup context="post_completion" onClose={() => setShowFeedback(false)} />
        )}
      </div>

      <p className="text-sm text-gray-400 font-medium">
        נמצאו {foundWords.length} מתוך {puzzle.word_count + 1} מילים
      </p>

      <footer>
        <a href="mailto:ohad.griner@gmail.com" className="text-sm text-gray-400 hover:text-gray-600">
          📧 צור קשר
        </a>
      </footer>

      {shareCopied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-medium rounded-lg px-4 py-2 shadow-lg">
          הועתק ללוח! ✓
        </div>
      )}
    </div>
  )
}
