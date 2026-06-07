import React, { useState } from 'react';
import {
    Button,
    Card,
    FormControlLabel,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Trans, useTranslation } from 'next-i18next';
import { useStoredBoolean } from '../../lib/hooks/useStoredBoolean';
import { ArtnetCanvas, type Fixture } from './ArtnetCanvas';
import { ARTNET_SCALAR_FIELDS, Fields, type RecordData } from './fields';
import { newFixture, fixtureSummary } from './artnet/fixtureHelpers';
import { FixtureDetails } from './artnet/FixtureDetails';
import { FixtureRow } from './artnet/FixtureRow';
import { UniversesInput } from './artnet/UniversesInput';

interface ArtnetData extends RecordData {
    universes?: number[];
    fixtures?: Fixture[];
}

interface ArtnetEditorProps {
    data: ArtnetData;
    canvasWidth: number;
    canvasHeight: number;
    /** 1-based CG channel to stream as the stage backdrop. Falsy disables. */
    previewChannel?: number | null;
    onChange: (data: ArtnetData) => void;
}

const PREVIEW_PREF_KEY = 'artnet-editor-preview';

export const ArtnetEditor: React.FC<ArtnetEditorProps> = ({
    data,
    canvasWidth,
    canvasHeight,
    previewChannel,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const fixtures = data.fixtures ?? [];
    const [selected, setSelected] = useState<number | null>(null);
    const [showPreview, setShowPreview] = useStoredBoolean(
        PREVIEW_PREF_KEY,
        false,
    );

    const updateData = (key: string, value: any) =>
        onChange({ ...data, [key]: value });

    const updateFixture = (i: number, key: string, value: any) => {
        const next = fixtures.map((f, idx) =>
            idx === i ? { ...f, [key]: value } : f,
        );
        onChange({ ...data, fixtures: next });
    };

    const updateFixtures = (next: Fixture[]) =>
        onChange({ ...data, fixtures: next });

    const addFixture = () => {
        const next = [...fixtures, newFixture(canvasWidth, canvasHeight)];
        onChange({ ...data, fixtures: next });
        setSelected(next.length - 1);
    };

    const removeFixture = (i: number) => {
        const next = fixtures.filter((_, idx) => idx !== i);
        onChange({ ...data, fixtures: next });
        if (selected === i) setSelected(null);
        else if (selected !== null && selected > i) setSelected(selected - 1);
    };

    const selectedFixture = selected !== null ? fixtures[selected] : null;

    return (
        <Stack spacing={3}>
            <Card
                variant="outlined"
                sx={theme => ({
                    p: 2,
                    bgcolor: theme.palette.surface.elevated,
                })}
            >
                <Stack spacing={2}>
                    <Typography variant="h4">
                        {t('config.artnet.output')}
                    </Typography>
                    <UniversesInput
                        universes={data.universes ?? []}
                        onChange={next =>
                            onChange({ ...data, universes: next })
                        }
                    />
                    <Fields
                        fields={ARTNET_SCALAR_FIELDS}
                        data={data}
                        onChange={updateData}
                    />
                </Stack>
            </Card>

            <Stack
                direction={{ xs: 'column', lg: 'row' }}
                gap={3}
                alignItems="flex-start"
            >
                <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                    {previewChannel != null && (
                        <Stack direction="row" justifyContent="flex-end">
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showPreview}
                                        onChange={e =>
                                            setShowPreview(e.target.checked)
                                        }
                                    />
                                }
                                label={
                                    <Typography variant="caption">
                                        {t('config.artnet.livePreview', {
                                            channel: previewChannel,
                                        })}
                                    </Typography>
                                }
                                labelPlacement="start"
                                sx={{
                                    m: 0,
                                    '& .MuiFormControlLabel-label': {
                                        color: 'text.secondary',
                                    },
                                }}
                            />
                        </Stack>
                    )}
                    <ArtnetCanvas
                        fixtures={fixtures}
                        canvasWidth={canvasWidth}
                        canvasHeight={canvasHeight}
                        selectedIndex={selected}
                        onSelect={setSelected}
                        onChange={updateFixtures}
                        previewChannel={showPreview ? previewChannel : null}
                    />
                </Stack>

                <Stack
                    spacing={2}
                    sx={{ width: { xs: '100%', lg: 480 }, flexShrink: 0 }}
                >
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
                            onClick={addFixture}
                        >
                            {t('actions.add')}
                        </Button>
                    </Stack>

                    {fixtures.length === 0 ? (
                        <Typography
                            variant="body2"
                            sx={{ color: 'text.secondary' }}
                        >
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
                                    label={fixtureSummary(fixture, i)}
                                    selected={i === selected}
                                    onSelect={() => setSelected(i)}
                                    onDelete={() => removeFixture(i)}
                                />
                            ))}
                        </Stack>
                    )}

                    {selectedFixture && selected !== null && (
                        <FixtureDetails
                            index={selected}
                            fixture={selectedFixture}
                            onChange={(k, v) => updateFixture(selected, k, v)}
                            onDelete={() => removeFixture(selected)}
                        />
                    )}
                </Stack>
            </Stack>
        </Stack>
    );
};
