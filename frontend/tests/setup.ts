import '@testing-library/jest-dom/vitest'

// Node's experimental global localStorage (the "--localstorage-file was
// provided without a valid path" warning) shadows jsdom's implementation in
// vitest, leaving a Storage object with no working methods. Replace it with a
// plain in-memory implementation for tests.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
})
