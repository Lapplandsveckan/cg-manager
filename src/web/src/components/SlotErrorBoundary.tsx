import React from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { Button, Stack, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { reportClientError } from '../lib/reportClientError';

const SlotErrorFallback: React.FC<FallbackProps> = ({ resetErrorBoundary }) => {
    const { t } = useTranslation('common');
    return (
        <Stack
            direction="row"
            alignItems="center"
            spacing={2}
            sx={theme => ({
                p: 2,
                borderRadius: 1,
                bgcolor: theme.palette.surface.elevated,
                border: `1px solid ${theme.palette.divider}`,
            })}
        >
            <Typography
                variant="body2"
                sx={{ color: 'text.secondary', flex: 1 }}
            >
                {t('layout.slotError.body')}
            </Typography>
            <Button
                size="small"
                variant="outlined"
                onClick={resetErrorBoundary}
            >
                {t('layout.slotError.retry')}
            </Button>
        </Stack>
    );
};

const SilentFallback: React.FC<FallbackProps> = () => null;

interface SlotErrorBoundaryProps {
    children?: React.ReactNode;
    label?: string;
    resetKeys?: unknown[];
    /** When true, renders nothing on error instead of the compact card. */
    silent?: boolean;
}

export const SlotErrorBoundary: React.FC<SlotErrorBoundaryProps> = ({
    children,
    label,
    resetKeys,
    silent = false,
}) => (
    <ErrorBoundary
        FallbackComponent={silent ? SilentFallback : SlotErrorFallback}
        onError={(error, info) => {
            console.error(
                `[SlotErrorBoundary:${label ?? 'unknown'}]`,
                error,
                info,
            );
            const err = error as Error;
            reportClientError({
                source: `slot:${label ?? 'unknown'}`,
                message: err.message,
                stack: err.stack,
                componentStack: info.componentStack,
            });
        }}
        resetKeys={resetKeys}
    >
        {children}
    </ErrorBoundary>
);
