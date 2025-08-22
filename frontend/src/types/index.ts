export interface Connection {
  id: string
  name: string
  protocol: 'ftp' | 'sftp'
  host: string
  port: number
  username: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastConnected?: Date
  // Legacy fields for backward compatibility
  password?: string
  keyFile?: string
  // New authentication fields
  authMethod?: 'password' | 'key'
  privateKey?: string
  privateKeyFile?: File
  passphrase?: string
}

export interface FileItem {
  name: string
  size: number
  type: 'file' | 'directory'
  permissions: string
  modified: Date
  path: string
}

export interface TransferItem {
  id: string
  type: 'upload' | 'download'
  fileName: string
  progress: number
  status: 'pending' | 'transferring' | 'completed' | 'error' | 'paused'
  speed?: number
  remainingTime?: number
  error?: string
}

export interface TransferProgress {
  id: string
  type: 'upload' | 'download'
  fileName: string
  progress: number
  speed?: number
  remainingTime?: number
  status: 'transferring' | 'completed' | 'error'
  error?: string
}

export interface WSMessage {
  type: string
  data: any
}