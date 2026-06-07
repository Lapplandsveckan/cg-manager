import { Card } from '@mui/material';
import React from 'react';

const ModalCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Card
        sx={theme => ({
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 460,
            p: 3,
            bgcolor: theme.palette.surface.elevated,
            border: `1px solid ${theme.palette.divider}`,
        })}
    >
        {children}
    </Card>
);

export default ModalCard;
