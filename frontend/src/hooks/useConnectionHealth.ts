import { useEffect, useRef, useCallback } from 'react'
import { useConnectionStore } from '@/stores/connectionStore'
import { apiClient } from '@/services/api'
import { toast } from '@/hooks/useToast'

interface UseConnectionHealthOptions {
  checkInterval?: number // in milliseconds, default 5 minutes
  enabled?: boolean
}

export function useConnectionHealth({ 
  checkInterval = 5 * 60 * 1000, // 5 minutes
  enabled = true 
}: UseConnectionHealthOptions = {}) {
  const { activeConnection, setActiveConnection, removeConnection } = useConnectionStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

  const checkConnectionHealth = useCallback(async () => {
    if (!activeConnection || !enabled) return

    try {
      // Try to list files from the current directory as a health check
      const result = await apiClient.listFiles(activeConnection.id, '/')
      
      if (!result.success) {
        // Check if this is a connection timeout or connection not found error
        if (apiClient.isConnectionTimeoutError(result.error || '')) {
          console.log('Connection timed out, cleaning up...')
          await handleConnectionTimeout()
        }
      }
    } catch (error) {
      console.log('Health check failed:', error)
      // If the request fails completely, it might be a network issue or timeout
      if (isNetworkError(error)) {
        await handleConnectionTimeout()
      }
    }
  }, [activeConnection, enabled])

  const handleConnectionTimeout = useCallback(async () => {
    if (!activeConnection) return

    // Clean up the connection state
    removeConnection(activeConnection.id)
    setActiveConnection(null)
    apiClient.clearSession()

    // Show a user-friendly notification
    toast({
      variant: "warning",
      title: "Connection Timeout",
      description: "Your connection timed out due to inactivity. Please reconnect to continue.",
    })
  }, [activeConnection, removeConnection, setActiveConnection])


  const isNetworkError = (error: any): boolean => {
    if (!error) return false
    const errorStr = error.toString().toLowerCase()
    
    return errorStr.includes('network error') ||
           errorStr.includes('fetch failed') ||
           errorStr.includes('connection refused') ||
           errorStr.includes('timeout')
  }

  // Start health checking when there's an active connection
  useEffect(() => {
    if (activeConnection && enabled) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Start periodic health checks
      intervalRef.current = setInterval(checkConnectionHealth, checkInterval)

      // Run an initial health check after a short delay
      setTimeout(checkConnectionHealth, 5000)
    } else {
      // Clean up interval when no active connection
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [activeConnection, enabled, checkInterval, checkConnectionHealth])

  // Track user activity
  useEffect(() => {
    if (!enabled || !activeConnection) return

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    const handleActivity = () => {
      updateActivity()
    }

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [enabled, activeConnection, updateActivity])

  return {
    isHealthCheckEnabled: enabled && !!activeConnection,
    updateActivity,
    lastActivity: lastActivityRef.current,
    checkConnectionHealth
  }
}