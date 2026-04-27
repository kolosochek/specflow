import type { ReactNode } from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';

export function AppHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar variant="dense" sx={{ gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          🌊 specflow
        </Typography>
        <Typography variant="body1" color="text.secondary">
          / {title}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {children}
      </Toolbar>
    </AppBar>
  );
}
