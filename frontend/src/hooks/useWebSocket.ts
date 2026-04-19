import { useEffect, useRef, useState, useCallback } from 'react'
import type { WSMessage } from '../types/task'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/api/v1/ws'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface UseWebSocketOptions {
  onMessage: (msg: WSMessage) => void
  onReconnect?: () => void
  enabled: boolean
}

const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

/**
 * Manages a persistent WebSocket connection with exponential backoff reconnection.
 * Cleans up on unmount. Retries indefinitely while mounted.
 */
export function useWebSocket(options: UseWebSocketOptions): {
  status: ConnectionStatus
} {
  const { onMessage, onReconnect, enabled } = options
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  // Use refs for callbacks so the reconnect loop doesn't stale-close over them.
  const onMessageRef = useRef(onMessage)
  const onReconnectRef = useRef(onReconnect)
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onReconnectRef.current = onReconnect }, [onReconnect])

  const attemptsRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const unmountedRef = useRef(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (unmountedRef.current) return

    setStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return }
      setStatus('connected')

      // Fire onReconnect (if any) for subsequent connections (not the first).
      if (attemptsRef.current > 0) {
        onReconnectRef.current?.()
      }
      attemptsRef.current = 0
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      if (unmountedRef.current) return
      try {
        const msg = JSON.parse(event.data) as WSMessage
        onMessageRef.current(msg)
      } catch {
        // Ignore malformed frames — never crash the app.
      }
    }

    ws.onerror = () => {
      // onerror always fires before onclose — no action needed here.
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      wsRef.current = null
      setStatus('disconnected')

      // Exponential backoff: 1s, 2s, 4s, … capped at 30s.
      attemptsRef.current += 1
      const backoff = Math.min(
        MIN_BACKOFF_MS * Math.pow(2, attemptsRef.current - 1),
        MAX_BACKOFF_MS,
      )

      retryTimerRef.current = setTimeout(() => {
        connect()
      }, backoff)
    }
  }, []) // stable — all dynamic values accessed via refs

  useEffect(() => {
    if (!enabled) return

    unmountedRef.current = false
    connect()

    return () => {
      unmountedRef.current = true
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current)
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [enabled, connect])

  return { status }
}
