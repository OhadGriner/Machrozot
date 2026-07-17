import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { initGoogleButton, isGoogleAuthConfigured } from '../utils/googleAuth'

export default function AuthButton() {
  const { user, initialized, loginWithGoogle, logout } = useAuthStore()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const showGoogleButton = isGoogleAuthConfigured() && initialized && !user

  useEffect(() => {
    if (!showGoogleButton || !buttonRef.current) return
    initGoogleButton(buttonRef.current, (credential) => {
      loginWithGoogle(credential).catch(() => {})
    }).catch(() => {})
  }, [showGoogleButton, loginWithGoogle])

  if (!isGoogleAuthConfigured()) return null

  if (user) {
    return (
      <div className="absolute right-2 top-0">
        <button onClick={() => setMenuOpen((v) => !v)} aria-label="חשבון">
          {user.picture_url ? (
            <img src={user.picture_url} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center">
              {(user.name ?? user.email)[0]}
            </span>
          )}
        </button>
        {menuOpen && (
          // Anchored to the avatar's right edge so the menu opens inward
          // (leftward) — left-anchoring pushed it off the right side of the
          // screen, since the avatar sits at the screen's right edge.
          <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-2 text-sm whitespace-nowrap z-40">
            <p className="text-gray-600 mb-1">{user.name ?? user.email}</p>
            <button
              onClick={() => {
                logout()
                setMenuOpen(false)
              }}
              className="text-red-500 hover:text-red-700 font-medium"
            >
              התנתק
            </button>
          </div>
        )}
      </div>
    )
  }

  return <div ref={buttonRef} className="absolute right-2 top-0" />
}
