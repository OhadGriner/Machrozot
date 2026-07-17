import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, authToken } from '../api/client'

// Gate for admin pages: verifies the signed-in account actually has admin
// rights (via /api/auth/me), not merely that some token exists. Redirects to
// the admin login page otherwise. Returns true once verified.
export function useRequireAdmin(): boolean {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!authToken.get()) {
      navigate('/admin/login')
      return
    }
    let cancelled = false
    authApi
      .getMe()
      .then((user) => {
        if (cancelled) return
        if (user.is_admin) setIsAdmin(true)
        else navigate('/admin/login')
      })
      .catch(() => {
        if (!cancelled) navigate('/admin/login')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return isAdmin
}
