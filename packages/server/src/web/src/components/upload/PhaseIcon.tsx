import React from 'react';
import { Box, alpha } from '@mui/material';
import {
    CloudUploadRounded,
    CheckCircleRounded,
    ErrorOutlineRounded,
} from '@mui/icons-material';
import type { UploadPhase } from './types';

export const PhaseIcon: React.FC<{ phase: UploadPhase }> = ({ phase }) => {
    if (phase === 'done')
        return <CheckCircleRounded sx={{ color: '#5fc97a' }} />;
    if (phase === 'error') return <ErrorOutlineRounded color="error" />;
    return (
        <Box
            sx={theme => ({
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.primary.main, 0.18),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            })}
        >
            <CloudUploadRounded
                fontSize="small"
                sx={{ color: 'primary.main' }}
            />
        </Box>
    );
};
