import React from 'react';
import {Box, Card, CardActionArea, Modal, Stack, Typography, alpha} from '@mui/material';
import {VideoRouteSource} from '../../lib/api/videoRoutes';

export type SourceType = VideoRouteSource['type'];

interface RouteSourceTypePickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (type: SourceType) => void;
}

interface TypeMeta {
    title: string;
    description: string;
}

const TYPES: SourceType[] = ['decklink', 'video', 'channel', 'color'];

const TYPE_META: Record<SourceType, TypeMeta> = {
    decklink: {
        title: 'Decklink',
        description: 'Blackmagic Decklink SDI input (optional fill+key).',
    },
    video: {
        title: 'Video file',
        description: 'Looping clip from the media library.',
    },
    channel: {
        title: 'Channel',
        description: 'Route the output of another CasparCG channel.',
    },
    color: {
        title: 'Color',
        description: 'Solid color fill (CSS name or #RRGGBB).',
    },
};

export const RouteSourceTypePicker: React.FC<RouteSourceTypePickerProps> = ({open, onClose, onSelect}) => (
    <Modal open={open} onClose={onClose}>
        <Box
            sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(720px, 95vw)',
                maxHeight: '90vh',
                overflowY: 'auto',
            }}
        >
            <Card sx={{p: 3}}>
                <Stack spacing={3}>
                    <Stack spacing={1}>
                        <Typography variant="h3">Add route</Typography>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            Pick a source type. You&apos;ll fill in its details and the destination next.
                        </Typography>
                    </Stack>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 1.5,
                        }}
                    >
                        {TYPES.map((type) => (
                            <Card
                                key={type}
                                variant="outlined"
                                sx={(theme) => ({
                                    bgcolor: theme.palette.surface.elevated,
                                    transition: theme.transitions.create(
                                        ['background-color', 'border-color'],
                                        {duration: 120},
                                    ),
                                    '&:hover': {
                                        borderColor: theme.palette.primary.main,
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                    },
                                })}
                            >
                                <CardActionArea
                                    onClick={() => onSelect(type)}
                                    sx={{p: 2, height: '100%', alignItems: 'flex-start'}}
                                >
                                    <Stack spacing={0.5} sx={{textAlign: 'left', width: '100%'}}>
                                        <Typography variant="h4">{TYPE_META[type].title}</Typography>
                                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                            {TYPE_META[type].description}
                                        </Typography>
                                    </Stack>
                                </CardActionArea>
                            </Card>
                        ))}
                    </Box>
                </Stack>
            </Card>
        </Box>
    </Modal>
);
