import { Routes, Route } from 'react-router-dom'
import GamePage from './pages/GamePage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminCalendarPage from './pages/AdminCalendarPage'
import AdminEditorPage from './pages/AdminEditorPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminCalendarPage />} />
      <Route path="/admin/editor/:date" element={<AdminEditorPage />} />
    </Routes>
  )
}
