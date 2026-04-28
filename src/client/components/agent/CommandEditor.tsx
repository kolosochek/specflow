import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Alert,
  Box,
} from '@mui/material';
import { trpc } from '../../trpc.js';

export function CommandEditor({
  waveId,
  open,
  onClose,
}: {
  waveId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: preflight } = trpc.agent.preflight.useQuery({ waveId });
  const [command, setCommand] = useState('');
  const [error, setError] = useState<string | null>(null);

  const spawnMutation = trpc.agent.spawn.useMutation({
    onSuccess: () => {
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  useEffect(() => {
    if (preflight?.suggestedCommand) {
      setCommand(preflight.suggestedCommand);
    }
  }, [preflight?.suggestedCommand]);

  function onRun() {
    setError(null);
    spawnMutation.mutate({ waveId, command });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Run agent on {waveId}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          {preflight && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Pre-flight
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                <Typography variant="body2">
                  branch{' '}
                  <span data-testid="branch-status">
                    {preflight.branchExists ? '✓' : '✗'}
                  </span>{' '}
                  ({preflight.branchName})
                </Typography>
                <Typography variant="body2">
                  worktree{' '}
                  <span data-testid="worktree-status">
                    {preflight.worktreeExists ? '✓' : '✗'}
                  </span>{' '}
                  ({preflight.worktreePath})
                </Typography>
              </Stack>
            </Box>
          )}
          <TextField
            multiline
            minRows={4}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            label="Command"
            slotProps={{
              htmlInput: { 'data-testid': 'command-textarea' },
            }}
          />
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="cancel">Cancel</Button>
        <Button
          variant="contained"
          onClick={onRun}
          data-testid="run-agent"
          disabled={spawnMutation.isPending}
        >
          Run agent
        </Button>
      </DialogActions>
    </Dialog>
  );
}
