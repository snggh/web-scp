import { create } from 'zustand'
import { Connection } from '@/types'

interface ConnectionStore {
  connections: Connection[]
  activeConnection: Connection | null
  addConnection: (connection: Connection) => void
  removeConnection: (id: string) => void
  updateConnection: (id: string, updates: Partial<Connection>) => void
  setActiveConnection: (connection: Connection | null) => void
}

export const useConnectionStore = create<ConnectionStore>((set) => ({
  connections: [],
  activeConnection: null,
  addConnection: (connection) =>
    set((state) => ({
      connections: [...state.connections, connection],
    })),
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
  setActiveConnection: (connection) =>
    set({ activeConnection: connection }),
}))