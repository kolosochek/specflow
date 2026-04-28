import { describe, expect, it, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import { installAgentWebSocket } from '../ws.js';
import type { TmuxManager } from '../services/tmuxManager.js';
import type * as pty from 'node-pty';

// ---------- Fake IPty ----------

type DataCb = (data: string) => void;
type ExitCb = (e: { exitCode: number; signal?: number }) => void;

function makeFakePty() {
  let dataCb: DataCb | null = null;
  let exitCb: ExitCb | null = null;
  const writes: string[] = [];
  const killSpy = vi.fn();

  const fake = {
    pid: 12345,
    cols: 120,
    rows: 30,
    process: 'tmux',
    handleFlowControl: false,
    onData(cb: DataCb) {
      dataCb = cb;
      return { dispose() {} };
    },
    onExit(cb: ExitCb) {
      exitCb = cb;
      return { dispose() {} };
    },
    on() {},
    resize() {},
    clear() {},
    write(data: string) {
      writes.push(data);
    },
    kill: killSpy,
    pause() {},
    resume() {},
  } as unknown as pty.IPty;

  return {
    fake,
    emitData: (s: string) => dataCb?.(s),
    emitExit: () => exitCb?.({ exitCode: 0 }),
    writes,
    killSpy,
  };
}

// ---------- Test harness ----------

interface Harness {
  server: HttpServer;
  port: number;
  ptyHandle: ReturnType<typeof makeFakePty>;
  attachSpy: ReturnType<typeof vi.fn>;
  close: () => Promise<void>;
}

async function startHarness(): Promise<Harness> {
  const ptyHandle = makeFakePty();
  const attachSpy = vi.fn(() => ptyHandle.fake);
  const fakeTmux = {
    attach: attachSpy,
  } as unknown as TmuxManager;

  const server = createServer();
  installAgentWebSocket(server, { getTmux: () => fakeTmux });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    server,
    port,
    ptyHandle,
    attachSpy,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// ---------- Tests ----------

describe('installAgentWebSocket', () => {
  it('rejects an invalid session name with HTTP 400', async () => {
    // SCENARIO: invalid session name closes WS with 400
    // INPUT: connect with ?session=agent-not-valid
    // EXPECTED: WS upgrade rejected, response 400
    const h = await startHarness();
    try {
      const ws = new WebSocket(`ws://127.0.0.1:${h.port}/ws/agent?session=agent-not-valid`);
      const status = await new Promise<number | null>((resolve) => {
        ws.on('unexpected-response', (_req, res) => {
          resolve(res.statusCode ?? null);
          res.resume();
        });
        ws.on('error', () => resolve(null));
      });
      expect(status).toBe(400);
      expect(h.attachSpy).not.toHaveBeenCalled();
    } finally {
      await h.close();
    }
  });

  it('attaches to tmux and streams pty data to the client', async () => {
    // SCENARIO: valid session name attaches and streams data
    // INPUT: mocked TmuxManager.attach returns fake IPty that emits 'hello'
    // EXPECTED: client receives a text frame containing 'hello'
    const h = await startHarness();
    try {
      const ws = new WebSocket(
        `ws://127.0.0.1:${h.port}/ws/agent?session=agent-E001-M001-W001`,
      );
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      expect(h.attachSpy).toHaveBeenCalledWith('agent-E001-M001-W001');

      const received = new Promise<string>((resolve) => {
        ws.on('message', (data) => resolve(data.toString()));
      });
      h.ptyHandle.emitData('hello');
      const got = await received;
      expect(got).toContain('hello');

      ws.close();
    } finally {
      await h.close();
    }
  });

  it('forwards client messages to pty.write', async () => {
    // SCENARIO: client message flows to pty.write
    // INPUT: client sends 'q'
    // EXPECTED: fake IPty.write called with 'q'
    const h = await startHarness();
    try {
      const ws = new WebSocket(
        `ws://127.0.0.1:${h.port}/ws/agent?session=agent-E001-M001-W001`,
      );
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      ws.send('q');
      // Give the server a tick to process the message
      await new Promise((r) => setTimeout(r, 30));

      expect(h.ptyHandle.writes).toContain('q');
      ws.close();
    } finally {
      await h.close();
    }
  });

  it('disposes the pty when the client closes the WebSocket', async () => {
    // SCENARIO: WS close releases pty
    // INPUT: client closes the socket
    // EXPECTED: fake IPty.kill called
    const h = await startHarness();
    try {
      const ws = new WebSocket(
        `ws://127.0.0.1:${h.port}/ws/agent?session=agent-E001-M001-W001`,
      );
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      ws.close();
      await new Promise((r) => setTimeout(r, 30));

      expect(h.ptyHandle.killSpy).toHaveBeenCalled();
    } finally {
      await h.close();
    }
  });

  it('closes the WebSocket with code 1000 when pty exits', async () => {
    // SCENARIO: pty exit closes WS with 1000
    // INPUT: fake IPty emits 'exit'
    // EXPECTED: WS close received with code 1000
    const h = await startHarness();
    try {
      const ws = new WebSocket(
        `ws://127.0.0.1:${h.port}/ws/agent?session=agent-E001-M001-W001`,
      );
      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve());
        ws.on('error', reject);
      });

      const closed = new Promise<number>((resolve) => {
        ws.on('close', (code) => resolve(code));
      });

      h.ptyHandle.emitExit();
      const code = await closed;
      expect(code).toBe(1000);
    } finally {
      await h.close();
    }
  });
});
