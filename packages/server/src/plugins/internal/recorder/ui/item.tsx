import React from 'react';
import { Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
    entry: {
        data?: { channel?: number; presetId?: string; durationSec?: number };
    };
}

const RecordChannelItem: React.FC<Props> = ({ entry }) => {
    const { t } = useTranslation('recorder');
    const { channel, presetId, durationSec } = entry?.data ?? {};

    if (!channel || !presetId)
        return (
            <Typography
                variant="body2"
                sx={{ color: 'text.secondary', fontStyle: 'italic' }}
            >
                {t('item.unconfigured')}
            </Typography>
        );

    return (
        <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">
                {t('channelN', { n: channel })}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                ·
            </Typography>
            <Typography variant="body2">
                {t(`presets.${presetId}`, presetId)}
            </Typography>
            {durationSec ? (
                <>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        ·
                    </Typography>
                    <Typography variant="body2">
                        {t('item.durationLabel', {
                            count: durationSec,
                        })}
                    </Typography>
                </>
            ) : null}
        </Stack>
    );
};

export default RecordChannelItem;
