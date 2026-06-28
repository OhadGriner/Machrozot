import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi, adminAuth } from '../api/adminClient'
import SelectionLine from '../components/SelectionLine'
import type { WordLine } from '../store/gameStore'

const ROWS = 8
const COLS = 6

type CellPos = { row: number; col: number }
type WordType = 'word' | 'spangram'
interface WordGroup { cells: CellPos[]; type: WordType }

function cellKey(c: CellPos) { return `${c.row}-${c.col}` }

function isAdjacent(a: CellPos, b: CellPos) {
  return Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1 && cellKey(a) !== cellKey(b)
}

function wordFromGrid(grid: string[][], cells: CellPos[]) {
  return cells.map((c) => grid[c.row]?.[c.col] ?? '').join('')
}

function emptyGrid(): string[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(''))
}

// ── Cell visual states ────────────────────────────────────────────────────────
type CellVisual = 'default' | 'focused' | 'selected' | 'word' | 'spangram'

const CELL_STYLE: Record<CellVisual, string> = {
  default:  'bg-white border-gray-200 text-gray-800',
  focused:  'bg-white border-blue-500 text-blue-700 ring-2 ring-blue-200',
  selected: 'bg-blue-400 border-blue-400 text-white scale-105',
  word:     'bg-green-400 border-green-400 text-white',
  spangram: 'bg-yellow-400 border-yellow-400 text-white',
}

interface AdminCellProps {
  letter: string
  visual: CellVisual
  row: number
  col: number
  onPointerDown: () => void
}

function AdminCell({ letter, visual, row, col, onPointerDown }: AdminCellProps) {
  return (
    <div
      data-row={row}
      data-col={col}
      onPointerDown={onPointerDown}
      className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-xl font-bold cursor-pointer select-none transition-all duration-75 ${CELL_STYLE[visual]}`}
    >
      {letter || <span className="text-gray-300 text-sm">·</span>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminEditorPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()

  const [theme, setTheme] = useState('')
  const [grid, setGrid] = useState<string[][]>(emptyGrid)
  const [wordGroups, setWordGroups] = useState<WordGroup[]>([])
  const [selectedCells, setSelectedCells] = useState<CellPos[]>([])
  const [focusedCell, setFocusedCell] = useState<CellPos | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const isDragging = useRef(false)
  const hiddenInputRef = useRef<HTMLInputElement>(null)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  // Load existing puzzle for this date
  useEffect(() => {
    if (!adminAuth.isSet()) { navigate('/admin/login'); return }
    if (!date) return
    adminApi.getPuzzle(date).then((data) => {
      setTheme(data.theme)
      setGrid(data.grid)
      setWordGroups([
        { cells: data.spangram_cells, type: 'spangram' },
        ...data.word_cells.map((cells) => ({ cells, type: 'word' as WordType })),
      ])
    }).catch(() => {})  // 404 = new puzzle, blank grid is correct
  }, [date, navigate])

  // Derived: which cells are already committed to a word group
  const assignedMap = new Map<string, WordType>()
  wordGroups.forEach((g) => g.cells.forEach((c) => assignedMap.set(cellKey(c), g.type)))

  const selectedSet = new Set(selectedCells.map(cellKey))
  const focusedKey = focusedCell ? cellKey(focusedCell) : null

  function getCellVisual(row: number, col: number): CellVisual {
    const k = cellKey({ row, col })
    const assigned = assignedMap.get(k)
    if (assigned) return assigned
    if (selectedSet.has(k)) return 'selected'
    if (focusedKey === k) return 'focused'
    return 'default'
  }

  // ── Drag / selection — same mechanism as the game ─────────────────────────
  const startDrag = useCallback((cell: CellPos) => {
    isDragging.current = true
    setSelectedCells([cell])
    setFocusedCell(null)
  }, [])

  const extendDrag = useCallback((cell: CellPos) => {
    if (!isDragging.current) return
    setSelectedCells((prev) => {
      if (prev.some((c) => cellKey(c) === cellKey(cell))) return prev
      const last = prev[prev.length - 1]
      if (!isAdjacent(last, cell)) return prev
      return [...prev, cell]
    })
  }, [])

  const handleGridPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const r = el?.getAttribute('data-row')
    const c = el?.getAttribute('data-col')
    if (r != null && c != null) extendDrag({ row: Number(r), col: Number(c) })
  }

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    setSelectedCells((prev) => {
      if (prev.length === 1) {
        // Single tap — enter letter mode for that cell
        setFocusedCell(prev[0])
        setTimeout(() => hiddenInputRef.current?.focus(), 0)
        return []
      }
      return prev  // Keep multi-cell selection for word assignment
    })
  }, [])

  // ── Letter entry via hidden input ─────────────────────────────────────────
  const setLetter = useCallback((row: number, col: number, letter: string) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r])
      next[row][col] = letter
      return next
    })
  }, [])

  const moveFocus = useCallback((row: number, col: number) => {
    const r = Math.max(0, Math.min(ROWS - 1, row))
    const c = Math.max(0, Math.min(COLS - 1, col))
    setFocusedCell({ row: r, col: c })
  }, [])

  const advanceFocus = useCallback((from: CellPos) => {
    if (from.col + 1 < COLS) moveFocus(from.row, from.col + 1)
    else if (from.row + 1 < ROWS) moveFocus(from.row + 1, 0)
    else setFocusedCell(null)
  }, [moveFocus])

  // onKeyDown: handles arrow keys and backspace
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!focusedCell) return
    const { row, col } = focusedCell
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        // RTL: right on screen = lower col index
        moveFocus(row, col - 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveFocus(row, col + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(row - 1, col)
        break
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(row + 1, col)
        break
      case 'Backspace':
        e.preventDefault()
        setLetter(row, col, '')
        break
      case 'Escape':
        setFocusedCell(null)
        break
    }
  }

  // onChange: handles actual letter input (works on mobile virtual keyboards too)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!focusedCell || !e.target.value) return
    const char = e.target.value.slice(-1)
    setLetter(focusedCell.row, focusedCell.col, char)
    advanceFocus(focusedCell)
    e.target.value = ''  // reset so next input fires onChange again
  }

  // ── Word assignment ────────────────────────────────────────────────────────
  const commitSelection = (type: WordType) => {
    if (selectedCells.length < 2) return
    setWordGroups((prev) => [...prev, { cells: selectedCells, type }])
    setSelectedCells([])
  }

  const removeWordGroup = (i: number) => {
    setWordGroups((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Validation ─────────────────────────────────────────────────────────────
  const spangramGroups = wordGroups.filter((g) => g.type === 'spangram')
  const wordGroupsOnly = wordGroups.filter((g) => g.type === 'word')
  const allFilled = grid.every((row) => row.every((c) => c !== ''))
  const canSave =
    !!theme.trim() &&
    allFilled &&
    spangramGroups.length === 1 &&
    wordGroupsOnly.length >= 1 &&
    assignedMap.size === ROWS * COLS

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave || !date) return
    setSaveStatus('saving')
    try {
      await adminApi.savePuzzle(date, {
        theme: theme.trim(),
        grid,
        spangram_cells: spangramGroups[0].cells,
        word_cells: wordGroupsOnly.map((g) => g.cells),
      })
      setSaveStatus('saved')
      setTimeout(() => navigate('/admin'), 1200)
    } catch {
      setSaveStatus('error')
    }
  }

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 min-h-dvh" dir="rtl">

      {/* Hidden input — captures letter keys + triggers mobile keyboard on tap */}
      <input
        ref={hiddenInputRef}
        className="fixed opacity-0 w-px h-px top-0 left-0 pointer-events-none"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onChange={handleInputChange}
      />

      {/* Top bar */}
      <div className="w-full max-w-sm flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
        <span className="text-sm text-gray-500">{formattedDate}</span>
      </div>

      {/* Theme */}
      <input
        type="text"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="נושא הפאזל"
        className="w-full max-w-sm border-2 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:border-blue-400"
      />

      {/* Grid — same pointer-event pattern as the game */}
      <div className="relative inline-block" style={{ zIndex: 0 }}>
        <SelectionLine
          selectedCells={selectedCells}
          foundWordLines={wordGroups.map((g): WordLine => ({ cells: g.cells, state: g.type === 'word' ? 'found' : 'spangram' }))}
          containerRef={gridContainerRef}
        />
        <div
          ref={gridContainerRef}
          className="flex flex-col items-center gap-2 select-none touch-none"
          onPointerMove={handleGridPointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {grid.map((row, r) => (
            <div key={r} className="flex gap-2">
              {row.map((letter, c) => (
                <AdminCell
                  key={c}
                  letter={letter}
                  visual={getCellVisual(r, c)}
                  row={r}
                  col={c}
                  onPointerDown={() => startDrag({ row: r, col: c })}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Word action buttons — appear after a drag selects 2+ cells */}
      {selectedCells.length >= 2 && (
        <div className="flex gap-2 w-full max-w-sm">
          <button
            onClick={() => commitSelection('word')}
            className="flex-1 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 text-sm"
          >
            מילה · {wordFromGrid(grid, selectedCells)}
          </button>
          <button
            onClick={() => commitSelection('spangram')}
            className="flex-1 py-2 bg-yellow-400 text-white rounded-xl font-bold hover:bg-yellow-500 text-sm"
          >
            ספנגרם
          </button>
          <button
            onClick={() => setSelectedCells([])}
            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Word list */}
      {wordGroups.length > 0 && (
        <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-gray-100 p-3 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400">מילים שנבחרו</h2>
          {wordGroups.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${g.type === 'spangram' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                {g.type === 'spangram' ? 'ספנגרם' : 'מילה'}
              </span>
              <span className="flex-1 text-base font-bold text-center">{wordFromGrid(grid, g.cells)}</span>
              <button onClick={() => removeWordGroup(i)} className="text-red-400 hover:text-red-600 font-bold shrink-0 px-1">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Validation hints */}
      <div className="text-xs text-gray-400 text-center flex flex-col gap-0.5">
        {!allFilled && <span>⚠ {grid.flat().filter((c) => !c).length} תאים ריקים</span>}
        {spangramGroups.length === 0 && wordGroups.length > 0 && <span>⚠ חסר ספנגרם</span>}
        {spangramGroups.length > 1 && <span>⚠ יותר מספנגרם אחד</span>}
        {allFilled && assignedMap.size < ROWS * COLS && (
          <span>⚠ {ROWS * COLS - assignedMap.size} תאים לא שויכו למילה</span>
        )}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!canSave || saveStatus === 'saving'}
        className={`w-full max-w-sm py-3 rounded-2xl font-bold text-white text-lg transition-colors ${
          saveStatus === 'saved'  ? 'bg-green-500' :
          saveStatus === 'error'  ? 'bg-red-500' :
          canSave                 ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300'
        }`}
      >
        {saveStatus === 'saving' ? 'שומר...' :
         saveStatus === 'saved'  ? '✓ נשמר!' :
         saveStatus === 'error'  ? 'שגיאה בשמירה' : 'שמור פאזל'}
      </button>
    </div>
  )
}
