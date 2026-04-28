// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock xterm + addon-fit BEFORE the component import.
const writeSpy = vi.fn();
const onDataSpy = vi.fn();
const disposeSpy = vi.fn();
const fitSpy = vi.fn();
let onDataHandler: ((data: string) => void) | null = null;

vi.mock('@xterm/xterm', () => {
  class Terminal {
    open = vi.fn();
    write = writeSpy;
    dispose = disposeSpy;
    loadAddon = vi.fn();
    onData(handler: (data: string) => void) {
      onDataHandler = handler;
      onDataSpy(handler);
      return { dispose: vi.fn() };
    }
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    fit = fitSpy;
  }
  return { FitAddon };
});

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

interface FakeWS {
  url: string;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onmessage?: (e: { data: string }) => void;
  onclose?: (e: { code: number }) => void;
  onopen?: () => void;
}

const wsInstances: FakeWS[] = [];
const originalWS = globalThis.WebSocket;

beforeEach(() => {
  writeSpy.mockReset();
  onDataSpy.mockReset();
  disposeSpy.mockReset();
  fitSpy.mockReset();
  wsInstances.length = 0;
  onDataHandler = null;
  vi.useFakeTimers();
  class FakeWebSocket {
    url: string;
    send = vi.fn();
    close = vi.fn();
    onmessage?: (e: { data: string }) => void;
    onclose?: (e: { code: number }) => void;
    onopen?: () => void;
    constructor(url: string) {
      this.url = url;
      wsInstances.push(this as unknown as FakeWS);
    }
  }
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  // jsdom does not implement ResizeObserver
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  globalThis.WebSocket = originalWS;
});

import { XTermTerminal } from '../XTermTerminal.js';

describe('XTermTerminal', () => {
  it('mount opens WS to correct URL', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: mount opens WS to correct URL
    // INPUT: render with sessionName='agent-E001-M001-W001'
    // EXPECTED: WebSocket constructor called with url ending '/ws/agent?session=agent-E001-M001-W001'
    render(<XTermTerminal sessionName="agent-E001-M001-W001" />);
    expect(wsInstances).toHaveLength(1);
    expect(wsInstances[0].url).toMatch(/\/ws\/agent\?session=agent-E001-M001-W001$/);
  });

  it('WS message data is written to terminal', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: WS data writes to terminal
    // INPUT: simulate ws.onmessage with 'hello'
    // EXPECTED: terminal.write spy called with 'hello'
    render(<XTermTerminal sessionName="agent-X" />);
    const ws = wsInstances[0];
    ws.onmessage?.({ data: 'hello' });
    expect(writeSpy).toHaveBeenCalledWith('hello');
  });

  it('terminal input sends to WS', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: terminal input sends to WS
    // INPUT: invoke onData with 'q'
    // EXPECTED: ws.send called with 'q'
    render(<XTermTerminal sessionName="agent-X" />);
    expect(onDataHandler).not.toBeNull();
    onDataHandler?.('q');
    expect(wsInstances[0].send).toHaveBeenCalledWith('q');
  });

  it('unmount disposes both terminal and ws', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: unmount disposes both
    // INPUT: unmount the component
    // EXPECTED: terminal.dispose and ws.close both called
    const { unmount } = render(<XTermTerminal sessionName="agent-X" />);
    unmount();
    expect(disposeSpy).toHaveBeenCalled();
    expect(wsInstances[0].close).toHaveBeenCalled();
  });

  it('WS close with non-1000 schedules reconnect', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: WS close with non-1000 schedules reconnect
    // INPUT: simulate ws.close({ code: 1006 })
    // EXPECTED: a new WebSocket constructor call within 1.2s (after timer advance)
    render(<XTermTerminal sessionName="agent-X" />);
    expect(wsInstances).toHaveLength(1);
    wsInstances[0].onclose?.({ code: 1006 });
    vi.advanceTimersByTime(1200);
    expect(wsInstances.length).toBeGreaterThanOrEqual(2);
  });

  it('clean WS close with code 1000 does NOT schedule a reconnect', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: clean close 1000 does not reconnect
    // INPUT: simulate ws.close({ code: 1000 }), advance 8s
    // EXPECTED: no additional WebSocket constructor calls
    render(<XTermTerminal sessionName="agent-X" />);
    expect(wsInstances).toHaveLength(1);
    wsInstances[0].onclose?.({ code: 1000 });
    vi.advanceTimersByTime(8000);
    expect(wsInstances).toHaveLength(1);
  });

  it('reconnect backoff progresses 1s → 2s → 4s for repeated non-1000 closes', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: backoff progression
    // INPUT: 3 successive non-1000 closes; advance fake timers each time
    // EXPECTED: reconnect attempts land at the documented intervals
    render(<XTermTerminal sessionName="agent-X" />);
    expect(wsInstances).toHaveLength(1);
    wsInstances[0].onclose?.({ code: 1006 });
    vi.advanceTimersByTime(999);
    expect(wsInstances).toHaveLength(1);
    vi.advanceTimersByTime(2);
    expect(wsInstances).toHaveLength(2);
    wsInstances[1].onclose?.({ code: 1006 });
    vi.advanceTimersByTime(1999);
    expect(wsInstances).toHaveLength(2);
    vi.advanceTimersByTime(2);
    expect(wsInstances).toHaveLength(3);
    wsInstances[2].onclose?.({ code: 1006 });
    vi.advanceTimersByTime(3999);
    expect(wsInstances).toHaveLength(3);
    vi.advanceTimersByTime(2);
    expect(wsInstances).toHaveLength(4);
  });

  it('uses wss:// when the page protocol is https', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: protocol selection — secure page upgrades the WS scheme
    // INPUT: window.location.protocol = 'https:'
    // EXPECTED: WS URL begins with wss://
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { protocol: 'https:', host: 'kanban.example' },
    });
    render(<XTermTerminal sessionName="agent-X" />);
    expect(wsInstances[0].url.startsWith('wss://')).toBe(true);
    expect(wsInstances[0].url).toContain('kanban.example');
  });

  it('unmount during a pending reconnect cancels the reconnect timer', () => {
    // SCENARIO->INPUT->EXPECTED
    // SCENARIO: lifecycle correctness — no zombie reconnect after unmount
    // INPUT: trigger non-1000 close, then unmount before the timer fires
    // EXPECTED: advancing past the backoff does NOT spawn a new WebSocket
    const { unmount } = render(<XTermTerminal sessionName="agent-X" />);
    wsInstances[0].onclose?.({ code: 1006 });
    unmount();
    vi.advanceTimersByTime(2000);
    expect(wsInstances).toHaveLength(1);
  });
});
