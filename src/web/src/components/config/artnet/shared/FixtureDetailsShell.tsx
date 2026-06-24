import React from 'react';
import { Card, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from 'next-i18next';
import { ScalarField } from '../../fields';
import { buildSharedFixtureFields } from './fixtureFields';
import { type BaseFixture } from '../types';

interface FixtureDetailsShellProps {
    index: number;
    fixture: BaseFixture;
    onChange: (key: string, value: any) => void;
    onDelete: () => void;
    children: React.ReactNode;
}

export const FixtureDetailsShell: React.FC<FixtureDetailsShellProps> = ({
    index,
    fixture,
    onChange,
    onDelete,
    children,
}) => {
    const { t } = useTranslation('common');
    const F = buildSharedFixtureFields(t);

    return (
        <Card
            variant="outlined"
            sx={theme => ({ p: 2, bgcolor: theme.palette.surface.elevated })}
        >
            <Stack spacing={1.5}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Typography variant="body1">
                        {t('config.artnet.fixtureN', { n: index + 1 })}
                    </Typography>
                    <Tooltip title={t('actions.delete')}>
                        <IconButton size="small" onClick={onDelete}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <ScalarField
                    def={F.TYPE_FIELD as any}
                    value={fixture.type}
                    onChange={v => onChange('type', v)}
                />

                <Stack direction="row" gap={1.5}>
                    <ScalarField
                        def={F.START_ADDRESS_FIELD as any}
                        value={fixture.startAddress}
                        onChange={v => onChange('startAddress', v)}
                    />
                    <ScalarField
                        def={F.CHANNELS_FIELD as any}
                        value={fixture.fixtureChannels}
                        onChange={v => onChange('fixtureChannels', v)}
                    />
                </Stack>

                {children}
            </Stack>
        </Card>
    );
};
