const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

export function isGoogleAuthConfigured(): boolean {
  return !!CLIENT_ID
}

let scriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptPromise = null
        reject(new Error('Failed to load Google Identity Services'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptPromise
}

// Renders the official Google sign-in button into `container`; onCredential
// receives the Google ID token to exchange with our backend. Silently no-ops
// when VITE_GOOGLE_CLIENT_ID isn't configured (same pattern as analytics.ts).
export async function initGoogleButton(
  container: HTMLElement,
  onCredential: (credential: string) => void
): Promise<void> {
  if (!CLIENT_ID) return
  await loadGisScript()
  window.google!.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: (response) => onCredential(response.credential),
  })
  // Icon-only: the full "כניסה באמצעות Google" text button is wide enough to
  // cover the centered logo on narrow screens.
  window.google!.accounts.id.renderButton(container, {
    type: 'icon',
    shape: 'circle',
    size: 'medium',
    theme: 'outline',
  })
}
