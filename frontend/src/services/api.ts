const API_BASE = '/api'

export interface TestConnectionRequest {
  protocol: 'ftp' | 'sftp'
  host: string
  port: number
  username: string
  password?: string
  keyFile?: string
}

export interface ConnectRequest extends TestConnectionRequest {
  name: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async testConnection(config: TestConnectionRequest) {
    return this.request('/connections/test', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async connect(config: ConnectRequest) {
    return this.request<{ connectionId: string }>('/connections/connect', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  async disconnect(connectionId: string) {
    return this.request(`/connections/${connectionId}`, {
      method: 'DELETE',
    })
  }

  async listFiles(connectionId: string, path: string = '/') {
    return this.request<{ files: any[] }>(`/files/list?connectionId=${connectionId}&path=${encodeURIComponent(path)}`)
  }

  async createDirectory(connectionId: string, path: string) {
    return this.request('/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ connectionId, path }),
    })
  }

  async deleteFile(connectionId: string, path: string) {
    return this.request('/files/delete', {
      method: 'DELETE',
      body: JSON.stringify({ connectionId, path }),
    })
  }

  async renameFile(connectionId: string, oldPath: string, newPath: string) {
    return this.request('/files/rename', {
      method: 'PUT',
      body: JSON.stringify({ connectionId, oldPath, newPath }),
    })
  }
}

export const apiClient = new ApiClient()