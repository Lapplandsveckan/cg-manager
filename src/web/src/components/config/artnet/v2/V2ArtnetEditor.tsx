import React from 'react';
import { FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { useStoredBoolean } from '../../../../lib/hooks/useStoredBoolean';
import { OutputCard } from '../shared/OutputCard';
import { FixturePanel } from '../shared/FixturePanel';
import { useFixtureList } from '../shared/useFixtureList';
import { fixtureSummary } from '../shared/fixtureSummary';
import { newFixture } from './v2Fixture';
import { ArtnetCanvas } from './ArtnetCanvas';
import { UniversesInput } from './UniversesInput';
import { V2FixtureDetails } from './V2FixtureDetails';
import { type ArtnetVariantEditorProps, type V2Fixture } from '../types';

const PREVIEW_PREF_KEY = 'artnet-editor-preview';

export const V2ArtnetEditor: React.FC<ArtnetVariantEditorProps> = ({
    data,
    onChange,
    canvasWidth,
    canvasHeight,
    previewChannel,
}) => {
    const { t } = useTranslation('common');
    const [showPreview, setShowPreview] = useStoredBoolean(
        PREVIEW_PREF_KEY,
        false,
    );
    const {
        fixtures,
        selected,
        setSelected,
        addFixture,
        removeFixture,
        updateFixture,
        updateFixtures,
    } = useFixtureList<V2Fixture>(data, onChange, () =>
        newFixture(canvasWidth, canvasHeight),
    );

    return (
        <Stack spacing={3}>
            <OutputCard
                data={data}
                onChange={(key, value) => onChange({ ...data, [key]: value })}
            >
                <UniversesInput
                    universes={(data as any).universes ?? []}
                    onChange={next => onChange({ ...data, universes: next })}
                />
            </OutputCard>

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

                <FixturePanel
                    fixtures={fixtures}
                    selected={selected}
                    onAdd={addFixture}
                    onSelect={setSelected}
                    onDelete={removeFixture}
                    summary={fixtureSummary}
                    renderDetails={(i, f) => (
                        <V2FixtureDetails
                            index={i}
                            fixture={f as V2Fixture}
                            onChange={(k, v) => updateFixture(i, k, v)}
                            onDelete={() => removeFixture(i)}
                        />
                    )}
                    sx={{ width: { xs: '100%', lg: 480 }, flexShrink: 0 }}
                />
            </Stack>
        </Stack>
    );
};
