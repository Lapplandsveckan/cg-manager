import React, { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Card,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'react-i18next';
import {
    sessionThumbnailPath,
    type IngestSession,
} from '../../../../../web/src/lib/api/ingest';

interface SessionCardProps {
    session: IngestSession;
    onAir: boolean;
    busy: boolean;
    onToggle: () => void;
    onClose: () => void;
}

const THUMBNAIL_INTERVAL_MS = 5000;

/** The sender posts a frame every few seconds; nothing pushes it, so the card
 *  re-requests on its own while the session is live. */
function useThumbnailUrl(session: IngestSession) {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (session.state !== 'live') return;

        const timer = setInterval(
            () => setTick(current => current + 1),
            THUMBNAIL_INTERVAL_MS,
        );
        return () => clearInterval(timer);
    }, [session.state]);

    return `${sessionThumbnailPath(session.id)}?v=${tick}`;
}

export const SessionCard: React.FC<SessionCardProps> = ({
    session,
    onAir,
    busy,
    onToggle,
    onClose,
}) => {
    const { t } = useTranslation('screenshare');
    const [hasThumbnail, setHasThumbnail] = useState(false);
    const thumbnail = useThumbnailUrl(session);

    return (
        <Card
            variant="outlined"
            sx={theme => ({
                overflow: 'hidden',
                borderColor: onAir ? theme.palette.primary.main : undefined,
            })}
        >
            <Box
                sx={{
                    position: 'relative',
                    aspectRatio: '16 / 9',
                    bgcolor: 'common.black',
                }}
            >
                <Stack
                    sx={{ position: 'absolute', inset: 0 }}
                    alignItems="center"
                    justifyContent="center"
                >
                    <Typography variant="caption" color="text.disabled">
                        {t('sessions.noPreview')}
                    </Typography>
                </Stack>
                {/* Stays mounted through a 404: the first frames only land a
                    few seconds in, and every retry is a new `src`. */}
                <Box
                    component="img"
                    src={thumbnail}
                    alt=""
                    onError={() => setHasThumbnail(false)}
                    onLoad={() => setHasThumbnail(true)}
                    sx={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        display: hasThumbnail ? 'block' : 'none',
                    }}
                />
                {onAir && (
                    <Chip
                        size="small"
                        color="primary"
                        label={t('sessions.onAir')}
                        sx={{ position: 'absolute', top: 8, left: 8 }}
                    />
                )}
            </Box>

            <Stack spacing={1} sx={{ p: 1.5 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                >
                    <Typography variant="h4" noWrap title={session.label}>
                        {session.label}
                    </Typography>
                    <Tooltip title={t('sessions.disconnect')}>
                        <IconButton size="small" onClick={onClose}>
                            <CloseRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Stack direction="row" gap={0.5} flexWrap="wrap">
                    <Chip
                        size="small"
                        label={t(`sessions.state.${session.state}`)}
                        color={session.state === 'live' ? 'success' : 'default'}
                    />
                    <Chip
                        size="small"
                        variant="outlined"
                        label={t(
                            session.hasAudio
                                ? 'sessions.audio'
                                : 'sessions.noAudio',
                        )}
                    />
                </Stack>

                <Button
                    size="small"
                    fullWidth
                    disabled={busy}
                    variant={onAir ? 'outlined' : 'contained'}
                    onClick={onToggle}
                >
                    {t(onAir ? 'sessions.hide' : 'sessions.show')}
                </Button>
            </Stack>
        </Card>
    );
};
