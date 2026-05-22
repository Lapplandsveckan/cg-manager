import React from 'react';
import {Box, IconButton, Stack, Tooltip, Typography, alpha} from '@mui/material';
import {keyframes} from '@mui/system';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

const LIVE_RED = '#e0463a';

const livePulse = keyframes`
    0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 ${alpha(LIVE_RED, 0.6)}; }
    50% { transform: scale(1.15); opacity: 0.85; box-shadow: 0 0 0 6px ${alpha(LIVE_RED, 0)}; }
`;

/** Shown when the rundown is unlocked — items will fire on card click. */
export const LiveIndicator: React.FC = () => (
    <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={{
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: alpha(LIVE_RED, 0.14),
            border: `1px solid ${alpha(LIVE_RED, 0.45)}`,
            color: LIVE_RED,
        }}
    >
        <Box
            sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: LIVE_RED,
                animation: `${livePulse} 1.4s ease-in-out infinite`,
            }}
        />
        <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.7rem' }}
        >
            LIVE
        </Typography>
    </Stack>
);

/** Shown when the rundown is locked — items only fire from the play button. */
export const EditIndicator: React.FC = () => (
    <Stack
        direction="row"
        alignItems="center"
        gap={0.75}
        sx={(theme) => ({
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            bgcolor: alpha(theme.palette.primary.main, 0.14),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.45)}`,
            color: theme.palette.primary.main,
        })}
    >
        <EditOutlinedIcon sx={{ fontSize: 14 }} />
        <Typography
            variant="caption"
            sx={{ fontWeight: 700, letterSpacing: '0.12em', fontSize: '0.7rem' }}
        >
            EDIT
        </Typography>
    </Stack>
);

interface LockToggleProps {
    locked: boolean;
    onToggle: () => void;
    label?: string;
}

export const LockToggle: React.FC<LockToggleProps> = ({ locked, onToggle, label }) => (
    <Tooltip title={
        locked
            ? `${label ?? 'Items'} are locked — clicking a card won\'t fire it. Use the play button.`
            : `${label ?? 'Items'} are unlocked — click anywhere on a card to fire it.`
    }>
        <IconButton
            size="small"
            onClick={onToggle}
            sx={(theme) => ({
                color: locked ? theme.palette.primary.main : 'text.secondary',
                border: `1px solid ${locked ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 1.5,
                px: 1.25,
                py: 0.5,
                gap: 0.75,
                '&:hover': { borderColor: theme.palette.primary.main, color: theme.palette.primary.main },
            })}
        >
            {locked ? <LockRoundedIcon fontSize="small" /> : <LockOpenRoundedIcon fontSize="small" />}
            <Typography variant="caption" sx={{ fontWeight: 500 }}>
                {locked ? 'Locked' : 'Unlocked'}
            </Typography>
        </IconButton>
    </Tooltip>
);
