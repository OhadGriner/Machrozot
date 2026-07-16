import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi, adminAuth } from '../api/adminClient'
import SelectionLine from '../components/SelectionLine'
import type { LevelGridDetail, ShuffleStatus } from '../api/adminClient'
import type { WordLine } from '../store/gameStore'

type CellPos = { row: number; col: number }

function cellKey(c: CellPos) { return `${c.row}-${c.col}` }

function wordFromGrid(grid: string[][], cells: CellPos[]) {
  return cells.map((c) => grid[c.row]?.[c.col] ?? '').join('')
}

function formatElapsed(seconds: number): string {
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type CellVisual = 'default' | 'word' | 'megaMachrozet'

const CELL_STYLE: Record<CellVisual, string> = {
  default:  'bg-white border-gray-200 text-gray-800',
  word:     'bg-green-400 border-green-400 text-white',
  megaMachrozet: 'bg-purple-400 border-purple-400 text-white',
}

export default function LevelGridViewPage() {
  const { date, id } = useParams<{ date?: string; id?: string }>()
  const navigate = useNavigate()
  const gridContainerRef = useRef<HTMLDivElement>(null)

  const [puzzle, setPuzzle] = useState<LevelGridDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unassigning, setUnassigning] = useState(false)
  const [shuffling, setShuffling] = useState(false)
  const [shuffleElapsed, setShuffleElapsed] = useState(0)
  const pollRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    if (!adminAuth.isSet()) { navigate('/admin/login'); return }
    if (!date && !id) return
    setError('')
    try {
      const data = id ? await adminApi.getLevelGrid(Number(id)) : await adminApi.getScheduledLevel(date!)
      setPuzzle(data)
    } catch (e) {
      if (e instanceof Error && e.message === 'Unauthorized') {
        navigate('/admin/login')
        return
      }
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת הפאזל')
    } finally {
      setLoading(false)
    }
  }, [date, id, navigate])

  useEffect(() => { load() }, [load])

  // Polls the shuffle status for `puzzleId` until it's done or errored,
  // updating the live elapsed-time display each tick. Reused both to resume
  // watching a shuffle that was already running (e.g. after navigating away
  // and back, or a page reload) and after freshly starting one.
  const tick = useCallback((puzzleId: number) => {
    adminApi.getShuffleStatus(puzzleId)
      .then((status) => applyShuffleStatus(puzzleId, status))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'שגיאה בערבוב הלוח')
        setShuffling(false)
      })
  }, [])

  const applyShuffleStatus = useCallback((puzzleId: number, status: ShuffleStatus) => {
    if (status.status === 'pending') {
      setShuffling(true)
      setShuffleElapsed(status.elapsed_seconds)
      pollRef.current = window.setTimeout(() => tick(puzzleId), 1500)
      return
    }
    setShuffling(false)
    setShuffleElapsed(0)
    if (status.status === 'done' && status.puzzle) setPuzzle(status.puzzle)
    if (status.status === 'error') setError(status.detail || 'שגיאה בערבוב הלוח')
  }, [tick])

  // Resume-on-mount: if a shuffle was already running for this puzzle (the
  // admin navigated away and came back, or reloaded the page), pick up
  // watching its progress instead of losing track of it.
  useEffect(() => {
    if (!puzzle) return
    let cancelled = false
    adminApi.getShuffleStatus(puzzle.id).then((status) => {
      if (!cancelled && status.status === 'pending') applyShuffleStatus(puzzle.id, status)
    }).catch(() => {})
    return () => {
      cancelled = true
      if (pollRef.current !== null) {
        clearTimeout(pollRef.current)
        pollRef.current = null
      }
    }
  }, [puzzle?.id, applyShuffleStatus])

  const deleteDay = async () => {
    if (!date) return
    if (!window.confirm('להסיר את הפאזל מהתאריך הזה?')) return
    setUnassigning(true)
    setError('')
    try {
      await adminApi.unassignLevel(date)
      navigate('/admin')
    } catch (e) {
      setUnassigning(false)
      setError(e instanceof Error ? e.message : 'שגיאה בהסרת הפאזל')
    }
  }

  const shuffleBoard = async () => {
    if (!puzzle) return
    setError('')
    try {
      // Re-sends the same words to the grid generator and swaps in the new
      // arrangement in place (same puzzle id), so any calendar date already
      // pointing at this puzzle picks up the change automatically. Starts (or
      // resumes, if one's already running) an async job — applyShuffleStatus
      // takes it from here, polling until it's done or errored.
      const status = await adminApi.triggerShuffle(puzzle.id)
      applyShuffleStatus(puzzle.id, status)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בערבוב הלוח')
    }
  }

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-gray-400">טוען...</p>
      </div>
    )
  }

  const backTo = id ? '/admin/levels' : '/admin'

  if (!puzzle) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4 min-h-dvh" dir="rtl">
        <button onClick={() => navigate(backTo)} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
        <p className="text-sm text-red-500">{error || 'לא נמצא פאזל'}</p>
      </div>
    )
  }

  const assignedMap = new Map<string, CellVisual>()
  puzzle.mega_machrozet_cells.forEach((c) => assignedMap.set(cellKey(c), 'megaMachrozet'))
  puzzle.word_cells.forEach((cells) => cells.forEach((c) => assignedMap.set(cellKey(c), 'word')))

  const wordLines: WordLine[] = [
    { cells: puzzle.mega_machrozet_cells, state: 'megaMachrozet' },
    ...puzzle.word_cells.map((cells): WordLine => ({ cells, state: 'found' })),
  ]

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 min-h-dvh" dir="rtl">
      <div className="w-full max-w-sm flex items-center justify-between">
        <button onClick={() => navigate(backTo)} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
        <span className="text-sm text-gray-500">{date ? formattedDate : 'תצוגת פאזל'}</span>
      </div>

      <div className="text-center">
        <div className="text-lg font-bold">#{puzzle.id} · {puzzle.theme}</div>
      </div>

      <button
        onClick={shuffleBoard}
        disabled={shuffling}
        className="w-full max-w-sm py-2 rounded-xl font-bold text-sm bg-purple-100 text-purple-800 hover:bg-purple-200 disabled:opacity-50"
      >
        {shuffling ? `מערבב... (${formatElapsed(shuffleElapsed)})` : '🔀 ערבב לוח'}
      </button>

      {error && <div className="w-full max-w-sm text-sm text-red-500 text-center">{error}</div>}

      {date && (
        <div className="w-full max-w-sm flex items-center gap-2">
          <button
            onClick={() => navigate(`/admin/levels/${date}`)}
            className="flex-1 py-2 rounded-xl font-bold text-sm bg-blue-100 text-blue-800 hover:bg-blue-200"
          >
            שנה פאזל
          </button>
          <button
            onClick={deleteDay}
            disabled={unassigning}
            className="flex-1 py-2 rounded-xl font-bold text-sm bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
          >
            מחק מהתאריך
          </button>
        </div>
      )}

      <div className="relative inline-block" style={{ zIndex: 0 }}>
        <SelectionLine selectedCells={[]} foundWordLines={wordLines} containerRef={gridContainerRef} />
        <div ref={gridContainerRef} className="flex flex-col items-center gap-2 select-none">
          {puzzle.grid.map((row, r) => (
            <div key={r} className="flex gap-2">
              {row.map((letter, c) => {
                const visual = assignedMap.get(cellKey({ row: r, col: c })) ?? 'default'
                return (
                  <div
                    key={c}
                    data-row={r}
                    data-col={c}
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-bold ${CELL_STYLE[visual]}`}
                  >
                    {letter}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-gray-100 p-3 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-400">מילים</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-purple-100 text-purple-800">מגה מחרוזת</span>
          <span className="flex-1 text-base font-bold text-center">{wordFromGrid(puzzle.grid, puzzle.mega_machrozet_cells)}</span>
        </div>
        {puzzle.word_cells.map((cells, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0 bg-green-100 text-green-800">מילה</span>
            <span className="flex-1 text-base font-bold text-center">{wordFromGrid(puzzle.grid, cells)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
