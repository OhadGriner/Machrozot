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
import { track } from '../utils/analytics'

const TUTORIAL_SEEN_KEY = 'hasSeenTutorial'

export default function GamePage() {
  const { date } = useParams<{ date?: string }>()
  const {
    puzzle, setPuzzle, foundWords, foundBonusWords, isComplete, solveOrder, hintsUsed, hintsEarned,
  } = useGameStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [showFireworks, setShowFireworks] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem(TUTORIAL_SEEN_KEY))
  const [showTutorialReplay, setShowTutorialReplay] = useState(false)
  const savedStateRef = useRef<ReturnType<typeof useGameStore.getState> | null>(null)

  // Analytics timing/dedup state — reset whenever a new puzzle loads.
  const puzzleStartRef = useRef(Date.now())
  const lastEventTimeRef = useRef(Date.now())
  const processedWordsRef = useRef(0)
  const processedBonusRef = useRef(0)
  const processedHintsRef = useRef(0)
  const completedFiredRef = useRef(false)

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
      .then((data) => {
        setPuzzle(data)
        puzzleStartRef.current = Date.now()
        lastEventTimeRef.current = Date.now()
        processedWordsRef.current = 0
        processedBonusRef.current = 0
        processedHintsRef.current = 0
        completedFiredRef.current = false
        track('puzzle_loaded', {
          puzzle_id: data.id,
          date: date ?? 'today',
          theme: data.theme,
          word_count: data.word_count,
        })
      })
      .catch(() => setError(date ? 'לא נמצאה חידה לתאריך זה' : 'לא נמצאה חידה להיום'))
      .finally(() => setLoading(false))
  }, [date, setPuzzle, showTutorial])

  // Word-found timing: solveOrder is parallel-indexed with foundWords (both
  // pushed together in gameStore's submitSelection), so index i in each array
  // describes the same solve. The processedWordsRef guard means this only
  // ever emits for genuinely new entries, safe under StrictMode's double-invoke.
  useEffect(() => {
    if (showTutorial || showTutorialReplay) return
    const newCount = solveOrder.length
    if (newCount <= processedWordsRef.current) return
    for (let i = processedWordsRef.current; i < newCount; i++) {
      const step = solveOrder[i]
      const now = Date.now()
      track('word_found', {
        word: foundWords[i],
        type: step.type,
        order_index: i,
        hinted: step.hinted,
        seconds_since_start: (now - puzzleStartRef.current) / 1000,
        seconds_since_previous: (now - lastEventTimeRef.current) / 1000,
      })
      lastEventTimeRef.current = now
    }
    processedWordsRef.current = newCount
  }, [solveOrder, foundWords, showTutorial, showTutorialReplay])

  useEffect(() => {
    if (showTutorial || showTutorialReplay) return
    const newCount = foundBonusWords.length
    if (newCount <= processedBonusRef.current) return
    for (let i = processedBonusRef.current; i < newCount; i++) {
      track('bonus_word_found', {
        word: foundBonusWords[i],
        seconds_since_start: (Date.now() - puzzleStartRef.current) / 1000,
      })
    }
    processedBonusRef.current = newCount
  }, [foundBonusWords, showTutorial, showTutorialReplay])

  useEffect(() => {
    if (showTutorial || showTutorialReplay) return
    if (hintsUsed <= processedHintsRef.current) return
    track('hint_used', { hints_used: hintsUsed, hints_earned: hintsEarned })
    processedHintsRef.current = hintsUsed
  }, [hintsUsed, hintsEarned, showTutorial, showTutorialReplay])

  useEffect(() => {
    if (!isComplete || showTutorial || showTutorialReplay) return
    setShowFireworks(true)
    const timer = setTimeout(() => setShowFireworks(false), 3000)
    return () => clearTimeout(timer)
  }, [isComplete, showTutorial, showTutorialReplay])

  useEffect(() => {
    if (!isComplete || showTutorial || showTutorialReplay || completedFiredRef.current) return
    completedFiredRef.current = true
    track('puzzle_completed', {
      total_seconds: (Date.now() - puzzleStartRef.current) / 1000,
      hints_used: hintsUsed,
      bonus_words_found: foundBonusWords.length,
    })
  }, [isComplete, showTutorial, showTutorialReplay, hintsUsed, foundBonusWords])

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
