import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000];

export function XTermTerminal({ sessionName }: { sessionName: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const term = new Terminal({
      fontFamily: 'ui-monospace, monospace',
      fontSize: 14,
      scrollback: 10000,
      theme: { background: '#0f172a' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    let ws: WebSocket | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
      const url = `${protocol}://${host}/ws/agent?session=${sessionName}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        reconnectAttempt = 0;
      };
      ws.onmessage = (event: { data: string }) => {
        term.write(event.data);
      };
      ws.onclose = (event: { code: number }) => {
        if (disposed) return;
        if (event.code === 1000) return;
        const delay = RECONNECT_BACKOFF_MS[Math.min(reconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    const onDataDisposable = term.onData((data: string) => {
      ws?.send(data);
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
      } catch {
        // container may be detached during unmount; ignore
      }
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      ws?.close();
      term.dispose();
    };
  }, [sessionName]);

  return (
    <div
      ref={containerRef}
      data-testid="xterm-terminal"
      data-session={sessionName}
      style={{ height: 200, background: '#0f172a' }}
    />
  );
}
