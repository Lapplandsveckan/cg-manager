import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
    Alert,
    Box,
    Button,
    Card,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useTranslation } from 'next-i18next';
import { noTryAsync } from 'no-try';

const Page = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If auth isn't actually enabled (no password configured), the user
    // shouldn't be on this page — bounce them to wherever they were going.
    // Also bounce if they're already signed in.
    useEffect(() => {
        // `router.query` isn't populated until isReady on statically
        // optimized pages — without this guard we'd read `from=undefined`
        // on first paint and bounce the user to `/` even when they had a
        // valid return URL.
        if (!router.isReady) return;

        let cancelled = false;
        (async () => {
            const [, resp] = await noTryAsync(() =>
                fetch('/api/auth/check', { credentials: 'same-origin' }),
            );
            if (cancelled || !resp?.ok) return;
            const [, json] = await noTryAsync(() => resp.json());
            const status = json as { enabled: boolean; authenticated: boolean };
            if (!status?.enabled || status.authenticated) {
                const from =
                    typeof router.query.from === 'string'
                        ? router.query.from
                        : '/';
                router.replace(from);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [router, router.isReady]);

    const submit = async () => {
        if (busy || !password) return;
        setBusy(true);
        setError(null);

        const [err, resp] = await noTryAsync(() =>
            fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ password }),
            }),
        );

        setBusy(false);

        if (err || !resp.ok) {
            setError(t('login.wrongPassword'));
            setPassword('');
            return;
        }

        const from =
            typeof router.query.from === 'string' ? router.query.from : '/';
        router.replace(from);
    };

    return (
        <Box
            sx={theme => ({
                display: 'flex',
                height: '100vh',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: theme.palette.background.default,
                px: 2,
            })}
        >
            <Card sx={{ p: 4, width: 360, maxWidth: '100%' }}>
                <Stack spacing={2.5}>
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <Box
                            sx={theme => ({
                                width: 36,
                                height: 36,
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: theme.palette.surface.elevated,
                                border: `1px solid ${theme.palette.divider}`,
                                color: theme.palette.primary.main,
                            })}
                        >
                            <LockRoundedIcon fontSize="small" />
                        </Box>
                        <Stack spacing={0}>
                            <Typography variant="h3">
                                {t('brand.name')}
                            </Typography>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('login.subtitle')}
                            </Typography>
                        </Stack>
                    </Stack>

                    <TextField
                        label={t('login.password')}
                        type="password"
                        autoFocus
                        size="small"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') submit();
                        }}
                        disabled={busy}
                    />

                    {error && (
                        <Alert severity="error" variant="outlined">
                            {error}
                        </Alert>
                    )}

                    <Button
                        variant="contained"
                        onClick={submit}
                        disabled={busy || !password}
                    >
                        {busy ? t('login.signingIn') : t('login.signIn')}
                    </Button>
                </Stack>
            </Card>
        </Box>
    );
};

export default Page;
