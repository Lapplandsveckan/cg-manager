import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Trans, useTranslation } from 'next-i18next';
import { FixtureRow } from './FixtureRow';
import { type BaseFixture } from '../types';

interface FixturePanelProps {
    fixtures: BaseFixture[];
    selected: number | null;
    onAdd: () => void;
    onSelect: (i: number) => void;
    onDelete: (i: number) => void;
    summary: (fixture: BaseFixture, index: number) => string;
    renderDetails?: (index: number, fixture: BaseFixture) => React.ReactNode;
    sx?: object;
}

export const FixturePanel: React.FC<FixturePanelProps> = ({
    fixtures,
    selected,
    onAdd,
    onSelect,
    onDelete,
    summary,
    renderDetails,
    sx,
}) => {
    const { t } = useTranslation('common');
    return (
        <Stack spacing={2} sx={sx}>
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
            >
                <Typography variant="h4">
                    {t('config.artnet.fixtures')}
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddRoundedIcon />}
                    onClick={onAdd}
                >
                    {t('actions.add')}
                </Button>
            </Stack>

            {fixtures.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    <Trans
                        i18nKey="config.artnet.fixturesEmpty"
                        ns="common"
                        components={{ em: <em /> }}
                    />
                </Typography>
            ) : (
                <Stack spacing={0.5}>
                    {fixtures.map((fixture, i) => (
                        <FixtureRow
                            key={i}
                            label={summary(fixture, i)}
                            selected={i === selected}
                            onSelect={() => onSelect(i)}
                            onDelete={() => onDelete(i)}
                        />
                    ))}
                </Stack>
            )}

            {selected !== null &&
                fixtures[selected] !== undefined &&
                renderDetails?.(selected, fixtures[selected])}
        </Stack>
    );
};
