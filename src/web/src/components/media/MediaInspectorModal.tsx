import React, { useEffect, useState } from 'react';
import {
    Box,
    Card,
    Divider,
    IconButton,
    Modal,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import { useTranslation } from 'next-i18next';
import { type MediaDoc } from '../../lib/api/caspar';

interface Props {
    doc: MediaDoc | null;
    onClose: () => void;
}

function fmtDuration(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);
    const H = h.toString().padStart(2, '0');
    const M = m.toString().padStart(2, '0');
    const S = s.toString().padStart(2, '0');
    const MS = ms.toString().padStart(3, '0');
    return h > 0 ? `${H}:${M}:${S}.${MS}` : `${M}:${S}.${MS}`;
}

function fmtBytes(bytes: number): string {
    if (bytes >= 1_073_741_824)
        return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
}

function fmtBitrate(bps: number): string {
    if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
    if (bps >= 1000) return `${(bps / 1000).toFixed(0)} kbps`;
    return `${bps} bps`;
}

const MetaRow: React.FC<{ label: string; value: string }> = ({
    label,
    value,
}) => (
    <Stack direction="row" gap={1} alignItems="baseline">
        <Typography
            variant="caption"
            sx={{ color: 'text.disabled', minWidth: 90, flexShrink: 0 }}
        >
            {label}
        </Typography>
        <Typography
            variant="caption"
            sx={{ color: 'text.primary', wordBreak: 'break-all' }}
        >
            {value}
        </Typography>
    </Stack>
);

const MediaInspectorModal: React.FC<Props> = ({ doc, onClose }) => {
    const { t } = useTranslation('common');
    const [videoError, setVideoError] = useState(false);

    useEffect(() => {
        setVideoError(false);
    }, [doc?.id]);

    const info = doc?.mediainfo;
    const videoStream = info?.streams.find(s => s.codec?.type === 'video');
    const audioStream = info?.streams.find(s => s.codec?.type === 'audio');

    const fps =
        videoStream?.nb_frames &&
        videoStream?.duration &&
        parseFloat(videoStream.nb_frames) > 0 &&
        parseFloat(videoStream.duration) > 0
            ? (
                  parseFloat(videoStream.nb_frames) /
                  parseFloat(videoStream.duration)
              ).toFixed(3)
            : null;

    const src = doc
        ? `/api/caspar/media/raw/${encodeURIComponent(doc.id)}`
        : '';

    // ffprobe reports still images (png/jpg/gif) as a single video stream
    // with no audio and effectively no duration — mirror the scanner's
    // STILL-vs-MOVIE heuristic (dur <= 1/24, see scanner.ts) so images
    // render in an <img> rather than a <video> that can't play them.
    const rawDuration = info?.format?.duration ?? videoStream?.duration;
    const parsedDuration = rawDuration == null ? null : Number(rawDuration);
    const durationSecs =
        parsedDuration != null && Number.isFinite(parsedDuration)
            ? parsedDuration
            : null;
    const isImage =
        Boolean(doc) &&
        Boolean(videoStream) &&
        !audioStream &&
        (durationSecs == null || durationSecs <= 1 / 24);

    return (
        <Modal open={Boolean(doc)} onClose={onClose}>
            <Card
                sx={theme => ({
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(1200px, 90vw)',
                    height: 'min(700px, 85vh)',
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: theme.palette.surface.elevated,
                    border: `1px solid ${theme.palette.divider}`,
                })}
            >
                {/* Header */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={2}
                    sx={theme => ({
                        px: 3,
                        py: 1.5,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        flexShrink: 0,
                    })}
                >
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant="h3" noWrap>
                            {doc?.id ?? ''}
                        </Typography>
                        <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('media.inspector.subtitle')}
                        </Typography>
                    </Stack>
                    <Tooltip title={t('actions.close')}>
                        <IconButton
                            onClick={onClose}
                            sx={{ color: 'text.secondary', flexShrink: 0 }}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Body */}
                <Stack
                    direction="row"
                    sx={{ flexGrow: 1, minHeight: 0 }}
                    divider={<Divider orientation="vertical" flexItem />}
                >
                    {/* Player */}
                    <Box
                        sx={{
                            flex: '1 1 60%',
                            minWidth: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'black',
                            p: 0,
                        }}
                    >
                        {videoError ? (
                            <Stack
                                alignItems="center"
                                spacing={1}
                                sx={{ color: 'rgba(255,255,255,0.4)', p: 3 }}
                            >
                                <BrokenImageOutlinedIcon
                                    sx={{ fontSize: 48 }}
                                />
                                <Typography
                                    variant="body2"
                                    textAlign="center"
                                    sx={{ color: 'rgba(255,255,255,0.4)' }}
                                >
                                    {t('media.inspector.notPreviewable')}
                                </Typography>
                            </Stack>
                        ) : isImage ? (
                            <Box
                                component="img"
                                src={src}
                                alt={doc?.id}
                                onError={() => setVideoError(true)}
                                sx={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />
                        ) : (
                            <Box
                                component="video"
                                src={src}
                                controls
                                preload="metadata"
                                onError={() => setVideoError(true)}
                                sx={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />
                        )}
                    </Box>

                    {/* Metadata */}
                    <Box
                        sx={{
                            flex: '0 0 300px',
                            overflowY: 'auto',
                            p: 2.5,
                        }}
                    >
                        <Stack spacing={0.75}>
                            <Typography
                                variant="overline"
                                sx={{ color: 'text.disabled', lineHeight: 1 }}
                            >
                                {t('media.inspector.sectionFile')}
                            </Typography>

                            {doc?.mediaSize != null && (
                                <MetaRow
                                    label={t('media.inspector.fileSize')}
                                    value={fmtBytes(doc.mediaSize)}
                                />
                            )}
                            {info?.format?.duration != null && (
                                <MetaRow
                                    label={t('media.inspector.duration')}
                                    value={fmtDuration(info.format.duration)}
                                />
                            )}
                            {info?.format?.long_name && (
                                <MetaRow
                                    label={t('media.inspector.format')}
                                    value={info.format.long_name}
                                />
                            )}
                            {info?.format?.bit_rate != null &&
                                info.format.bit_rate > 0 && (
                                    <MetaRow
                                        label={t('media.inspector.bitrate')}
                                        value={fmtBitrate(info.format.bit_rate)}
                                    />
                                )}

                            {videoStream && (
                                <>
                                    <Box pt={1}>
                                        <Typography
                                            variant="overline"
                                            sx={{
                                                color: 'text.disabled',
                                                lineHeight: 1,
                                            }}
                                        >
                                            {t('media.inspector.sectionVideo')}
                                        </Typography>
                                    </Box>

                                    {videoStream.width != null &&
                                        videoStream.height != null && (
                                            <MetaRow
                                                label={t(
                                                    'media.inspector.resolution',
                                                )}
                                                value={`${videoStream.width}×${videoStream.height}`}
                                            />
                                        )}
                                    {videoStream.codec?.long_name && (
                                        <MetaRow
                                            label={t('media.inspector.codec')}
                                            value={videoStream.codec.long_name}
                                        />
                                    )}
                                    {fps && (
                                        <MetaRow
                                            label={t('media.inspector.fps')}
                                            value={fps}
                                        />
                                    )}
                                    {videoStream.pix_fmt && (
                                        <MetaRow
                                            label={t('media.inspector.pixFmt')}
                                            value={videoStream.pix_fmt}
                                        />
                                    )}
                                </>
                            )}

                            {audioStream && (
                                <>
                                    <Box pt={1}>
                                        <Typography
                                            variant="overline"
                                            sx={{
                                                color: 'text.disabled',
                                                lineHeight: 1,
                                            }}
                                        >
                                            {t('media.inspector.sectionAudio')}
                                        </Typography>
                                    </Box>

                                    {audioStream.codec?.long_name && (
                                        <MetaRow
                                            label={t('media.inspector.codec')}
                                            value={audioStream.codec.long_name}
                                        />
                                    )}
                                    {audioStream.sample_rate != null && (
                                        <MetaRow
                                            label={t(
                                                'media.inspector.sampleRate',
                                            )}
                                            value={`${audioStream.sample_rate} Hz`}
                                        />
                                    )}
                                    {audioStream.channels != null && (
                                        <MetaRow
                                            label={t(
                                                'media.inspector.channels',
                                            )}
                                            value={
                                                audioStream.channel_layout
                                                    ? `${audioStream.channels} (${audioStream.channel_layout})`
                                                    : String(
                                                          audioStream.channels,
                                                      )
                                            }
                                        />
                                    )}
                                </>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </Card>
        </Modal>
    );
};

export default MediaInspectorModal;
