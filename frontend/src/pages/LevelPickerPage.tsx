import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi } from '../api/adminClient'
import { useRequireAdmin } from '../hooks/useRequireAdmin'
import type { LevelSummary } from '../api/adminClient'

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })
}

export default function LevelPickerPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const isAdmin = useRequireAdmin()

  const [levels, setLevels] = useState<LevelSummary[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [assigning, setAssigning] = useState<number | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [levelList, current] = await Promise.all([
        adminApi.getLevels(),
        date ? adminApi.getScheduledLevel(date).catch(() => null) : Promise.resolve(null),
      ])
      setLevels(levelList)
      setCurrentId(current?.id ?? null)
    } catch (e) {
      if (e instanceof Error && e.message === 'Unauthorized') {
        navigate('/admin/login')
        return
      }
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה')
    } finally {
      setLoading(false)
    }
  }, [date, navigate])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const pickLevel = async (puzzleId: number) => {
    if (!date) return
    setAssigning(puzzleId)
    setError('')
    try {
      await adminApi.assignLevel(date, puzzleId)
      navigate('/admin')
    } catch (e) {
      setAssigning(null)
      setError(e instanceof Error ? e.message : 'שגיאה בשיוך הפאזל')
    }
  }

  const deleteLevel = async (level: LevelSummary) => {
    if (!window.confirm(`למחוק את הפאזל #${level.id} - ${level.theme}?`)) return
    setError('')
    try {
      await adminApi.deleteLevel(level.id)
      setLevels((prev) => prev.filter((l) => l.id !== level.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה במחיקת הפאזל')
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

  return (
    <div className="flex flex-col items-center gap-5 py-6 px-4 min-h-dvh" dir="rtl">
      <div className="w-full max-w-sm flex items-center justify-between">
        <button onClick={() => navigate('/admin')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
        <span className="text-sm text-gray-500">{date ? formattedDate : 'כל הפאזלים'}</span>
      </div>

      <button
        onClick={() => navigate('/admin/levels/new', { state: { date } })}
        className="w-full max-w-sm py-3 rounded-2xl font-bold text-white text-lg bg-blue-500 hover:bg-blue-600"
      >
        + צור פאזל חדש
      </button>

      {error && <div className="w-full max-w-sm text-sm text-red-500 text-center">{error}</div>}

      <div className="w-full max-w-sm bg-white rounded-2xl border-2 border-gray-100 p-3 flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-gray-400">פאזלים קיימים</h2>
        {levels.length === 0 && <p className="text-sm text-gray-400 text-center py-2">אין פאזלים עדיין</p>}
        {levels.map((level) => {
          const isScheduled = level.scheduled_dates.length > 0
          const isCurrent = date != null && level.id === currentId
          return (
            <div key={level.id} className="flex items-center gap-2">
              <button
                onClick={() => date ? pickLevel(level.id) : navigate(`/admin/grid/puzzle/${level.id}`)}
                disabled={assigning !== null}
                className={`flex-1 text-right py-2 px-3 rounded-xl font-bold ${
                  isScheduled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                } ${isCurrent ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div>#{level.id} · {level.theme}</div>
                {isScheduled && (
                  <div className="text-xs font-normal mt-0.5">
                    {level.scheduled_dates.map(formatDate).join(', ')}
                  </div>
                )}
              </button>
              <button
                onClick={() => deleteLevel(level)}
                className="text-lg text-gray-400 hover:text-red-500 shrink-0 px-1"
                title="מחק פאזל"
              >
                🗑
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
