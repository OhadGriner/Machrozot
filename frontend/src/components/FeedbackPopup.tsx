import { useState } from 'react'
import { api } from '../api/client'

interface Props {
  context: string
  onClose: () => void
}

export default function FeedbackPopup({ context, onClose }: Props) {
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const handleSubmit = async () => {
    if (!message.trim()) return
    setSending(true)
    try {
      await api.submitFeedback({ message: message.trim(), contact: contact.trim() || undefined, context })
      setSent(true)
      setTimeout(onClose, 1500)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-2xl">
      <div className="bg-white rounded-2xl shadow-xl p-5 w-72 text-center flex flex-col gap-3 relative">
        <button
          onClick={onClose}
          aria-label="סגור"
          className="absolute top-2 left-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
        >
          ✕
        </button>

        {sent ? (
          <p className="text-green-600 font-medium py-4">תודה על המשוב! 💚</p>
        ) : (
          <>
            <p className="text-gray-700 font-medium">מה דעתך על המשחק? נשמח לשמוע 🙂</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="כתבו כאן..."
              rows={3}
              className="border border-gray-200 rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="דוא״ל לחזרה (אופציונלי)"
              className="border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || sending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium rounded-lg px-4 py-2 text-sm"
            >
              שלח
            </button>
          </>
        )}
      </div>
    </div>
  )
}
