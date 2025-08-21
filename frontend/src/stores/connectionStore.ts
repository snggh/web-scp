import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Connection, TransferItem, TransferProgress } from '@/types'

interface ConnectionStore {
  connections: Connection[]
  activeConnection: Connection | null
  transfers: TransferItem[]
  addConnection: (connection: Connection) => void
  removeConnection: (id: string) => void
  updateConnection: (id: string, updates: Partial<Connection>) => void
  setActiveConnection: (connection: Connection | null) => void
  loadPersistedConnections: () => void
  // Transfer management
  addTransfer: (transfer: TransferItem) => void
  updateTransferProgress: (progress: TransferProgress) => void
  removeTransfer: (id: string) => void
  clearCompletedTransfers: () => void
}

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnection: null,
      transfers: [],
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
      // Transfer management methods
      addTransfer: (transfer) => {
        set((state) => ({
          transfers: [...state.transfers, transfer],
        }))
      },
      updateTransferProgress: (progress) => {
        set((state) => ({
          transfers: state.transfers.map((transfer) =>
            transfer.id === progress.id
              ? {
                  ...transfer,
                  progress: progress.progress,
                  status: progress.status as TransferItem['status'],
                  speed: progress.speed,
                  remainingTime: progress.remainingTime,
                  error: progress.error,
                }
              : transfer
          ),
        }))
      },
      removeTransfer: (id) => {
        set((state) => ({
          transfers: state.transfers.filter((transfer) => transfer.id !== id),
        }))
      },
      clearCompletedTransfers: () => {
        set((state) => ({
          transfers: state.transfers.filter(
            (transfer) => transfer.status !== 'completed' && transfer.status !== 'error'
          ),
        }))
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