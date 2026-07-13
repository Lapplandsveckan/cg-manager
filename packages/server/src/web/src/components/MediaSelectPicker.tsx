import {
    Box,
    Button,
    Card,
    IconButton,
    Modal,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { type MediaDoc } from '../lib/api/caspar';
import { MediaCard } from './MediaCard';
import { MediaView } from './MediaView';

// Split out of MediaView.tsx to keep that file under the project's
// max-lines cap — this is the read-only clip picker modal, unrelated to
// the browsing/selection logic that lives in MediaView itself.

interface MediaSelectProps {
    clip?: MediaDoc | null;
    onClipSelect: (clip: MediaDoc) => void;
}

const MediaSelectCrumb: React.FC<{
    label: React.ReactNode;
    onClick: () => void;
    active?: boolean;
}> = ({ label, onClick, active }) => (
    <Box
        component="button"
        onClick={onClick}
        sx={theme => ({
            appearance: 'none',
            background: 'transparent',
            border: 'none',
            padding: '4px 8px',
            borderRadius: 1,
            cursor: 'pointer',
            color: active
                ? theme.palette.text.primary
                : theme.palette.text.secondary,
            fontWeight: active ? 600 : 400,
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            display: 'inline-flex',
            alignItems: 'center',
            '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.text.primary,
            },
        })}
    >
        {label}
    </Box>
);

interface MediaSelectBreadcrumbProps {
    path: string;
    onNavigate: (next: string) => void;
}

const MediaSelectBreadcrumb: React.FC<MediaSelectBreadcrumbProps> = ({
    path,
    onNavigate,
}) => {
    const segments = path.split('/').filter(Boolean);
    return (
        <Stack direction="row" alignItems="center" gap={0.25} flexWrap="wrap">
            <MediaSelectCrumb
                label={
                    <HomeRoundedIcon
                        fontSize="small"
                        sx={{ display: 'block' }}
                    />
                }
                onClick={() => onNavigate('')}
                active={segments.length === 0}
            />
            {segments.map((segment, index) => (
                <React.Fragment key={index}>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled' }}
                    >
                        /
                    </Typography>
                    <MediaSelectCrumb
                        label={segment}
                        onClick={() =>
                            onNavigate(
                                `${segments.slice(0, index + 1).join('/')}/`,
                            )
                        }
                        active={index === segments.length - 1}
                    />
                </React.Fragment>
            ))}
        </Stack>
    );
};

export const MediaSelect: React.FC<MediaSelectProps> = ({
    clip,
    onClipSelect,
}) => {
    const { t } = useTranslation('common');
    const [open, setOpen] = useState<boolean>(false);
    const [path, setPath] = useState<string>('');

    // Reset the folder navigation each time the modal reopens so picking again
    // doesn't drop the user wherever they last browsed.
    useEffect(() => {
        if (!open) setPath('');
    }, [open]);

    const data = useMemo(() => {
        if (!clip?.id) return null;

        const background = clip._attachments?.['thumb.png'];
        const url = background
            ? `data:${background.content_type};base64,${Buffer.from(background.data).toString('base64')}`
            : 'https://via.placeholder.com/1920x1080';

        return {
            name: clip.id,
            duration: clip.mediainfo?.format?.duration ?? 0,
            backgroundUrl: url,
        };
    }, [clip]);

    return (
        <>
            <Stack spacing={1}>
                {data ? (
                    <MediaCard
                        {...data}
                        columns={1}
                        onClick={() => setOpen(true)}
                    />
                ) : (
                    <Box
                        onClick={() => setOpen(true)}
                        sx={theme => ({
                            aspectRatio: '16/9',
                            border: `1px dashed ${theme.palette.divider}`,
                            borderRadius: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: theme.transitions.create(
                                ['border-color', 'background-color'],
                                {
                                    duration: 120,
                                },
                            ),
                            '&:hover': {
                                borderColor: alpha(
                                    theme.palette.primary.main,
                                    0.45,
                                ),
                                bgcolor: theme.palette.surface.elevated,
                            },
                        })}
                    >
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('media.select.empty')}
                        </Typography>
                    </Box>
                )}
                <Button
                    variant="outlined"
                    color="inherit"
                    size="small"
                    onClick={() => setOpen(true)}
                >
                    {data ? t('media.select.change') : t('media.select.select')}
                </Button>
            </Stack>

            <Modal open={open} onClose={() => setOpen(false)}>
                <Card
                    sx={theme => ({
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',

                        width: 'min(1100px, 85vw)',
                        height: 'min(720px, 75vh)',
                        display: 'flex',
                        flexDirection: 'column',

                        bgcolor: theme.palette.surface.elevated,
                        border: `1px solid ${theme.palette.divider}`,
                    })}
                >
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                        sx={theme => ({
                            px: 3,
                            py: 2,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            flexShrink: 0,
                        })}
                    >
                        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                            <Typography variant="h3">
                                {t('media.select.modalTitle')}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('media.select.modalSubtitle')}
                            </Typography>
                        </Stack>
                        <Tooltip title={t('actions.close')}>
                            <IconButton
                                onClick={() => setOpen(false)}
                                sx={{ color: 'text.secondary' }}
                            >
                                <CloseRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>

                    <Box
                        sx={theme => ({
                            px: 3,
                            py: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            flexShrink: 0,
                        })}
                    >
                        <MediaSelectBreadcrumb
                            path={path}
                            onNavigate={setPath}
                        />
                    </Box>

                    <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 3 }}>
                        <MediaView
                            columns={4}
                            prefix={path}
                            showAsDirectories
                            onNavigate={folder => setPath(`${path}${folder}/`)}
                            onClipSelect={clip => {
                                setOpen(false);
                                onClipSelect?.(clip);
                            }}
                        />
                    </Box>
                </Card>
            </Modal>
        </>
    );
};
