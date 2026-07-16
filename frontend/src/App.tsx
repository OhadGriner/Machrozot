import { Routes, Route } from 'react-router-dom'
import GamePage from './pages/GamePage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminCalendarPage from './pages/AdminCalendarPage'
import LevelPickerPage from './pages/LevelPickerPage'
import LevelEditorPage from './pages/LevelEditorPage'
import LevelGridViewPage from './pages/LevelGridViewPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GamePage />} />
      <Route path="/archive/:date" element={<GamePage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminCalendarPage />} />
      <Route path="/admin/levels/new" element={<LevelEditorPage />} />
      <Route path="/admin/levels" element={<LevelPickerPage />} />
      <Route path="/admin/levels/:date" element={<LevelPickerPage />} />
      <Route path="/admin/grid/puzzle/:id" element={<LevelGridViewPage />} />
      <Route path="/admin/grid/:date" element={<LevelGridViewPage />} />
    </Routes>
  )
}
