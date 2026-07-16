import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminAuth } from '../api/adminClient'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    adminAuth.set(password)
    navigate('/admin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-md w-80 flex flex-col gap-4"
        dir="rtl"
      >
        <h1 className="text-xl font-bold text-center">כניסת מנהל</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="סיסמה"
          className="border rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
          autoFocus
        />
        <button
          type="submit"
          disabled={!password}
          className="bg-blue-500 text-white rounded-lg py-2 font-bold hover:bg-blue-600 disabled:opacity-40"
        >
          כניסה
        </button>
      </form>
    </div>
  )
}
