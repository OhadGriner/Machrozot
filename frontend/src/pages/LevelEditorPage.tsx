import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { adminApi } from '../api/adminClient'
import { useRequireAdmin } from '../hooks/useRequireAdmin'

const TOTAL_LETTERS = 48

export default function LevelEditorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const fromDate = (location.state as { date?: string } | null)?.date

  const [theme, setTheme] = useState('')
  const [megaMachrozet, setMegaMachrozet] = useState('')
  const [words, setWords] = useState<string[]>([])
  const [wordInput, setWordInput] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useRequireAdmin()

  const addWord = useCallback(() => {
    const trimmed = wordInput.trim()
    if (!trimmed) return
    setWords((prev) => [...prev, trimmed])
    setWordInput('')
  }, [wordInput])

  const removeWord = (i: number) => {
    setWords((prev) => prev.filter((_, idx) => idx !== i))
  }

  const reorderWord = (from: number, to: number) => {
    setWords((prev) => {
      if (from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const committedLetters = megaMachrozet.length + words.reduce((sum, w) => sum + w.length, 0)
  const totalLetters = committedLetters + wordInput.length
  const canSave = !!theme.trim() && !!megaMachrozet.trim() && words.length >= 1 && committedLetters === TOTAL_LETTERS

  const goBack = useCallback(() => {
    navigate(fromDate ? `/admin/levels/${fromDate}` : '/admin')
  }, [navigate, fromDate])

  const handleSave = async () => {
    if (!canSave) return
    setSaveStatus('saving')
    setErrorMessage('')
    const payload = { theme: theme.trim(), mega_machrozet: megaMachrozet.trim(), words }
    try {
      await adminApi.createLevel(payload)
      setSaveStatus('saved')
      setTimeout(goBack, 1200)
    } catch (e) {
      setSaveStatus('error')
      setErrorMessage(e instanceof Error ? e.message : 'שגיאה בשמירה')
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 min-h-dvh" dir="rtl">
      <div className="w-full max-w-sm flex items-center justify-between">
        <button onClick={goBack} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
        <span className="text-sm text-gray-500">פאזל חדש</span>
      </div>

      <input
        type="text"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        placeholder="נושא הפאזל"
        className="w-full max-w-sm border-2 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:border-blue-400"
      />

      <input
        type="text"
        value={megaMachrozet}
        onChange={(e) => setMegaMachrozet(e.target.value)}
        placeholder="מגה מחרוזת"
        className="w-full max-w-sm border-2 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:border-purple-400"
      />

      <div className="w-full max-w-sm flex gap-2">
        <input
          type="text"
          value={wordInput}
          onChange={(e) => setWordInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord() } }}
          placeholder="הוסף מילה"
          className="flex-1 border-2 rounded-xl px-4 py-2 text-lg font-bold text-center focus:outline-none focus:border-green-400"
        />
        <button
          onClick={addWord}
          className="px-4 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600"
        >
          הוסף
        </button>
      </div>

      <div className={`text-lg font-bold ${totalLetters === TOTAL_LETTERS ? 'text-green-600' : totalLetters > TOTAL_LETTERS ? 'text-red-500' : 'text-gray-500'}`}>
        {totalLetters} / {TOTAL_LETTERS}
      </div>

      {words.length > 0 && (
        <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-gray-100 p-3 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-400">מילים</h2>
          {words.map((w, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDraggedIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => {
                if (draggedIndex !== null && draggedIndex !== i) {
                  reorderWord(draggedIndex, i)
                  setDraggedIndex(i)
                }
              }}
              onDrop={() => setDraggedIndex(null)}
              onDragEnd={() => setDraggedIndex(null)}
              className={`flex items-center gap-2 transition-opacity ${draggedIndex === i ? 'opacity-30' : ''}`}
            >
              <span className="text-gray-300 cursor-grab active:cursor-grabbing shrink-0 px-1 select-none">⠿</span>
              <span className="flex-1 text-base font-bold text-center">{w}</span>
              <span className="text-xs text-gray-400">{w.length}</span>
              <button onClick={() => removeWord(i)} className="text-red-400 hover:text-red-600 font-bold shrink-0 px-1">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="w-full max-w-sm text-sm text-red-500 text-center">{errorMessage}</div>
      )}

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
