import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { initGoogleButton, isGoogleAuthConfigured } from '../utils/googleAuth'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { user, loginWithGoogle } = useAuthStore()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  // Already signed in: admins go straight in; anyone else sees the denial.
  useEffect(() => {
    if (user?.is_admin) navigate('/admin')
  }, [user, navigate])

  useEffect(() => {
    if (user || !buttonRef.current) return
    initGoogleButton(buttonRef.current, (credential) => {
      loginWithGoogle(credential).catch(() => setError('ההתחברות נכשלה, נסו שוב'))
    }).catch(() => setError('טעינת ההתחברות של Google נכשלה'))
  }, [user, loginWithGoogle])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-md w-80 flex flex-col items-center gap-4" dir="rtl">
        <h1 className="text-xl font-bold text-center">כניסת מנהל</h1>
        {!isGoogleAuthConfigured() ? (
          <p className="text-sm text-red-500 text-center">
            התחברות Google אינה מוגדרת (חסר VITE_GOOGLE_CLIENT_ID)
          </p>
        ) : user && !user.is_admin ? (
          <p className="text-sm text-red-500 text-center">
            אין לך הרשאת מנהל ({user.email})
          </p>
        ) : (
          <div ref={buttonRef} />
        )}
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
      </div>
    </div>
  )
}
