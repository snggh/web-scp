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

export interface DownloadResponse {
  success: boolean
  data?: Blob
  fileName?: string
  error?: string
}

class ApiClient {
  private sessionId: string | null = null

  setSessionId(sessionId: string) {
    this.sessionId = sessionId
    // Store in localStorage for persistence
    localStorage.setItem('web-scp-session-id', sessionId)
  }

  getSessionId(): string | null {
    if (!this.sessionId) {
      // Try to restore from localStorage
      this.sessionId = localStorage.getItem('web-scp-session-id')
    }
    return this.sessionId
  }

  clearSession() {
    this.sessionId = null
    localStorage.removeItem('web-scp-session-id')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers,
      }

      // Add session ID if available
      const sessionId = this.getSessionId()
      if (sessionId) {
        headers['X-Session-ID'] = sessionId
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers,
        ...options,
      })

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response isn't JSON, use the status message
        }
        throw new Error(errorMessage)
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
    const response = await this.request<{ connectionId: string, userSession: string, connection: any }>('/connections/connect', {
      method: 'POST',
      body: JSON.stringify(config),
    })
    
    // Store session ID if connection is successful
    const actualData = response.data?.data || response.data
    if (response.success && actualData?.userSession) {
      this.setSessionId(actualData.userSession)
    }
    
    return response
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

  async uploadFile(connectionId: string, file: File, remotePath: string) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('connectionId', connectionId)
    formData.append('remotePath', remotePath)

    return this.request('/transfer/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type header - let the browser set it with boundary for FormData
        ...this.getAuthHeaders(),
      },
    })
  }

  async downloadFile(connectionId: string, remotePath: string): Promise<DownloadResponse> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      }

      const response = await fetch(`${API_BASE}/transfer/download`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ connectionId, remotePath }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `HTTP error! status: ${response.status}`)
      }

      // Return the blob directly for binary data
      return {
        success: true,
        data: await response.blob(),
        fileName: this.extractFileName(remotePath),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  private extractFileName(path: string): string {
    return path.split('/').pop() || 'downloaded_file'
  }

  private getAuthHeaders() {
    const headers: Record<string, string> = {}
    const sessionId = this.getSessionId()
    if (sessionId) {
      headers['X-Session-ID'] = sessionId
    }
    return headers
  }
}

export const apiClient = new ApiClient()