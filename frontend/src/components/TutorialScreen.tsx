import { useEffect, useState } from 'react'
import type { CellPosition, PuzzlePublic } from '../api/client'
import { useGameStore } from '../store/gameStore'
import type { CellState, WordLine } from '../store/gameStore'
import { tutorialPuzzle } from '../utils/tutorialPuzzle'
import Grid from './Grid'
import HintBar from './HintBar'

interface Props {
  onFinish: () => void
}

// Each stage narrows the puzzle down to just its own target (allow/disallow
// per stage) and tracks its own cells/color so a later stage's entry
// snapshot can re-color earlier, already-completed stages.
const STAGES: Array<{
  title: string
  body: string
  target: string
  cells: CellPosition[]
  color: 'found' | 'megaMachrozet'
  puzzleOverrides: Pick<PuzzlePublic, 'mega_machrozet_cells' | 'words' | 'word_cells'>
  grantHint: boolean
}> = [
  {
    title: 'איך משחקים?',
    body: 'גררו אצבע או עכבר בין אותיות סמוכות (גם באלכסון!) כדי למצוא מילה. נסו למצוא את המילה "כחול".',
    target: tutorialPuzzle.words[0],
    cells: tutorialPuzzle.word_cells[0],
    color: 'found',
    puzzleOverrides: {
      mega_machrozet_cells: [],
      words: [tutorialPuzzle.words[0]],
      word_cells: [tutorialPuzzle.word_cells[0]],
    },
    grantHint: false,
  },
  {
    title: 'מגה מחרוזת',
    body: 'בכל חידה יש גם "מגה מחרוזת" - מילה מיוחדת אחת שעוברת על פני כל הלוח ומגלה את הנושא של החידה. היא תיצבע בסגול. נסו למצוא אותה עכשיו!',
    target: tutorialPuzzle.mega_machrozet,
    cells: tutorialPuzzle.mega_machrozet_cells,
    color: 'megaMachrozet',
    puzzleOverrides: {
      mega_machrozet_cells: tutorialPuzzle.mega_machrozet_cells,
      words: [],
      word_cells: [],
    },
    grantHint: false,
  },
  {
    title: 'רמזים',
    body: 'לפעמים תרוויחו רמז 💡 שיעזור לכם למצוא מילה. לחצו על כפתור הרמז, ואז גררו על האותיות שיודגשו בכתום כדי למצוא את המילה "אדום".',
    target: tutorialPuzzle.words[1],
    cells: tutorialPuzzle.word_cells[1],
    color: 'found',
    puzzleOverrides: {
      mega_machrozet_cells: [],
      words: [tutorialPuzzle.words[1]],
      word_cells: [tutorialPuzzle.word_cells[1]],
    },
    grantHint: true,
  },
]

function cellKey(cell: CellPosition) {
  return `${cell.row}-${cell.col}`
}

export default function TutorialScreen({ onFinish }: Props) {
  const { setPuzzle, foundWords } = useGameStore()
  const [viewStep, setViewStep] = useState(0)
  const [completed, setCompleted] = useState([false, false, false])

  useEffect(() => {
    setPuzzle(tutorialPuzzle)
  }, [setPuzzle])

  // Entering a stage (mount, next, or back) resets live selection/found
  // progress and narrows the puzzle to just this stage's target, but shows
  // every earlier stage colored in as if solved — e.g. pressing next past
  // stage 0 without solving it still shows "כחול" highlighted on arrival at
  // stage 1, since navigating past a stage previews it as done regardless of
  // whether it was actually dragged. Going back still hides the current
  // stage and anything after it (only i < viewStep gets colored).
  useEffect(() => {
    const stage = STAGES[viewStep]
    const priorCellStates: Record<string, CellState> = {}
    const priorFoundWordLines: WordLine[] = []
    STAGES.forEach((s, i) => {
      if (i >= viewStep) return
      s.cells.forEach((c) => { priorCellStates[cellKey(c)] = s.color })
      priorFoundWordLines.push({ cells: s.cells, state: s.color })
    })

    useGameStore.setState((s) => ({
      puzzle: s.puzzle ? { ...s.puzzle, ...stage.puzzleOverrides } : s.puzzle,
      selectedCells: [],
      cellStates: priorCellStates,
      foundWords: [],
      foundWordLines: priorFoundWordLines,
      hintWordLines: [],
      isComplete: false,
      hintsEarned: stage.grantHint ? 1 : 0,
      hintsUsed: 0,
    }))
  }, [viewStep])

  // Record completion and auto-advance to the next stage the moment this
  // stage's target is actually found — the arrows remain available too, for
  // manually rereading any stage at any time. Not guarded by `completed`:
  // foundWords is reset to [] every time a stage is (re-)entered, so this
  // only ever fires on a genuine fresh solve, including re-solving a stage
  // after going back to it.
  useEffect(() => {
    if (!foundWords.includes(STAGES[viewStep].target)) return
    setCompleted((c) => (c[viewStep] ? c : c.map((v, i) => (i === viewStep ? true : v))))
    if (viewStep < STAGES.length - 1) {
      setViewStep(viewStep + 1)
    }
  }, [foundWords, viewStep])

  const tutorialDone = completed[STAGES.length - 1]

  return (
    <div className="flex flex-col items-center gap-6 py-8 px-4 min-h-dvh">
      <header className="text-center mt-0">
        <img src="/complete-logo-01.png" alt="מחרוזות" className="h-12 mx-auto" />
      </header>

      <div className="relative bg-blue-50 rounded-xl px-6 py-4 text-center max-w-xs w-full h-[220px] flex flex-col items-center justify-center">
        {!tutorialDone && (
          <button
            onClick={onFinish}
            aria-label="יציאה"
            className="absolute top-2 left-2 text-gray-400 hover:text-gray-600 text-lg leading-none font-bold"
          >
            ✕
          </button>
        )}

        {tutorialDone ? (
          <>
            <p className="text-blue-700 font-bold mb-3">מעולה! ככה משחקים 🎉</p>
            <button
              onClick={onFinish}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg px-6 py-2 ring-2 ring-purple-300 shadow-md"
            >
              שחק!
            </button>
          </>
        ) : (
          <>
            <p className="text-blue-700 font-bold mb-1">{STAGES[viewStep].title}</p>
            <p className="text-blue-600 text-sm mb-3">{STAGES[viewStep].body}</p>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => setViewStep((v) => Math.max(0, v - 1))}
                disabled={viewStep === 0}
                aria-label="הקודם"
                className="text-xl font-extrabold text-blue-500 hover:text-blue-700 disabled:opacity-30"
              >
                →
              </button>
              <button
                onClick={() => setViewStep((v) => Math.min(STAGES.length - 1, v + 1))}
                disabled={viewStep === STAGES.length - 1}
                aria-label="הבא"
                className="text-xl font-extrabold text-blue-500 hover:text-blue-700 disabled:opacity-30"
              >
                ←
              </button>
            </div>
          </>
        )}
      </div>

      <HintBar />

      <Grid />
    </div>
  )
}
