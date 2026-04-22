import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import type { WSMessage } from '../types/task'
import { useWebSocket } from '../hooks/useWebSocket'
import { useAuthContext } from './AuthContext'

interface WSContextType {
  wsStatus: 'connected' | 'connecting' | 'disconnected'
  lastMessage: WSMessage | null
  reconnect: () => void
}

export const WSContext = createContext<WSContextType>({
  wsStatus: 'disconnected',
  lastMessage: null,
  reconnect: () => {},
})

export function WSProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  
  const handleMessage = useCallback((msg: WSMessage) => {
    setLastMessage(msg)
  }, [])
  
  const handleReconnect = useCallback(() => {
    setLastMessage({ type: 'task.reconnect', payload: {} } as any)
  }, [])

  const { status } = useWebSocket({
    onMessage: handleMessage,
    onReconnect: handleReconnect,
    enabled: isAuthenticated,
  })

  return (
    <WSContext.Provider value={{ wsStatus: status, lastMessage, reconnect: handleReconnect }}>
      {children}
    </WSContext.Provider>
  )
}

export function useWS() {
  return useContext(WSContext)
}
