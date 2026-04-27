import { useState, useMemo } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  Stack,
} from '@mui/material';
import { trpc } from '../trpc.js';
import { AppHeader } from '../components/AppHeader.js';
import { WaveDetailModal } from '../components/backlog/WaveDetailModal.js';

const STATUS_COLUMNS = ['draft', 'ready_to_dev', 'claimed', 'in_progress', 'done'] as const;
type ExecStatus = (typeof STATUS_COLUMNS)[number];

const DERIVED_COLOR: Record<string, 'default' | 'primary' | 'success'> = {
  draft: 'default',
  active: 'primary',
  done: 'success',
};

const COLUMN_BG: Record<ExecStatus, string> = {
  draft: 'grey.100',
  ready_to_dev: 'info.50',
  claimed: 'warning.50',
  in_progress: 'primary.50',
  done: 'success.50',
};

type WaveSummary = {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  branch: string | null;
  pr: string | null;
  totalSlices: number;
  doneSlices: number;
};

export function BacklogPage() {
  const [selectedEpic, setSelectedEpic] = useState<string>('all');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('all');
  const [selectedWave, setSelectedWave] = useState<string | null>(null);

  const overviewQuery = trpc.backlog.getOverview.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const epics = overviewQuery.data ?? [];

  const visibleEpics = useMemo(() => {
    if (selectedEpic === 'all') return epics;
    return epics.filter((e) => e.id === selectedEpic);
  }, [epics, selectedEpic]);

  const visibleMilestones = useMemo(
    () => visibleEpics.flatMap((e) => e.milestones),
    [visibleEpics],
  );

  const filteredWaves = useMemo<WaveSummary[]>(() => {
    if (selectedMilestone === 'all') {
      return visibleMilestones.flatMap((m) => m.waves);
    }
    const m = visibleMilestones.find((mi) => mi.id === selectedMilestone);
    return m?.waves ?? [];
  }, [visibleMilestones, selectedMilestone]);

  const totalWaves = filteredWaves.length;
  const doneWaves = filteredWaves.filter((w) => w.status === 'done').length;

  const handleEpicChange = (epicId: string) => {
    setSelectedEpic(epicId);
    setSelectedMilestone('all');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <AppHeader title="Backlog">
        {totalWaves > 0 && (
          <Typography variant="body2" color="text.secondary">
            {doneWaves}/{totalWaves} waves done
          </Typography>
        )}
      </AppHeader>

      {overviewQuery.error && (
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load backlog: {overviewQuery.error.message}
        </Alert>
      )}

      {epics.length === 0 && !overviewQuery.isLoading && (
        <Alert severity="info" sx={{ m: 2 }}>
          No epics yet. Create one with <code>npm run ticket create epic "&lt;title&gt;"</code>.
        </Alert>
      )}

      {epics.length > 0 && (
        <>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: 'background.paper' }}>
            <Tabs
              value={selectedEpic}
              onChange={(_, v: string) => handleEpicChange(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab label="All epics" value="all" />
              {epics.map((e) => (
                <Tab
                  key={e.id}
                  value={e.id}
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box component="span" sx={{ fontWeight: 600 }}>
                        {e.id}
                      </Box>
                      <Box component="span">{e.title}</Box>
                      <Chip
                        label={e.status}
                        size="small"
                        color={DERIVED_COLOR[e.status] ?? 'default'}
                      />
                    </Stack>
                  }
                />
              ))}
            </Tabs>
          </Box>

          {visibleMilestones.length > 0 && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: 'background.paper' }}>
              <Tabs
                value={selectedMilestone}
                onChange={(_, v: string) => setSelectedMilestone(v)}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="All milestones" value="all" />
                {visibleMilestones.map((m) => (
                  <Tab
                    key={m.id}
                    value={m.id}
                    label={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                          {m.id}
                        </Box>
                        <Box component="span">{m.title}</Box>
                        <Chip
                          label={m.status}
                          size="small"
                          color={DERIVED_COLOR[m.status] ?? 'default'}
                        />
                      </Stack>
                    }
                  />
                ))}
              </Tabs>
            </Box>
          )}
        </>
      )}

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          flex: 1,
          overflow: 'auto',
        }}
      >
        {STATUS_COLUMNS.map((status) => {
          const wavesInColumn = filteredWaves.filter((w) => w.status === status);
          return (
            <Box
              key={status}
              sx={{
                minWidth: 260,
                flex: 1,
                bgcolor: COLUMN_BG[status],
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography
                  variant="subtitle2"
                  sx={{ textTransform: 'uppercase', color: 'text.secondary', fontWeight: 700 }}
                >
                  {status.replace(/_/g, ' ')}
                </Typography>
                <Chip label={wavesInColumn.length} size="small" />
              </Stack>

              <Stack spacing={1}>
                {wavesInColumn.map((wave) => (
                  <WaveCard key={wave.id} wave={wave} onClick={() => setSelectedWave(wave.id)} />
                ))}
                {wavesInColumn.length === 0 && (
                  <Typography variant="caption" color="text.disabled">
                    —
                  </Typography>
                )}
              </Stack>
            </Box>
          );
        })}
      </Box>

      {selectedWave && (
        <WaveDetailModal
          waveId={selectedWave}
          open={true}
          onClose={() => setSelectedWave(null)}
        />
      )}
    </Box>
  );
}

function WaveCard({ wave, onClick }: { wave: WaveSummary; onClick: () => void }) {
  const progress = wave.totalSlices > 0 ? (wave.doneSlices / wave.totalSlices) * 100 : 0;

  return (
    <Card sx={{ cursor: 'pointer', '&:hover': { boxShadow: 2 } }} onClick={onClick}>
      <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
          {wave.id}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.25 }}>
          {wave.title}
        </Typography>

        {wave.totalSlices > 0 && (
          <Box sx={{ mt: 1 }}>
            <LinearProgress variant="determinate" value={progress} sx={{ mb: 0.5 }} />
            <Typography variant="caption" color="text.secondary">
              {wave.doneSlices}/{wave.totalSlices} slices
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {wave.assignedTo && <Chip label={wave.assignedTo} size="small" variant="outlined" />}
          {wave.branch && (
            <Chip label={wave.branch} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
          )}
          {wave.pr && (
            <Chip
              label="PR"
              size="small"
              color="primary"
              component="a"
              href={wave.pr}
              target="_blank"
              rel="noreferrer"
              clickable
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
