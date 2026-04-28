import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Chip,
  Box,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
} from '@mui/material';
import { trpc } from '../../trpc.js';
import { CommandEditor } from '../agent/CommandEditor.js';

const RUN_AGENT_STATES = new Set(['ready_to_dev', 'claimed', 'in_progress']);

const SLICE_STATUS_ICON: Record<string, string> = {
  done: '✓',
  draft: '□',
};

export function WaveDetailModal({
  waveId,
  open,
  onClose,
}: {
  waveId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [view, setView] = useState<'summary' | 'raw'>('summary');
  const utils = trpc.useUtils();

  const detailQuery = trpc.backlog.getWaveDetail.useQuery({ waveId }, { enabled: open });
  const contentQuery = trpc.backlog.getWaveContent.useQuery(
    { waveId },
    { enabled: open && view === 'raw' },
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [commandEditorOpen, setCommandEditorOpen] = useState(false);

  const promoteMutation = trpc.backlog.promote.useMutation({
    onSuccess: (result) => {
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      utils.backlog.getOverview.invalidate();
      utils.backlog.getWaveDetail.invalidate({ waveId });
    },
    onError: (e) => setActionError(e.message),
  });

  const resetMutation = trpc.backlog.reset.useMutation({
    onSuccess: (result) => {
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      utils.backlog.getOverview.invalidate();
      utils.backlog.getWaveDetail.invalidate({ waveId });
    },
    onError: (e) => setActionError(e.message),
  });

  const detail = detailQuery.data;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography
            component="span"
            sx={{ fontFamily: 'monospace', fontSize: '0.95em', color: 'text.secondary' }}
          >
            {waveId}
          </Typography>
          <Typography component="span" sx={{ fontWeight: 600 }}>
            {detail?.wave.title ?? '…'}
          </Typography>
          {detail && <Chip label={detail.status} size="small" />}
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v: 'summary' | 'raw' | null) => v && setView(v)}
          >
            <ToggleButton value="summary">Summary</ToggleButton>
            <ToggleButton value="raw">Raw markdown</ToggleButton>
          </ToggleButtonGroup>

          {detail && (
            <Stack direction="row" spacing={1}>
              {detail.assignedTo && <Chip label={`agent: ${detail.assignedTo}`} size="small" />}
              {detail.branch && (
                <Chip
                  label={detail.branch}
                  size="small"
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                />
              )}
              {detail.pr && (
                <Chip
                  label="PR"
                  size="small"
                  color="primary"
                  component="a"
                  href={detail.pr}
                  target="_blank"
                  rel="noreferrer"
                  clickable
                />
              )}
            </Stack>
          )}
        </Stack>

        {actionError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
            {actionError}
          </Alert>
        )}

        {detailQuery.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {view === 'summary' && detail && (
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Slices ({detail.slices.length})
            </Typography>
            {detail.slices.map((s) => {
              const sliceStatus = s.status ?? 'draft';
              return (
                <Stack key={s.id} direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: sliceStatus === 'done' ? 'success.main' : 'text.disabled',
                      width: 16,
                    }}
                  >
                    {SLICE_STATUS_ICON[sliceStatus] ?? '?'}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 60 }}
                  >
                    {s.id.split('/').pop()}
                  </Typography>
                  <Typography variant="body2">{s.title}</Typography>
                </Stack>
              );
            })}
          </Stack>
        )}

        {view === 'raw' && (
          <Box>
            {contentQuery.isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            )}
            {contentQuery.data && (
              <Stack spacing={2}>
                <RawSection label={contentQuery.data.wave.path} body={contentQuery.data.wave.raw} />
                <Divider />
                {contentQuery.data.slices.map((s) => (
                  <RawSection key={s.id} label={`${s.id} — ${s.path}`} body={s.raw} />
                ))}
              </Stack>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => promoteMutation.mutate({ waveId })}
            disabled={!detail || detail.status !== 'draft' || promoteMutation.isPending}
          >
            Promote
          </Button>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => resetMutation.mutate({ waveId })}
            disabled={!detail || resetMutation.isPending}
          >
            Reset to draft
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => setCommandEditorOpen(true)}
            disabled={!detail || !RUN_AGENT_STATES.has(detail.status)}
          >
            Run agent
          </Button>
        </Stack>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
      {commandEditorOpen && (
        <CommandEditor
          waveId={waveId}
          open={commandEditorOpen}
          onClose={() => setCommandEditorOpen(false)}
        />
      )}
    </Dialog>
  );
}

function RawSection({ label, body }: { label: string; body: string }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.5,
          p: 1.5,
          bgcolor: 'grey.100',
          borderRadius: 1,
          fontSize: '0.78em',
          overflowX: 'auto',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {body}
      </Box>
    </Box>
  );
}
