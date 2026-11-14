import React from 'react';
import {
    Box,
    Card,
    CardActionArea,
    Modal,
    Stack,
    Typography,
    alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { type VideoRouteSource } from '../api';
import { useRouteSourceTypesQuery } from '../query';

export type SourceType = VideoRouteSource['type'];

interface RouteSourceTypePickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (type: SourceType) => void;
}

interface Tile {
    type: string;
    label: string;
    description: string;
}

const BUILTIN: SourceType[] = ['decklink', 'video', 'channel', 'color'];

export const RouteSourceTypePicker: React.FC<RouteSourceTypePickerProps> = ({
    open,
    onClose,
    onSelect,
}) => {
    const { t } = useTranslation('routes');
    const { data: contributed } = useRouteSourceTypesQuery();

    const tiles: Tile[] = [
        ...BUILTIN.map(type => ({
            type,
            label: t(`sourceTypes.${type}`),
            description: t(`sourceTypeDescriptions.${type}`),
        })),
        ...(contributed ?? []).map(entry => ({
            type: entry.type,
            label: t(entry.label, { defaultValue: entry.label }),
            description: entry.description
                ? t(entry.description, { defaultValue: entry.description })
                : t('sourceTypeDescriptions.contributed', {
                      plugin: entry.plugin,
                  }),
        })),
    ];

    return (
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
                <Card sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        <Stack spacing={1}>
                            <Typography variant="h3">
                                {t('picker.title')}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('picker.description')}
                            </Typography>
                        </Stack>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: 1.5,
                            }}
                        >
                            {tiles.map(tile => (
                                <Card
                                    key={tile.type}
                                    variant="outlined"
                                    sx={theme => ({
                                        bgcolor: theme.palette.surface.elevated,
                                        transition: theme.transitions.create(
                                            [
                                                'background-color',
                                                'border-color',
                                            ],
                                            {
                                                duration: 120,
                                            },
                                        ),
                                        '&:hover': {
                                            borderColor:
                                                theme.palette.primary.main,
                                            bgcolor: alpha(
                                                theme.palette.primary.main,
                                                0.08,
                                            ),
                                        },
                                    })}
                                >
                                    <CardActionArea
                                        onClick={() => onSelect(tile.type)}
                                        sx={{
                                            p: 2,
                                            height: '100%',
                                            alignItems: 'flex-start',
                                        }}
                                    >
                                        <Stack
                                            spacing={0.5}
                                            sx={{
                                                textAlign: 'left',
                                                width: '100%',
                                            }}
                                        >
                                            <Typography variant="h4">
                                                {tile.label}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={{ color: 'text.secondary' }}
                                            >
                                                {tile.description}
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
};
