import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com'

// No-ops entirely when the key isn't configured (local dev without a .env,
// tests, CI) so analytics never affects app behavior or throws.
if (KEY) {
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
  })
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!KEY) return
  posthog.capture(event, properties)
}
