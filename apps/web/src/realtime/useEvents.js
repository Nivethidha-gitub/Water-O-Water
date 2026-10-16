import { useEffect, useRef } from "react";
import { apiBase, getToken } from "../api/client";

/*
 * Subscribes to the server's real-time stream (Server-Sent Events).
 *
 * EventSource cannot send an Authorization header, and putting the token in
 * the URL would leak it into logs, so the stream is read with fetch().
 * It reconnects automatically with backoff and calls `onReconnect` so the
 * screen can re-sync anything it missed while offline.
 */
export function useEvents({ onEvent, onReconnect, enabled = true }) {
  const handlers = useRef({ onEvent, onReconnect });
  handlers.current = { onEvent, onReconnect };

  useEffect(() => {
    if (!enabled) return undefined;
    let stopped = false;
    let controller = null;
    let attempt = 0;
    let timer = null;

    async function connect() {
      controller = new AbortController();
      try {
        const response = await fetch(apiBase() + "/events", {
          headers: { Authorization: "Bearer " + getToken(), Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("stream " + response.status);

        if (attempt > 0) handlers.current.onReconnect?.();
        attempt = 0;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let index;
          while ((index = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, index);
            buffer = buffer.slice(index + 2);
            const name = /^event: (.+)$/m.exec(frame)?.[1];
            const data = /^data: (.+)$/m.exec(frame)?.[1];
            if (name && data && name !== "ready") {
              try {
                handlers.current.onEvent?.(name, JSON.parse(data));
              } catch {
                /* ignore malformed frame */
              }
            }
          }
        }
      } catch {
        /* aborted or network error: retry below */
      }
      if (stopped) return;
      attempt += 1;
      timer = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    };
  }, [enabled]);
}
