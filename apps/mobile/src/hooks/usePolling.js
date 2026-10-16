import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useRealtime } from "../realtime/RealtimeContext";

/**
 * Keeps a screen's data fresh.
 *  - loads when the screen is focused,
 *  - reloads immediately when the server pushes a live event (WebSocket),
 *  - and polls as a safety net: every `ms` while the live connection is down,
 *    and only every 30s+ while it is up.
 */
export default function usePolling(load, baseMs = 8000) {
  const saved = useRef(load);
  saved.current = load;
  const { connected, subscribe } = useRealtime();
  const ms = connected ? Math.max(baseMs * 3, 30000) : baseMs;

  useFocusEffect(
    useCallback(() => {
      let timer = null;
      const run = () => Promise.resolve(saved.current()).catch(() => {});
      const start = () => {
        if (!timer) timer = setInterval(run, ms);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };

      let debounce = null;
      const unsubscribe = subscribe(() => {
        clearTimeout(debounce);
        debounce = setTimeout(run, 250); // several events in a burst -> one reload
      });

      run();
      start();
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          run();
          start();
        } else {
          stop();
        }
      });
      return () => {
        stop();
        clearTimeout(debounce);
        unsubscribe();
        sub.remove();
      };
    }, [ms, subscribe])
  );
}
