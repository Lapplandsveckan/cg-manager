import { Modal, Stack } from '@mui/material';
import React from 'react';

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const ModalShell: React.FC<ModalShellProps> = ({
    open,
    onClose,
    children,
}) => (
    <Modal open={open} onClose={onClose} disableRestoreFocus>
        <Stack
            justifyContent="center"
            alignItems="center"
            sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
            }}
        >
            <Stack
                padding={3}
                spacing={2}
                direction="column"
                sx={theme => ({
                    bgcolor: theme.palette.surface.elevated,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    width: 500,
                    boxShadow: 8,
                })}
            >
                {children}
            </Stack>
        </Stack>
    </Modal>
);
