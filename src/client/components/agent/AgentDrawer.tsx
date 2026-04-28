import { useState, Fragment } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { trpc } from '../../trpc.js';
import { XTermTerminalPlaceholder } from './XTermTerminalPlaceholder.js';

const COLLAPSED_HEIGHT = 28;
const EXPANDED_HEIGHT = 360;

export function AgentDrawer() {
  const { data: sessions = [], refetch } = trpc.agent.list.useQuery(
    undefined,
    { refetchInterval: 3000 },
  );
  const killMutation = trpc.agent.kill.useMutation();

  const [confirmKill, setConfirmKill] = useState<string | null>(null);
  const [openTerminals, setOpenTerminals] = useState<Set<string>>(new Set());

  const isEmpty = sessions.length === 0;
  const height = isEmpty ? COLLAPSED_HEIGHT : EXPANDED_HEIGHT;

  function toggleTerminal(name: string) {
    setOpenTerminals((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function onConfirmKill() {
    if (!confirmKill) return;
    killMutation.mutate({ sessionName: confirmKill });
    setConfirmKill(null);
    refetch();
  }

  return (
    <Box
      data-testid="agent-drawer"
      data-height={height}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        bgcolor: '#0f172a',
        color: '#cbd5e1',
        borderTop: '1px solid #334155',
        overflowY: 'auto',
        zIndex: 1100,
      }}
    >
      {isEmpty ? (
        <Stack direction="row" alignItems="center" sx={{ height: '100%', px: 2 }}>
          <Typography variant="caption">0 agents</Typography>
        </Stack>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Wave</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Last activity</TableCell>
              <TableCell>Dead?</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((s) => (
              <Fragment key={s.sessionName}>
                <TableRow data-session={s.sessionName}>
                  <TableCell>{s.waveId}</TableCell>
                  <TableCell>{new Date(s.createdAt * 1000).toLocaleTimeString()}</TableCell>
                  <TableCell>{new Date(s.lastActivity * 1000).toLocaleTimeString()}</TableCell>
                  <TableCell>{s.paneDead ? `dead (${s.exitCode})` : 'live'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      onClick={() => toggleTerminal(s.sessionName)}
                      data-testid={`open-terminal-${s.sessionName}`}
                    >
                      open terminal
                    </Button>
                    <IconButton
                      size="small"
                      onClick={() => setConfirmKill(s.sessionName)}
                      data-testid={`kill-${s.sessionName}`}
                    >
                      kill
                    </IconButton>
                  </TableCell>
                </TableRow>
                {openTerminals.has(s.sessionName) && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <XTermTerminalPlaceholder sessionName={s.sessionName} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={confirmKill !== null} onClose={() => setConfirmKill(null)}>
        <DialogTitle>Kill agent {confirmKill}?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmKill(null)}>Cancel</Button>
          <Button onClick={onConfirmKill} color="error" variant="contained">Confirm</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
