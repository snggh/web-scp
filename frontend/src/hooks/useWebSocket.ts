import { useEffect, useRef, useState } from 'react'

interface WSMessage {
  type: string
  data: any
}

interface UseWebSocketReturn {
  socket: WebSocket | null
  isConnected: boolean
  send: (message: WSMessage) => void
  lastMessage: WSMessage | null
}

export function useWebSocket(url: string = '/ws'): UseWebSocketReturn {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const shouldReconnectRef = useRef(true)

  const connect = () => {
    if (!shouldReconnectRef.current) return

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}${url}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setIsConnected(true)
        setSocket(ws)
        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
      }

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data)
          setLastMessage(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setIsConnected(false)
        setSocket(null)

        // Reconnect after a delay if it wasn't a normal closure
        if (shouldReconnectRef.current && event.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setIsConnected(false)
      }

    } catch (error) {
      console.error('Error creating WebSocket:', error)
      setIsConnected(false)
    }
  }

  const send = (message: WSMessage) => {
    if (socket && isConnected) {
      try {
        socket.send(JSON.stringify(message))
      } catch (error) {
        console.error('Error sending WebSocket message:', error)
      }
    }
  }

  useEffect(() => {
    shouldReconnectRef.current = true
    connect()

    return () => {
      shouldReconnectRef.current = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socket) {
        socket.close(1000, 'Component unmounting')
      }
    }
  }, [url])

  return {
    socket,
    isConnected,
    send,
    lastMessage,
  }
}