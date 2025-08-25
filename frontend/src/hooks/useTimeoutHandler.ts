import { useCallback } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { toast } from '@/hooks/useToast'

export function useTimeoutHandler() {
  const { activeConnection, removeConnection, setActiveConnection } = useConnectionStore()

  const handleApiError = useCallback(async (error: string | null, action?: string) => {
    if (!error || !activeConnection) return false

    // Check if this is a connection timeout error
    if (apiClient.isConnectionTimeoutError(error)) {
      console.log('Connection timeout detected, cleaning up...')
      
      // Clean up the connection state
      removeConnection(activeConnection.id)
      setActiveConnection(null)
      apiClient.clearSession()

      // Show timeout notification with context
      const actionText = action ? ` while ${action}` : ''
      toast({
        variant: "warning",
        title: "Connection Timeout",
        description: `Your connection timed out${actionText}. Please reconnect to continue.`,
      })

      return true // Handled
    }

    return false // Not handled
  }, [activeConnection, removeConnection, setActiveConnection])

  const wrapApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    action?: string
  ): Promise<T | null> => {
    try {
      const result = await apiCall()
      
      // Check if the result has an error field (for API responses)
      if (typeof result === 'object' && result !== null && 'success' in result && !result.success) {
        const apiResult = result as any
        const wasHandled = await handleApiError(apiResult.error, action)
        if (wasHandled) {
          return null
        }
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const wasHandled = await handleApiError(errorMessage, action)
      if (wasHandled) {
        return null
      }
      throw error // Re-throw if not a timeout error
    }
  }, [handleApiError])

  return {
    handleApiError,
    wrapApiCall,
    isConnectionActive: !!activeConnection
  }
}