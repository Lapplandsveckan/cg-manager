import React from 'react';
import { FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { useStoredBoolean } from '../../../../lib/hooks/useStoredBoolean';
import { ScalarField } from '../../fields';
import { OutputCard } from '../shared/OutputCard';
import { FixturePanel } from '../shared/FixturePanel';
import { useFixtureList } from '../shared/useFixtureList';
import { fixtureSummary } from '../shared/fixtureSummary';
import { newFixtureLegacy } from './legacyFixture';
import { LegacyFixtureDetails } from './LegacyFixtureDetails';
import { ArtnetCanvas } from '../v2/ArtnetCanvas';
import {
    type ArtnetVariantEditorProps,
    type LegacyFixture,
    type V2Fixture,
} from '../types';

const PREVIEW_PREF_KEY = 'artnet-legacy-editor-preview';

// Legacy CasparCG artnet config stores <x>/<y> as the CENTER of the fixture
// region in canvas-pixel space. The v2 canvas uses left/top (top-left corner).
// These adapters convert between the two so the visual editor stays in sync
// with what gets written to the config file.

const toCanvasFixtures = (fixtures: LegacyFixture[]): V2Fixture[] =>
    fixtures.map(
        ({ x, y, ...rest }) =>
            ({
                ...rest,
                left: (x ?? 0) - (rest.width ?? 100) / 2,
                top: (y ?? 0) - (rest.height ?? 100) / 2,
            }) as unknown as V2Fixture,
    );

const fromCanvasFixtures = (
    v2: V2Fixture[],
    originals: LegacyFixture[],
): LegacyFixture[] =>
    v2.map(
        ({ left, top, ...rest }, i) =>
            ({
                ...originals[i],
                ...rest,
                x: (left ?? 0) + (rest.width ?? 100) / 2,
                y: (top ?? 0) + (rest.height ?? 100) / 2,
            }) as LegacyFixture,
    );

export const LegacyArtnetEditor: React.FC<ArtnetVariantEditorProps> = ({
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
    } = useFixtureList<LegacyFixture>(data, onChange, newFixtureLegacy);

    const handleCanvasChange = (v2: V2Fixture[]) => {
        updateFixtures(fromCanvasFixtures(v2, fixtures));
    };

    return (
        <Stack spacing={3}>
            <OutputCard
                data={data}
                onChange={(key, value) => onChange({ ...data, [key]: value })}
            >
                <ScalarField
                    def={
                        {
                            key: 'universe',
                            label: t('config.artnet.universe'),
                            type: 'integer',
                        } as any
                    }
                    value={(data as any).universe}
                    onChange={v => onChange({ ...data, universe: v })}
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
                        fixtures={toCanvasFixtures(fixtures)}
                        canvasWidth={canvasWidth}
                        canvasHeight={canvasHeight}
                        selectedIndex={selected}
                        onSelect={setSelected}
                        onChange={handleCanvasChange}
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
                        <LegacyFixtureDetails
                            index={i}
                            fixture={f as LegacyFixture}
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
