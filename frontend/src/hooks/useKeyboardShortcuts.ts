import { useEffect } from 'react'

interface KeyboardShortcuts {
  [key: string]: () => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or textareas
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        return
      }

      // Create key combination string
      const combo = [
        event.ctrlKey && 'ctrl',
        event.metaKey && 'meta',
        event.altKey && 'alt',
        event.shiftKey && 'shift',
        event.key.toLowerCase()
      ].filter(Boolean).join('+')

      // Check for shortcut
      if (shortcuts[combo]) {
        event.preventDefault()
        shortcuts[combo]()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

export function useGlobalKeyboardShortcuts() {
  return useKeyboardShortcuts({
    'ctrl+k': () => {
      // Global command palette (could be implemented later)
      console.log('Command palette shortcut')
    },
    'ctrl+,': () => {
      // Settings (could be implemented later)
      console.log('Settings shortcut')
    },
    'f5': () => {
      // Refresh current view
      const event = new CustomEvent('refresh-current-view')
      document.dispatchEvent(event)
    },
    'escape': () => {
      // Close modals, dialogs, etc.
      const event = new CustomEvent('close-modals')
      document.dispatchEvent(event)
    }
  })
}
