import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LinkIcon from '@mui/icons-material/Link';
import {
    SlotErrorBoundary,
    useBroadcast,
    useScreenCapture,
    useSocket,
    useToast,
} from '@web-lib';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import {
    operatorWhipPath,
    type IngestSession,
    type ShareLink,
} from '../../../../web/src/lib/api/ingest';
import { API_ROOT, sessionsUpdated, sharesUpdated } from './api';

const DEFAULT_GROUP = '1:screenshare';

const ScreensharePage: React.FC = () => {
    const conn = useSocket();
    const { t } = useTranslation('screenshare');
    const notify = useToast();

    const [sessions, setSessions] = useState<IngestSession[]>([]);
    const [shares, setShares] = useState<ShareLink[]>([]);
    const [shown, setShown] = useState<string[]>([]);
    const [label, setLabel] = useState('');
    const [group, setGroup] = useState(DEFAULT_GROUP);

    const refreshShown = useCallback(async () => {
        const [, ids] = await noTryAsync(() =>
            conn.rawRequest(`${API_ROOT}/shown`, 'GET', null),
        );
        if (Array.isArray(ids)) setShown(ids as string[]);
    }, [conn]);

    const refresh = useCallback(async () => {
        const [, loaded] = await noTryAsync(() =>
            Promise.all([
                conn.rawRequest(`${API_ROOT}/sessions`, 'GET', null),
                conn.rawRequest(`${API_ROOT}/shares`, 'GET', null),
            ]),
        );
        if (loaded) {
            setSessions(loaded[0] as IngestSession[]);
            setShares(loaded[1] as ShareLink[]);
        }
        await refreshShown();
    }, [conn, refreshShown]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    useBroadcast(sessionsUpdated, data => {
        setSessions(data);
        void refreshShown();
    });
    useBroadcast(sharesUpdated, setShares);

    const capture = useScreenCapture({
        endpoint: operatorWhipPath(t('local.title')),
    });

    const createShare = async () => {
        const [err] = await noTryAsync(() =>
            conn.rawRequest(`${API_ROOT}/shares`, 'CREATE', {
                label: label || undefined,
            }),
        );
        if (err) return notify(t('errors.createFailed'), 'error');

        setLabel('');
    };

    const revokeShare = (id: string) =>
        void conn.rawRequest(`${API_ROOT}/shares/${id}`, 'DELETE', null);

    const copyLink = async (share: ShareLink) => {
        const url = `${window.location.origin}${share.path ?? ''}`;
        const [err] = await noTryAsync(() =>
            navigator.clipboard.writeText(url),
        );
        if (err) return notify(url, 'info');

        notify(t('shares.copied'), 'success');
    };

    const toggleShown = async (session: IngestSession) => {
        const live = shown.includes(session.id);
        const path = `${API_ROOT}/sessions/${session.id}/${live ? 'hide' : 'show'}`;
        const [err] = await noTryAsync(() =>
            conn.rawRequest(
                path,
                'ACTION',
                live ? null : { effectLayer: group },
            ),
        );
        if (err) return notify(t('errors.showFailed'), 'error');

        await refreshShown();
    };

    return (
        <Box sx={{ p: 3 }}>
            <Stack spacing={4}>
                <SlotErrorBoundary label="screenshare-sessions">
                    <Stack spacing={1}>
                        <Typography variant="h6">
                            {t('sessions.title')}
                        </Typography>
                        <TextField
                            size="small"
                            label={t('editor.destination')}
                            helperText={t('editor.destinationHint')}
                            value={group}
                            onChange={e => setGroup(e.target.value)}
                            sx={{ maxWidth: 260 }}
                        />
                        {!sessions.length && (
                            <Typography variant="body2" color="text.secondary">
                                {t('sessions.empty')}
                            </Typography>
                        )}
                        <List dense>
                            {sessions.map(session => (
                                <ListItem
                                    key={session.id}
                                    secondaryAction={
                                        <Button
                                            size="small"
                                            variant={
                                                shown.includes(session.id)
                                                    ? 'outlined'
                                                    : 'contained'
                                            }
                                            onClick={() =>
                                                void toggleShown(session)
                                            }
                                        >
                                            {t(
                                                shown.includes(session.id)
                                                    ? 'sessions.hide'
                                                    : 'sessions.show',
                                            )}
                                        </Button>
                                    }
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                alignItems="center"
                                            >
                                                <span>{session.label}</span>
                                                <Chip
                                                    size="small"
                                                    label={t(
                                                        `sessions.state.${session.state}`,
                                                    )}
                                                    color={
                                                        session.state === 'live'
                                                            ? 'success'
                                                            : 'default'
                                                    }
                                                />
                                                {shown.includes(session.id) && (
                                                    <Chip
                                                        size="small"
                                                        color="primary"
                                                        label={t(
                                                            'sessions.onAir',
                                                        )}
                                                    />
                                                )}
                                            </Stack>
                                        }
                                        secondary={t(
                                            session.hasAudio
                                                ? 'sessions.audio'
                                                : 'sessions.noAudio',
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Stack>
                </SlotErrorBoundary>

                <Divider />

                <SlotErrorBoundary label="screenshare-shares">
                    <Stack spacing={1}>
                        <Typography variant="h6">
                            {t('shares.title')}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <TextField
                                size="small"
                                label={t('shares.label')}
                                placeholder={t('shares.labelPlaceholder')}
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                            />
                            <Button
                                variant="contained"
                                startIcon={<LinkIcon />}
                                onClick={() => void createShare()}
                            >
                                {t('shares.create')}
                            </Button>
                        </Stack>
                        {!shares.length && (
                            <Typography variant="body2" color="text.secondary">
                                {t('shares.empty')}
                            </Typography>
                        )}
                        <List dense>
                            {shares.map(share => (
                                <ListItem
                                    key={share.id}
                                    secondaryAction={
                                        <Stack direction="row" spacing={0.5}>
                                            <Tooltip title={t('shares.copy')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        void copyLink(share)
                                                    }
                                                >
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={t('shares.revoke')}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        revokeShare(share.id)
                                                    }
                                                >
                                                    <DeleteOutlineRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    }
                                >
                                    <ListItemText
                                        primary={share.label}
                                        secondary={share.path}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </Stack>
                </SlotErrorBoundary>

                <Divider />

                <SlotErrorBoundary label="screenshare-local">
                    <Stack spacing={1} alignItems="flex-start">
                        <Typography variant="h6">{t('local.title')}</Typography>
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
        </Box>
    );
};

export const meta = {
    label: 'screenshare:nav',
    icon: ScreenShareIcon,
};

export default ScreensharePage;
