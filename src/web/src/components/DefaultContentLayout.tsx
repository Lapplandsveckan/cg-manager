import { Stack, Box, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'next-i18next';
import { Navbar } from './Navbar';

class ErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback: React.ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Unhandled error in DefaultContentLayout', error, info);
    }

    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

const ErrorFallback: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <Stack
            sx={theme => ({
                m: 4,
                p: 4,
                borderRadius: 2,
                bgcolor: theme.palette.surface.elevated,
                border: `1px solid ${theme.palette.divider}`,
                maxWidth: 480,
            })}
            spacing={1}
        >
            <Typography variant="h3">{t('layout.error.title')}</Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                {t('layout.error.body')}
            </Typography>
        </Stack>
    );
};

export const DefaultContentLayout = (props: { children: React.ReactNode }) => (
    <Stack
        direction="row"
        alignItems="stretch"
        justifyContent="start"
        sx={theme => ({
            width: '100%',
            flex: 1,
            minHeight: 0,
            bgcolor: theme.palette.background.default,
        })}
    >
        <Navbar />
        <Box
            sx={{
                flexGrow: 1,
                minWidth: 0,
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                p: 4,
            }}
        >
            <ErrorBoundary fallback={<ErrorFallback />}>
                {props.children}
            </ErrorBoundary>
        </Box>
    </Stack>
);
