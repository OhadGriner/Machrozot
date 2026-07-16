import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, adminAuth } from '../api/adminClient'
import type { ScheduleEntry } from '../api/adminClient'

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const DAY_NAMES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export default function AdminCalendarPage() {
  const navigate = useNavigate()
  const today = new Date()

  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [schedules, setSchedules] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSchedules = useCallback(async () => {
    if (!adminAuth.isSet()) { navigate('/admin/login'); return }
    const start = toDateStr(view.year, view.month, 1)
    const lastDay = new Date(view.year, view.month + 1, 0).getDate()
    const end = toDateStr(view.year, view.month, lastDay)
    setError('')
    try {
      const entries: ScheduleEntry[] = await adminApi.getSchedules(start, end)
      const map: Record<string, string> = {}
      entries.forEach((e) => { map[e.date] = e.theme })
      setSchedules(map)
    } catch (e) {
      if (e instanceof Error && e.message === 'Unauthorized') {
        navigate('/admin/login')
        return
      }
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת הלוח')
    } finally {
      setLoading(false)
    }
  }, [view, navigate])

  useEffect(() => {
    setLoading(true)
    loadSchedules()
  }, [loadSchedules])

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-gray-400">טוען...</p>
      </div>
    )
  }

  const firstDayOfWeek = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const isToday = (day: number) =>
    view.year === today.getFullYear() && view.month === today.getMonth() && day === today.getDate()

  return (
    <div className="flex flex-col items-center py-8 px-4 min-h-dvh bg-gray-50" dir="rtl">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setView(addMonth(view.year, view.month, 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-gray-200"
          >
            ‹
          </button>
          <h1 className="text-xl font-bold">{MONTH_NAMES[view.month]} {view.year}</h1>
          <button
            onClick={() => setView(addMonth(view.year, view.month, -1))}
            className="w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-gray-200"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 font-semibold py-1">{d}</div>
          ))}
        </div>

        <div className="mb-4 text-center">
          <button
            onClick={() => navigate('/admin/levels')}
            className="text-sm font-semibold text-blue-500 hover:text-blue-700"
          >
            רשימת כל הפאזלים ←
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-500 text-center">{error}</p>}

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`pad-${i}`} />
            const dateStr = toDateStr(view.year, view.month, day)
            const theme = schedules[dateStr]
            return (
              <div
                key={day}
                onClick={() => navigate(theme ? `/admin/grid/${dateStr}` : `/admin/levels/${dateStr}`)}
                className={[
                  'aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer p-1',
                  'border-2 transition-all hover:shadow-md',
                  isToday(day) ? 'border-blue-500' : 'border-transparent',
                  theme ? 'bg-green-100' : 'bg-white',
                ].join(' ')}
              >
                <span className={`text-sm leading-none ${isToday(day) ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
                  {day}
                </span>
                {theme && (
                  <span className="text-[8px] text-green-700 leading-tight text-center w-full truncate mt-0.5 px-0.5">
                    {theme}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-gray-600">
            חזרה למשחק
          </button>
        </div>
      </div>
    </div>
  )
}
