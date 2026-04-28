export interface AgentSessionInfo {
  sessionName: string;
  waveId: string;
  createdAt: number;
  lastActivity: number;
  paneDead: boolean;
  exitCode: number | null;
}
