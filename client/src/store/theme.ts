import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'system'
export type ResolvedTheme = 'dark' | 'light'

const STORAGE_KEY = 'parley:theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light' || stored === 'system') {
    return stored
  }
  return 'system'
}

function resolve(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolve(theme)
}

interface ThemeState {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  resolved: resolve(getInitialTheme()),
  setTheme(theme) {
    applyTheme(theme)
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore
    }
    set({ theme, resolved: resolve(theme) })
  },
}))

// Apply on module load so the first paint matches the chosen theme.
applyTheme(getInitialTheme())

// Re-apply when the OS theme changes, but only while in 'system' mode.
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: light)')
  const handler = () => {
    const { theme } = useThemeStore.getState()
    if (theme === 'system') {
      applyTheme('system')
      useThemeStore.setState({ resolved: resolve('system') })
    }
  }
  if (mql.addEventListener) mql.addEventListener('change', handler)
  else mql.addListener(handler)
}
