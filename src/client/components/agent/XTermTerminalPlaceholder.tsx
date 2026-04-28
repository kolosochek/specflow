export function XTermTerminalPlaceholder({ sessionName }: { sessionName: string }) {
  return (
    <div
      data-testid="xterm-terminal-placeholder"
      data-session={sessionName}
      style={{
        height: 200,
        background: '#0f172a',
        color: '#cbd5e1',
        padding: 12,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
      }}
    >
      Terminal placeholder for {sessionName}. Real xterm.js integration ships in S003.
    </div>
  );
}
