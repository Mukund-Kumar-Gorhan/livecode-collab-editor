import { useEffect, useRef, useState } from 'react';

export interface UseSocketOptions {
  url?: string;
  onMessage?: (data: unknown) => void;
}

/**
 * Custom hook for managing raw WebSocket connection or Yjs provider status.
 */
export const useSocket = (options: UseSocketOptions = {}) => {
  const { url = 'ws://localhost:5000/ws', onMessage } = options;
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Only connect if explicitly invoked or active
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        onMessage?.(parsed);
      } catch {
        onMessage?.(event.data);
      }
    };

    return () => {
      ws.close();
    };
  }, [url, onMessage]);

  const sendMessage = (payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      );
    }
  };

  return { isConnected, sendMessage };
};

