import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
    Box,
    Button,
    CircularProgress,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import {
    guestSharePath,
    guestWhipPath,
    type ShareInfo,
} from '../../lib/api/ingest';
import { useScreenCapture } from '../../lib/useScreenCapture';

/** Standalone, reachable without a manager login: the whole credential is the
 *  token in the URL. Deliberately a host page rather than a plugin injection,
 *  since plugin bundles are served from behind the auth gate. */
const SharePage: React.FC = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const token =
        typeof router.query.token === 'string' ? router.query.token : '';

    const [share, setShare] = useState<ShareInfo | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const capture = useScreenCapture({
        endpoint: token ? guestWhipPath(token) : '',
        audio: share?.allowAudio ?? true,
    });

    useEffect(() => {
        if (!token) return;

        let active = true;
        (async () => {
            const [err, info] = await noTryAsync(async () => {
                const resp = await fetch(guestSharePath(token));
                if (!resp.ok) throw new Error(String(resp.status));

                return (await resp.json()) as ShareInfo;
            });
            if (!active) return;

            if (err) return setLoadError(t('share.errors.invalidLink'));
            setShare(info);
        })();

        return () => {
            active = false;
        };
    }, [t, token]);

    useEffect(() => {
        const video = videoRef.current;
        if (video) video.srcObject = capture.stream;
    }, [capture.stream]);

    if (loadError)
        return (
            <Centered>
                <Typography variant="h6">{loadError}</Typography>
            </Centered>
        );

    if (!share)
        return (
            <Centered>
                <CircularProgress size={24} />
            </Centered>
        );

    const live = capture.state === 'live';

    return (
        <Centered>
            <Paper sx={{ p: 4, maxWidth: 520, width: '100%' }}>
                <Stack spacing={3} alignItems="center">
                    <Stack spacing={0.5} alignItems="center">
                        <Typography variant="h5">{share.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t(live ? 'share.statusLive' : 'share.description')}
                        </Typography>
                    </Stack>

                    <Box
                        component="video"
                        ref={videoRef}
                        muted
                        autoPlay
                        playsInline
                        sx={{
                            width: '100%',
                            aspectRatio: '16 / 9',
                            bgcolor: 'common.black',
                            borderRadius: 1,
                            objectFit: 'contain',
                            display: live ? 'block' : 'none',
                        }}
                    />

                    {capture.error && (
                        <Typography variant="body2" color="error">
                            {capture.error}
                        </Typography>
                    )}

                    <Button
                        variant="contained"
                        size="large"
                        color={live ? 'error' : 'primary'}
                        startIcon={
                            live ? <StopScreenShareIcon /> : <ScreenShareIcon />
                        }
                        disabled={capture.state === 'starting'}
                        onClick={() =>
                            live ? capture.stop() : capture.start()
                        }
                    >
                        {t(live ? 'share.stop' : 'share.start')}
                    </Button>
                </Stack>
            </Paper>
        </Centered>
    );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Stack
        sx={{
            minHeight: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2,
        }}
    >
        {children}
    </Stack>
);

export default SharePage;
