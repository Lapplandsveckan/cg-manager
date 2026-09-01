import React from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useTranslation } from 'react-i18next';
import { type useConfigDraft } from '../../../lib/config/useConfigDraft';
import { type useConsumerEditor } from '../../../lib/config/useConsumerEditor';
import { SimpleChannelCard } from './SimpleChannelCard';

interface SimpleConfigProps {
    config: ReturnType<typeof useConfigDraft>;
    consumers: ReturnType<typeof useConsumerEditor>;
    onGoAdvanced: () => void;
}

export const SimpleConfig: React.FC<SimpleConfigProps> = ({
    config,
    consumers,
    onGoAdvanced,
}) => {
    const { t } = useTranslation('common');
    if (!config.draft) return null;
    const { channels, videoModes } = config.draft;

    return (
        <Stack spacing={3}>
            <Stack spacing={0.5}>
                <Typography variant="h2">
                    {t('config.simple.intro.title')}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    {t('config.simple.intro.body')}
                </Typography>
            </Stack>

            {channels.length === 0 ? (
                <Alert severity="warning" variant="outlined">
                    {t('config.simple.channels.empty')}
                </Alert>
            ) : (
                <Stack spacing={2}>
                    {channels.map((channel, i) => (
                        <SimpleChannelCard
                            key={i}
                            channel={channel}
                            index={i}
                            videoModes={videoModes}
                            onChange={c => config.updateChannel(i, c)}
                            onDelete={() => config.deleteChannel(i)}
                            onEditConsumer={consumerIndex =>
                                consumers.editConsumer(i, consumerIndex)
                            }
                            onAddConsumer={() => consumers.startPicking(i)}
                            onDeleteConsumer={consumerIndex =>
                                consumers.deleteConsumerAt(i, consumerIndex)
                            }
                            onGoAdvanced={onGoAdvanced}
                        />
                    ))}
                </Stack>
            )}

            <Button
                startIcon={<AddRoundedIcon />}
                variant="outlined"
                onClick={config.addChannel}
                sx={{ alignSelf: 'flex-start' }}
            >
                {t('config.simple.channel.add')}
            </Button>

            <Card variant="outlined" sx={{ p: 2.5 }}>
                <Stack spacing={0.5}>
                    <Typography variant="h4">
                        {t('config.simple.footer.title')}
                    </Typography>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('config.simple.footer.body')}
                    </Typography>
                    <Box>
                        <Button onClick={onGoAdvanced} sx={{ pl: 0 }}>
                            {t('config.simple.footer.button')}
                        </Button>
                    </Box>
                </Stack>
            </Card>
        </Stack>
    );
};
