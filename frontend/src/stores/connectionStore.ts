import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Connection } from '@/types'

interface ConnectionStore {
  connections: Connection[]
  activeConnection: Connection | null
  addConnection: (connection: Connection) => void
  removeConnection: (id: string) => void
  updateConnection: (id: string, updates: Partial<Connection>) => void
  setActiveConnection: (connection: Connection | null) => void
  loadPersistedConnections: () => void
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,
      addConnection: (connection) => {
        set((state) => ({
          connections: [...state.connections, connection],
        }))
      },
      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
          activeConnection: state.activeConnection?.id === id ? null : state.activeConnection,
        })),
      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id ? { ...conn, ...updates } : conn
          ),
          activeConnection:
            state.activeConnection?.id === id
              ? { ...state.activeConnection, ...updates }
              : state.activeConnection,
        })),
      setActiveConnection: (connection) => {
        set({ activeConnection: connection })
      },
      loadPersistedConnections: () => {
        // This will be called to restore persisted state
        const state = get()
      },
    }),
    {
      name: 'web-scp-connections',
      partialize: (state) => ({
        connections: state.connections,
        activeConnection: state.activeConnection,
      }),
      onRehydrateStorage: () => (state) => {
        // Silent rehydration
      },
    }
  )
)