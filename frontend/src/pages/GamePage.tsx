import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, progressApi } from '../api/client'
import { useGameStore } from '../store/gameStore'
import { useAuthStore } from '../store/authStore'
import Grid from '../components/Grid'
import HintBar from '../components/HintBar'
import Fireworks from '../components/Fireworks'
import FeedbackPopup from '../components/FeedbackPopup'
import TutorialScreen from '../components/TutorialScreen'
import AuthButton from '../components/AuthButton'
import { buildShareText } from '../utils/shareUtils'
import { track } from '../utils/analytics'
import { clearOldProgress, loadProgress, saveProgress } from '../utils/persistence'
import type { SavedProgress } from '../utils/persistence'
import { fromServerResponse, pickRicherProgress, toServerPayload } from '../utils/progressSync'

const TUTORIAL_SEEN_KEY = 'hasSeenTutorial'

export default function GamePage() {
  const { date } = useParams<{ date?: string }>()
  const {
    puzzle, setPuzzle, foundWords, foundBonusWords, isComplete, solveOrder,
    hintsUsed, hintsEarned, nonThemeCount,
  } = useGameStore()
  const user = useAuthStore((s) => s.user)
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
  // True when the restored save was already complete — suppresses replaying
  // the completion celebration (fireworks/feedback) on every reload.
  const restoredCompleteRef = useRef(false)

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
    // Native share sheet (WhatsApp / copy / etc.) where available — mainly
    // mobile; desktop browsers mostly lack it, so fall back to clipboard.
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        // User closed the share sheet — not an error, nothing to do.
      }
      return
    }
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
      .then(async (data) => {
        setPuzzle(data)
        clearOldProgress()
        const local = loadProgress(data.id)
        // Logged-in players may have progress from another device — reconcile
        // with the server copy; the richer of the two wins (tie → local).
        let server: SavedProgress | null = null
        if (user) {
          try {
            const response = await progressApi.get(data.id)
            server = response ? fromServerResponse(response) : null
          } catch {
            // Server sync is best-effort; local progress still applies.
          }
        }
        const saved = pickRicherProgress(local, server)
        if (saved) {
          useGameStore.setState({
            cellStates: saved.cellStates,
            foundWords: saved.foundWords,
            foundWordLines: saved.foundWordLines,
            hintWordLines: saved.hintWordLines,
            foundBonusWords: saved.foundBonusWords,
            nonThemeCount: saved.nonThemeCount,
            hintsEarned: saved.hintsEarned,
            hintsUsed: saved.hintsUsed,
            isComplete: saved.isComplete,
            solveOrder: saved.solveOrder,
          })
          // Both sides converge on the winner.
          saveProgress(data.id, saved)
          if (user && saved !== server) {
            progressApi.put(data.id, toServerPayload(saved)).catch(() => {})
          }
        }
        // Backdating the start by previously accumulated play time makes every
        // downstream duration (seconds_since_start, total_seconds, the next
        // save's activeSeconds) measure real cumulative play across visits.
        puzzleStartRef.current = Date.now() - (saved?.activeSeconds ?? 0) * 1000
        lastEventTimeRef.current = Date.now()
        // Seed the dedup refs with restored counts so nothing already found
        // re-fires its analytics event, and a restored completed puzzle
        // doesn't replay puzzle_completed.
        processedWordsRef.current = saved?.solveOrder.length ?? 0
        processedBonusRef.current = saved?.foundBonusWords.length ?? 0
        processedHintsRef.current = saved?.hintsUsed ?? 0
        completedFiredRef.current = saved?.isComplete ?? false
        restoredCompleteRef.current = saved?.isComplete ?? false
        track('puzzle_loaded', {
          puzzle_id: data.id,
          date: date ?? 'today',
          theme: data.theme,
          word_count: data.word_count,
          resumed: !!saved,
        })
      })
      .catch(() => setError(date ? 'לא נמצאה חידה לתאריך זה' : 'לא נמצאה חידה להיום'))
      .finally(() => setLoading(false))
    // user?.id in the deps re-runs the load on login/logout, which is exactly
    // the moment server progress needs reconciling (e.g. logging in mid-game).
  }, [date, setPuzzle, showTutorial, user?.id])

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

  // Fireworks/feedback celebrate the moment of completion — a puzzle restored
  // already-complete from a previous visit must not replay them on reload.
  useEffect(() => {
    if (!isComplete || showTutorial || showTutorialReplay || restoredCompleteRef.current) return
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
    if (isComplete && !showTutorial && !showTutorialReplay && !restoredCompleteRef.current) {
      setShowFeedback(true)
    }
  }, [isComplete, showTutorial, showTutorialReplay])

  // Persist progress on every meaningful change. cellStates is read at save
  // time (not a dependency) since its meaningful changes always accompany one
  // of the listed fields — and mid-drag 'selected' entries are stripped so a
  // restore never shows phantom selections.
  useEffect(() => {
    if (!puzzle || puzzle.id === -1 || showTutorial || showTutorialReplay) return
    if (foundWords.length === 0 && foundBonusWords.length === 0 && hintsUsed === 0 && nonThemeCount === 0) return
    const { cellStates, foundWordLines, hintWordLines } = useGameStore.getState()
    const cleanCellStates = Object.fromEntries(
      Object.entries(cellStates).filter(([, state]) => state !== 'selected' && state !== 'default')
    )
    saveProgress(puzzle.id, {
      cellStates: cleanCellStates,
      foundWords,
      foundWordLines,
      hintWordLines,
      foundBonusWords,
      nonThemeCount,
      hintsEarned,
      hintsUsed,
      isComplete,
      solveOrder,
      activeSeconds: (Date.now() - puzzleStartRef.current) / 1000,
      lastSavedAt: new Date().toISOString(),
    })
  }, [
    puzzle, foundWords, foundBonusWords, nonThemeCount, hintsEarned, hintsUsed,
    isComplete, solveOrder, showTutorial, showTutorialReplay,
  ])

  // Server sync for logged-in players: reads the just-written localStorage
  // copy (the save effect above runs first) and pushes it, debounced so a
  // burst of finds becomes one request.
  useEffect(() => {
    if (!user || !puzzle || puzzle.id === -1 || showTutorial || showTutorialReplay) return
    if (foundWords.length === 0 && foundBonusWords.length === 0 && hintsUsed === 0 && nonThemeCount === 0) return
    const puzzleId = puzzle.id
    const timer = window.setTimeout(() => {
      const saved = loadProgress(puzzleId)
      if (saved) progressApi.put(puzzleId, toServerPayload(saved)).catch(() => {})
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [
    user, puzzle, foundWords, foundBonusWords, nonThemeCount, hintsEarned, hintsUsed,
    isComplete, solveOrder, showTutorial, showTutorialReplay,
  ])

  // Best-effort flush when the tab is hidden/closed, so a find made within
  // the debounce window isn't lost to the server.
  useEffect(() => {
    if (!user || !puzzle || puzzle.id === -1) return
    const puzzleId = puzzle.id
    const flush = () => {
      if (document.visibilityState !== 'hidden') return
      const saved = loadProgress(puzzleId)
      if (saved) progressApi.put(puzzleId, toServerPayload(saved)).catch(() => {})
    }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [user, puzzle])

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
    <div className="flex flex-col items-center gap-4 py-4 px-4 min-h-dvh">
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
        <AuthButton />
        <img src="/complete-logo-01.png" alt="מחרוזות" className="h-11 mx-auto" />
      </header>

      {/* RTL row: theme box renders on the right, the found-counter to its left */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 rounded-lg px-4 py-1.5 text-center flex items-baseline gap-2">
          <span className="text-xs text-blue-400 font-medium">נושא</span>
          <span className="text-lg font-bold text-blue-700">{puzzle.theme}</span>
        </div>
        <p className="text-sm text-gray-400 font-medium whitespace-nowrap">
          {foundWords.length}/{puzzle.word_count + 1} מילים נמצאו
        </p>
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
