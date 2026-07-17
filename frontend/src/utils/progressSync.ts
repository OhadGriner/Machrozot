import type { ProgressPayload, ProgressResponse } from '../api/client'
import type { SavedProgress } from './persistence'

// Local vs server progress can diverge (played on another device, or offline).
// Whoever found more words is further along; on a tie the local copy wins —
// it's the device the player is holding right now.
export function pickRicherProgress(
  local: SavedProgress | null,
  server: SavedProgress | null
): SavedProgress | null {
  if (!local) return server
  if (!server) return local
  return server.foundWords.length > local.foundWords.length ? server : local
}

export function toServerPayload(progress: SavedProgress): ProgressPayload {
  return {
    progress: progress as unknown as Record<string, unknown>,
    active_seconds: Math.round(progress.activeSeconds),
    is_complete: progress.isComplete,
  }
}

export function fromServerResponse(response: ProgressResponse): SavedProgress | null {
  const p = response.progress as unknown as SavedProgress
  if (!p || !Array.isArray(p.foundWords)) return null
  return { ...p, activeSeconds: response.active_seconds, isComplete: response.is_complete }
}
