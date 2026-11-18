import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AppStateSnapshot,
  RealtimeNotification,
  ServerWSMessage,
} from '../types/app';
import { upsertById } from '../utils/format';

const EMPTY_STATE: AppStateSnapshot = {
  media: [],
  notes: [],
  voiceMessages: [],
  events: [],
  locations: [],
  notifications: [],
};

export function useRealtimeSocket(
  currentUser: string,
  onIncomingNotification?: (notif: RealtimeNotification) => void
) {
  const [state, setState] = useState<AppStateSnapshot>(EMPTY_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  );

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const onNotifRef = useRef(onIncomingNotification);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    onNotifRef.current = onIncomingNotification;
  }, [onIncomingNotification]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const fetchInitialState = useCallback(async () => {
    try {
      const [stateRes, cfgRes] = await Promise.all([
        fetch('/api/state'),
        fetch('/api/config'),
      ]);
      if (stateRes.ok) {
        const snapshot = (await stateRes.json()) as AppStateSnapshot;
        setState(snapshot);
      }
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { googleMapsApiKey?: string };
        if (cfg.googleMapsApiKey) {
          setGoogleMapsApiKey(cfg.googleMapsApiKey);
        }
      }
    } catch {
      // Initial HTTP fallback failed; WebSocket will sync on open
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialState();
  }, [fetchInitialState]);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!unmounted) {
          setIsConnected(true);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerWSMessage;
          switch (msg.type) {
            case 'init':
              setState(msg.payload);
              setIsLoading(false);
              break;
            case 'media:created':
              setState((prev) => ({
                ...prev,
                media: upsertById(prev.media, msg.payload, true),
              }));
              break;
            case 'media:deleted':
              setState((prev) => ({
                ...prev,
                media: prev.media.filter((m) => m.id !== msg.payload.id),
              }));
              break;
            case 'note:created':
              setState((prev) => ({
                ...prev,
                notes: upsertById(
                  prev.notes.map((n) => ({ ...n, isPinned: false })),
                  msg.payload,
                  true
                ),
              }));
              break;
            case 'note:pinned':
              setState((prev) => ({
                ...prev,
                notes: prev.notes.map((n) => ({
                  ...n,
                  isPinned: n.id === msg.payload.id,
                })),
              }));
              break;
            case 'voice:created':
              setState((prev) => ({
                ...prev,
                voiceMessages: upsertById(prev.voiceMessages, msg.payload, true),
              }));
              break;
            case 'voice:deleted':
              setState((prev) => ({
                ...prev,
                voiceMessages: prev.voiceMessages.filter((v) => v.id !== msg.payload.id),
              }));
              break;
            case 'event:created':
              setState((prev) => ({
                ...prev,
                events: upsertById(prev.events, msg.payload, true),
              }));
              break;
            case 'event:updated':
              setState((prev) => ({
                ...prev,
                events: upsertById(prev.events, msg.payload, false),
              }));
              break;
            case 'location:updated':
              setState((prev) => ({
                ...prev,
                locations: upsertById(prev.locations, msg.payload, true),
              }));
              break;
            case 'notification:new':
              setState((prev) => ({
                ...prev,
                notifications: upsertById(prev.notifications, msg.payload, true).slice(0, 50),
              }));
              if (msg.payload.actorName !== currentUserRef.current) {
                onNotifRef.current?.(msg.payload);
              } else {
                onNotifRef.current?.(msg.payload);
              }
              break;
            case 'notifications:read':
              setState((prev) => ({
                ...prev,
                notifications: prev.notifications.map((n) =>
                  n.readBy.includes(msg.payload.userName)
                    ? n
                    : { ...n, readBy: [...n.readBy, msg.payload.userName] }
                ),
              }));
              break;
          }
        } catch {
          // ignore malformed WS payload
        }
      };

      ws.onclose = () => {
        if (!unmounted) {
          setIsConnected(false);
          reconnectTimerRef.current = window.setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => ws.close());
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
  }, []);

  return {
    state,
    setState,
    isLoading,
    isConnected,
    googleMapsApiKey,
    refreshState: fetchInitialState,
  };
}
