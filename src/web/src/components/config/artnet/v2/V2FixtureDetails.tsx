import React from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Stack,
    Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { useTranslation } from 'next-i18next';
import { ScalarField } from '../../fields';
import { FixtureDetailsShell } from '../shared/FixtureDetailsShell';
import { buildSharedFixtureFields } from '../shared/fixtureFields';
import { buildV2FixtureFields } from './v2Fixture';
import { FixtureCountInput } from './FixtureCountInput';
import { type V2Fixture } from '../types';

interface V2FixtureDetailsProps {
    index: number;
    fixture: V2Fixture;
    onChange: (key: string, value: any) => void;
    onDelete: () => void;
}

export const V2FixtureDetails: React.FC<V2FixtureDetailsProps> = ({
    index,
    fixture,
    onChange,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const S = buildSharedFixtureFields(t);
    const V = buildV2FixtureFields(t);
    const flux = (fixture.flux ?? {}) as Record<string, number | undefined>;

    const updateFlux = (k: string, v: any) => {
        const next = { ...flux, [k]: v };
        const isEmpty = Object.values(next).every(
            x => x === undefined || x === '',
        );
        onChange('flux', isEmpty ? undefined : next);
    };

    return (
        <FixtureDetailsShell
            index={index}
            fixture={fixture}
            onChange={onChange}
            onDelete={onDelete}
        >
            <ScalarField
                def={V.HOST_FIELD as any}
                value={fixture.host}
                onChange={v => onChange('host', v)}
            />
            <Stack direction="row" gap={1.5}>
                <ScalarField
                    def={V.PORT_FIELD as any}
                    value={fixture.port}
                    onChange={v => onChange('port', v)}
                />
                <ScalarField
                    def={V.UNIVERSE_FIELD as any}
                    value={fixture.universe}
                    onChange={v => onChange('universe', v)}
                />
            </Stack>
            <FixtureCountInput
                value={fixture.fixtureCount}
                onChange={v => onChange('fixtureCount', v)}
            />
            <Stack direction="row" gap={1.5}>
                <ScalarField
                    def={V.LEFT_FIELD as any}
                    value={fixture.left}
                    onChange={v => onChange('left', v)}
                />
                <ScalarField
                    def={V.TOP_FIELD as any}
                    value={fixture.top}
                    onChange={v => onChange('top', v)}
                />
            </Stack>
            <Stack direction="row" gap={1.5}>
                <ScalarField
                    def={S.WIDTH_FIELD as any}
                    value={fixture.width}
                    onChange={v => onChange('width', v)}
                />
                <ScalarField
                    def={S.HEIGHT_FIELD as any}
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
                    <Stack spacing={1.5}>
                        <Stack spacing={1}>
                            <Typography
                                variant="caption"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('config.artnet.fluxHelp')}
                            </Typography>
                            <Stack direction="row" gap={1.5}>
                                {V.FLUX_FIELDS.map(def => (
                                    <ScalarField
                                        key={def.key}
                                        def={def as any}
                                        value={flux[def.key]}
                                        onChange={v => updateFlux(def.key, v)}
                                    />
                                ))}
                            </Stack>
                        </Stack>
                        <Stack direction="row" gap={1.5}>
                            <ScalarField
                                def={V.BRIGHTNESS_FIELD as any}
                                value={fixture.brightness}
                                onChange={v => onChange('brightness', v)}
                            />
                            <ScalarField
                                def={V.ROTATION_FIELD as any}
                                value={fixture.rotation}
                                onChange={v => onChange('rotation', v)}
                            />
                        </Stack>
                        <Stack direction="row" gap={1.5}>
                            <ScalarField
                                def={V.MIRROR_X_FIELD as any}
                                value={fixture.mirrorX}
                                onChange={v => onChange('mirrorX', v)}
                            />
                            <ScalarField
                                def={V.MIRROR_Y_FIELD as any}
                                value={fixture.mirrorY}
                                onChange={v => onChange('mirrorY', v)}
                            />
                        </Stack>
                    </Stack>
                </AccordionDetails>
            </Accordion>
        </FixtureDetailsShell>
    );
};
