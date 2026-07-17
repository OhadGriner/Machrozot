import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './utils/analytics'
import App from './App'
import { useAuthStore } from './store/authStore'

// Restore the logged-in user (if any) before first paint decisions.
useAuthStore.getState().fetchMe()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
