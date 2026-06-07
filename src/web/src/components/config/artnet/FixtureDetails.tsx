import React from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Card,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'next-i18next';
import { type Fixture } from '../ArtnetCanvas';
import { ScalarField } from '../fields';
import { buildFixtureFields } from './fixtureHelpers';
import { FixtureCountInput } from './FixtureCountInput';

interface FixtureDetailsProps {
    index: number;
    fixture: Fixture;
    onChange: (key: string, value: any) => void;
    onDelete: () => void;
}

export const FixtureDetails: React.FC<FixtureDetailsProps> = ({
    index,
    fixture,
    onChange,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const F = buildFixtureFields(t);
    const flux = (fixture.flux ?? {}) as Record<string, number | undefined>;
    const updateFlux = (k: string, v: any) => {
        const next = { ...flux, [k]: v };
        const isEmpty = Object.values(next).every(
            x => x === undefined || x === '',
        );
        onChange('flux', isEmpty ? undefined : next);
    };

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

                <FixtureCountInput
                    value={fixture.fixtureCount}
                    onChange={v => onChange('fixtureCount', v)}
                />

                <Stack direction="row" gap={1.5}>
                    <ScalarField
                        def={F.LEFT_FIELD as any}
                        value={fixture.left}
                        onChange={v => onChange('left', v)}
                    />
                    <ScalarField
                        def={F.TOP_FIELD as any}
                        value={fixture.top}
                        onChange={v => onChange('top', v)}
                    />
                </Stack>
                <Stack direction="row" gap={1.5}>
                    <ScalarField
                        def={F.WIDTH_FIELD as any}
                        value={fixture.width}
                        onChange={v => onChange('width', v)}
                    />
                    <ScalarField
                        def={F.HEIGHT_FIELD as any}
                        value={fixture.height}
                        onChange={v => onChange('height', v)}
                    />
                </Stack>

                <Accordion
                    disableGutters
                    elevation={0}
                    sx={theme => ({
                        bgcolor: 'transparent',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        '&::before': { display: 'none' },
                    })}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreRoundedIcon fontSize="small" />}
                        sx={{
                            minHeight: 36,
                            '& .MuiAccordionSummary-content': { my: 0.5 },
                        }}
                    >
                        <Typography variant="body2">
                            {t('config.advanced')}
                        </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack spacing={1}>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('config.artnet.fluxHelp')}
                            </Typography>
                            <Stack direction="row" gap={1.5}>
                                {F.FLUX_FIELDS.map(def => (
                                    <ScalarField
                                        key={def.key}
                                        def={def as any}
                                        value={flux[def.key]}
                                        onChange={v => updateFlux(def.key, v)}
                                    />
                                ))}
                            </Stack>
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            </Stack>
        </Card>
    );
};
