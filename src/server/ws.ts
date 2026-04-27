import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { Socket } from 'net';
import { getTmuxManager, type TmuxManager } from './services/tmuxManager.js';

/**
 * Session names accepted by /ws/agent. Only the canonical 4-level
 * shape is allowed; anything else is closed with HTTP 400 before the
 * WebSocket upgrade completes.
 */
const SESSION_REGEX = /^agent-E\d{3}-M\d{3}-W\d{3}$/;

export interface InstallAgentWsDeps {
  getTmux?: () => TmuxManager;
}

/**
 * Mount the agent WebSocket bridge on an existing http.Server. Streams
 * pty data both ways between the browser xterm.js client and a tmux
 * session attached via node-pty.
 */
export function installAgentWebSocket(
  server: HttpServer,
  deps: InstallAgentWsDeps = {},
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const getTmux = deps.getTmux ?? getTmuxManager;

  server.on('upgrade', (req, socket: Socket, head) => {
    if (!req.url) return;
    if (!req.url.startsWith('/ws/agent')) return;

    // Parse session query param. Build URL with a placeholder host so
    // relative req.url works with WHATWG URL parser.
    const fullUrl = new URL(req.url, 'http://x');
    const sessionName = fullUrl.searchParams.get('session') ?? '';

    if (!SESSION_REGEX.test(sessionName)) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      attachPty(ws, sessionName, getTmux());
    });
  });

  return wss;
}

function attachPty(ws: WebSocket, sessionName: string, tmux: TmuxManager): void {
  let pty;
  try {
    pty = tmux.attach(sessionName);
  } catch (err) {
    ws.close(1011, (err as Error).message.slice(0, 120));
    return;
  }

  pty.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  pty.onExit(() => {
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      ws.close(1000);
    }
  });

  ws.on('message', (data) => {
    pty.write(data.toString());
  });

  ws.on('close', () => {
    try {
      pty.kill();
    } catch {
      // pty already dead — nothing to clean up
    }
  });
}
