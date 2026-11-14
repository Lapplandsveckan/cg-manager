import React, { useState } from 'react';
import {
    Box,
    Button,
    Divider,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import LinkIcon from '@mui/icons-material/Link';
import {
    SlotErrorBoundary,
    useChannelInfo,
    useScreenCapture,
    useSocket,
    useToast,
} from '@web-lib';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import {
    operatorWhipPath,
    sessionThumbnailPath,
    type IngestSession,
} from '../../../../web/src/lib/api/ingest';
import {
    closeSession,
    createShare,
    hideSession,
    revokeShare,
    showSession,
    useIngestSessions,
    useShareLinks,
    useShownSessions,
} from './data';
import { tileTransform } from './grid';
import { SessionCard } from './components/SessionCard';
import { ShareCard } from './components/ShareCard';
import { ShareQrDialog } from './components/ShareQrDialog';
import {
    DestinationField,
    effectLayerOf,
    type Destination,
} from './components/DestinationField';

const DEFAULT_DESTINATION: Destination = { channel: '1', group: 'screenshare' };

const guestUrl = (path?: string | null) =>
    path ? `${window.location.origin}${path}` : null;

const ScreensharePage: React.FC = () => {
    const conn = useSocket();
    const { t } = useTranslation('screenshare');
    const notify = useToast();
    const { channels } = useChannelInfo();

    const { sessions } = useIngestSessions();
    const { shares } = useShareLinks();
    const { shown, refresh: refreshShown } = useShownSessions(sessions);

    const [destination, setDestination] =
        useState<Destination>(DEFAULT_DESTINATION);
    const [label, setLabel] = useState('');
    const [maxSessions, setMaxSessions] = useState('1');
    const [busy, setBusy] = useState(false);
    const [qrShare, setQrShare] = useState<string | null>(null);

    const capture = useScreenCapture({
        endpoint: operatorWhipPath(t('local.title')),
        thumbnailEndpoint: sessionThumbnailPath,
    });

    const run = async (action: () => Promise<unknown>, errorKey: string) => {
        setBusy(true);
        const [err] = await noTryAsync(action);
        setBusy(false);
        await refreshShown();

        if (err) notify(t(errorKey), 'error');
    };

    const toggleShown = (session: IngestSession) =>
        run(
            () =>
                shown.includes(session.id)
                    ? hideSession(conn, session.id)
                    : showSession(conn, session.id, {
                          effectLayer: effectLayerOf(destination),
                      }),
            'errors.showFailed',
        );

    const showWall = () => {
        const live = sessions.filter(session => session.state === 'live');

        return run(
            () =>
                Promise.all(
                    live.map((session, index) =>
                        showSession(conn, session.id, {
                            effectLayer: effectLayerOf(destination),
                            transform: tileTransform(index, live.length),
                        }),
                    ),
                ),
            'errors.showFailed',
        );
    };

    const clearScreen = () =>
        run(
            () => Promise.all(shown.map(id => hideSession(conn, id))),
            'errors.showFailed',
        );

    const onCreateShare = () =>
        run(async () => {
            await createShare(conn, {
                label: label || undefined,
                maxSessions: Number(maxSessions) || 1,
            });
            setLabel('');
        }, 'errors.createFailed');

    const copyLink = async (path?: string | null) => {
        const url = guestUrl(path);
        if (!url) return;

        const [err] = await noTryAsync(() =>
            navigator.clipboard.writeText(url),
        );
        if (err) return notify(url, 'info');

        notify(t('shares.copied'), 'success');
    };

    const usedBy = (shareId: string) =>
        sessions.filter(session => session.shareId === shareId).length;

    const qrLink = shares.find(share => share.id === qrShare);

    return (
        <Box sx={{ p: 3 }}>
            <Stack spacing={4}>
                <Stack spacing={1}>
                    <Typography variant="h1">{t('nav')}</Typography>
                    <Typography variant="body1" color="text.secondary">
                        {t('description')}
                    </Typography>
                </Stack>

                <SlotErrorBoundary label="screenshare-sessions">
                    <Stack spacing={2}>
                        <Typography variant="h3">
                            {t('sessions.title')}
                        </Typography>

                        <Stack
                            direction="row"
                            gap={1.5}
                            flexWrap="wrap"
                            alignItems="center"
                        >
                            <DestinationField
                                value={destination}
                                channels={channels}
                                onChange={setDestination}
                            />
                            <Button
                                variant="outlined"
                                startIcon={<GridViewRoundedIcon />}
                                disabled={busy || !sessions.length}
                                onClick={() => void showWall()}
                            >
                                {t('sessions.showWall')}
                            </Button>
                            <Button
                                color="inherit"
                                disabled={busy || !shown.length}
                                onClick={() => void clearScreen()}
                            >
                                {t('sessions.clear')}
                            </Button>
                        </Stack>

                        {!sessions.length && (
                            <Typography variant="body2" color="text.secondary">
                                {t('sessions.empty')}
                            </Typography>
                        )}

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'repeat(auto-fill, minmax(240px, 1fr))',
                                gap: 2,
                            }}
                        >
                            {sessions.map(session => (
                                <SlotErrorBoundary
                                    key={session.id}
                                    label={`screenshare-session:${session.id}`}
                                    resetKeys={[session.id]}
                                >
                                    <SessionCard
                                        session={session}
                                        onAir={shown.includes(session.id)}
                                        busy={busy}
                                        onToggle={() =>
                                            void toggleShown(session)
                                        }
                                        onClose={() =>
                                            void run(
                                                () =>
                                                    closeSession(
                                                        conn,
                                                        session.id,
                                                    ),
                                                'errors.showFailed',
                                            )
                                        }
                                    />
                                </SlotErrorBoundary>
                            ))}
                        </Box>
                    </Stack>
                </SlotErrorBoundary>

                <Divider />

                <SlotErrorBoundary label="screenshare-shares">
                    <Stack spacing={2}>
                        <Typography variant="h3">
                            {t('shares.title')}
                        </Typography>

                        <Stack direction="row" gap={1} flexWrap="wrap">
                            <TextField
                                size="small"
                                label={t('shares.label')}
                                placeholder={t('shares.labelPlaceholder')}
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                            />
                            <TextField
                                size="small"
                                type="number"
                                label={t('shares.maxSessions')}
                                value={maxSessions}
                                onChange={e => setMaxSessions(e.target.value)}
                                inputProps={{ min: 1, max: 50, step: 1 }}
                                sx={{ width: 120 }}
                            />
                            <Button
                                variant="contained"
                                startIcon={<LinkIcon />}
                                disabled={busy}
                                onClick={() => void onCreateShare()}
                            >
                                {t('shares.create')}
                            </Button>
                        </Stack>

                        {!shares.length && (
                            <Typography variant="body2" color="text.secondary">
                                {t('shares.empty')}
                            </Typography>
                        )}

                        <Stack spacing={1} sx={{ maxWidth: 720 }}>
                            {shares.map(share => (
                                <ShareCard
                                    key={share.id}
                                    share={share}
                                    used={usedBy(share.id)}
                                    onCopy={() => void copyLink(share.path)}
                                    onQr={() => setQrShare(share.id)}
                                    onRevoke={() =>
                                        void run(
                                            () => revokeShare(conn, share.id),
                                            'errors.revokeFailed',
                                        )
                                    }
                                />
                            ))}
                        </Stack>
                    </Stack>
                </SlotErrorBoundary>

                <Divider />

                <SlotErrorBoundary label="screenshare-local">
                    <Stack spacing={1} alignItems="flex-start">
                        <Typography variant="h3">{t('local.title')}</Typography>
                        <Button
                            variant="contained"
                            color={
                                capture.state === 'live' ? 'error' : 'primary'
                            }
                            startIcon={
                                capture.state === 'live' ? (
                                    <StopScreenShareIcon />
                                ) : (
                                    <ScreenShareIcon />
                                )
                            }
                            disabled={capture.state === 'starting'}
                            onClick={() =>
                                capture.state === 'live'
                                    ? capture.stop()
                                    : void capture.start()
                            }
                        >
                            {t(
                                capture.state === 'live'
                                    ? 'local.stop'
                                    : 'local.start',
                            )}
                        </Button>
                        {capture.error && (
                            <Typography variant="body2" color="error">
                                {capture.error}
                            </Typography>
                        )}
                    </Stack>
                </SlotErrorBoundary>
            </Stack>

            <ShareQrDialog
                url={guestUrl(qrLink?.path)}
                label={qrLink?.label ?? ''}
                onClose={() => setQrShare(null)}
            />
        </Box>
    );
};

export const meta = {
    label: 'screenshare:nav',
    icon: ScreenShareIcon,
};

export default ScreensharePage;
