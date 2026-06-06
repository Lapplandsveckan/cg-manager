import React from 'react';
import {Box, Card, CardActionArea, Modal, Stack, Typography, alpha} from '@mui/material';
import {useTranslation} from 'next-i18next';
import {CONSUMER_TYPES, type ConsumerType, formatConsumerType} from './fields';

interface ConsumerTypePickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (type: ConsumerType) => void;
}

export const ConsumerTypePicker: React.FC<ConsumerTypePickerProps> = ({open, onClose, onSelect}) => {
    const {t} = useTranslation('common');
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
                <Card sx={{p: 3}}>
                    <Stack spacing={3}>
                        <Stack spacing={1}>
                            <Typography variant="h3">{t('config.consumers.pickerTitle')}</Typography>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                {t('config.consumers.pickerDescription')}
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
                                            <Typography variant="h4">
                                                {t(`config.consumers.types.${type}`, {
                                                    defaultValue: formatConsumerType(type),
                                                })}
                                            </Typography>
                                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                                {t(`config.consumers.descriptions.${type}`)}
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
