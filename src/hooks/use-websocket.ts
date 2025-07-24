
import { useEffect, useRef, useState } from 'react';

type WebSocketHook = {
  lastMessage: MessageEvent | null;
  readyState: number;
  sendMessage: (data: string) => void;
};

const useWebSocket = (url: string): WebSocketHook => {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setReadyState(WebSocket.OPEN);
    ws.current.onclose = () => setReadyState(WebSocket.CLOSED);
    ws.current.onmessage = (event) => setLastMessage(event);

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const sendMessage = (data: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(data);
    }
  };

  return { lastMessage, readyState, sendMessage };
};

export default useWebSocket;
