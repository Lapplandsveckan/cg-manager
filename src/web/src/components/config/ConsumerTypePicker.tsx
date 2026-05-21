import React from 'react';
import {Box, Card, CardActionArea, Modal, Stack, Typography, alpha} from '@mui/material';
import {CONSUMER_TYPES, ConsumerType} from './fields';

interface ConsumerTypePickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (type: ConsumerType) => void;
}

interface TypeMeta {
    title: string;
    description: string;
}

const TYPE_META: Record<ConsumerType, TypeMeta> = {
    decklink: {
        title: 'Decklink',
        description: 'Blackmagic Decklink SDI output.',
    },
    bluefish: {
        title: 'Bluefish',
        description: 'Bluefish444 SDI output.',
    },
    screen: {
        title: 'Screen',
        description: 'On-screen window or fullscreen monitor.',
    },
    'system-audio': {
        title: 'System audio',
        description: 'Default system audio device.',
    },
    ndi: {
        title: 'NDI',
        description: 'NDI network video output.',
    },
    ffmpeg: {
        title: 'FFmpeg',
        description: 'Pipe to FFmpeg — files, RTMP, custom args.',
    },
    artnet: {
        title: 'Art-Net',
        description: 'DMX lighting via Art-Net.',
    },
};

export const ConsumerTypePicker: React.FC<ConsumerTypePickerProps> = ({open, onClose, onSelect}) => (
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
                        <Typography variant="h3">Add consumer</Typography>
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            Pick a consumer type. You'll be able to fill in its settings next.
                        </Typography>
                    </Stack>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 1.5,
                        }}
                    >
                        {CONSUMER_TYPES.map((type) => (
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
