"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createWebSocketURL } from "@/lib/alia-api";
import type { ConversationResponse } from "@/types/alia";

export type WSStatus = "connecting" | "connected" | "disconnected" | "unsupported";

interface UseWebSocketOptions {
  sessionId: string | null;
  onMessage?: (data: ConversationResponse) => void;
  onStatusChange?: (status: WSStatus) => void;
  enabled?: boolean;
}

export function useWebSocket({
  sessionId,
  onMessage,
  onStatusChange,
  enabled = true,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WSStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const onMessageRef = useRef(onMessage);
  const onStatusChangeRef = useRef(onStatusChange);

  onMessageRef.current = onMessage;
  onStatusChangeRef.current = onStatusChange;

  const updateStatus = useCallback((newStatus: WSStatus) => {
    setStatus(newStatus);
    onStatusChangeRef.current?.(newStatus);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    if (typeof WebSocket === "undefined") {
      updateStatus("unsupported");
      return;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    updateStatus("connecting");

    try {
      const url = createWebSocketURL(sessionId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        updateStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ConversationResponse;
          onMessageRef.current?.(data);
        } catch {
          // Non-JSON message
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          updateStatus("connecting");
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          updateStatus("disconnected");
        }
      };

      ws.onerror = () => {
        updateStatus("disconnected");
      };
    } catch {
      updateStatus("disconnected");
    }
  }, [sessionId, enabled, updateStatus]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttempts.current = maxReconnectAttempts;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    updateStatus("disconnected");
  }, [updateStatus]);

  const sendMessage = useCallback(
    (message: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(message);
        return true;
      }
      return false;
    },
    []
  );

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { status, sendMessage, reconnect: connect, disconnect };
}
